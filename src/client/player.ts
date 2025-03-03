import { GameConfig, Position, PlayerPostiton } from '../types/game-config';
import { displayMessage } from './utils';
import { DrawingHelper } from './DrawingHelper';

 /**
   * Get the current state to send to server
   */
 interface InputState {
  position: {
    x: number;
    y: number;
    timestamp: number;
  };
  movement: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  action: boolean;
  toggleMap: boolean;
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
  // Core player properties
  public id: string;
  public username: string;
  public x: number;
  public y: number;
  public currentFloor: number;
  public size: number;
  private moveSpeed: number;
  private lastUpdateTime: number;

  // Input controls
  private keys: Keys;
  private lastKeyPressed: string | null;
  private previousInputState: InputState | null;
  
  // Display properties
  public showMinimap: boolean;

  // Player state
  private stats: PlayerStats;
  private inventory: Item[];
  private equipment: Equipment;
  
  constructor(config: GameConfig) {
    // Initialize basic properties
    this.id = '';
    this.username = 'Player';
    this.x = 0;
    this.y = 0;
    this.currentFloor = config.game.initialFloor;
    this.size = 24; // Default size for collision detection
    this.moveSpeed = config.player.initialStats.baseSpeed;
    this.lastUpdateTime = Date.now();
    
    // Input controls
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
      toggleMap: false
    };
    this.lastKeyPressed = null;
    this.previousInputState = null;
    
    // Minimap settings
    this.showMinimap = true;


    // Initialize player stats with default values
    this.stats = {
      maxHealth: 100,
      currentHealth: 100,
      maxMana: 50,
      currentMana: 50,
      strength: 10,
      dexterity: 8,
      intelligence: 5,
      level: 1,
      experience: 0,
      nextLevelExp: 100
    };
    
    // Initialize empty inventory and equipment
    this.inventory = [];
    this.equipment = {
      weapon: null,
      armor: null,
      helmet: null,
      boots: null
    };
    
    // Set up input event listeners
    this._setupInput();
  }

  /**
   * Register the player with the server
   * @param username The player's username
   */
  public register(username: string): void {
    this.username = username;
  }

  /**
   * Set up keyboard input event listeners
   */
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
          this.lastKeyPressed = e.key;
          break;
        case 'm':
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
          this.lastKeyPressed = null;
          break;
        case 'm':
          this.keys.toggleMap = false;
          break;
      }
    });
  }

 

  /**
   * Retrieves the current input state of the player.
   *
   * @returns {InputState} An object representing the player's current input state, including position, movement, action, and toggleMap status.
   */
  public getInputState(): InputState {
    const currentTime = Date.now();
    return {
      position: {
      x: this.x,
      y: this.y,
      timestamp: currentTime
      },
      movement: {
        up: this.keys.up,
        down: this.keys.down,
        left: this.keys.left,
        right: this.keys.right
      },
      action: this.keys.action,
      toggleMap: this.keys.toggleMap
    };
  }

  /**
   * Handle registration response
   */
  public handleRegistration(id: string, playerData: any): void {
    this.id = id;
    this.updateFromServerData(playerData);
    this.updateStatusBars();
  }

  /**
   * Handle floor change
   */
  public handleFloorChange(floorLevel: number): void {
    this.currentFloor = floorLevel;
  }
  
  /**
   * Handle game state update for this player
   */
  public handleGameStateUpdate(playerData: any): void {
    this.updateFromServerData(playerData);
  }

  /**
   * Handle inventory update
   */
  public handleInventoryUpdate(data: { 
    inventory: Item[], 
    equipment?: Equipment, 
    stats: PlayerStats
  }): void {
    this.inventory = data.inventory;
    if (data.equipment) {
      this.equipment = data.equipment;
    }
    this.stats = data.stats;
    this.updateStatusBars();
  }

  /**
   * Update player data from server state
   */
  private updateFromServerData(data: any): void {
    this.x = data.x;
    this.y = data.y;
    this.currentFloor = data.currentFloor;
    this.stats = data.stats;
    
    // Only update equipment/inventory if provided
    if (data.equipment) {
      this.equipment = data.equipment;
    }
    
    if (data.inventory) {
      this.inventory = data.inventory;
    }
  }

  /**
   * Update visual status bars for health, mana, experience
   */
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

  /**
   * Update method called by game loop
   */
  public update(map: number[][], upStairsPos?: Position, downStairsPos?: Position): FloorChangeResult {
    // Calculate delta time for smooth movement
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = currentTime;


    // Handle player movement based on key input
    let dx = 0;
    let dy = 0;
    
    // Calculate movement direction
    if (this.keys.up) {
      dy -= this.moveSpeed * deltaTime;
    }
    if (this.keys.down) {
      dy += this.moveSpeed * deltaTime;
    }
    if (this.keys.left) {
      dx -= this.moveSpeed * deltaTime;
    }
    if (this.keys.right) {
      dx += this.moveSpeed * deltaTime;
    }
    
    // Apply movement if any keys are pressed
    if (dx !== 0 || dy !== 0) {
      // Calculate new position
      const newX = this.x + dx;
      const newY = this.y + dy;
      
      // Check for collision with map boundaries and walls
      const tileSize = this.size;
      const playerCenterX = newX + tileSize / 2;
      const playerCenterY = newY + tileSize / 2;
      
      // Get map tile position
      const tileX = Math.floor(playerCenterX / tileSize);
      const tileY = Math.floor(playerCenterY / tileSize);
      
      // Check map boundaries
      if (tileX >= 0 && tileX < map[0].length && tileY >= 0 && tileY < map.length) {
        // Check if the tile is walkable (1 = floor, 2 = up stairs, 3 = down stairs)
        const isTileWalkable = map[tileY][tileX] !== 0;
        
        if (isTileWalkable) {
          // Update position if no collision
          this.x = newX;
          this.y = newY;
        }
      }
    }

    // Check for floor change
    if (this.keys.action) {
      if (upStairsPos && this.x === upStairsPos.x * this.size && this.y === upStairsPos.y * this.size) {
        return { floorChange: true, direction: 'up' };
      } else if (downStairsPos && this.x === downStairsPos.x * this.size && this.y === downStairsPos.y * this.size) {
        return { floorChange: true, direction: 'down' };
      }
    }

    return { floorChange: false };
  }

  /**
   * Place the player at the specified stairs
   */
  public placeAtStairs(direction: 'up' | 'down', upStairsPos?: Position, downStairsPos?: Position): void {
    if (direction === 'up' && upStairsPos) {
      this.x = upStairsPos.x * this.size;
      this.y = upStairsPos.y * this.size;
    } else if (direction === 'down' && downStairsPos) {
      this.x = downStairsPos.x * this.size;
      this.y = downStairsPos.y * this.size;
    }
  }

  /**
   * Toggle minimap visibility
   */
  public toggleMinimap(): void {
    this.showMinimap = !this.showMinimap;
    displayMessage(`Minimap ${this.showMinimap ? 'enabled' : 'disabled'}`);
  }

  /**
   * Use an item from the inventory
   */
  public useItem(itemId: string): void {
    // Handle item usage logic
  }

  /**
   * Equip an item from the inventory
   */
  public equipItem(itemId: string): void {
    // Handle item equipping logic
  }

  /**
   * Unequip an item
   */
  public unequipItem(slot: keyof Equipment): void {
    // Handle item unequipping logic
  }

  /**
   * Get player stats
   */
  public getStats(): PlayerStats {
    return { ...this.stats };
  }

  /**
   * Get player inventory
   */
  public getInventory(): Item[] {
    return [...this.inventory];
  }

  /**
   * Get player equipment
   */
  public getEquipment(): Equipment {
    return {
      weapon: this.equipment.weapon ? { ...this.equipment.weapon } : null,
      armor: this.equipment.armor ? { ...this.equipment.armor } : null,
      helmet: this.equipment.helmet ? { ...this.equipment.helmet } : null,
      boots: this.equipment.boots ? { ...this.equipment.boots } : null
    };
  }

  /**
   * Check if position has changed enough to warrant an update
   */
  public hasInputChange(currentInputState: any): boolean {
    let hasChanged = false;

    if (!this.previousInputState) {
      this.previousInputState = {...currentInputState};
      console.log('Initial input state set');
      hasChanged = true;
    } else

    // Check if any movement keys changed
    if (currentInputState.movement.up !== this.previousInputState.movement.up ||
        currentInputState.movement.down !== this.previousInputState.movement.down ||
        currentInputState.movement.left !== this.previousInputState.movement.left ||
        currentInputState.movement.right !== this.previousInputState.movement.right) {
      console.log('Movement keys changed');
      hasChanged = true;
    } else

    // Check if action or toggleMap changed
    if (currentInputState.action !== this.previousInputState.action ||
        currentInputState.toggleMap !== this.previousInputState.toggleMap) {
      console.log('Action or toggleMap changed');
      hasChanged = true;
    } else {
      // Check if position changed by at least 1 pixel
      const positionChanged = 
      Math.abs(currentInputState.position.x - this.previousInputState.position.x) >= 1 ||
      Math.abs(currentInputState.position.y - this.previousInputState.position.y) >= 1;

      if (positionChanged) {
        // console.log('Position changed', currentInputState.position.x, this.previousInputState.position.x, currentInputState.position.y, this.previousInputState.position.y);
        hasChanged = true;
      }
    }
    
    if(hasChanged){
      this.previousInputState = JSON.parse(JSON.stringify(currentInputState)); // Deep copy input state
    }

    return hasChanged;
  }
}