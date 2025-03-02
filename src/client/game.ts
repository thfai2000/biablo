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
  enemyLevel?: number;
  enemyDensity?: number;
  treasureChestDensity?: number;
}

interface Assets {
  tiles: {
    wall: string;
    floor: string;
    upStairs: string;
    downStairs: string;
    tree: string; // New tree tile type
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
  private showStatusPopup: boolean;
  private statusButtonRect: { x: number, y: number, width: number, height: number };
  
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
    
    // Add click event listener for status button
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    
    displayMessage('Welcome to the village! Find the cave to enter the dungeon.', 'info');
    
    // Start game loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  handleCanvasClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if status button was clicked
    if (x >= this.statusButtonRect.x && 
        x <= this.statusButtonRect.x + this.statusButtonRect.width &&
        y >= this.statusButtonRect.y && 
        y <= this.statusButtonRect.y + this.statusButtonRect.height) {
      this.showStatusPopup = !this.showStatusPopup;
    } else if (this.showStatusPopup) {
      // Close popup if clicking outside of it (we'll check if it's inside the popup area)
      const popupX = this.canvas.width / 2 - 200;
      const popupY = this.canvas.height / 2 - 250;
      const popupWidth = 400;
      const popupHeight = 500;
      
      if (!(x >= popupX && x <= popupX + popupWidth &&
            y >= popupY && y <= popupY + popupHeight)) {
        this.showStatusPopup = false;
      }
    }
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
    
    // Add enemy and treasure density to floor data
    const floorConfig = this.config.floors.find(floor => floor.level === level);
    if (floorConfig) {
      this.floors[level].enemyLevel = floorConfig.enemyLevel;
      this.floors[level].enemyDensity = floorConfig.enemyDensity;
      this.floors[level].treasureChestDensity = floorConfig.treasureChestDensity;
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
    
    // Draw status button
    this.drawStatusButton();
    
    // Draw status popup if open
    if (this.showStatusPopup) {
      this.renderStatusPopup();
    }
  }
  
  drawStatusButton(): void {
    const buttonX = this.canvas.width - 120;
    const buttonY = 20;
    const buttonWidth = 100;
    const buttonHeight = 40;
    
    // Store button position and dimensions for click detection
    this.statusButtonRect = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
    
    // Button background
    this.ctx.fillStyle = '#444';
    this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Button border
    this.ctx.strokeStyle = '#aaa';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Button text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Status', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
  }
  
  renderStatusPopup(): void {
    if (!this.player) return;
    
    const playerStats = this.player.getStats();
    const inventory = this.player.getInventory();
    const equipment = this.player.getEquipment();
    
    // Draw popup background
    const popupX = this.canvas.width / 2 - 200;
    const popupY = this.canvas.height / 2 - 250;
    const popupWidth = 400;
    const popupHeight = 500;
    
    // Semi-transparent background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Popup panel
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(popupX, popupY, popupWidth, popupHeight);
    
    // Popup border
    this.ctx.strokeStyle = '#gold';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(popupX, popupY, popupWidth, popupHeight);
    
    // Title
    this.ctx.fillStyle = '#gold';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Player Status', popupX + popupWidth / 2, popupY + 30);
    this.ctx.textAlign = 'left';
    
    // Draw stats section
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Stats:', popupX + 20, popupY + 60);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = '14px Arial';
    this.ctx.fillText(`Health: ${playerStats.currentHealth}/${playerStats.maxHealth}`, popupX + 30, popupY + 85);
    this.ctx.fillText(`Mana: ${playerStats.currentMana}/${playerStats.maxMana}`, popupX + 30, popupY + 105);
    this.ctx.fillText(`Strength: ${playerStats.strength}`, popupX + 30, popupY + 125);
    this.ctx.fillText(`Dexterity: ${playerStats.dexterity}`, popupX + 30, popupY + 145);
    this.ctx.fillText(`Intelligence: ${playerStats.intelligence}`, popupX + 30, popupY + 165);
    this.ctx.fillText(`Level: ${playerStats.level}`, popupX + 30, popupY + 185);
    this.ctx.fillText(`Experience: ${playerStats.experience}/${playerStats.nextLevelExp}`, popupX + 30, popupY + 205);
    
    // Draw equipment section
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Equipment:', popupX + 20, popupY + 235);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = '14px Arial';
    this.ctx.fillText(`Weapon: ${equipment.weapon ? equipment.weapon.name : 'None'}`, popupX + 30, popupY + 260);
    this.ctx.fillText(`Armor: ${equipment.armor ? equipment.armor.name : 'None'}`, popupX + 30, popupY + 280);
    this.ctx.fillText(`Helmet: ${equipment.helmet ? equipment.helmet.name : 'None'}`, popupX + 30, popupY + 300);
    this.ctx.fillText(`Boots: ${equipment.boots ? equipment.boots.name : 'None'}`, popupX + 30, popupY + 320);
    
    // Draw inventory section
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Inventory:', popupX + 20, popupY + 350);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = '14px Arial';
    if (inventory.length === 0) {
      this.ctx.fillText('Empty', popupX + 30, popupY + 375);
    } else {
      inventory.slice(0, 5).forEach((item, index) => {
        this.ctx.fillText(`${index + 1}. ${item.name} ${item.quantity > 1 ? `(${item.quantity})` : ''}`, 
          popupX + 30, popupY + 375 + index * 20);
      });
      
      if (inventory.length > 5) {
        this.ctx.fillText(`... and ${inventory.length - 5} more items`, popupX + 30, popupY + 475);
      }
    }
    
    // Close button
    this.ctx.fillStyle = '#444';
    this.ctx.fillRect(popupX + popupWidth - 80, popupY + 10, 60, 25);
    this.ctx.strokeStyle = '#aaa';
    this.ctx.strokeRect(popupX + popupWidth - 80, popupY + 10, 60, 25);
    
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Close', popupX + popupWidth - 50, popupY + 25);
    this.ctx.textAlign = 'left';
  }
}

// Initialize game when the page loads
window.addEventListener('load', () => {
  (window as any).game = new Game();
});