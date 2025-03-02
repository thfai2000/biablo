export interface GameConfig {
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