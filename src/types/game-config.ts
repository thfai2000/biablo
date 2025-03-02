export interface GameConfig {
  // General game settings
  gameTitle: string;
  version: string;

  world: {
    startingLocation: string;
    totalDungeonFloors: number;
  };
  map: {
    tileSize: number;
    viewportWidth: number;
    viewportHeight: number;
    minRoomsPerFloor: number;
    maxRoomsPerFloor: number;
    roomMinSize: number;
    roomMaxSize: number;
    corridorWidth: number;
  };
  player: {
    initialStats: {
      health: number;
      mana: number;
      strength: number;
      dexterity: number;
      intelligence: number;
      baseSpeed: number;
    };
    levelUpPoints: number;
  };
  game: {
    totalFloors: number;
    initialFloor: number;
    villageFloor: number;
  };
  interaction: {
    stairsProximity: number;
    clickableHighlightColor: string;
  };
  floors: FloorConfig[];

  // Map generation settings
  dungeonSize: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  };
  villageSize: {
    width: number;
    height: number;
  };

  // Character progression
  maxPlayerLevel: number;
  experienceMultiplier: number;

  // Combat settings
  baseDamage: number;
  baseDefense: number;

  // Item settings
  maxInventorySize: number;

  // Enemy settings
  enemyScaling: {
    healthPerLevel: number;
    damagePerLevel: number;
  };
}

export interface FloorConfig {
  level: number;
  name: string;
  type: 'safe' | 'dungeon';
  hasShop?: boolean;
  enemyLevel?: number;
  enemyDensity?: number;
  treasureChestDensity?: number;
  backgroundMusic: string;
}