import { Player } from './player';
import { fetchGameConfig, displayMessage } from './utils';
import { StatsWidget } from './stats-widget'; // Import StatsWidget
import { GameConfig, FloorData, Assets, Position } from '../types/game-config';
import { io, Socket } from 'socket.io-client';
import { DrawingHelper } from './DrawingHelper';
import { GameRenderer3D } from './3DRenderer';

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
  playerData: any;
}

interface GameStateUpdatePayload {
  floorLevel: number;
  players: any[];
  npcs: any[];
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
  private otherPlayers: Map<string, any>;
  private npcs: Map<string, any>;
  private minimapSize: number;
  private minimapScale: number;
  private renderer3D: GameRenderer3D | null;
  private is3DMode: boolean;


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
    this.otherPlayers = new Map();
    this.npcs = new Map();
    
    this.minimapSize = 150;
    this.minimapScale = 0.2;
    
    this.renderer3D = null;
    this.is3DMode = true; // Set to true to enable 3D mode by default
    
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

    // Handle position corrections from server
    this.socket.on('positionCorrection', (data: { 
      x: number, 
      y: number, 
      timestamp: number, 
      floorLevel: number,
      direction: 'up' | 'down'
    }) => {
      if (this.player) {
        this.player.x = data.x;
        this.player.y = data.y;

        // Handle floor change if included
        if (data.floorLevel !== this.currentFloor) {
          this.player.handleFloorChange(data.floorLevel);
          this.currentFloor = data.floorLevel;
          this.handleFloorChange(data);
          
          // Request the new floor data if we don't have it
          if (!this.floors[data.floorLevel]) {
            this.getFloor(data.floorLevel).catch(err => {
              console.error(`Error loading floor ${data.floorLevel}:`, err);
              displayMessage(`Failed to load floor ${data.floorLevel}. Please try again.`, 'danger');
            });
          }

          if (data.direction) {
            displayMessage(`Moving ${data.direction} to floor ${data.floorLevel}`, 'info');
          }
        }
        //displayMessage(`Position corrected by server -> (${this.player.x}, ${this.player.y})`, 'warning');
      }
    });
    
    // Handle world data reception
    this.socket.on('worldData', ({ floorLevel, data }: WorldDataPayload) => {
      console.log(`Received data for floor ${floorLevel}`);
      this.floors[floorLevel] = data;
      
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
    this.socket.on('playerRegistered', (data: PlayerRegisteredPayload) => {
      console.log('Player registered:', data.message);
      this.playerId = data.id;
      if (this.player) {
        this.player.handleRegistration(data.id, data.playerData);
      }
    });

    
    // Handle game state updates
    this.socket.on('gameStateUpdate', (data: GameStateUpdatePayload) => {
      // Only process updates for current floor
      if (data.floorLevel === this.currentFloor) {
        // Update main player
        if (this.player) {
          const playerData = data.players.find(p => p.id === this.playerId);
          if (playerData) {
            this.player.handleGameStateUpdate(playerData);
          }
        }

        // Update other players
        this.updateOtherPlayers(data.players.filter(p => p.id !== this.playerId));
        
        // Update NPCs
        this.updateNPCs(data.npcs);
      }
    });

    // Handle inventory updates
    this.socket.on('inventoryUpdated', (data: { 
      inventory: any[], 
      equipment?: any, 
      stats: any, 
      success: boolean 
    }) => {
      if (data.success && this.player) {
        this.player.handleInventoryUpdate({
          inventory: data.inventory,
          equipment: data.equipment,
          stats: data.stats
        });
      }
    });
  }


  // Handle floor changes
  private handleFloorChange(result: { direction: 'up' | 'down' }): void {
    if(!this.player) return;
    this.currentFloor = this.player.currentFloor;
    
    // Pre-load the next floor if it's not already loaded
    if (!this.floors[this.currentFloor]) {
      this.getFloor(this.currentFloor)
        .catch(err => {
          console.error(`Error loading floor ${this.currentFloor}:`, err);
          displayMessage(`Failed to load floor ${this.currentFloor}. Please try again.`, 'danger');
        });
    } else if (this.is3DMode && this.renderer3D) {
      // We already have this floor data, ensure it's loaded in the 3D renderer
      this.renderer3D.loadFloor(this.currentFloor, this.floors[this.currentFloor]);
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
        this.player.placeAtStairs(result.direction, undefined, currentFloor.downStairsPos ? { ...currentFloor.downStairsPos } : undefined);
        // Immediately center camera on down stairs
        if (currentFloor.downStairsPos) {
          this.cameraX = currentFloor.downStairsPos.x * this.tileSize - this.canvas.width / 2;
          this.cameraY = currentFloor.downStairsPos.y * this.tileSize - this.canvas.height / 2;
        }
      } else {
        this.player.placeAtStairs(result.direction, currentFloor.upStairsPos ? { ...currentFloor.upStairsPos } : undefined, undefined);
        // Immediately center camera on up stairs
        if (currentFloor.upStairsPos) {
          this.cameraX = currentFloor.upStairsPos.x * this.tileSize - this.canvas.width / 2;
          this.cameraY = currentFloor.upStairsPos.y * this.tileSize - this.canvas.height / 2;
        }
      }
    }
  }

  private updateOtherPlayers(players: any[]): void {
    // Clear players not in the update
    const currentIds = new Set(players.map(p => p.id));
    for (const [id] of this.otherPlayers) {
      if (!currentIds.has(id)) {
        this.otherPlayers.delete(id);
      }
    }

    // Update or add players
    for (const playerData of players) {
      this.otherPlayers.set(playerData.id, playerData);
    }
  }

  private updateNPCs(npcs: any[]): void {
    // Clear NPCs not in the update
    const currentIds = new Set(npcs.map(npc => npc.id));
    for (const [id] of this.npcs) {
      if (!currentIds.has(id)) {
        this.npcs.delete(id);
      }
    }

    // Update or add NPCs
    for (const npcData of npcs) {
      this.npcs.set(npcData.id, npcData);
    }
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
          
          // Load the floor data into the 3D renderer if in 3D mode
          if (this.is3DMode && this.renderer3D) {
            this.renderer3D.loadFloor(level, data);
          }
          
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
    
    // Initialize 3D renderer if 3D mode is enabled
    if (this.is3DMode && !this.renderer3D) {
      this.renderer3D = new GameRenderer3D(this.canvas, this.config);
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
      
      // Load the current floor data into the 3D renderer
      if (this.is3DMode && this.renderer3D && this.floors[0]) {
        this.renderer3D.loadFloor(0, this.floors[0]);
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
    
    // Register player with the server
    this.socket.emit('registerPlayer', {username: 'Player 1'});

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
    
    // Send player input to server every frame when movement keys are pressed
    if (this.player) {
      const inputState = this.player.getInputState();
      
      // Always send input state when movement keys are pressed
      if (inputState.movement.up || inputState.movement.down || 
          inputState.movement.left || inputState.movement.right ||
          this.player.hasInputChange(inputState)) {
        this.socket.emit('playerInput', inputState);
      }
    }
    
    // Update camera
    this.updateCamera();
    
    // Render the game
    if (this.is3DMode && this.renderer3D) {
      // 3D rendering
      
      // Update player position in 3D space
      if (this.player) {
        this.renderer3D.updatePlayer('self', this.player.x, this.player.y, this.player.z || 0);
      }
      
      // Update other players
      this.otherPlayers.forEach((playerData, id) => {
        this.renderer3D!.updatePlayer(
          id,
          playerData.x,
          playerData.y,
          playerData.z || 0
        );
      });
      
      // Update NPCs
      this.npcs.forEach((npcData, id) => {
        this.renderer3D!.updateNPC(
          id,
          npcData.type,
          npcData.x,
          npcData.y,
          npcData.z || 0
        );
      });
      
      // Render 3D scene
      this.renderer3D.render();
    } else {
      // 2D rendering (existing code)
      this.render();
    }
    
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
    
    // Draw the map
    DrawingHelper.drawMap(this.ctx, map, this.assets, this.tileSize, this.cameraX, this.cameraY);
    
    // Draw the player
    DrawingHelper.drawPlayer(this.ctx, this.player, this.cameraX, this.cameraY);

    // Draw the minimap if enabled
    if (this.player.showMinimap && map) {
      DrawingHelper.drawMinimap(this.ctx, map, this.player, this.player.size, this.minimapSize, this.minimapScale, upStairsPos, downStairsPos);
    }
    
    // Draw other players
    for (const [_, playerData] of this.otherPlayers) {
      this.ctx.fillStyle = '#0000ff'; // Blue for other players
      this.ctx.beginPath();
      this.ctx.arc(
        playerData.x - this.cameraX,
        playerData.y - this.cameraY,
        this.tileSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
    
    // Draw NPCs
    for (const [_, npcData] of this.npcs) {
      this.ctx.fillStyle = '#00ff00'; // Green for NPCs
      this.ctx.beginPath();
      this.ctx.arc(
        npcData.x - this.cameraX,
        npcData.y - this.cameraY,
        this.tileSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
    
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

  // Add methods to handle player actions
  public useItem(itemId: string): void {
    this.socket.emit('useItem', itemId);
  }

  public equipItem(itemId: string): void {
    this.socket.emit('equipItem', itemId);
  }

  public unequipItem(slot: string): void {
    this.socket.emit('unequipItem', slot);
  }

  // Toggle between 2D and 3D rendering
  public toggle3DMode(): void {
    this.is3DMode = !this.is3DMode;
    
    if (this.is3DMode && !this.renderer3D) {
      // Initialize 3D renderer if switching to 3D mode
      this.renderer3D = new GameRenderer3D(this.canvas, this.config!);
      
      // Load current floor data
      const floorData = this.floors[this.currentFloor];
      if (floorData) {
        this.renderer3D.loadFloor(this.currentFloor, floorData);
      }
    }
    
    displayMessage(`Switched to ${this.is3DMode ? '3D' : '2D'} mode`, 'info');
  }
}

// Initialize game when the page loads
window.addEventListener('load', () => {
  (window as any).game = new Game();
});