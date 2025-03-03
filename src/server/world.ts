import { DungeonGenerator, Dungeon } from './dungeon-generator';
import { GameConfig } from '../types/game-config';

export class World {
  private _floors: { [key: number]: Dungeon } = {};
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
  
  // Getter to access floors data
  get floors(): { [key: number]: Dungeon } {
    return this._floors;
  }
  
  generateFloor(level: number): void {
      if (this._floors[level]) {
        return; // Floor already generated
      }
      
      if (!this.config) return;
      
      const generator = new DungeonGenerator(this.config, level);
      
      if (level === 0) {
        // Generate village
        this._floors[level] = generator.generateVillage();
      } else {
        // Generate dungeon floor
        this._floors[level] = generator.generate();
      }
      
      // Add enemy and treasure density to floor data
      const floorConfig = this.config.floors.find(floor => floor.level === level);
      if (floorConfig) {
        this._floors[level].enemyLevel = floorConfig.enemyLevel;
        this._floors[level].enemyDensity = floorConfig.enemyDensity;
        this._floors[level].treasureChestDensity = floorConfig.treasureChestDensity;
      }
      
    }
}