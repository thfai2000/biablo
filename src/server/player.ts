import { GameConfig } from '../types/game-config';

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

  // Position and movement
  public x: number;
  public y: number;
  public currentFloor: number;
  public previousFloor: number;
  public moveSpeed: number;
  public size: number;
  private lastX: number;
  private lastY: number;
  private lastUpdateTime: number;
  private maxVelocity: number; // Maximum pixels per millisecond

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
    this.x = (config.map.viewportWidth * 3) * config.map.tileSize / 2;
    this.y = (config.map.viewportHeight * 3) * config.map.tileSize / 2;
    this.lastX = this.x;
    this.lastY = this.y;
    
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
    this.maxVelocity = this.moveSpeed / 1000; // Convert moveSpeed to pixels per millisecond
  }

  /**
   * Process a movement input from the client
   */
  public processMovementInput(input: { up: boolean, down: boolean, left: boolean, right: boolean }): void {
    if (input.up) {
      this.y -= this.moveSpeed;
    }
    if (input.down) {
      this.y += this.moveSpeed;
    }
    if (input.left) {
      this.x -= this.moveSpeed;
    }
    if (input.right) {
      this.x += this.moveSpeed;
    }
  }

  /**
   * Validate and process a position update from client
   */
  public processPositionUpdate(newX: number, newY: number, timestamp: number): boolean {
    // Calculate time difference
    const timeDiff = timestamp - this.lastUpdateTime;
    if (timeDiff <= 0) return false; // Invalid timestamp

    // Calculate distance moved
    const distanceMoved = Math.sqrt(
      Math.pow(newX - this.lastX, 2) + 
      Math.pow(newY - this.lastY, 2)
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
      this.x = newX;
      this.y = newY;
      this.lastUpdateTime = timestamp;
      return true;
    }

    // If validation fails, reset to last valid position
    this.x = this.lastX;
    this.y = this.lastY;
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
    
    // Ensure current values don't exceed max
    if (this.stats.currentHealth > this.stats.maxHealth) {
      this.stats.currentHealth = this.stats.maxHealth;
    }
    
    if (this.stats.currentMana > this.stats.maxMana) {
      this.stats.currentMana = this.stats.maxMana;
    }
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