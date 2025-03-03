import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { GameConfig } from '../types/game-config';
import { World } from './world';
import { ServerPlayer } from './player';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const PORT = process.env.PORT || 3000;

// Load game configuration
const configPath = path.join(__dirname, '../../config', 'game-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as GameConfig;

// Initialize game world
const world = new World(config);
world.init();

// Game loop variables
const TICK_RATE = 60; // Updates per second
const MS_PER_TICK = 1000 / TICK_RATE;
let lastTickTime = Date.now();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Handle player registration
  socket.on('registerPlayer', (playerData: { username: string }) => {
    // Create a new server-side player
    const player = new ServerPlayer(socket.id, playerData.username, config);
    
    // Add player to the world
    world.addPlayer(player);
    
    // Send initial player data back to client
    socket.emit('playerRegistered', {
      id: player.id,
      playerData: player.getPlayerData(),
      message: 'Player registered successfully'
    });
    
    // Send the player to the initial floor's dungeon
    const initialFloor = player.currentFloor
    const dungeon = world.getDungeon(initialFloor);
    
    if (dungeon) {
      socket.emit('floorData', {
        floorLevel: initialFloor,
        mapData: dungeon.getMapData()
      });
      
      // Join the floor room for floor-specific updates
      socket.join(`floor_${initialFloor}`);
    }

    socket.emit('positionCorrection', {
      x: player.x,
      y: player.y,
      timestamp: Date.now(),
      floorLevel: player.currentFloor
    });
    
    console.log(`Player registered: ${socket.id} as ${playerData.username}`);
  });
  
  // Handle player input
  socket.on('playerInput', (input: { 
    position: { x: number, y: number, timestamp: number },
    movement: { up: boolean, down: boolean, left: boolean, right: boolean },
    action: boolean,
    toggleMap: boolean
  }) => {
    const player = world.getPlayer(socket.id);
    if (!player) return;

    // Get current floor dungeon
    const dungeon = world.getDungeon(player.currentFloor);
    if (!dungeon) return;

    // Process movement input
    player.processMovementInput(input.movement);

    // Handle stairs interaction
    if (input.action && player.canInteractWithStairs()) {
      const result = dungeon.handleStairsInteraction(player.id);
      
      if (result.floorChange) {
        player.updateLastActionTime();
        
        // Calculate target floor
        let targetFloor = player.currentFloor;
        if (result.direction === 'up') {
          targetFloor--;
        } else if (result.direction === 'down') {
          targetFloor++;
        }
        
        // Move player to the new floor
        const floorChanged = world.movePlayerToFloor(player.id, targetFloor);
        
        if (floorChanged) {
          // Leave the old floor room
          socket.leave(`floor_${player.currentFloor}`);
          
          // Join the new floor room
          socket.join(`floor_${targetFloor}`);
          
          // Send the new floor data to the client
          const newDungeon = world.getDungeon(targetFloor);
          
          socket.emit('positionCorrection', {
            x: player.x,
            y: player.y,
            timestamp: Date.now(),
            floorLevel: player.currentFloor
          });

        }
      }
      return;
    }

    // Validate and process position update
    const positionValid = player.processPositionUpdate(
      input.position.x,
      input.position.y,
      input.position.timestamp
    );

    if (!positionValid) {
      // If position update was invalid, send correction to client
      socket.emit('positionCorrection', {
        x: player.x,
        y: player.y,
        timestamp: Date.now(),
        floorLevel: player.currentFloor
      });
    }

    // Check for collision with map boundaries and walls
    const success = dungeon.updatePlayerPosition(player.id, player.x, player.y);
    if (!success) {
      // If collision detected, reset position and notify client
      socket.emit('positionCorrection', {
        x: player.x,
        y: player.y,
        timestamp: Date.now(),
        floorLevel: player.currentFloor
      });
    }

    
  });
  
  // Handle player requesting floor data
  socket.on('getFloorData', (floorLevel: number) => {
    const dungeon = world.getDungeon(floorLevel);
    
    if (dungeon) {
      socket.emit('floorData', {
        floorLevel,
        mapData: dungeon.getMapData()
      });
    } else {
      socket.emit('error', { message: `Floor ${floorLevel} not available` });
    }
  });

  // Handle player requesting world data
  socket.on('getWorldData', (floorLevel: number) => {
    const dungeon = world.getDungeon(floorLevel);
    
    if (dungeon) {
      socket.emit('worldData', {
        floorLevel,
        data: dungeon.getMapData()
      });
    } else {
      // Try to generate the floor if it doesn't exist
      world.generateFloor(floorLevel);
      const newDungeon = world.getDungeon(floorLevel);
      
      if (newDungeon) {
        socket.emit('worldData', {
          floorLevel,
          data: newDungeon.getMapData()
        });
      } else {
        socket.emit('worldError', { message: `Could not generate floor ${floorLevel}` });
      }
    }
  });
  
  // Handle inventory actions
  socket.on('useItem', (itemId: string) => {
    const player = world.getPlayer(socket.id);
    
    if (player) {
      const success = player.useItem(itemId);
      socket.emit('inventoryUpdated', {
        inventory: player.getInventory(),
        stats: player.stats,
        success
      });
    }
  });
  
  socket.on('equipItem', (itemId: string) => {
    const player = world.getPlayer(socket.id);
    
    if (player) {
      const success = player.equipItem(itemId);
      socket.emit('inventoryUpdated', {
        inventory: player.getInventory(),
        equipment: player.getEquipment(),
        stats: player.stats,
        success
      });
    }
  });
  
  socket.on('unequipItem', (slot: string) => {
    const player = world.getPlayer(socket.id);
    
    if (player) {
      const success = player.unequipItem(slot as any);
      socket.emit('inventoryUpdated', {
        inventory: player.getInventory(),
        equipment: player.getEquipment(),
        stats: player.stats,
        success
      });
    }
  });
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    world.removePlayer(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Game loop
setInterval(() => {
  const now = Date.now();
  const deltaTime = now - lastTickTime;
  lastTickTime = now;
  
  // Update the game world
  world.update(deltaTime);
  
  // Broadcast updates to all clients by floor
  Object.entries(world.dungeons).forEach(([floorLevel, dungeon]) => {
    const floorState = dungeon.getState();
    
    // Only send updates if there are players on the floor
    if (floorState.players.size > 0) {
      // Convert Map objects to arrays for serialization
      const serializedState = {
        floorLevel: parseInt(floorLevel),
        players: Array.from(floorState.players.values()).map(player => player.getPlayerData()),
        npcs: Array.from(floorState.npcs.values())
      };
      
      // Send to all clients in this floor's room
      io.to(`floor_${floorLevel}`).emit('gameStateUpdate', serializedState);
    }
  });
}, MS_PER_TICK);

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