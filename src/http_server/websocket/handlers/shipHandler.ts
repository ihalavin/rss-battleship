import { db, sendMessage } from '../websocketHandler.js';
import { wss } from '../../index.js';
import { PlayerWebSocket, Ship, GamePlayer, Game, ShipData } from '../../../types.js';

// Ship types and their lengths
const SHIP_TYPES: Record<string, number> = {
  small: 1,
  medium: 2,
  large: 3,
  huge: 4
};

// Handle ship requests
export function handleShipRequests(ws: PlayerWebSocket, type: string, data: ShipData, id: number): void {
  if (type === 'add_ships') {
    addShips(ws, data);
  }
}

// Add ships to the game board
function addShips(ws: PlayerWebSocket, data: ShipData): void {
  const { gameId, ships, indexPlayer } = data;

  // Find the game
  const game = db.games.find(g => g.gameId === gameId);
  if (!game) {
    sendMessage(ws, 'add_ships', {
      error: true,
      errorText: 'Game not found'
    });
    return;
  }

  // Find the player in the game
  const playerIndex = game.players.findIndex(p => p.idPlayer === indexPlayer);
  if (playerIndex === -1) {
    sendMessage(ws, 'add_ships', {
      error: true,
      errorText: 'Player not found in the game'
    });
    return;
  }

  // Validate ships
  if (!validateShips(ships)) {
    sendMessage(ws, 'add_ships', {
      error: true,
      errorText: 'Invalid ships configuration'
    });
    return;
  }

  // Add ships to the player's board
  game.players[playerIndex].ships = ships;
  game.players[playerIndex].ready = true;

  // Place ships on the board
  placeShipsOnBoard(game.players[playerIndex]);

  // Check if both players are ready
  if (game.players.every(p => p.ready)) {
    startGame(game);
  } else {
    // Send start_game message to the player who just added ships
    sendMessage(ws, 'start_game', {
      ships: ships,
      currentPlayerIndex: playerIndex
    });
  }
}

// Validate ships configuration
function validateShips(ships: Ship[]): boolean {
  // Check if all required ships are present
  const requiredShips: Record<string, number> = {
    small: 4,
    medium: 3,
    large: 2,
    huge: 1
  };

  const shipCounts: Record<string, number> = {
    small: 0,
    medium: 0,
    large: 0,
    huge: 0
  };

  for (const ship of ships) {
    shipCounts[ship.type]++;
  }

  for (const type in requiredShips) {
    if (shipCounts[type] !== requiredShips[type]) {
      return false;
    }
  }

  // Check if ships are within bounds and don't overlap
  const board: number[][] = Array(10).fill(0).map(() => Array(10).fill(0));

  for (const ship of ships) {
    const { position, direction, length } = ship;
    const { x, y } = position;

    // Check if ship is within bounds
    if (x < 0 || x >= 10 || y < 0 || y >= 10) {
      return false;
    }

    // Check if ship extends beyond the board
    if (!direction && x + length > 10) {
      return false;
    }

    if (direction && y + length > 10) {
      return false;
    }

    // Check if ship overlaps with another ship or is adjacent to another ship
    for (let i = -1; i <= length; i++) {
      for (let j = -1; j <= 1; j++) {
        const checkX = direction ? x + j : x + i;
        const checkY = direction ? y + i : y + j;

        if (checkX >= 0 && checkX < 10 && checkY >= 0 && checkY < 10) {
          if (board[checkY][checkX] === 1) {
            // If checking ship position (not surroundings) - fail if overlapping
            if (i >= 0 && i < length && j === 0) {
              return false;
            }
            // If checking surroundings - fail if adjacent
            if (!(i >= 0 && i < length && j === 0)) {
              return false;
            }
          }
        }
      }
    }

    // Place ship on the board for validation
    for (let i = 0; i < length; i++) {
      const placeX = direction ? x : x + i;
      const placeY = direction ? y + i : y;
      board[placeY][placeX] = 1;
    }
  }

  return true;
}

// Place ships on the player's board
function placeShipsOnBoard(player: GamePlayer): void {
  // Reset the board
  player.board = Array(10).fill(0).map(() => Array(10).fill(0));

  // Place ships on the board
  for (const ship of player.ships) {
    const { position, direction, length } = ship;
    const { x, y } = position;

    for (let i = 0; i < length; i++) {
      const placeX = direction ? x : x + i;
      const placeY = direction ? y + i : y;
      player.board[placeY][placeX] = 1; // 1 represents a ship cell
    }
  }
}

// Start the game when both players are ready
function startGame(game: Game): void {
  // Set the current player (randomly choose who goes first)
  game.currentPlayer = Math.random() < 0.5 ? 0 : 1;
  game.status = 'playing' as 'playing';

  // Send start_game message to both players
  wss.clients.forEach(client => {
    const playerClient = client as PlayerWebSocket;
    const playerIndex = game.players.findIndex(p =>
      p.playerIndex === playerClient.indexPlayer
    );

    if (playerIndex !== -1) {
      sendMessage(playerClient, 'start_game', {
        ships: game.players[playerIndex].ships,
        currentPlayerIndex: game.players[playerIndex].idPlayer
      });

      // Send turn message
      sendMessage(playerClient, 'turn', {
        currentPlayer: game.players[game.currentPlayer].idPlayer
      });
    }
  });
}
