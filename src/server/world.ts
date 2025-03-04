import { DungeonGenerator } from './dungeon-generator';
import { GameConfig } from '../types/game-config';
import { Dungeon } from './dungeon';
import { ServerPlayer } from './player';

export class World {
  private _dungeons: { [key: number]: Dungeon } = {};
  private _players: Map<string, ServerPlayer> = new Map();
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  init() {
    // Generate all floors
    for (let i = 0; i < this.config.game.totalFloors; i++) {
      this.generateFloor(i);
    }
  }
  
  // Getter to access dungeons
  get dungeons(): { [key: number]: Dungeon } {
    return this._dungeons;
  }
  
  // Method to get a specific dungeon
  getDungeon(floorLevel: number): Dungeon | undefined {
    return this._dungeons[floorLevel];
  }
  
  // Method to generate a floor
  generateFloor(level: number): void {
    if (this._dungeons[level]) {
      return; // Floor already generated
    }
    
    const generator = new DungeonGenerator(this.config, level);
    let dungeonData;
    
    if (level === 0) {
      // Generate village
      dungeonData = generator.generateVillage();
    } else {
      // Generate dungeon floor
      dungeonData = generator.generate();
    }
    
    // Create a new Dungeon instance with the generated data
    this._dungeons[level] = new Dungeon(dungeonData, level, this.config);
  }
  
  // Add a player to the world
  addPlayer(player: ServerPlayer): void {
    this._players.set(player.id, player);
    
    // Add player to their current floor's dungeon
    const dungeon = this._dungeons[player.currentFloor];
    if (dungeon) {
      dungeon.addPlayer(player);
    }
  }
  
  // Remove a player from the world
  removePlayer(playerId: string): void {
    const player = this._players.get(playerId);
    if (player) {
      // Remove from current dungeon
      const dungeon = this._dungeons[player.currentFloor];
      if (dungeon) {
        dungeon.removePlayer(playerId);
      }
      // Remove from players map
      this._players.delete(playerId);
    }
  }
  
  // Get a player by ID
  getPlayer(playerId: string): ServerPlayer | undefined {
    return this._players.get(playerId);
  }
  
  // Handle player movement between floors
  movePlayerToFloor(playerId: string, targetFloor: number): boolean {
    const player = this._players.get(playerId);
    if (!player) {
      return false;
    }
    
    // Check if target floor exists
    if (!this._dungeons[targetFloor]) {
      return false;
    }
    
    // Get current and target dungeons
    const currentDungeon = this._dungeons[player.currentFloor];
    const targetDungeon = this._dungeons[targetFloor];
    
    if (currentDungeon && targetDungeon) {
      // Remove player from current floor
      currentDungeon.removePlayer(playerId);
      
      // Update player's floor reference in the server-side player object
      player.previousFloor = player.currentFloor;
      player.currentFloor = targetFloor;
      
      // Add player to target floor
      targetDungeon.addPlayer(player);
      
      return true;
    }
    
    return false;
  }
  
  // Update all dungeons
  update(deltaTime: number): void {
    // Update each dungeon
    Object.values(this._dungeons).forEach(dungeon => {
      dungeon.update(deltaTime);
    });
  }
}