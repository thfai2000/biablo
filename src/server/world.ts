import { DungeonGenerator, DungeonResult } from './dungeon-generator';
import { GameConfig } from '../types/game-config';

export class World {
  private floors: { [key: number]: DungeonResult } = {};
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config; 
  }

  init(){
    // generate all floors
    for (let i = 0; i < this.config.game.totalFloors; i++) {
      this.generateFloor(i);
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
      
    }
} 