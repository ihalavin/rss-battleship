import { db, sendMessage } from '../websocketHandler.js';
import { wss } from '../../index.js';
import { updatePlayerWins } from './playerHandler.js';
import { PlayerWebSocket, Game, GamePlayer, AttackData, Ship } from '../../../types.js';

// Handle game requests
export function handleGameRequests(ws: PlayerWebSocket, type: string, data: AttackData, id: number): void {
  switch (type) {
    case 'attack':
      handleAttack(ws, data);
      break;
    case 'randomAttack':
      handleRandomAttack(ws, data);
      break;
  }
}

// Handle attack request
function handleAttack(ws: PlayerWebSocket, data: AttackData): void {
  const { gameId, x, y, indexPlayer } = data;

  // Find the game
  const game = db.games.find(g => g.gameId === gameId);
  if (!game) {
    sendMessage(ws, 'attack', {
      error: true,
      errorText: 'Game not found'
    });
    return;
  }

  // Check if game is in playing state
  if (game.status !== 'playing') {
    sendMessage(ws, 'attack', {
      error: true,
      errorText: 'Game is not in playing state'
    });
    return;
  }

  // Find the player in the game
  const attackerIndex = game.players.findIndex(p => p.idPlayer === indexPlayer);
  if (attackerIndex === -1) {
    sendMessage(ws, 'attack', {
      error: true,
      errorText: 'Player not found in the game'
    });
    return;
  }

  // Check if it's the player's turn
  if (game.currentPlayer !== attackerIndex) {
    sendMessage(ws, 'attack', {
      error: true,
      errorText: 'Not your turn'
    });
    return;
  }

  // Get the opponent
  const defenderIndex = attackerIndex === 0 ? 1 : 0;
  const defender = game.players[defenderIndex];

  // Check if the coordinates are valid
  if (x < 0 || x >= 10 || y < 0 || y >= 10) {
    sendMessage(ws, 'attack', {
      error: true,
      errorText: 'Invalid coordinates'
    });
    return;
  }

  // Check if the cell has already been attacked
  if (defender.board[y][x] === 2 || defender.board[y][x] === 3) {
    sendMessage(ws, 'attack', {
      error: true,
      errorText: 'Cell already attacked'
    });
    return;
  }

  // Process the attack
  processAttack(game, attackerIndex, defenderIndex, x, y);
}

// Handle random attack request
function handleRandomAttack(ws: PlayerWebSocket, data: AttackData): void {
  const { gameId, indexPlayer } = data;

  // Find the game
  const game = db.games.find(g => g.gameId === gameId);
  if (!game) {
    sendMessage(ws, 'randomAttack', {
      error: true,
      errorText: 'Game not found'
    });
    return;
  }

  // Check if game is in playing state
  if (game.status !== 'playing') {
    sendMessage(ws, 'randomAttack', {
      error: true,
      errorText: 'Game is not in playing state'
    });
    return;
  }

  // Find the player in the game
  const attackerIndex = game.players.findIndex(p => p.idPlayer === indexPlayer);
  if (attackerIndex === -1) {
    sendMessage(ws, 'randomAttack', {
      error: true,
      errorText: 'Player not found in the game'
    });
    return;
  }

  // Check if it's the player's turn
  if (game.currentPlayer !== attackerIndex) {
    sendMessage(ws, 'randomAttack', {
      error: true,
      errorText: 'Not your turn'
    });
    return;
  }

  // Get the opponent
  const defenderIndex = attackerIndex === 0 ? 1 : 0;
  const defender = game.players[defenderIndex];

  // Find a random cell that hasn't been attacked yet
  const availableCells: { x: number, y: number }[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (defender.board[y][x] === 0 || defender.board[y][x] === 1) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) {
    sendMessage(ws, 'randomAttack', {
      error: true,
      errorText: 'No available cells to attack'
    });
    return;
  }

  // Choose a random cell
  const randomIndex = Math.floor(Math.random() * availableCells.length);
  const { x, y } = availableCells[randomIndex];

  // Process the attack
  processAttack(game, attackerIndex, defenderIndex, x, y);
}

// Process an attack
function processAttack(game: Game, attackerIndex: number, defenderIndex: number, x: number, y: number): void {
  const attacker = game.players[attackerIndex];
  const defender = game.players[defenderIndex];

  // Check if the cell contains a ship
  const isHit = defender.board[y][x] === 1;

  if (isHit) {
    // Mark the cell as hit
    defender.board[y][x] = 2; // 2 represents a hit

    // Check if the ship is sunk
    const isSunk = checkIfShipIsSunk(defender, x, y);

    if (isSunk) {
      // Mark all cells around the ship as missed
      markCellsAroundShip(defender, x, y);

      // Send attack message to both players
      sendAttackMessage(game, attackerIndex, x, y, 'killed');

      // Check if all ships are sunk
      if (checkIfAllShipsSunk(defender)) {
        // Game over, attacker wins
        game.status = 'finished';

        // Send finish message to both players
        wss.clients.forEach(client => {
          const playerClient = client as PlayerWebSocket;
          const playerIndex = game.players.findIndex(p =>
            p.playerIndex === playerClient.indexPlayer
          );

          if (playerIndex !== -1) {
            sendMessage(playerClient, 'finish', {
              winPlayer: attacker.idPlayer
            });
          }
        });

        // Update player wins
        updatePlayerWins(attacker.playerIndex);
        db.rooms = [];
      } else {
        // Attacker gets another turn
        sendTurnMessage(game);
      }
    } else {
      // Send attack message to both players
      sendAttackMessage(game, attackerIndex, x, y, 'shot');

      // Attacker gets another turn
      sendTurnMessage(game);
    }
  } else {
    // Mark the cell as missed
    defender.board[y][x] = 3; // 3 represents a miss

    // Send attack message to both players
    sendAttackMessage(game, attackerIndex, x, y, 'miss');

    // Switch turns
    game.currentPlayer = defenderIndex;
    sendTurnMessage(game);
  }
}

// Check if a ship is sunk
function checkIfShipIsSunk(player: GamePlayer, hitX: number, hitY: number): boolean {
  // Find the ship that was hit
  const hitShip = player.ships.find(ship => {
    const { position, direction, length } = ship;
    const { x, y } = position;

    for (let i = 0; i < length; i++) {
      const shipX = direction ? x : x + i;
      const shipY = direction ? y + i : y;

      if (shipX === hitX && shipY === hitY) {
        return true;
      }
    }

    return false;
  });

  if (!hitShip) {
    return false;
  }

  // Check if all cells of the ship are hit
  const { position, direction, length } = hitShip;
  const { x, y } = position;

  for (let i = 0; i < length; i++) {
    const shipX = direction ? x : x + i;
    const shipY = direction ? y + i : y;

    if (player.board[shipY][shipX] !== 2) {
      return false;
    }
  }

  return true;
}

// Mark all cells around a sunk ship as missed
function markCellsAroundShip(player: GamePlayer, hitX: number, hitY: number): void {
  // Find the ship that was hit
  const hitShip = player.ships.find(ship => {
    const { position, direction, length } = ship;
    const { x, y } = position;

    for (let i = 0; i < length; i++) {
      const shipX = direction ? x : x + i;
      const shipY = direction ? y + i : y;

      if (shipX === hitX && shipY === hitY) {
        return true;
      }
    }

    return false;
  });

  if (!hitShip) {
    return;
  }

  // Mark all cells around the ship as missed
  const { position, direction, length } = hitShip;
  const { x, y } = position;

  for (let i = -1; i <= length; i++) {
    for (let j = -1; j <= 1; j++) {
      const checkX = direction ? x + j : x + i;
      const checkY = direction ? y + i : y + j;

      if (checkX >= 0 && checkX < 10 && checkY >= 0 && checkY < 10) {
        if (i >= 0 && i < length && j === 0) {
          // Ship cell, already marked as hit
        } else {
          // Adjacent cell, mark as missed
          if (player.board[checkY][checkX] === 0) {
            player.board[checkY][checkX] = 3;
          }
        }
      }
    }
  }
}

// Check if all ships are sunk
function checkIfAllShipsSunk(player: GamePlayer): boolean {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (player.board[y][x] === 1) {
        return false;
      }
    }
  }

  return true;
}

// Send attack message to both players
function sendAttackMessage(game: Game, attackerIndex: number, x: number, y: number, status: string): void {
  wss.clients.forEach(client => {
    const playerClient = client as PlayerWebSocket;
    const playerIndex = game.players.findIndex(p =>
      p.playerIndex === playerClient.indexPlayer
    );

    if (playerIndex !== -1) {
      sendMessage(playerClient, 'attack', {
        position: { x, y },
        currentPlayer: game.players[attackerIndex].idPlayer,
        status
      });
    }
  });
}

// Send turn message to both players
function sendTurnMessage(game: Game): void {
  wss.clients.forEach(client => {
    const playerClient = client as PlayerWebSocket;
    const playerIndex = game.players.findIndex(p =>
      p.playerIndex === playerClient.indexPlayer
    );

    if (playerIndex !== -1) {
      sendMessage(playerClient, 'turn', {
        currentPlayer: game.players[game.currentPlayer].idPlayer
      });
    }
  });
}