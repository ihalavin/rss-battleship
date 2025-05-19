import { db, sendMessage, broadcastUpdateRooms, sendRoomMessage } from '../websocketHandler.js';
import { wss } from '../../index.js';
import { PlayerWebSocket, Room, RoomData, Game, GamePlayer } from '../../../types.js';

// Generate a unique room ID
function generateRoomId(): string {
  return Date.now().toString();
}

// Generate a unique game ID
function generateGameId(): string {
  return Date.now().toString();
}

// Generate a unique player ID for the game session
function generateGamePlayerId(): string {
  return Math.floor(Math.random() * 1000000).toString();
}

// Handle room requests
export function handleRoomRequests(ws: PlayerWebSocket, type: string, data: RoomData, id: number): void {
  // Check if player is registered
  if (!ws.indexPlayer) {
    sendMessage(ws, type, {
      error: true,
      errorText: 'Player not registered'
    });
    return;
  }

  const player = db.players.find(p => p.index === ws.indexPlayer);
  if (!player) {
    sendMessage(ws, type, {
      error: true,
      errorText: 'Player not found'
    });
    return;
  }

  switch (type) {
    case 'create_room':
      createRoom(ws, player);
      break;
    case 'add_user_to_room':
      addUserToRoom(ws, player, data);
      break;
  }
}

// Create a new room
function createRoom(ws: PlayerWebSocket, player: { name: string, index: string }): void {
  // Check if player is already in a room
  const existingRoom = db.rooms.find(room =>
    room.roomUsers.some(user => user.index === player.index)
  );

  if (existingRoom) {
    sendMessage(ws, 'create_room', {
      error: true,
      errorText: 'Player already in a room'
    });
    return;
  }

  // Create a new room
  const roomId = generateRoomId();
  const newRoom: Room = {
    roomId,
    roomUsers: [
      {
        name: player.name,
        index: player.index
      }
    ]
  };

  // Add room to the database
  db.rooms.push(newRoom);

  // Broadcast updated rooms list
  broadcastUpdateRooms(wss);
}

// Add user to an existing room
function addUserToRoom(ws: PlayerWebSocket, player: { name: string, index: string }, data: RoomData): void {
  const { indexRoom } = data;

  // Check if room exists
  const room = db.rooms.find(r => r.roomId === indexRoom);
  if (!room) {
    sendMessage(ws, 'add_user_to_room', {
      error: true,
      errorText: 'Room not found'
    });
    return;
  }

  // Check if room is full
  if (room.roomUsers.length >= 2) {
    sendMessage(ws, 'add_user_to_room', {
      error: true,
      errorText: 'Room is full'
    });
    return;
  }

  // Check if player is already in a room
  const existingRoom = db.rooms.find(r =>
    r.roomUsers.some(user => user.index === player.index)
  );

  if (existingRoom && existingRoom.roomId !== indexRoom) {
    sendMessage(ws, 'add_user_to_room', {
      error: true,
      errorText: 'Player already in another room'
    });
    return;
  }

  // Add player to the room if not already there
  if (!room.roomUsers.some(user => user.index === player.index)) {
    room.roomUsers.push({
      name: player.name,
      index: player.index
    });
  }

  // Broadcast updated rooms list
  broadcastUpdateRooms(wss);

  // If room is now full (2 players), create a game
  if (room.roomUsers.length === 2) {
    createGame(room);
  }
}

// Create a new game for a room with 2 players
function createGame(room: Room): void {
  const gameId = generateGameId();

  // Generate unique player IDs for the game session
  const player1Id = generateGamePlayerId();
  const player2Id = generateGamePlayerId();

  // Create a new game
  const newGame: Game = {
    gameId: gameId,
    players: [
      {
        playerIndex: room.roomUsers[0].index,
        idPlayer: player1Id,
        ships: [],
        board: Array(10).fill(0).map(() => Array(10).fill(0))
      },
      {
        playerIndex: room.roomUsers[1].index,
        idPlayer: player2Id,
        ships: [],
        board: Array(10).fill(0).map(() => Array(10).fill(0))
      }
    ],
    currentPlayer: 0,
    status: 'waiting' // waiting, playing, finished
  };

  // Add game to the database
  db.games.push(newGame);

  // Send create_game message to both players
  wss.clients.forEach((client) => {
    const playerClient = client as PlayerWebSocket;
    if (playerClient.indexPlayer === room.roomUsers[0].index) {
      sendMessage(playerClient, 'create_game', {
        idGame: gameId,
        idPlayer: player1Id
      });
    } else if (playerClient.indexPlayer === room.roomUsers[1].index) {
      sendMessage(playerClient, 'create_game', {
        idGame: gameId,
        idPlayer: player2Id
      });
    }
  });
}
