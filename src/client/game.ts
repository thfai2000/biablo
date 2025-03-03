import { Player } from './player';
import { fetchGameConfig, displayMessage } from './utils';
import { StatsWidget } from './stats-widget'; // Import StatsWidget
import { GameConfig, FloorData, Assets, Position } from '../types/game-config';
import { io, Socket } from 'socket.io-client';

// Define interfaces for socket.io message payloads
interface WorldDataPayload {
  floorLevel: number;
  data: FloorData;
}

interface WorldErrorPayload {
  message: string;
}

interface PlayerRegisteredPayload {
  id: string;
  message: string;
}

export class Game {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public tileSize: number;
  private config: GameConfig | null;
  private player: Player | null;
  private floors: { [key: number]: FloorData };
  private currentFloor: number;
  private cameraX: number;
  private cameraY: number;
  private lastTime: number;
  private assets: Assets;
  private showStatusPopup: boolean;
  private statusButtonRect: { x: number, y: number, width: number, height: number };
  private statsWidget: StatsWidget; // Add StatsWidget instance
  private socket: Socket; // Socket.IO client
  private playerId: string | null;
  
  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.tileSize = 32;
    this.config = null;
    this.player = null;
    this.floors = {};
    this.currentFloor = 0;
    this.cameraX = 0;
    this.cameraY = 0;
    this.lastTime = 0;
    this.showStatusPopup = false;
    this.statusButtonRect = { x: 0, y: 0, width: 0, height: 0 };
    this.statsWidget = new StatsWidget(); // Initialize StatsWidget without player - will be set later
    this.playerId = null;
    
    // Initialize Socket.IO connection
    this.socket = io();
    this.setupSocketListeners();
    
    // Assets
    this.assets = {
      tiles: {
        wall: '#333',
        floor: '#555',
        upStairs: '#77f',
        downStairs: '#f77',
        tree: '#0a5' // Green color for trees
      }
    };
    
    this.init();
  }

  private setupSocketListeners(): void {
    // Handle socket connection
    this.socket.on('connect', () => {
      console.log('Connected to server with id:', this.socket.id);
    });
    
    // Handle socket disconnection
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      displayMessage('Connection to server lost. Please refresh the page.', 'danger');
    });
    
    // Handle world data reception
    this.socket.on('worldData', ({ floorLevel, data }: WorldDataPayload) => {
      console.log(`Received data for floor ${floorLevel}`);
      this.floors[floorLevel] = data;
      
      // If this is the current floor and we're waiting for it, place the player
      if (floorLevel === this.currentFloor && this.player) {
        const startPos = this.getStartingPosition(floorLevel);
        if (startPos) {
          this.player.x = startPos.x * this.tileSize;
          this.player.y = startPos.y * this.tileSize;
        }
      }
    });
    
    // Handle world data errors
    this.socket.on('worldError', ({ message }: WorldErrorPayload) => {
      console.error('World data error:', message);
      displayMessage(`Error: ${message}`, 'danger');
    });
    
    // Handle player registration
    this.socket.on('playerRegistered', ({ id, message }: PlayerRegisteredPayload) => {
      console.log(message);
      this.playerId = id;
    });
  }

  async getFloor(level: number): Promise<FloorData> {
    return new Promise((resolve, reject) => {
      // If we already have this floor cached, return it
      if (this.floors[level]) {
        resolve(this.floors[level]);
        return;
      }
      
      // Request floor data from server
      this.socket.emit('getWorldData', level);
      
      // Set up a one-time listener for the response
      const worldDataListener = ({ floorLevel, data }: WorldDataPayload) => {
        if (floorLevel === level) {
          this.socket.off('worldData', worldDataListener);
          this.floors[level] = data;
          resolve(data);
        }
      };
      
      // Set up error listener
      const errorListener = ({ message }: WorldErrorPayload) => {
        this.socket.off('worldError', errorListener);
        reject(new Error(message));
      };
      
      this.socket.on('worldData', worldDataListener);
      this.socket.on('worldError', errorListener);
      
      // Set a timeout in case the server doesn't respond
      setTimeout(() => {
        this.socket.off('worldData', worldDataListener);
        this.socket.off('worldError', errorListener);
        reject(new Error(`Timeout getting floor ${level} data`));
      }, 5000); // 5 second timeout
    });
  }
  
  async getPlayerConfig(): Promise<any> {
    // Register player with the server
    const playerConfig = {
      x: 0,
      y: 0,
      tileSize: this.tileSize,
      currentFloor: 0,
      moveSpeed: 100,
      stats: {
        maxHealth: 100,
        currentHealth: 100,
        maxMana: 50,
        currentMana: 50,
        attack: 10,
        defense: 5,
        level: 1,
        experience: 0,
        experienceToNextLevel: 100
      }
    };
    
    // Register player with the server
    this.socket.emit('registerPlayer', playerConfig);
    
    return playerConfig;
  }

  async init(): Promise<void> {
    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Load game config
    this.config = await fetchGameConfig();
    
    if (!this.config) {
      displayMessage('Could not load game configuration', 'danger');
      return;
    }
    
    // Initialize player
    this.player = new Player(this.config);
    
    // Now that we have the player, set it in the stats widget
    this.statsWidget.setPlayer(this.player);
    
    // Generate the initial floor (village)
    try {
      // Get the initial floor (village) from the server
      this.floors[0] = await this.getFloor(0);
      
      // Pre-load the next floor
      if (this.config.floors.length > 1) {
        this.getFloor(1).catch(err => console.warn('Failed to pre-load floor 1:', err));
      }
      
      // Start in the village
      this.currentFloor = 0;
      const startPos = this.getStartingPosition(0);
      if (this.player && startPos) {
        this.player.x = startPos.x * this.tileSize;
        this.player.y = startPos.y * this.tileSize;
      }
      
    } catch (error) {
      console.error('Failed to initialize floor data:', error);
      displayMessage('Failed to load world data. Please refresh the page.', 'danger');
      return;
    }
    
    // Add click event listener for status button
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    
    const statusButton = document.getElementById('status-button');
    if (statusButton) {
      statusButton.addEventListener('click', () => {
        this.statsWidget.toggle(); // Toggle StatsWidget visibility
        this.render();
      });
    }
    
    // Set up additional event listeners
    this.setupEventListeners();
    
    displayMessage('Welcome to the village! Find the cave to enter the dungeon.', 'info');
    
    // Start game loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  private handleCanvasClick(event: MouseEvent): void {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Pass right-click information to StatsWidget
    const isRightClick = event.button === 2;
    if (this.statsWidget.isCurrentlyVisible()) {
        this.statsWidget.handleCanvasClick(x, y, this.canvas, isRightClick);
        return;
    }

    if (this.statsWidget.isCurrentlyVisible()) {
      // Let stats widget handle the click if it's visible
      this.statsWidget.handleCanvasClick(x, y, this.canvas);
      this.render(); // Re-render to show any changes
      return;
    }
  }

  private setupEventListeners(): void {
    // ...existing event listeners...

    // Prevent context menu on right-click
    this.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Add right-click handling
    this.canvas.addEventListener('mousedown', this.handleCanvasClick.bind(this));
  }
  
  
  
  getStartingPosition(level: number): Position | null {
    const floor = this.floors[level];
    if (!floor || !floor.map) return null;
    
    // Find a suitable starting position on the floor
    if (level === 0) {
      // Start in center of village
      const map = floor.map;
      return {
        x: Math.floor(map[0].length / 2),
        y: Math.floor(map.length / 2)
      };
    } else {
      // Start at up stairs for dungeon floors
      return floor.upStairsPos || {
        x: Math.floor(floor.map[0].length / 2),
        y: Math.floor(floor.map.length / 2)
      };
    }
  }
  
  resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight * 0.8; // 80% of window height
  }
  
  updateCamera(): void {
    if (!this.player) return;
    
    // Calculate the camera position to follow the player
    const viewportWidth = this.canvas.width;
    const viewportHeight = this.canvas.height;
    
    // Center the camera on the player
    this.cameraX = this.player.x - viewportWidth / 2;
    this.cameraY = this.player.y - viewportHeight / 2;
    
    // Limit camera to map boundaries
    const currentMap = this.floors[this.currentFloor]?.map;
    if (!currentMap) return;
    
    const mapWidth = currentMap[0].length * this.tileSize;
    const mapHeight = currentMap.length * this.tileSize;
    
    this.cameraX = Math.max(0, Math.min(this.cameraX, mapWidth - viewportWidth));
    this.cameraY = Math.max(0, Math.min(this.cameraY, mapHeight - viewportHeight));
  }
  
  gameLoop(currentTime: number): void {
    // Calculate delta time
    const deltaTime = (currentTime - this.lastTime) / 1000; // in seconds
    this.lastTime = currentTime;
    
    // Get floor data
    const floorData = this.floors[this.currentFloor];
    if (!floorData || !this.player) {
      requestAnimationFrame((time) => this.gameLoop(time));
      return;
    }
    
    const { map, upStairsPos, downStairsPos } = floorData;
    
    // Update player - convert null to undefined for the stairs positions
    const result = this.player.update(map, upStairsPos || undefined, downStairsPos || undefined);
    
    // Handle floor changes
    if (result.floorChange) {
      this.currentFloor = this.player.currentFloor;
      
      // Pre-load the next floor if it's not already loaded
      if (!this.floors[this.currentFloor]) {
        this.getFloor(this.currentFloor)
          .catch(err => {
            console.error(`Error loading floor ${this.currentFloor}:`, err);
            displayMessage(`Failed to load floor ${this.currentFloor}. Please try again.`, 'danger');
          });
      }
      
      // Also pre-load the floor above and below if they exist
      if (this.currentFloor > 0 && !this.floors[this.currentFloor - 1]) {
        this.getFloor(this.currentFloor - 1).catch(err => console.warn(`Failed to pre-load floor ${this.currentFloor - 1}:`, err));
      }
      if (!this.floors[this.currentFloor + 1]) {
        this.getFloor(this.currentFloor + 1).catch(err => console.warn(`Failed to pre-load floor ${this.currentFloor + 1}:`, err));
      }
      
      const currentFloor = this.floors[this.currentFloor];
      if (currentFloor && result.direction) {
        // Place player at appropriate stairs
        if (result.direction === 'up') {
          this.player.placeAtStairs(result.direction, undefined, currentFloor.downStairsPos || undefined);
          // Immediately center camera on down stairs
          if (currentFloor.downStairsPos) {
            this.cameraX = currentFloor.downStairsPos.x * this.tileSize - this.canvas.width / 2;
            this.cameraY = currentFloor.downStairsPos.y * this.tileSize - this.canvas.height / 2;
          }
        } else {
          this.player.placeAtStairs(result.direction, currentFloor.upStairsPos || undefined, undefined);
          // Immediately center camera on up stairs
          if (currentFloor.upStairsPos) {
            this.cameraX = currentFloor.upStairsPos.x * this.tileSize - this.canvas.width / 2;
            this.cameraY = currentFloor.upStairsPos.y * this.tileSize - this.canvas.height / 2;
          }
        }
      }
    }
    
    // Update camera
    this.updateCamera();
    
    // Render the game
    this.render();
    
    // Continue the game loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  
  render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get current map
    const floorData = this.floors[this.currentFloor];
    if (!floorData || !floorData.map || !this.player) return;
    
    const { map, upStairsPos, downStairsPos, enemyLevel, enemyDensity, treasureChestDensity } = floorData;
    
    // Calculate visible tile range based on camera position
    const startCol = Math.floor(this.cameraX / this.tileSize);
    const endCol = Math.min(
      map[0].length, 
      startCol + Math.ceil(this.canvas.width / this.tileSize) + 1
    );
    
    const startRow = Math.floor(this.cameraY / this.tileSize);
    const endRow = Math.min(
      map.length, 
      startRow + Math.ceil(this.canvas.height / this.tileSize) + 1
    );
    
    // Draw the map
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const tileType = map[y][x];
        
        switch (tileType) {
          case 0: // Wall
            this.ctx.fillStyle = this.assets.tiles.wall;
            this.ctx.fillRect(
              x * this.tileSize - this.cameraX,
              y * this.tileSize - this.cameraY,
              this.tileSize,
              this.tileSize
            );
            break;
          case 1: // Floor
            this.ctx.fillStyle = this.assets.tiles.floor;
            this.ctx.fillRect(
              x * this.tileSize - this.cameraX,
              y * this.tileSize - this.cameraY,
              this.tileSize,
              this.tileSize
            );
            break;
          case 2: // Up stairs
            this.ctx.fillStyle = this.assets.tiles.upStairs;
            this.ctx.fillRect(
              x * this.tileSize - this.cameraX,
              y * this.tileSize - this.cameraY,
              this.tileSize,
              this.tileSize
            );
            break;
          case 3: // Down stairs
            this.ctx.fillStyle = this.assets.tiles.downStairs;
            this.ctx.fillRect(
              x * this.tileSize - this.cameraX,
              y * this.tileSize - this.cameraY,
              this.tileSize,
              this.tileSize
            );
            break;
          case 4: // Tree
            // First draw the ground under the tree
            this.ctx.fillStyle = this.assets.tiles.floor;
            this.ctx.fillRect(
              x * this.tileSize - this.cameraX,
              y * this.tileSize - this.cameraY,
              this.tileSize,
              this.tileSize
            );
            
            // Draw tree trunk (brown stem)
            this.ctx.fillStyle = '#8B4513'; // Saddle brown for trunk
            this.ctx.fillRect(
              x * this.tileSize + this.tileSize * 0.45 - this.cameraX,
              y * this.tileSize + this.tileSize * 0.5 - this.cameraY,
              this.tileSize * 0.1,
              this.tileSize * 0.5
            );
            
            // Draw first layer of leaves (bottom, wider triangle)
            this.ctx.fillStyle = '#228B22'; // Forest green
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.tileSize + this.tileSize * 0.2 - this.cameraX, y * this.tileSize + this.tileSize * 0.6 - this.cameraY);
            this.ctx.lineTo(x * this.tileSize + this.tileSize * 0.8 - this.cameraX, y * this.tileSize + this.tileSize * 0.6 - this.cameraY);
            this.ctx.lineTo(x * this.tileSize + this.tileSize * 0.5 - this.cameraX, y * this.tileSize + this.tileSize * 0.25 - this.cameraY);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Draw second layer of leaves (middle triangle)
            this.ctx.fillStyle = '#32CD32'; // Lime green
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.tileSize + this.tileSize * 0.25 - this.cameraX, y * this.tileSize + this.tileSize * 0.45 - this.cameraY);
            this.ctx.lineTo(x * this.tileSize + this.tileSize * 0.75 - this.cameraX, y * this.tileSize + this.tileSize * 0.45 - this.cameraY);
            this.ctx.lineTo(x * this.tileSize + this.tileSize * 0.5 - this.cameraX, y * this.tileSize + this.tileSize * 0.1 - this.cameraY);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Draw top layer of leaves (smaller triangle)
            this.ctx.fillStyle = '#90EE90'; // Light green
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.tileSize + this.tileSize * 0.3 - this.cameraX, y * this.tileSize + this.tileSize * 0.3 - this.cameraY);
            this.ctx.lineTo(x * this.tileSize + this.tileSize * 0.7 - this.cameraX, y * this.tileSize + this.tileSize * 0.3 - this.cameraY);
            this.ctx.lineTo(x * this.tileSize + this.tileSize * 0.5 - this.cameraX, y * this.tileSize - this.cameraY);
            this.ctx.closePath();
            this.ctx.fill();
            break;
        }
      }
    }
    
    // Draw the player
    this.player.draw(this.ctx, this.cameraX, this.cameraY, map, upStairsPos || undefined, downStairsPos || undefined);
    
    // Draw UI
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px Arial';
    this.ctx.fillText(`Floor: ${this.currentFloor}`, 10, 20);
    
    // Draw instructions
    this.ctx.fillText('Use arrow keys or WASD to move', 10, 40);
    this.ctx.fillText('Press Space or Enter at stairs to change floors', 10, 60);
    
    // Draw basic player stats
    const playerStats = this.player.getStats();
    this.ctx.fillText(`HP: ${playerStats.currentHealth}/${playerStats.maxHealth}`, 10, 90);
    this.ctx.fillText(`Mana: ${playerStats.currentMana}/${playerStats.maxMana}`, 10, 110);
    
    // Draw connection status
    const connectionStatus = this.socket.connected ? 'Connected' : 'Disconnected';
    this.ctx.fillStyle = this.socket.connected ? '#0f0' : '#f00'; // Green if connected, red if disconnected
    this.ctx.fillText(`Server: ${connectionStatus}`, 10, 130);
    
    // Draw status popup if open
    if (this.statsWidget.isCurrentlyVisible()) {
        this.statsWidget.renderCanvas(this.ctx, this.canvas);
    }
  }
}

// Initialize game when the page loads
window.addEventListener('load', () => {
  (window as any).game = new Game();
});