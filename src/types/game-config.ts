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


export interface Position {
  x: number;
  y: number;
}

export interface FloorData {
  map: number[][];
  upStairsPos: Position | null;
  downStairsPos: Position | null;
  enemyLevel?: number;
  enemyDensity?: number;
  treasureChestDensity?: number;
}

export interface Assets {
  tiles: {
    wall: string;
    floor: string;
    upStairs: string;
    downStairs: string;
    tree: string; // New tree tile type
  };
}