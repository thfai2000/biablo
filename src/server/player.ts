import { GameConfig } from '../types/game-config';

/**
 * Simple 3D vector class for physics calculations
 */
class Vector3 {
  x: number;
  y: number;
  z: number;
  
  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  
  normalize(): Vector3 {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }
  
  add(v: Vector3): Vector3 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  
  subtract(v: Vector3): Vector3 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  
  multiplyScalar(scalar: number): Vector3 {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
  
  static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  
  static cross(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
}

export interface PlayerStats {
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

export interface Item {
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

export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  helmet: Item | null;
  boots: Item | null;
}

export class ServerPlayer {
  // Player identification
  public id: string; // Socket ID
  public username: string;

  // Position and movement in 3D space
  public x: number;
  public y: number;
  public z: number; // Add z-coordinate
  public currentFloor: number;
  public previousFloor: number;
  public moveSpeed: number;
  public size: number;
  private lastX: number;
  private lastY: number;
  private lastZ: number; // Add last z-coordinate
  private lastUpdateTime: number;
  private maxVelocity: number; // Maximum pixels per millisecond
  private verticalVelocity: number = 0; // Vertical velocity for jumping
  private isCrouching: boolean = false; // Crouching state
  private tileSize: number; // Tile size for ground level calculation

  // Core stats
  public stats: PlayerStats;
  public inventory: Item[];
  public equipment: Equipment;
  private maxInventorySize: number;

  // Flags and state
  private lastActionTime: number;
  private actionCooldown: number;
  private config: any;

  constructor(id: string, username: string, config: GameConfig) {
    this.id = id;
    this.username = username;
    this.config = config.player;

    // Starting position - center of the actual map (which is 3x viewport size)
    this.currentFloor = config.game.initialFloor;
    this.previousFloor = -1;
    this.x = 300 // (config.map.viewportWidth * 3) * config.map.tileSize / 2;
    this.y = 300 // (config.map.viewportHeight * 3) * config.map.tileSize / 2;
    this.z = config.map.tileSize; // Initial z position (slightly above ground)
    this.lastX = this.x;
    this.lastY = this.y;
    this.lastZ = this.z;
    
    this.moveSpeed = this.config.initialStats.baseSpeed;
    this.size = 24; // Default size for collision detection
    
    // Action cooldown
    this.actionCooldown = 1000; // 1 second cooldown
    this.lastActionTime = 0;
    
    // Initialize stats
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


    this.lastUpdateTime = Date.now();
    this.maxVelocity = this.moveSpeed / 100; // Convert moveSpeed to pixels per millisecond
    this.tileSize = config.map.tileSize; // Initialize tile size
  }

  /**
   * Process a movement input from the client
   */
  public processMovementInput(input: { 
    up: boolean, 
    down: boolean, 
    left: boolean, 
    right: boolean, 
    jump: boolean, 
    crouch: boolean,
    cameraDirection?: { x: number, y: number, z: number },
    deltaTime?: number
  }): void {
    // Use elapsed time for smoother movement (default to 16ms if not provided - ~60fps)
    const dt = (input.deltaTime || 16) / 1000;
    
    // Movement speed adjusted by time
    const adjustedSpeed = this.moveSpeed * dt;
    
    // Basic vector for movement
    let moveX = 0;
    let moveY = 0;
    
    // Calculate 2D movement based on input (corrected WASD mapping)
    if (input.up) moveY -= 1;      // W key moves forward (negative Y)
    if (input.down) moveY += 1;    // S key moves backward (positive Y)
    if (input.left) moveX -= 1;    // A key moves left (negative X)
    if (input.right) moveX += 1;   // D key moves right (positive X)
    
    // Normalize diagonal movement to prevent moving faster diagonally
    if (moveX !== 0 && moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
    }
    
    // Apply movement speed
    moveX *= adjustedSpeed;
    moveY *= adjustedSpeed;
    
    // If camera direction is provided, move relative to camera direction
    if (input.cameraDirection) {
      // Convert from camera-relative to world space
      // We only care about the XZ plane for horizontal movement
      const forward = new Vector3(input.cameraDirection.x, 0, input.cameraDirection.z);
      forward.normalize();
      
      // Calculate right vector (perpendicular to forward)
      const right = new Vector3(-forward.z, 0, forward.x);
      
      // Calculate final movement vector
      const finalMoveX = moveY * forward.x + moveX * right.x;
      const finalMoveY = moveY * forward.z + moveX * right.z;
      
      moveX = finalMoveX;
      moveY = finalMoveY;
    }
    
    // Apply movement
    this.x += moveX;
    this.y += moveY;
    console.log(`Player moved to: ${this.x}, ${this.y}, ${this.z}`);
    
    // Handle jumping and vertical movement
    // In a 3D game, jumping should be affected by gravity
    const GRAVITY = 9.8; // m/s^2
    const JUMP_FORCE = 5; // Initial upward velocity
    
    // Simulate simple jumping physics
    if (input.jump && this.isGrounded()) {
      // Start a jump if player is on the ground
      this.verticalVelocity = JUMP_FORCE;
    }
    
    // Apply gravity to vertical velocity
    this.verticalVelocity -= GRAVITY * dt;
    
    // Update z-position based on vertical velocity
    this.z += this.verticalVelocity * dt * this.tileSize;
    
    // Ground check - don't go below ground level
    const groundLevel = this.tileSize; // Assuming ground is at tileSize height
    if (this.z <= groundLevel) {
      this.z = groundLevel;
      this.verticalVelocity = 0;
    }
    
    // Handle crouching
    if (input.crouch && this.isGrounded()) {
      // Reduce player height for collision purposes
      this.isCrouching = true;
    } else {
      this.isCrouching = false;
    }
  }
  
  /**
   * Check if player is on the ground
   */
  private isGrounded(): boolean {
    // Simple ground check - player is grounded if z position is at or below ground level
    const groundLevel = this.tileSize;
    return this.z <= groundLevel + 0.1; // Small tolerance for floating point imprecision
  }

  /**
   * Validate and process a 3D position update from client
   */
  public processPositionUpdate(newX: number, newY: number, newZ: number, timestamp: number): boolean {
    
    // Calculate time difference
    const timeDiff = timestamp - this.lastUpdateTime;
    if (timeDiff <= 0) return false; // Invalid timestamp

    // Calculate 3D distance moved
    const distanceMoved = Math.sqrt(
      Math.pow(newX - this.lastX, 2) + 
      Math.pow(newY - this.lastY, 2) +
      Math.pow(newZ - this.lastZ, 2)
    );

    // Calculate actual velocity (pixels per millisecond)
    const actualVelocity = distanceMoved / timeDiff;

    // Add a small tolerance (10%) to account for network lag and floating point imprecision
    const velocityTolerance = this.maxVelocity * 1.1;

    // Validate velocity
    if (actualVelocity <= velocityTolerance) {
      // Update is valid
      this.lastX = this.x;
      this.lastY = this.y;
      this.lastZ = this.z;
      this.x = newX;
      this.y = newY;
      this.z = newZ;
      this.lastUpdateTime = timestamp;
      return true;
    }

    // If validation fails, reset to last valid position
    this.x = this.lastX;
    this.y = this.lastY;
    this.z = this.lastZ;
    return false;
  }

  /**
   * Check if player can interact with stairs
   */
  public canInteractWithStairs(): boolean {
    const currentTime = Date.now();
    return currentTime - this.lastActionTime > this.actionCooldown;
  }

  /**
   * Update the last action time when interacting with objects
   */
  public updateLastActionTime(): void {
    this.lastActionTime = Date.now();
  }

  /**
   * Handle player taking damage
   */
  public takeDamage(amount: number): boolean {
    this.stats.currentHealth = Math.max(0, this.stats.currentHealth - amount);
    
    if (this.stats.currentHealth <= 0) {
      return true; // Player died
    }
    return false; // Player still alive
  }

  /**
   * Handle player healing
   */
  public heal(amount: number): void {
    this.stats.currentHealth = Math.min(this.stats.maxHealth, this.stats.currentHealth + amount);
  }

  /**
   * Handle mana consumption
   */
  public useMana(amount: number): boolean {
    if (this.stats.currentMana >= amount) {
      this.stats.currentMana -= amount;
      return true;
    }
    return false;
  }

  /**
   * Handle mana restoration
   */
  public restoreMana(amount: number): void {
    this.stats.currentMana = Math.min(this.stats.maxMana, this.stats.currentMana + amount);
  }

  /**
   * Handle experience gain and leveling
   */
  public gainExperience(amount: number): boolean {
    let leveledUp = false;
    this.stats.experience += amount;
    
    while (this.stats.experience >= this.stats.nextLevelExp) {
      this.levelUp();
      leveledUp = true;
    }
    
    return leveledUp;
  }

  /**
   * Level up the player
   */
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
  }

  /**
   * Add an item to the player's inventory
   */
  public addItem(item: Item): boolean {
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

  /**
   * Remove an item from the player's inventory
   */
  public removeItem(itemId: string, quantity: number = 1): boolean {
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

  /**
   * Equip an item from the inventory
   */
  public equipItem(itemId: string): boolean {
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

  /**
   * Unequip an item and place it in the inventory
   */
  public unequipItem(slot: keyof Equipment): boolean {
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

  /**
   * Use a consumable item like a potion
   */
  public useItem(itemId: string): boolean {
    const itemIndex = this.inventory.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return false;
    }
    
    const item = this.inventory[itemIndex];
    
    if (item.type === 'potion') {
      // Apply potion effects
      if (item.id === 'health-potion') {
        this.stats.currentHealth = Math.min(this.stats.currentHealth + 25, this.stats.maxHealth);
      } else if (item.id === 'mana-potion') {
        this.stats.currentMana = Math.min(this.stats.currentMana + 25, this.stats.maxMana);
      }
      
      // Remove used potion
      this.removeItem(itemId, 1);
      return true;
    }
    
    return false;
  }

  /**
   * Update player stats based on equipped items
   */
  public updateStats(): void {
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
    
    // Update movement speed based on dexterity and equipment
    // Higher dexterity gives faster movement in 3D space
    this.moveSpeed = this.config.initialStats.baseSpeed + (this.stats.dexterity / 20);
    
    // Update maximum velocity based on the new moveSpeed
    this.maxVelocity = this.moveSpeed / 1000; // Convert to pixels per millisecond
    
    // Calculate jump height based on strength and dexterity
    // This will affect how high the player can jump in 3D space
    const jumpFactor = (this.stats.strength * 0.3 + this.stats.dexterity * 0.7) / 10;
    
    // Apply equipment effects on movement abilities
    if (this.equipment.boots && this.equipment.boots.stats) {
      // Boots can affect movement speed and jump height
      if (this.equipment.boots.stats.dexterityBonus) {
        this.moveSpeed += this.equipment.boots.stats.dexterityBonus * 0.2;
        this.maxVelocity = this.moveSpeed / 1000;
      }
    }
    
    // Ensure current values don't exceed max
    if (this.stats.currentHealth > this.stats.maxHealth) {
      this.stats.currentHealth = this.stats.maxHealth;
    }
    
    if (this.stats.currentMana > this.stats.maxMana) {
      this.stats.currentMana = this.stats.maxMana;
    }
  }

  /**
   * Check collision with environment objects in 3D space
   * @param map The 3D map data (0 = wall, 1 = open space)
   * @param newX Potential new X position
   * @param newY Potential new Y position
   * @param newZ Potential new Z position
   * @returns Whether collision occurred (true = collision, false = no collision)
   */
  public checkCollision(
    map: number[][][],
    newX: number,
    newY: number, 
    newZ: number
  ): boolean {
    // Convert world coordinates to grid coordinates
    const gridX = Math.floor(newX / this.tileSize);
    const gridY = Math.floor(newY / this.tileSize);
    const gridZ = Math.floor(newZ / this.tileSize);
    
    // Player dimensions (simplified to a cylinder for 3D collision)
    const playerRadius = this.size / 2;
    const playerHeight = this.isCrouching ? this.tileSize * 0.7 : this.tileSize * 1.8;
    
    // Check if coordinates are within map bounds
    if (gridZ < 0 || gridZ >= map.length ||
        gridY < 0 || gridY >= map[0].length ||
        gridX < 0 || gridX >= map[0][0].length) {
      return true; // Out of bounds, colliding with world boundary
    }
    
    // Check collision with walls and obstacles
    // For simplicity, we'll check in a small radius around the player
    const checkRadius = Math.ceil(playerRadius / this.tileSize) + 1;
    
    for (let z = Math.max(0, gridZ - 1); z <= Math.min(map.length - 1, gridZ + Math.ceil(playerHeight / this.tileSize)); z++) {
      for (let y = Math.max(0, gridY - checkRadius); y <= Math.min(map[0].length - 1, gridY + checkRadius); y++) {
        for (let x = Math.max(0, gridX - checkRadius); x <= Math.min(map[0][0].length - 1, gridX + checkRadius); x++) {
          // Skip non-solid tiles (1 = open space)
          if (map[z][y][x] === 1) continue;
          
          // For solid tiles, check cylinder collision
          const tileX = x * this.tileSize + this.tileSize / 2;
          const tileY = y * this.tileSize + this.tileSize / 2;
          
          // Check horizontal distance (cylinder radius)
          const dx = tileX - newX;
          const dy = tileY - newY;
          const horizontalDist = Math.sqrt(dx * dx + dy * dy);
          
          if (horizontalDist < playerRadius + (this.tileSize / 2)) {
            // Check vertical collision (cylinder height)
            const tileZ = z * this.tileSize;
            if (newZ < tileZ + this.tileSize && newZ + playerHeight > tileZ) {
              return true; // Collision detected
            }
          }
        }
      }
    }
    
    return false; // No collision
  }

  /**
   * Get a player data object to send to clients
   */
  public getPlayerData(): any {
    return {
      id: this.id,
      username: this.username,
      x: this.x,
      y: this.y,
      z: this.z,
      currentFloor: this.currentFloor,
      size: this.size,
      stats: { ...this.stats },
      equipment: {
        weapon: this.equipment.weapon ? { ...this.equipment.weapon } : null,
        armor: this.equipment.armor ? { ...this.equipment.armor } : null,
        helmet: this.equipment.helmet ? { ...this.equipment.helmet } : null,
        boots: this.equipment.boots ? { ...this.equipment.boots } : null
      }
    };
  }

  /**
   * Get the player's inventory data
   */
  public getInventory(): Item[] {
    return [...this.inventory];
  }

  /**
   * Get the player's equipment data
   */
  public getEquipment(): Equipment {
    return {
      weapon: this.equipment.weapon ? { ...this.equipment.weapon } : null,
      armor: this.equipment.armor ? { ...this.equipment.armor } : null,
      helmet: this.equipment.helmet ? { ...this.equipment.helmet } : null,
      boots: this.equipment.boots ? { ...this.equipment.boots } : null
    };
  }
}