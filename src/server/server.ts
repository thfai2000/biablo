import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { GameConfig } from '../types/game-config';
import { World } from './world';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const PORT = process.env.PORT || 3000;

const configPath = path.join(__dirname, '../../config', 'game-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as GameConfig;
const world = new World(config);
world.init();

// Track connected players
const players = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send game world data when requested
  socket.on('getWorldData', (floorLevel: number) => {
    if (world.floors && world.floors[floorLevel]) {
      socket.emit('worldData', { 
        floorLevel, 
        data: world.floors[floorLevel] 
      });
    } else {
      socket.emit('worldError', { message: `Floor ${floorLevel} not available` });
    }
  });
  
  // Register player
  socket.on('registerPlayer', (playerData) => {
    const playerId = socket.id;
    players.set(playerId, {
      ...playerData,
      id: playerId,
      lastActive: Date.now()
    });
    
    socket.emit('playerRegistered', { 
      id: playerId,
      message: 'Player registered successfully'
    });
    
    console.log(`Player registered: ${playerId}`);
  });
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    if (players.has(socket.id)) {
      players.delete(socket.id);
      console.log(`Player disconnected: ${socket.id}`);
    }
  });
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../../public')));

// Serve the game config
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Serve the main game page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});