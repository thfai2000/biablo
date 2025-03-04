import { GameConfig, Position, FloorData } from '../types/game-config';
import { ServerPlayer } from '../server/player';

export interface DungeonState {
  floorLevel: number;
  map: number[][][]; // Updated to 3D array
  upStairsPos: Position | null;
  downStairsPos: Position | null;
  players: Map<string, ServerPlayer>;
  npcs: Map<string, NPC>;
}

export interface NPC {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number; // Added z-coordinate
  health: number;
  maxHealth: number;
  level: number;
  isAggressive: boolean;
}

export class Dungeon {
  private floorLevel: number;
  private map: number[][][]; // Changed to 3D array for height
  private upStairsPos: Position | null;
  private downStairsPos: Position | null;
  private players: Map<string, ServerPlayer>;
  private npcs: Map<string, NPC>;
  private enemyLevel: number;
  private enemyDensity: number;
  private treasureChestDensity: number;
  private config: GameConfig;

  constructor(floorData: FloorData, floorLevel: number, config: GameConfig) {
    this.floorLevel = floorLevel;
    this.map = floorData.map;
    this.upStairsPos = floorData.upStairsPos;
    this.downStairsPos = floorData.downStairsPos;
    this.players = new Map();
    this.npcs = new Map();
    this.enemyLevel = floorData.enemyLevel || 1;
    this.enemyDensity = floorData.enemyDensity || 0;
    this.treasureChestDensity = floorData.treasureChestDensity || 0;
    this.config = config;
    
    // Generate NPCs based on floor configuration
    if (this.enemyDensity > 0) {
      this.generateNPCs();
    }
  }
  
  public getState(): DungeonState {
    return {
      floorLevel: this.floorLevel,
      map: this.map,
      upStairsPos: this.upStairsPos,
      downStairsPos: this.downStairsPos,
      players: this.players,
      npcs: this.npcs
    };
  }
  
  public getMapData(): FloorData {
    return {
      map: this.map,
      upStairsPos: this.upStairsPos,
      downStairsPos: this.downStairsPos,
      enemyLevel: this.enemyLevel,
      enemyDensity: this.enemyDensity,
      treasureChestDensity: this.treasureChestDensity
    };
  }
  
  public addPlayer(player: ServerPlayer): void {
    this.players.set(player.id, player);
    
    // If player is new to this floor, place them at the appropriate stairs
    if (player.currentFloor !== this.floorLevel) {
      const tileSize = this.config.map.tileSize;
      
      // Coming from below (upstairs)
      if (player.currentFloor > this.floorLevel && this.downStairsPos) {
        player.x = this.downStairsPos.x * tileSize;
        player.y = this.downStairsPos.y * tileSize;
        player.z = this.downStairsPos.z * tileSize; // Add Z positioning
      } 
      // Coming from above (downstairs)
      else if (player.currentFloor < this.floorLevel && this.upStairsPos) {
        player.x = this.upStairsPos.x * tileSize;
        player.y = this.upStairsPos.y * tileSize;
        player.z = this.upStairsPos.z * tileSize; // Add Z positioning
      }
      
      player.currentFloor = this.floorLevel;
    }
  }
  
  public removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }
  
  public getPlayer(playerId: string): ServerPlayer | undefined {
    return this.players.get(playerId);
  }
  
  public getAllPlayers(): Map<string, ServerPlayer> {
    return this.players;
  }
  
  public updatePlayerPosition(playerId: string, x: number, y: number, z: number): boolean {
    const player = this.players.get(playerId);
    
    if (!player) {
      return false;
    }
    
    // Store previous position
    const oldX = player.x;
    const oldY = player.y;
    const oldZ = player.z;
    
    // Update position
    player.x = x;
    player.y = y;
    player.z = z;
    
    // Check for collision
    if (this.checkCollision(player.x, player.y, player.z, player.size)) {
      // Revert to previous position if collision
      player.x = oldX;
      player.y = oldY;
      player.z = oldZ;
      return false;
    }
    
    return true;
  }
  
  public handleStairsInteraction(playerId: string): { floorChange: boolean; direction?: 'up' | 'down' } {
    const player = this.players.get(playerId);
    
    if (!player) {
      return { floorChange: false };
    }
    
    const tileSize = this.config.map.tileSize;
    const tileX = Math.floor(player.x / tileSize);
    const tileY = Math.floor(player.y / tileSize);
    
    // Check for up stairs
    if (this.upStairsPos && tileX === this.upStairsPos.x && tileY === this.upStairsPos.y) {
      return { floorChange: true, direction: 'up' };
    }
    
    // Check for down stairs
    if (this.downStairsPos && tileX === this.downStairsPos.x && tileY === this.downStairsPos.y) {
      return { floorChange: true, direction: 'down' };
    }
    
    return { floorChange: false };
  }
  
  public movePlayerToFloor(player: ServerPlayer, floorLevel: number): void {
    // Record the player's last position before moving them
    player.previousFloor = player.currentFloor;
    player.currentFloor = floorLevel;
  }
  
  private checkCollision(x: number, y: number, z: number, size: number): boolean {
    const tileSize = this.config.map.tileSize;
    
    // Define corners for a 3D bounding box
    const corners = [
      { x: x, y: y, z: z }, // Bottom front left
      { x: x + size, y: y, z: z }, // Bottom front right
      { x: x, y: y + size, z: z }, // Bottom back left
      { x: x + size, y: y + size, z: z }, // Bottom back right
      { x: x, y: y, z: z + size }, // Top front left
      { x: x + size, y: y, z: z + size }, // Top front right
      { x: x, y: y + size, z: z + size }, // Top back left
      { x: x + size, y: y + size, z: z + size } // Top back right
    ];
    
    for (const corner of corners) {
      const tileX = Math.floor(corner.x / tileSize);
      const tileY = Math.floor(corner.y / tileSize);
      const tileZ = Math.floor(corner.z / tileSize);
      
      // Check if out of bounds
      if (tileX < 0 || tileY < 0 || tileZ < 0 ||
          tileX >= this.map[0][0].length || 
          tileY >= this.map[0].length ||
          tileZ >= this.map.length) {
        return true; // Collision with boundary
      }
      
      // Check collision with solid objects (0=wall, 4=tree)
      if (this.map[tileZ][tileY][tileX] === 0 || this.map[tileZ][tileY][tileX] === 4) {
        return true; // Collision detected
      }
    }
    
    return false; // No collision
  }
  
  private generateNPCs(): void {
    const floorVolume = this.map.length * this.map[0].length * this.map[0][0].length;
    const targetNPCCount = Math.floor(floorVolume * this.enemyDensity / 100);
    
    let npcCount = 0;
    let attempts = 0;
    const maxAttempts = 1000; // Prevent infinite loops
    
    while (npcCount < targetNPCCount && attempts < maxAttempts) {
      attempts++;
      
      // Random position in 3D space
      const x = Math.floor(Math.random() * this.map[0][0].length);
      const y = Math.floor(Math.random() * this.map[0].length);
      const z = Math.floor(Math.random() * this.map.length);
      
      // Check if position is a walkable tile (floor)
      if (this.map[z][y][x] === 1) {
        // Generate a random NPC
        const npcId = `npc_${this.floorLevel}_${npcCount}`;
        const npcTypes = ['zombie', 'skeleton', 'goblin', 'orc'];
        const npcType = npcTypes[Math.floor(Math.random() * npcTypes.length)];
        
        // Create NPC object with 3D position
        const npc: NPC = {
          id: npcId,
          type: npcType,
          x: x * this.config.map.tileSize + this.config.map.tileSize / 2,
          y: y * this.config.map.tileSize + this.config.map.tileSize / 2,
          z: z * this.config.map.tileSize + this.config.map.tileSize / 2,
          health: this.enemyLevel * 10,
          maxHealth: this.enemyLevel * 10,
          level: this.enemyLevel,
          isAggressive: Math.random() > 0.2 // 80% chance to be aggressive
        };
        
        this.npcs.set(npcId, npc);
        npcCount++;
      }
    }
  }
  
  public update(deltaTime: number): void {
    // Update NPCs (movement, AI, etc.)
    this.npcs.forEach((npc: NPC) => {
      // Basic NPC update logic
      if (npc.isAggressive) {
        // Find nearest player to chase
        let nearestPlayer: ServerPlayer | null = null;
        let nearestDistance = Number.MAX_VALUE;
        
        this.players.forEach((player: ServerPlayer) => {
          // Calculate 3D distance
          const distance = Math.sqrt(
            Math.pow(player.x - npc.x, 2) + 
            Math.pow(player.y - npc.y, 2) +
            Math.pow(player.z - npc.z, 2)
          );
          
          if (distance < nearestDistance) {
            nearestPlayer = player;
            nearestDistance = distance;
          }
        });
        
        // Simple chase logic
        if (nearestPlayer && nearestDistance < 200) { // Detection range
          const dx = nearestPlayer.x - npc.x;
          const dy = nearestPlayer.y - npc.y;
          const dz = nearestPlayer.z - npc.z;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (length > 0) {
            // Normalize and apply speed
            const speed = 0.5; // NPC movement speed
            const nx = dx / length * speed;
            const ny = dy / length * speed;
            const nz = dz / length * speed;
            
            // Try to move the NPC
            const newX = npc.x + nx;
            const newY = npc.y + ny;
            const newZ = npc.z + nz;
            
            // Check collision
            if (!this.checkCollision(newX, newY, newZ, 24)) { // Assuming NPC size of 24
              npc.x = newX;
              npc.y = newY;
              npc.z = newZ;
            }
          }
        }
      }
    });
    
    // Check player-NPC interactions (combat, damage, etc.)
    // This would be more complex in a real game
  }
}