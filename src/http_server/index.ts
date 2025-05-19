import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { handleWebSocketConnection } from './websocket/websocketHandler.js';
import { WebSocketServer } from "ws";

export const httpServer = http.createServer(function (req, res) {
  const __dirname = path.resolve(path.dirname(''));
  const file_path = __dirname + (req.url === '/' ? '/front/index.html' : '/front' + req.url);
  fs.readFile(file_path, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

// Create a WebSocket server that shares the HTTP server
export const wss = new WebSocketServer({ port: 3000 });

// Handle WebSocket connections
wss.on('connection', handleWebSocketConnection);
