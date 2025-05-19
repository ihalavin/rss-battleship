import { WebSocket } from 'ws';

// Player type
export interface Player {
  name: string;
  password: string;
  index: string;
  wins: number;
}

// Room user type
export interface RoomUser {
  name: string;
  index: string;
}

// Room type
export interface Room {
  roomId: string;
  roomUsers: RoomUser[];
}

// Ship position type
export interface ShipPosition {
  x: number;
  y: number;
}

// Ship type
export interface Ship {
  position: ShipPosition;
  direction: boolean; // true for vertical, false for horizontal
  length: number;
  type: string;
}

// Game player type
export interface GamePlayer {
  idPlayer: string;
  playerIndex: string;
  ships: Ship[];
  board: number[][]; // 0: empty, 1: ship, 2: hit, 3: miss
  ready?: boolean;
}

// Game type
export interface Game {
  gameId: string;
  players: GamePlayer[];
  currentPlayer: number;
  status: 'waiting' | 'started' | 'playing' | 'finished';
}

// Database type
export interface DB {
  players: Player[];
  rooms: Room[];
  games: Game[];
}

// Extended WebSocket type with player information
export interface PlayerWebSocket extends WebSocket {
  indexPlayer?: string;
}

// Message types
export interface Message {
  type: string;
  data: string;
  id: number;
}

// Registration data
export interface RegData {
  name: string;
  password: string;
}

// Registration response
export interface RegResponse {
  name: string;
  index: string;
  error: boolean;
  errorText: string;
}

// Room data
export interface RoomData {
  indexRoom: string;
  idPlayer: string;
}

// Ship data
export interface ShipData {
  ships: Ship[];
  gameId: string;
  indexPlayer: string;
}

// Attack data
export interface AttackData {
  gameId: string;
  indexPlayer: string;
  x: number;
  y: number;
}
