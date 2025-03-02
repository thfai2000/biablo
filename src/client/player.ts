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

interface PlayerStats {
  maxHealth: number;
  currentHealth: number;
  maxMana: number;
  currentMana: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  level: number;
  experience: number;
  nextLevelExp: number;
}

interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'helmet' | 'boots' | 'potion' | 'scroll' | 'misc';
  value: number;
  quantity: number;
  stats?: {
    damage?: number;
    defense?: number;
    healthBonus?: number;
    manaBonus?: number;
    strengthBonus?: number;
    dexterityBonus?: number;
    intelligenceBonus?: number;
  };
  description?: string;
}

interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  helmet: Item | null;
  boots: Item | null;
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
  public size: number; // Add missing property for collision detection

  // Consolidated player stats
  private stats: PlayerStats;
  private inventory: Item[];
  private equipment: Equipment;
  private maxInventorySize: number;

  constructor(config: GameConfig) {
    this.config = config.player;
    this.x = 0;
    this.y = 0;
    this.currentFloor = 0;
    this.moveSpeed = this.config.initialStats.baseSpeed;
    this.size = 24; // Default size for collision detection
    
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

    // Initialize consolidated stats
    this.stats = {
      maxHealth: this.config.initialStats.health,
      currentHealth: this.config.initialStats.health,
      maxMana: this.config.initialStats.mana,
      currentMana: this.config.initialStats.mana,
      strength: this.config.initialStats.strength,
      dexterity: this.config.initialStats.dexterity,
      intelligence: this.config.initialStats.intelligence,
      level: 1,
      experience: 0,
      nextLevelExp: 100
    };
    
    this.inventory = [];
    this.equipment = {
      weapon: null,
      armor: null,
      helmet: null,
      boots: null
    };
    this.maxInventorySize = 20;
    
    this._setupInput();
    this.updateStatusBars();
    
    // Add some starter items
    this.addItem({
      id: 'wooden-sword',
      name: 'Wooden Sword',
      type: 'weapon',
      value: 5,
      quantity: 1,
      stats: {
        damage: 3
      },
      description: 'A simple wooden sword.'
    });
    
    this.addItem({
      id: 'leather-armor',
      name: 'Leather Armor',
      type: 'armor',
      value: 10,
      quantity: 1,
      stats: {
        defense: 2
      },
      description: 'Basic leather armor.'
    });
    
    this.addItem({
      id: 'health-potion',
      name: 'Health Potion',
      type: 'potion',
      value: 5,
      quantity: 3,
      description: 'Restores 25 health points.'
    });
    
    // Equip starter items
    this.equipItem('wooden-sword');
    this.equipItem('leather-armor');
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
          (window as any).lastKeyPressed = e.key;
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
          (window as any).lastKeyPressed = null;
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
      const healthPercent = (this.stats.currentHealth / this.stats.maxHealth) * 100;
      healthBar.style.width = `${healthPercent}%`;
      healthText.textContent = `${this.stats.currentHealth}/${this.stats.maxHealth}`;
    }

    // Update mana bar
    const manaBar = document.querySelector('.mana-bar .stat-bar-fill') as HTMLElement;
    const manaText = document.querySelector('.mana-bar .stat-bar-text') as HTMLElement;
    if (manaBar && manaText) {
      const manaPercent = (this.stats.currentMana / this.stats.maxMana) * 100;
      manaBar.style.width = `${manaPercent}%`;
      manaText.textContent = `${this.stats.currentMana}/${this.stats.maxMana}`;
    }

    // Update experience bar
    const expBar = document.querySelector('.exp-bar .stat-bar-fill') as HTMLElement;
    const expText = document.querySelector('.exp-bar .stat-bar-text') as HTMLElement;
    if (expBar && expText) {
      const expPercent = (this.stats.experience / this.stats.nextLevelExp) * 100;
      expBar.style.width = `${expPercent}%`;
      expText.textContent = `${this.stats.experience}/${this.stats.nextLevelExp}`;
    }
  }

  public gainExperience(amount: number): void {
    this.stats.experience += amount;
    while (this.stats.experience >= this.stats.nextLevelExp) {
      this.levelUp();
    }
    this.updateStatusBars();
  }

  private levelUp(): void {
    this.stats.level++;
    this.stats.experience -= this.stats.nextLevelExp;
    // Increase XP needed for next level by 50%
    this.stats.nextLevelExp = Math.floor(this.stats.nextLevelExp * 1.5);
    
    // Increase stats
    this.stats.maxHealth += 10;
    this.stats.maxMana += 5;
    this.stats.strength += 2;
    this.stats.dexterity += 1;
    this.stats.intelligence += 1;
    
    // Restore HP and MP on level up
    this.stats.currentHealth = this.stats.maxHealth;
    this.stats.currentMana = this.stats.maxMana;
    
    displayMessage(`Level up! You are now level ${this.stats.level}`, 'info');
    displayMessage(`You have ${this.config.levelUpPoints} stat points to spend!`, 'info');
  }

  public takeDamage(amount: number): boolean {
    this.stats.currentHealth = Math.max(0, this.stats.currentHealth - amount);
    this.updateStatusBars();
    
    if (this.stats.currentHealth === 0) {
      displayMessage('You have died!', 'danger');
      // Handle death later
      return true; // Player died
    }
    return false; // Player still alive
  }

  public useMana(amount: number): boolean {
    if (this.stats.currentMana >= amount) {
      this.stats.currentMana -= amount;
      this.updateStatusBars();
      return true;
    }
    return false;
  }

  public heal(amount: number): void {
    this.stats.currentHealth = Math.min(this.stats.maxHealth, this.stats.currentHealth + amount);
    this.updateStatusBars();
  }

  public restoreMana(amount: number): void {
    this.stats.currentMana = Math.min(this.stats.maxMana, this.stats.currentMana + amount);
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
    
    // Collision detection with walls and trees
    const tileX = Math.floor(this.x / game.tileSize);
    const tileY = Math.floor(this.y / game.tileSize);
    
    // Ensure player stays on walkable tiles (0=wall, 4=tree are non-walkable)
    if (tileX < 0 || tileX >= map[0].length || tileY < 0 || tileY >= map.length || 
        map[tileY][tileX] === 0 || map[tileY][tileX] === 4) {
      // Collision with a wall, tree, or out of bounds, revert to previous position
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
        const tileType = map[y][x];
        // Draw different colored tiles based on their type
        if (tileType === 1) { // Floor
          ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
          ctx.fillRect(
            x * tileSize,
            y * tileSize,
            tileSize,
            tileSize
          );
        } else if (tileType === 4) { // Tree - draw as triangle
          // Draw floor underneath first
          ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
          ctx.fillRect(
            x * tileSize,
            y * tileSize,
            tileSize,
            tileSize
          );
          
          // Draw tree as a small triangle
          ctx.fillStyle = 'rgba(34, 139, 34, 0.8)'; // Forest green
          ctx.beginPath();
          ctx.moveTo(x * tileSize + tileSize / 2, y * tileSize);
          ctx.lineTo(x * tileSize + tileSize, y * tileSize + tileSize);
          ctx.lineTo(x * tileSize, y * tileSize + tileSize);
          ctx.closePath();
          ctx.fill();
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

  setupEventListeners() {
    // Movement controls
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
          this.keys.up = true;
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          this.keys.down = true;
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case ' ':
        case 'Enter':
          // Store last key press for stairs interaction
          (window as any).lastKeyPressed = e.key;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
          this.keys.up = false;
          break;
        case 's':
        case 'S':
        case 'ArrowDown':
          this.keys.down = false;
          break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'd':
        case 'D':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case ' ':
        case 'Enter':
          // Reset last key pressed
          (window as any).lastKeyPressed = null;
          break;
      }
    });
  }

  checkCollision(map: number[][], x: number, y: number): boolean {
    // Check if player would collide with a wall
    const tileSize = 32;
    
    // Check top-left corner
    let tileX = Math.floor(x / tileSize);
    let tileY = Math.floor(y / tileSize);
    
    if (tileY < 0 || tileX < 0 || tileY >= map.length || tileX >= map[0].length || map[tileY][tileX] === 0) return true; // Wall
    
    // Check top-right corner
    tileX = Math.floor((x + this.size) / tileSize);
    tileY = Math.floor(y / tileSize);
    
    if (tileY < 0 || tileX < 0 || tileY >= map.length || tileX >= map[0].length || map[tileY][tileX] === 0) return true; // Wall
    
    // Check bottom-left corner
    tileX = Math.floor(x / tileSize);
    tileY = Math.floor((y + this.size) / tileSize);
    
    if (tileY < 0 || tileX < 0 || tileY >= map.length || tileX >= map[0].length || map[tileY][tileX] === 0) return true; // Wall
    
    // Check bottom-right corner
    tileX = Math.floor((x + this.size) / tileSize);
    tileY = Math.floor((y + this.size) / tileSize);
    
    if (tileY < 0 || tileX < 0 || tileY >= map.length || tileX >= map[0].length || map[tileY][tileX] === 0) return true; // Wall
    
    return false;
  }
  
  checkStairsInteraction(): boolean {
    return (
      document.activeElement === document.body && // Make sure no input is focused
      (window as any).lastKeyPressed && 
      ((window as any).lastKeyPressed === ' ' || 
       (window as any).lastKeyPressed === 'Enter')
    );
  }
  
  // Inventory and Equipment methods
  addItem(item: Item): boolean {
    // Check if inventory is full
    if (this.inventory.length >= this.maxInventorySize) {
      return false;
    }
    
    // Check if similar item exists in inventory
    const existingItemIndex = this.inventory.findIndex(i => i.id === item.id);
    
    if (existingItemIndex >= 0) {
      // Increase quantity of existing item
      this.inventory[existingItemIndex].quantity += item.quantity;
      return true;
    } else {
      // Add new item to inventory
      this.inventory.push({ ...item });
      return true;
    }
  }
  
  removeItem(itemId: string, quantity: number = 1): boolean {
    const itemIndex = this.inventory.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return false;
    }
    
    const item = this.inventory[itemIndex];
    
    if (item.quantity <= quantity) {
      // Remove entire stack
      this.inventory.splice(itemIndex, 1);
    } else {
      // Reduce quantity
      item.quantity -= quantity;
    }
    
    return true;
  }
  
  equipItem(itemId: string): boolean {
    const itemIndex = this.inventory.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return false;
    }
    
    const item = this.inventory[itemIndex];
    
    if (!['weapon', 'armor', 'helmet', 'boots'].includes(item.type)) {
      return false;
    }
    
    // Unequip current item if present
    if (this.equipment[item.type as keyof Equipment]) {
      // Add current equipped item back to inventory
      this.addItem(this.equipment[item.type as keyof Equipment]!);
    }
    
    // Equip new item
    this.equipment[item.type as keyof Equipment] = { ...item };
    
    // Remove from inventory
    this.removeItem(itemId);
    
    // Apply stat bonuses
    this.updateStats();
    
    return true;
  }
  
  unequipItem(slot: keyof Equipment): boolean {
    const equippedItem = this.equipment[slot];
    
    if (!equippedItem) {
      return false;
    }
    
    // Check if inventory has space
    if (this.inventory.length >= this.maxInventorySize) {
      return false;
    }
    
    // Add item back to inventory
    this.addItem(equippedItem);
    
    // Remove from equipment
    this.equipment[slot] = null;
    
    // Update stats
    this.updateStats();
    
    return true;
  }
  
  updateStats(): void {
    // Reset stats to base values
    this.stats.maxHealth = 100 + (this.stats.level - 1) * 10;
    this.stats.maxMana = 50 + (this.stats.level - 1) * 5;
    this.stats.strength = 10 + (this.stats.level - 1) * 2;
    this.stats.dexterity = 8 + (this.stats.level - 1);
    this.stats.intelligence = 5 + (this.stats.level - 1);
    
    // Apply equipment bonuses
    Object.values(this.equipment).forEach(item => {
      if (item && item.stats) {
        if (item.stats.healthBonus) this.stats.maxHealth += item.stats.healthBonus;
        if (item.stats.manaBonus) this.stats.maxMana += item.stats.manaBonus;
        if (item.stats.strengthBonus) this.stats.strength += item.stats.strengthBonus;
        if (item.stats.dexterityBonus) this.stats.dexterity += item.stats.dexterityBonus;
        if (item.stats.intelligenceBonus) this.stats.intelligence += item.stats.intelligenceBonus;
      }
    });
    
    // Ensure current values don't exceed max
    if (this.stats.currentHealth > this.stats.maxHealth) {
      this.stats.currentHealth = this.stats.maxHealth;
    }
    
    if (this.stats.currentMana > this.stats.maxMana) {
      this.stats.currentMana = this.stats.maxMana;
    }
  }
  
  useItem(itemId: string): boolean {
    const itemIndex = this.inventory.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return false;
    }
    
    const item = this.inventory[itemIndex];
    
    if (item.type === 'potion') {
      // Apply potion effects
      if (item.id === 'health-potion') {
        this.stats.currentHealth = Math.min(this.stats.currentHealth + 25, this.stats.maxHealth);
        this.updateStatusBars();
      } else if (item.id === 'mana-potion') {
        this.stats.currentMana = Math.min(this.stats.currentMana + 25, this.stats.maxMana);
        this.updateStatusBars();
      }
      
      // Remove used potion
      this.removeItem(itemId, 1);
      return true;
    }
    
    return false;
  }
  
  // Methods for UI access
  getStats(): PlayerStats {
    return { ...this.stats };
  }
  
  getInventory(): Item[] {
    return [...this.inventory];
  }
  
  getEquipment(): Equipment {
    return {
      weapon: this.equipment.weapon ? { ...this.equipment.weapon } : null,
      armor: this.equipment.armor ? { ...this.equipment.armor } : null,
      helmet: this.equipment.helmet ? { ...this.equipment.helmet } : null,
      boots: this.equipment.boots ? { ...this.equipment.boots } : null
    };
  }
}