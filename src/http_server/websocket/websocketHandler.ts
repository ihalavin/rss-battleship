import { handlePlayerRequests } from './handlers/playerHandler.js';
import { handleRoomRequests } from './handlers/roomHandler.js';
import { handleShipRequests } from './handlers/shipHandler.js';
import { handleGameRequests } from './handlers/gameHandler.js';
import { WebSocketServer } from 'ws';
import { DB, PlayerWebSocket, Message } from '../../types.js';

// In-memory database for players, rooms, and games
export const db: DB = {
  players: [
    {
      name: 'gamer',
      password: 'gamer',
      index: '1',
      wins: 0
    }
  ], // Array of player objects { name, password, index, wins }
  rooms: [], // Array of room objects { roomId, roomUsers: [{ name, index }] }
  games: [], // Array of game objects { idGame, players: [], ships: [], board: [], currentPlayer, status }
};

// Handle WebSocket connection
export function handleWebSocketConnection(ws: PlayerWebSocket): void {
  console.log('New WebSocket connection established');

  // Send initial data to the client
  sendUpdateRooms(ws);
  sendUpdateWinners(ws);

  // Handle messages from the client
  ws.on('message', (message: Buffer) => {
    try {
      const parsedMessage = JSON.parse(message.toString()) as Message;
      console.log('Received message:', parsedMessage);

      const { type, data, id } = parsedMessage;
      const parsedData = data ? JSON.parse(data) : {};

      // Route the message to the appropriate handler
      switch (type) {
        case 'reg':
          handlePlayerRequests(ws, type, parsedData, id);
          break;
        case 'create_room':
        case 'add_user_to_room':
          handleRoomRequests(ws, type, parsedData, id);
          break;
        case 'add_ships':
          handleShipRequests(ws, type, parsedData, id);
          break;
        case 'attack':
        case 'randomAttack':
          handleGameRequests(ws, type, parsedData, id);
          break;
        default:
          console.log(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Handle cleanup if needed
  });
}

// Helper function to send a message to a specific client
export function sendMessage(ws: PlayerWebSocket, type: string, messageData: any, id: number = 0): void {
  const data = JSON.stringify(messageData);
  const message = JSON.stringify({ type, data, id });
  ws.send(message);
  console.log('Sent message:', { type, messageData, id });
}

// Helper function to broadcast a message to all connected clients
export function broadcastMessage(wss: WebSocketServer, type: string, messageData: any, id: number = 0): void {
  const data = JSON.stringify(messageData);
  const message = JSON.stringify({ type, data, id });
  wss.clients.forEach((client) => {
    (client as PlayerWebSocket).send(message);
  });
  console.log('Broadcast message:', { type, messageData, id });
}

// Helper function to send a message to all clients in a room
export function sendRoomMessage(wss: WebSocketServer, roomId: string, type: string, messageData: any, id: number = 0): void {
  const room = db.rooms.find(r => r.roomId === roomId);
  if (!room) return;

  const data = JSON.stringify(messageData);
  const message = JSON.stringify({ type, data, id });
  wss.clients.forEach((client) => {
    const playerClient = client as PlayerWebSocket;
    if (playerClient.indexPlayer && room.roomUsers.some(u => u.index === playerClient.indexPlayer)) {
      playerClient.send(message);
    }
  });
  console.log('Room message:', { roomId, type, messageData, id });
}

// Helper function to send update_room message
export function sendUpdateRooms(ws: PlayerWebSocket): void {
  const availableRooms = db.rooms.filter(room => room.roomUsers.length === 1);
  sendMessage(ws, 'update_room', availableRooms);
}

// Helper function to broadcast update_room message
export function broadcastUpdateRooms(wss: WebSocketServer): void {
  const availableRooms = db.rooms.filter(room => room.roomUsers.length === 1);
  broadcastMessage(wss, 'update_room', availableRooms);
}

// Helper function to send update_winners message
export function sendUpdateWinners(ws: PlayerWebSocket): void {
  const winners = db.players
    .filter(player => player.wins > 0)
    .map(player => ({ name: player.name, wins: player.wins }))
    .sort((a, b) => b.wins - a.wins);

  sendMessage(ws, 'update_winners', winners);
}

// Helper function to broadcast update_winners message
export function broadcastUpdateWinners(wss: WebSocketServer): void {
  const winners = db.players
    .filter(player => player.wins > 0)
    .map(player => ({ name: player.name, wins: player.wins }))
    .sort((a, b) => b.wins - a.wins);

  broadcastMessage(wss, 'update_winners', winners);
}