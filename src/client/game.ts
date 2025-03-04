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
  private config: GameConfig | null;
  private player: Player | null;
  private floors: { [key: number]: FloorData };
  private currentFloor: number;
  private lastTime: number;
  private assets: Assets;
  private showStatusPopup: boolean;
  private statusButtonRect: { x: number, y: number, width: number, height: number };
  private statsWidget: StatsWidget;
  private socket: Socket;
  private playerId: string | null;
  private otherPlayers: Map<string, any>;
  private npcs: Map<string, any>;
  private minimapSize: number;
  private minimapScale: number;
  private renderer3D: GameRenderer3D | null;
  private tileSize: number;  // Keep tileSize for game logic

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.tileSize = 32;
    this.config = null;
    this.player = null;
    this.floors = {};
    this.currentFloor = 0;
    this.lastTime = 0;
    this.showStatusPopup = false;
    this.statusButtonRect = { x: 0, y: 0, width: 0, height: 0 };
    this.statsWidget = new StatsWidget();
    this.playerId = null;
    this.otherPlayers = new Map();
    this.npcs = new Map();
    
    this.minimapSize = 150;
    this.minimapScale = 0.2;
    
    this.renderer3D = null;
    
    // Initialize Socket.IO connection
    this.socket = io();
    this.setupSocketListeners();
    
    // Assets (will be used by 3D renderer)
    this.assets = {
      tiles: {
        wall: '#333',
        floor: '#555',
        upStairs: '#77f',
        downStairs: '#f77',
        tree: '#0a5'  
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
    } else if (this.renderer3D) {
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
      } else {
        this.player.placeAtStairs(result.direction, currentFloor.upStairsPos ? { ...currentFloor.upStairsPos } : undefined, undefined);
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
          if (this.renderer3D) {
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
    try {
        // Set canvas size before anything else
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Load game config first
        this.config = await fetchGameConfig();
        
        if (!this.config) {
            throw new Error('Could not load game configuration');
        }

        // Initialize renderer before player
        this.renderer3D = new GameRenderer3D(this.canvas, this.config);
        
        // Test WebGL context
        if (!this.renderer3D || !(this.renderer3D as any).renderer?.getContext()) {
            throw new Error('WebGL context initialization failed');
        }
        
        // Initialize player
        this.player = new Player(this.config);
        this.statsWidget.setPlayer(this.player);

        // Get initial floor data
        this.floors[0] = await this.getFloor(0);
        
        // Set initial position
        this.currentFloor = 0;
        const startPos = this.getStartingPosition(0);
        if (this.player && startPos) {
            this.player.x = startPos.x * this.tileSize;
            this.player.y = startPos.y * this.tileSize;
            this.player.z = 0;
        }

        // Load floor into renderer
        if (this.floors[0]) {
            this.renderer3D.loadFloor(0, this.floors[0]);
        }

        // Setup event listeners
        this.setupEventListeners();
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Register with server
        this.socket.emit('registerPlayer', {username: 'Player 1'});
        displayMessage('Welcome to the village! Find the cave to enter the dungeon.', 'info');

        // Start game loop with initial timestamp
        requestAnimationFrame((time) => this.gameLoop(time));

    } catch (error) {
        console.error('Game initialization failed:', error);
        displayMessage('Failed to initialize game. Please refresh the page.', 'danger');
    }
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
        x: Math.floor(map[0][0].length / 2),
        y: Math.floor(map[0].length / 2),
        z: 0
      };
    } else {
      // Start at up stairs for dungeon floors
      return floor.upStairsPos || {
        x: Math.floor(floor.map[0][0].length / 2),
        y: Math.floor(floor.map[0].length / 2),
        z: 0
      };
    }
  }
  
  resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight * 0.8; // 80% of window height
    if (this.renderer3D) {
      this.renderer3D.onWindowResize(this.canvas);
    }
  }
  
  gameLoop(currentTime: number): void {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update game state
    if (this.player) {
      const currentFloor = this.floors[this.currentFloor];
      if (currentFloor && currentFloor.map) {
        this.player.update(
          currentFloor.map[0],
          currentFloor.upStairsPos || undefined,
          currentFloor.downStairsPos || undefined
        );
      }
    }

    // Use 3D renderer exclusively
    if (this.renderer3D) {
      // Update player positions
      if (this.player) {
        this.renderer3D.updatePlayer('self', this.player.x, this.player.y, this.player.z);
      }

      // Update other players
      this.otherPlayers.forEach((playerData, id) => {
        this.renderer3D!.updatePlayer(id, playerData.x, playerData.y, playerData.z || 0);
      });

      // Update NPCs
      this.npcs.forEach((npcData, id) => {
        this.renderer3D!.updateNPC(id, npcData.type, npcData.x, npcData.y, npcData.z || 0);
      });

      // Render 3D scene with UI
      this.renderer3D.render();
    }

    // Continue the game loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  private renderUI(): void {
    // Use the 3D renderer to render UI elements instead of 2D context
    if (!this.renderer3D) return;

    // Create text sprites for UI elements
    const textElements = [];

    // Floor info
    textElements.push({
      text: `Floor: ${this.currentFloor}`,
      position: { x: 10, y: 20 },
      color: 0xffffff
    });

    // Instructions
    textElements.push({
      text: 'Use arrow keys or WASD to move',
      position: { x: 10, y: 40 },
      color: 0xffffff
    });
    textElements.push({
      text: 'Press Space or Enter at stairs to change floors',
      position: { x: 10, y: 60 },
      color: 0xffffff
    });

    // Player stats
    if (this.player) {
      const playerStats = this.player.getStats();
      textElements.push({
        text: `HP: ${playerStats.currentHealth}/${playerStats.maxHealth}`,
        position: { x: 10, y: 90 },
        color: 0xffffff
      });
      textElements.push({
        text: `Mana: ${playerStats.currentMana}/${playerStats.maxMana}`,
        position: { x: 10, y: 110 },
        color: 0xffffff
      });
    }

    // Connection status
    const connectionStatus = this.socket.connected ? 'Connected' : 'Disconnected';
    const statusColor = this.socket.connected ? 0x00ff00 : 0xff0000;
    textElements.push({
      text: `Server: ${connectionStatus}`,
      position: { x: 10, y: 130 },
      color: statusColor
    });

    // Update the UI elements in the renderer
    this.renderer3D.updateUIText(textElements);

    // Handle stats widget visibility
    if (this.statsWidget.isCurrentlyVisible()) {
      // Pass stats data to renderer for WebGL rendering
      const playerData = this.player ? {
        stats: this.player.getStats(),
        inventory: this.player.getInventory(),
        equipment: this.player.getEquipment()
      } : null;
      
      this.renderer3D.renderStatsWidget(playerData);
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
}

// Initialize game when the page loads
window.addEventListener('load', () => {
  (window as any).game = new Game();
});