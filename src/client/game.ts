import { GameConfig } from '../types/game-config';
import { Player } from './player';
import { DungeonGenerator } from './dungeon-generator';
import { fetchGameConfig, displayMessage } from './utils';

interface Position {
  x: number;
  y: number;
}

interface FloorData {
  map: number[][];
  upStairsPos: Position | null;
  downStairsPos: Position | null;
}

interface Assets {
  tiles: {
    wall: string;
    floor: string;
    upStairs: string;
    downStairs: string;
  };
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
    
    // Assets
    this.assets = {
      tiles: {
        wall: '#333',
        floor: '#555',
        upStairs: '#77f',
        downStairs: '#f77'
      }
    };
    
    this.init();
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
    
    // Generate the initial floor (village)
    this.generateFloor(0);
    
    // Start in the village
    this.currentFloor = 0;
    const startPos = this.getStartingPosition(0);
    if (this.player && startPos) {
      this.player.x = startPos.x * this.tileSize;
      this.player.y = startPos.y * this.tileSize;
    }
    
    displayMessage('Welcome to the village! Find the cave to enter the dungeon.', 'info');
    
    // Start game loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  
  generateFloor(level: number): void {
    if (this.floors[level]) {
      return; // Floor already generated
    }
    
    if (!this.config) return;
    
    const generator = new DungeonGenerator(this.config, level);
    
    if (level === 0) {
      // Generate village
      this.floors[level] = generator.generateVillage();
    } else {
      // Generate dungeon floor
      this.floors[level] = generator.generate();
    }
    
    displayMessage(`Generated floor ${level}`, 'info');
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
    this.canvas.height = window.innerHeight * 0.9; // 90% of window height
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
    
    // Make sure the current floor is generated
    if (!this.floors[this.currentFloor]) {
      this.generateFloor(this.currentFloor);
    }
    
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
      
      // Make sure the floor is generated
      if (!this.floors[this.currentFloor]) {
        this.generateFloor(this.currentFloor);
      }
      
      const currentFloor = this.floors[this.currentFloor];
      if (currentFloor && result.direction) {
        // Place player at appropriate stairs
        this.player.placeAtStairs(
          result.direction, 
          currentFloor.upStairsPos || undefined, 
          currentFloor.downStairsPos || undefined
        );
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
    
    const { map, upStairsPos, downStairsPos } = floorData;
    
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
            break;
          case 1: // Floor
            this.ctx.fillStyle = this.assets.tiles.floor;
            break;
          case 2: // Up stairs
            this.ctx.fillStyle = this.assets.tiles.upStairs;
            break;
          case 3: // Down stairs
            this.ctx.fillStyle = this.assets.tiles.downStairs;
            break;
        }
        
        this.ctx.fillRect(
          x * this.tileSize - this.cameraX,
          y * this.tileSize - this.cameraY,
          this.tileSize,
          this.tileSize
        );
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
  }
}

// Initialize game when the page loads
window.addEventListener('load', () => {
  (window as any).game = new Game();
});