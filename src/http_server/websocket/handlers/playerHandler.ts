import { db, sendMessage, broadcastUpdateWinners } from '../websocketHandler.js';
import { wss } from '../../index.js';
import { PlayerWebSocket, RegData, RegResponse } from '../../../types.js';

// Generate a unique player index
function generatePlayerIndex(): string {
  return Date.now().toString();
}

// Handle player registration/login
export function handlePlayerRequests(ws: PlayerWebSocket, type: string, data: RegData, id: number): void {
  if (type === 'reg') {
    const { name, password } = data;

    // Check if player already exists
    const existingPlayer = db.players.find(player => player.name === name);

    if (existingPlayer) {
      // Login existing player
      if (existingPlayer.password === password) {
        // Store player index in the WebSocket connection
        ws.indexPlayer = existingPlayer.index;

        // Send success response
        sendMessage(ws, 'reg', {
          name: existingPlayer.name,
          index: existingPlayer.index,
          error: false,
          errorText: ''
        } as RegResponse);
      } else {
        // Send error response for incorrect password
        sendMessage(ws, 'reg', {
          name,
          index: '',
          error: true,
          errorText: 'Incorrect password'
        } as RegResponse);
      }
    } else {
      // Register new player
      const newPlayerIndex = generatePlayerIndex();
      const newPlayer = {
        name,
        password,
        index: newPlayerIndex,
        wins: 0
      };

      // Add player to the database
      db.players.push(newPlayer);

      // Store player index in the WebSocket connection
      ws.indexPlayer = newPlayerIndex;

      // Send success response
      sendMessage(ws, 'reg', {
        name,
        index: newPlayerIndex,
        error: false,
        errorText: ''
      } as RegResponse);

      // Broadcast updated winners list
      broadcastUpdateWinners(wss);
    }
  }
}

// Update player wins
export function updatePlayerWins(playerIndex: string): void {
  const player = db.players.find(p => p.index === playerIndex);
  if (player) {
    player.wins += 1;
    broadcastUpdateWinners(wss);
  }
}