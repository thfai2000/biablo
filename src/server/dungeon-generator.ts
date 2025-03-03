import { GameConfig, Position } from '../types/game-config';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
}

export interface Dungeon {
  map: number[][];
  upStairsPos: Position | null;
  downStairsPos: Position | null;
  enemyLevel?: number;
  enemyDensity?: number;
  treasureChestDensity?: number;
}

export class DungeonGenerator {
  private config: GameConfig;
  private level: number;
  private width: number;
  private height: number;
  private minRooms: number;
  private maxRooms: number;
  private roomMinSize: number;
  private roomMaxSize: number;
  private map: number[][];
  private rooms: Room[];
  private upStairsPos: Position | null;
  private downStairsPos: Position | null;
  
  constructor(config: GameConfig, level: number) {
    this.config = config;
    this.level = level;
    this.width = config.map.viewportWidth * 3; // Map larger than viewport
    this.height = config.map.viewportHeight * 3;
    this.minRooms = config.map.minRoomsPerFloor;
    this.maxRooms = config.map.maxRoomsPerFloor;
    this.roomMinSize = config.map.roomMinSize;
    this.roomMaxSize = config.map.roomMaxSize;
    
    // Tile types: 0=wall, 1=floor, 2=up stairs, 3=down stairs
    this.map = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
    this.rooms = [];
    this.upStairsPos = null;
    this.downStairsPos = null;
  }
  
  generate(): Dungeon {
    // Reset the map
    this.map = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
    this.rooms = [];
    
    // Generate rooms
    const numRooms = this.randomInt(this.minRooms, this.maxRooms);
    
    for (let i = 0; i < numRooms; i++) {
      // Random room size
      const w = this.randomInt(this.roomMinSize, this.roomMaxSize);
      const h = this.randomInt(this.roomMinSize, this.roomMaxSize);
      
      // Random room position
      const x = this.randomInt(1, this.width - w - 1);
      const y = this.randomInt(1, this.height - h - 1);
      
      const newRoom: Room = {
        x, y, w, h,
        centerX: Math.floor(x + w / 2),
        centerY: Math.floor(y + h / 2)
      };
      
      // Check if this room intersects with any existing room
      let intersects = false;
      for (const room of this.rooms) {
        if (this._roomsIntersect(newRoom, room)) {
          intersects = true;
          break;
        }
      }
      
      if (!intersects) {
        // Room doesn't intersect, so carve it out
        this._createRoom(newRoom);
        
        // Connect to previous room except for the first one
        if (this.rooms.length > 0) {
          const prevRoom = this.rooms[this.rooms.length - 1];
          this._createCorridor(prevRoom, newRoom);
        }
        
        this.rooms.push(newRoom);
      }
    }
    
    // Ensure all rooms are connected
    for (let i = 0; i < this.rooms.length - 1; i++) {
      this._createCorridor(this.rooms[i], this.rooms[i + 1]);
    }
    
    // Add stairs - up stairs in first room, down stairs in last room
    if (this.level > 0) { // No up stairs in village
      this.upStairsPos = {
        x: this.rooms[0].centerX,
        y: this.rooms[0].centerY
      };
      this.map[this.upStairsPos.y][this.upStairsPos.x] = 2; // Up stairs
    }
    
    if (this.level < this.config.world.totalDungeonFloors) { // No down stairs on last level
      this.downStairsPos = {
        x: this.rooms[this.rooms.length - 1].centerX,
        y: this.rooms[this.rooms.length - 1].centerY
      };
      this.map[this.downStairsPos.y][this.downStairsPos.x] = 3; // Down stairs
    }
    
    // Add enemy and treasure density to dungeon result
    const floorConfig = this.config.floors.find(floor => floor.level === this.level);
    const result: Dungeon = {
      map: this.map,
      upStairsPos: this.upStairsPos,
      downStairsPos: this.downStairsPos
    };
    if (floorConfig) {
      result.enemyLevel = floorConfig.enemyLevel;
      result.enemyDensity = floorConfig.enemyDensity;
      result.treasureChestDensity = floorConfig.treasureChestDensity;
    }
    return result;
  }
  
  private _createRoom(room: Room): void {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        this.map[y][x] = 1; // Floor
      }
    }
  }
  
  private _createCorridor(roomA: Room, roomB: Room): void {
    // Create an L-shaped corridor between two rooms
    const startX = roomA.centerX;
    const startY = roomA.centerY;
    const endX = roomB.centerX;
    const endY = roomB.centerY;
    
    // First go horizontally then vertically
    this._drawHorizontalCorridor(startX, endX, startY);
    this._drawVerticalCorridor(startY, endY, endX);
  }
  
  private _drawHorizontalCorridor(startX: number, endX: number, y: number): void {
    const start = Math.min(startX, endX);
    const end = Math.max(startX, endX);
    
    for (let x = start; x <= end; x++) {
      this.map[y][x] = 1; // Floor
      // Add width to corridor
      for (let i = 1; i <= this.config.map.corridorWidth / 2; i++) {
        if (y - i >= 0) this.map[y - i][x] = 1;
        if (y + i < this.height) this.map[y + i][x] = 1;
      }
    }
  }
  
  private _drawVerticalCorridor(startY: number, endY: number, x: number): void {
    const start = Math.min(startY, endY);
    const end = Math.max(startY, endY);
    
    for (let y = start; y <= end; y++) {
      this.map[y][x] = 1; // Floor
      // Add width to corridor
      for (let i = 1; i <= this.config.map.corridorWidth / 2; i++) {
        if (x - i >= 0) this.map[y][x - i] = 1;
        if (x + i < this.width) this.map[y][x + i] = 1;
      }
    }
  }
  
  private _roomsIntersect(a: Room, b: Room): boolean {
    // Check if two rooms intersect, including a buffer
    const buffer = 2; // Minimum space between rooms
    return (
      a.x - buffer < b.x + b.w + buffer &&
      a.x + a.w + buffer > b.x - buffer &&
      a.y - buffer < b.y + b.h + buffer &&
      a.y + a.h + buffer > b.y - buffer
    );
  }
  
  // Special generator for the village (level 0)
  generateVillage(): Dungeon {
    // Create a more open space for the village
    for (let y = 5; y < this.height - 5; y++) {
      for (let x = 5; x < this.width - 5; x++) {
        // Create a circular village
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (distance < this.width / 3) {
          this.map[y][x] = 1; // Floor
        }
      }
    }
    
    // Add trees around the village perimeter and some scattered within
    for (let y = 5; y < this.height - 5; y++) {
      for (let x = 5; x < this.width - 5; x++) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // Add trees near the perimeter of the village
        if (distance < this.width / 3 && distance > this.width / 3.5) {
          // Higher probability of trees near the edge
          if (Math.random() < 0.4) {
            this.map[y][x] = 4; // Tree
          }
        } 
        // Add some random trees within the village
        else if (distance < this.width / 3.5 && distance > this.width / 8) {
          // Lower probability for scattered trees
          if (Math.random() < 0.05) {
            this.map[y][x] = 4; // Tree
          }
        }
      }
    }
    
    // Add the dungeon entrance (cave) near the edge
    const caveX = Math.floor(this.width / 2);
    const caveY = Math.floor(this.height * 0.8);
    
    // Clear trees around the cave entrance for better visibility
    for (let y = caveY - 3; y <= caveY + 3; y++) {
      for (let x = caveX - 4; x <= caveX + 4; x++) {
        if (y >= 0 && y < this.height && x >= 0 && x < this.width && this.map[y][x] === 4) {
          this.map[y][x] = 1; // Change tree back to floor
        }
      }
    }
    
    // Add the cave entrance
    for (let y = caveY - 2; y <= caveY + 2; y++) {
      for (let x = caveX - 3; x <= caveX + 3; x++) {
        if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
          this.map[y][x] = 1; // Floor
        }
      }
    }
    
    // Add the down stairs (dungeon entrance)
    this.downStairsPos = { x: caveX, y: caveY };
    this.map[caveY][caveX] = 3; // Down stairs
    
    return {
      map: this.map,
      upStairsPos: null,
      downStairsPos: this.downStairsPos
    };
  }

  // Helper methods
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}