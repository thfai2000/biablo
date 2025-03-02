class Floor {
  constructor(floorNumber, config) {
    this.floorNumber = floorNumber;
    this.config = config;
    this.firstVisit = true;
    this.map = this.generateMap();
    this.enemies = [];
    this.treasures = [];
    
    // Generate stairs based on floor number
    this.generateStairs();
    
    // Initially spawn enemies and treasures
    this.spawnEnemies();
    this.spawnTreasures();
  }
  
  generateMap() {
    // Generate a random map with rooms and corridors
    // This is a placeholder for the actual map generation algorithm
    const map = {
      width: 1000,
      height: 800,
      rooms: [],
      walls: []
    };
    
    // Add rooms and ensure they're connected
    // ...

    return map;
  }
  
  generateStairs() {
    // Village (floor 0) only has down stairs
    if (this.floorNumber === this.config.game.villageFloor) {
      this.upStairs = null;
      this.downStairs = {
        x: 500, // Position should be calculated based on actual map
        y: 600,
        sprite: 'stairs-down'
      };
    } 
    // Last floor only has up stairs
    else if (this.floorNumber === this.config.game.totalFloors - 1) {
      this.upStairs = {
        x: 500,
        y: 200,
        sprite: 'stairs-up'
      };
      this.downStairs = null;
    } 
    // All other floors have both up and down stairs
    else {
      this.upStairs = {
        x: 300,
        y: 200,
        sprite: 'stairs-up'
      };
      this.downStairs = {
        x: 700,
        y: 600,
        sprite: 'stairs-down'
      };
    }
  }
  
  spawnEnemies() {
    // Spawn enemies on this floor
    // ...
  }
  
  respawnEnemies() {
    // Clear existing enemies and spawn new ones
    this.enemies = [];
    this.spawnEnemies();
  }
  
  spawnTreasures() {
    // Spawn treasure chests on this floor
    // ...
  }
  
  update(player) {
    // Update all entities on this floor
    // ...
  }
  
  render(ctx) {
    // Render floor, walls, rooms
    // ...
    
    // Render stairs
    if (this.upStairs) {
      // Draw up stairs
      ctx.fillStyle = 'brown';
      ctx.fillRect(this.upStairs.x - 15, this.upStairs.y - 15, 30, 30);
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText('↑', this.upStairs.x - 5, this.upStairs.y + 5);
    }
    
    if (this.downStairs) {
      // Draw down stairs
      ctx.fillStyle = 'brown';
      ctx.fillRect(this.downStairs.x - 15, this.downStairs.y - 15, 30, 30);
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText('↓', this.downStairs.x - 5, this.downStairs.y + 5);
    }
    
    // Render enemies and treasures
    // ...
  }
}
