import { GameConfig } from '../types/game-config';
import { displayMessage } from './utils';

interface Position {
  x: number;
  y: number;
}

interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
  toggleMap: boolean;
}

interface FloorChangeResult {
  floorChange: boolean;
  direction?: 'up' | 'down';
}

export class Player {
  private config: any;
  public x: number;
  public y: number;
  public currentFloor: number;
  private moveSpeed: number;
  private keys: Keys;
  private actionCooldown: number;
  private lastActionTime: number;
  public showMinimap: boolean;
  private minimapSize: number;
  private minimapScale: number;

  // New stats properties
  private currentHealth: number;
  private maxHealth: number;
  private currentMana: number;
  private maxMana: number;
  private experience: number;
  private level: number;
  private experienceToNextLevel: number;

  constructor(config: GameConfig) {
    this.config = config.player;
    this.x = 0;
    this.y = 0;
    this.currentFloor = 0;
    this.moveSpeed = this.config.initialStats.baseSpeed;

    // Initialize stats
    this.currentHealth = this.config.initialStats.health;
    this.maxHealth = this.config.initialStats.health;
    this.currentMana = this.config.initialStats.mana;
    this.maxMana = this.config.initialStats.mana;
    this.experience = 0;
    this.level = 1;
    this.experienceToNextLevel = 100; // Base XP needed for level 2
    
    // Set up keyboard controls
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
      toggleMap: false
    };
    
    // Add cooldown for action key
    this.actionCooldown = 1000; // 1 second cooldown
    this.lastActionTime = 0;
    
    // Minimap settings
    this.showMinimap = true; // Default to showing the minimap
    this.minimapSize = 150;  // Size of the minimap in pixels
    this.minimapScale = 0.2; // Scale factor for the minimap
    
    this._setupInput();

    // Update status bars initially
    this.updateStatusBars();
  }

  private _setupInput(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
          this.keys.up = true;
          break;
        case 'ArrowDown':
        case 's':
          this.keys.down = true;
          break;
        case 'ArrowLeft':
        case 'a':
          this.keys.left = true;
          break;
        case 'ArrowRight':
        case 'd':
          this.keys.right = true;
          break;
        case ' ':
        case 'Enter':
          this.keys.action = true;
          break;
        case 'm': // Add key to toggle minimap
          this.keys.toggleMap = true;
          this.toggleMinimap();
          break;
      }
    });
    
    document.addEventListener('keyup', (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
          this.keys.up = false;
          break;
        case 'ArrowDown':
        case 's':
          this.keys.down = false;
          break;
        case 'ArrowLeft':
        case 'a':
          this.keys.left = false;
          break;
        case 'ArrowRight':
        case 'd':
          this.keys.right = false;
          break;
        case ' ':
        case 'Enter':
          this.keys.action = false;
          break;
        case 'm':
          this.keys.toggleMap = false;
          break;
      }
    });
  }

  private updateStatusBars(): void {
    // Update health bar
    const healthBar = document.querySelector('.health-bar .stat-bar-fill') as HTMLElement;
    const healthText = document.querySelector('.health-bar .stat-bar-text') as HTMLElement;
    if (healthBar && healthText) {
      const healthPercent = (this.currentHealth / this.maxHealth) * 100;
      healthBar.style.width = `${healthPercent}%`;
      healthText.textContent = `${this.currentHealth}/${this.maxHealth}`;
    }

    // Update mana bar
    const manaBar = document.querySelector('.mana-bar .stat-bar-fill') as HTMLElement;
    const manaText = document.querySelector('.mana-bar .stat-bar-text') as HTMLElement;
    if (manaBar && manaText) {
      const manaPercent = (this.currentMana / this.maxMana) * 100;
      manaBar.style.width = `${manaPercent}%`;
      manaText.textContent = `${this.currentMana}/${this.maxMana}`;
    }

    // Update experience bar
    const expBar = document.querySelector('.exp-bar .stat-bar-fill') as HTMLElement;
    const expText = document.querySelector('.exp-bar .stat-bar-text') as HTMLElement;
    if (expBar && expText) {
      const expPercent = (this.experience / this.experienceToNextLevel) * 100;
      expBar.style.width = `${expPercent}%`;
      expText.textContent = `${this.experience}/${this.experienceToNextLevel}`;
    }
  }

  public gainExperience(amount: number): void {
    this.experience += amount;
    while (this.experience >= this.experienceToNextLevel) {
      this.levelUp();
    }
    this.updateStatusBars();
  }

  private levelUp(): void {
    this.level++;
    this.experience -= this.experienceToNextLevel;
    // Increase XP needed for next level by 50%
    this.experienceToNextLevel = Math.floor(this.experienceToNextLevel * 1.5);
    
    // Restore HP and MP on level up
    this.currentHealth = this.maxHealth;
    this.currentMana = this.maxMana;
    
    displayMessage(`Level up! You are now level ${this.level}`, 'info');
    displayMessage(`You have ${this.config.levelUpPoints} stat points to spend!`, 'info');
  }

  public takeDamage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    this.updateStatusBars();
    
    if (this.currentHealth === 0) {
      displayMessage('You have died!', 'danger');
      // Handle death later
    }
  }

  public useMana(amount: number): boolean {
    if (this.currentMana >= amount) {
      this.currentMana -= amount;
      this.updateStatusBars();
      return true;
    }
    return false;
  }

  public heal(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    this.updateStatusBars();
  }

  public restoreMana(amount: number): void {
    this.currentMana = Math.min(this.maxMana, this.currentMana + amount);
    this.updateStatusBars();
  }

  public update(map: number[][], upStairsPos?: Position, downStairsPos?: Position): FloorChangeResult {
    // Store previous position
    const oldX = this.x;
    const oldY = this.y;
    
    // Handle movement
    if (this.keys.up) {
      this.y -= this.moveSpeed;
    }
    if (this.keys.down) {
      this.y += this.moveSpeed;
    }
    if (this.keys.left) {
      this.x -= this.moveSpeed;
    }
    if (this.keys.right) {
      this.x += this.moveSpeed;
    }
    
    // Get reference to game for tileSize
    const game = (window as any).game;
    
    // Collision detection with walls
    const tileX = Math.floor(this.x / game.tileSize);
    const tileY = Math.floor(this.y / game.tileSize);
    
    // Ensure player stays on walkable tiles
    if (tileX < 0 || tileX >= map[0].length || tileY < 0 || tileY >= map.length || map[tileY][tileX] === 0) {
      // Collision with a wall or out of bounds, revert to previous position
      this.x = oldX;
      this.y = oldY;
    }
    
    // Check for stairs interaction with cooldown
    const currentTime = Date.now();
    if (this.keys.action && currentTime - this.lastActionTime > this.actionCooldown) {
      // Handle up stairs
      if (upStairsPos && tileX === upStairsPos.x && tileY === upStairsPos.y) {
        this.currentFloor--;
        this.lastActionTime = currentTime; // Update last action time
        displayMessage(`Going up to floor ${this.currentFloor}`);
        return { floorChange: true, direction: 'up' };
      }
      
      // Handle down stairs
      if (downStairsPos && tileX === downStairsPos.x && tileY === downStairsPos.y) {
        this.currentFloor++;
        this.lastActionTime = currentTime; // Update last action time
        displayMessage(`Going down to floor ${this.currentFloor}`);
        return { floorChange: true, direction: 'down' };
      }
    }
    
    return { floorChange: false };
  }
  
  public placeAtStairs(direction: string, upStairsPos?: Position, downStairsPos?: Position): void {
    const game = (window as any).game;
    // Place player at the appropriate stairs position after changing floors
    if (direction === 'up' && downStairsPos) {
      this.x = downStairsPos.x * game.tileSize;
      this.y = downStairsPos.y * game.tileSize;
    } else if (direction === 'down' && upStairsPos) {
      this.x = upStairsPos.x * game.tileSize;
      this.y = upStairsPos.y * game.tileSize;
    }
  }
  
  public toggleMinimap(): void {
    this.showMinimap = !this.showMinimap;
    displayMessage(`Minimap ${this.showMinimap ? 'enabled' : 'disabled'}`);
  }
  
  public draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, map: number[][], upStairsPos?: Position, downStairsPos?: Position): void {
    const game = (window as any).game;

    // Draw the player
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(
      this.x - offsetX, 
      this.y - offsetY, 
      game.tileSize / 2, 
      0, 
      Math.PI * 2
    );
    ctx.fill();
    
    // Try to get map data from game.currentFloor if not provided directly
    let mapData = map;
    let upStairsPosition = upStairsPos;
    let downStairsPosition = downStairsPos;
    
    // If map data not provided, try to get it from the game object
    if (!mapData && game && game.dungeonFloors) {
      const currentFloorData = game.dungeonFloors[this.currentFloor];
      if (currentFloorData) {
        mapData = currentFloorData.map;
        upStairsPosition = currentFloorData.upStairsPos;
        downStairsPosition = currentFloorData.downStairsPos;
      }
    }
    
    // Draw the minimap if map data is available
    if (mapData) {
      this.drawMinimap(ctx, mapData, upStairsPosition, downStairsPosition);
    } else {
      console.warn('No map data available for minimap rendering');
    }

    // Update status bars each frame
    this.updateStatusBars();
  }
  
  private drawMinimap(ctx: CanvasRenderingContext2D, map: number[][], upStairsPos?: Position, downStairsPos?: Position): void {
    if (!this.showMinimap || !map) return;
    
    const game = (window as any).game;
    
    // Save the current context state
    ctx.save();
    
    const margin = 10;
    const mapSize = this.minimapSize;
    const tileSize = Math.max(2, game.tileSize * this.minimapScale); // Ensure tiles are at least 2px
    
    // Position the minimap in the top-right corner
    const minimapX = ctx.canvas.width - mapSize - margin;
    const minimapY = margin;
    
    // Draw minimap background with higher opacity
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(minimapX, minimapY, mapSize, mapSize);
    
    // Calculate scaling to fit the map in the minimap area
    const mapWidth = map[0].length * tileSize;
    const mapHeight = map.length * tileSize;
    const scaleX = mapSize / mapWidth;
    const scaleY = mapSize / mapHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed
    
    // Center the map in the minimap area
    const scaledWidth = mapWidth * scale;
    const scaledHeight = mapHeight * scale;
    const offsetX = minimapX + (mapSize - scaledWidth) / 2;
    const offsetY = minimapY + (mapSize - scaledHeight) / 2;
    
    // Apply scaling
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // Draw the map tiles
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        // Only draw the tile if it's walkable
        if (map[y][x] === 1) {
          ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
          ctx.fillRect(
            x * tileSize,
            y * tileSize,
            tileSize,
            tileSize
          );
        }
      }
    }
    
    // Draw stairs on minimap
    if (upStairsPos) {
      ctx.fillStyle = 'rgba(0, 255, 0, 1)';
      ctx.fillRect(
        upStairsPos.x * tileSize,
        upStairsPos.y * tileSize,
        tileSize,
        tileSize
      );
    }
    
    if (downStairsPos) {
      ctx.fillStyle = 'rgba(255, 165, 0, 1)';
      ctx.fillRect(
        downStairsPos.x * tileSize,
        downStairsPos.y * tileSize,
        tileSize,
        tileSize
      );
    }
    
    // Draw player position on minimap
    const playerTileX = Math.floor(this.x / game.tileSize);
    const playerTileY = Math.floor(this.y / game.tileSize);
    
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.fillRect(
      playerTileX * tileSize,
      playerTileY * tileSize,
      tileSize,
      tileSize
    );
    
    // Restore the context state
    ctx.restore();
    
    // Draw border around minimap (after restore to ensure it's not scaled)
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(minimapX, minimapY, mapSize, mapSize);
  }
}