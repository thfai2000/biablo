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
    z: number; // Add z coordinate
    timestamp: number;
  };
  movement: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    jump: boolean; // Add jump
    crouch: boolean; // Add crouch
  };
  cameraDirection?: {
    x: number;
    y: number;
    z: number;
  };
  action: boolean;
  toggleMap: boolean;
  deltaTime?: number; // Add delta time for smoother movement
}

interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  jump: boolean; // Add jump
  crouch: boolean; // Add crouch
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
  public z: number; // Add z coordinate for 3D positioning
  public currentFloor: number;
  public size: number;
  private moveSpeed: number;
  private lastUpdateTime: number;
  private verticalVelocity: number; // Add vertical velocity for jumping
  
  // Camera properties
  private cameraAngleX: number; // Horizontal camera angle (yaw)
  private cameraAngleY: number; // Vertical camera angle (pitch)
  private cameraDirection: { x: number, y: number, z: number }; // Camera facing direction
  
  // Input controls
  private keys: Keys;
  private lastKeyPressed: string | null;
  private previousInputState: InputState | null;
  private mouseMovement: { x: number, y: number };
  private mouseButtons: { left: boolean, right: boolean, middle: boolean };
  
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
    this.z = config.map.tileSize; // Initialize z position above ground level
    this.currentFloor = config.game.initialFloor;
    this.size = 24; // Default size for collision detection
    this.moveSpeed = config.player.initialStats.baseSpeed;
    this.lastUpdateTime = Date.now();
    this.verticalVelocity = 0;
    
    // Initialize camera properties
    this.cameraAngleX = 0; // Start facing forward (north)
    this.cameraAngleY = 0; // Start looking straight ahead
    this.cameraDirection = { x: 0, y: 0, z: -1 }; // Initially facing forward
    
    // Input controls
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      jump: false,
      crouch: false,
      action: false,
      toggleMap: false
    };
    this.lastKeyPressed = null;
    this.previousInputState = null;
    this.mouseMovement = { x: 0, y: 0 };
    this.mouseButtons = { left: false, right: false, middle: false };
    
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
    // Keyboard events
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
          this.keys.jump = true;
          break;
        case 'Control':
          this.keys.crouch = true;
          break;
        case 'e':
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
          this.keys.jump = false;
          break;
        case 'Control':
          this.keys.crouch = false;
          break;
        case 'e':
        case 'Enter':
          this.keys.action = false;
          this.lastKeyPressed = null;
          break;
        case 'm':
          this.keys.toggleMap = false;
          break;
      }
    });
    
    // Mouse events for camera control
    document.addEventListener('mousemove', (e: MouseEvent) => {
      // Only update if pointer lock is active for first-person view
      if (document.pointerLockElement === document.getElementById('game-canvas')) {
        this.mouseMovement.x = e.movementX;
        this.mouseMovement.y = e.movementY;
        
        // Update camera angles
        const sensitivity = 0.002;
        this.cameraAngleX -= e.movementX * sensitivity;
        this.cameraAngleY -= e.movementY * sensitivity;
        
        // Clamp vertical angle to prevent flipping
        this.cameraAngleY = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.cameraAngleY));
        
        // Update camera direction
        this.updateCameraDirection();
      }
    });
    
    // Mouse button events
    document.addEventListener('mousedown', (e: MouseEvent) => {
      switch (e.button) {
        case 0:
          this.mouseButtons.left = true;
          break;
        case 1:
          this.mouseButtons.middle = true;
          break;
        case 2:
          this.mouseButtons.right = true;
          break;
      }
    });
    
    document.addEventListener('mouseup', (e: MouseEvent) => {
      switch (e.button) {
        case 0:
          this.mouseButtons.left = false;
          break;
        case 1:
          this.mouseButtons.middle = false;
          break;
        case 2:
          this.mouseButtons.right = false;
          break;
      }
    });
    
    // Pointer lock for first-person camera
    document.getElementById('game-canvas')?.addEventListener('click', () => {
      document.getElementById('game-canvas')?.requestPointerLock();
    });
  }
  
  /**
   * Update camera direction based on angles
   */
  private updateCameraDirection(): void {
    // Calculate direction vector using spherical coordinates
    this.cameraDirection = {
      x: Math.sin(this.cameraAngleX) * Math.cos(this.cameraAngleY),
      y: Math.sin(this.cameraAngleY),
      z: Math.cos(this.cameraAngleX) * Math.cos(this.cameraAngleY)
    };
  }
 
  /**
   * Retrieves the current input state of the player.
   *
   * @returns {InputState} An object representing the player's current input state, including position, movement, action, and toggleMap status.
   */
  public getInputState(): InputState {
    const currentTime = Date.now();
    const currentState: InputState = {
      position: {
        x: this.x,
        y: this.y,
        z: this.z,
        timestamp: currentTime
      },
      movement: {
        up: this.keys.up,
        down: this.keys.down,
        left: this.keys.left,
        right: this.keys.right,
        jump: this.keys.jump,
        crouch: this.keys.crouch
      },
      cameraDirection: this.cameraDirection,
      action: this.keys.action,
      toggleMap: this.keys.toggleMap,
      deltaTime: currentTime - this.lastUpdateTime
    };
    
    return currentState;
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
    this.z = data.z || this.z; // Use existing z if server doesn't provide one
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
    
    // Check for floor change using action key and position
    if (this.keys.action) {
      // In 3D space, we need to check if player is near stairs (not just exact position)
      const checkProximity = (playerPos: {x: number, y: number, z: number}, targetPos: Position, range: number): boolean => {
        if (!targetPos) return false;
        
        const dx = playerPos.x - targetPos.x * this.size;
        const dy = playerPos.y - targetPos.y * this.size;
        const distSquared = dx * dx + dy * dy;
        
        return distSquared <= range * range;
      };
      
      const interactionRange = this.size * 1.5; // Make interaction range slightly larger than player
      
      if (upStairsPos && checkProximity(this, upStairsPos, interactionRange)) {
        return { floorChange: true, direction: 'up' };
      } else if (downStairsPos && checkProximity(this, downStairsPos, interactionRange)) {
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
      this.previousInputState = JSON.parse(JSON.stringify(currentInputState));
      hasChanged = true;
    } else {
      // Check if any movement keys changed
      if (currentInputState.movement.up !== this.previousInputState.movement.up ||
          currentInputState.movement.down !== this.previousInputState.movement.down ||
          currentInputState.movement.left !== this.previousInputState.movement.left ||
          currentInputState.movement.right !== this.previousInputState.movement.right ||
          currentInputState.movement.jump !== this.previousInputState.movement.jump ||
          currentInputState.movement.crouch !== this.previousInputState.movement.crouch) {
        hasChanged = true;
      } else
      // Check if action or toggleMap changed
      if (currentInputState.action !== this.previousInputState.action ||
          currentInputState.toggleMap !== this.previousInputState.toggleMap) {
        hasChanged = true;
      } else {
        // Check if position changed by at least 0.1 units in any direction
        const positionChanged = 
          Math.abs(currentInputState.position.x - this.previousInputState.position.x) >= 0.1 ||
          Math.abs(currentInputState.position.y - this.previousInputState.position.y) >= 0.1 ||
          Math.abs(currentInputState.position.z - this.previousInputState.position.z) >= 0.1;
        
        // Check if camera direction changed significantly
        const cameraChanged = currentInputState.cameraDirection && this.previousInputState.cameraDirection &&
          (Math.abs(currentInputState.cameraDirection.x - this.previousInputState.cameraDirection.x) >= 0.01 ||
           Math.abs(currentInputState.cameraDirection.y - this.previousInputState.cameraDirection.y) >= 0.01 ||
           Math.abs(currentInputState.cameraDirection.z - this.previousInputState.cameraDirection.z) >= 0.01);
        
        if (positionChanged || cameraChanged) {
          hasChanged = true;
        }
      }
    }
    
    if(hasChanged){
      this.previousInputState = JSON.parse(JSON.stringify(currentInputState)); // Deep copy input state
    }
    return hasChanged;
  }
}