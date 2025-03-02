class DungeonGenerator {
    constructor(config, level) {
        this.config = config;
        this.level = level;
        this.width = config.map.viewportWidth * 3; // Map larger than viewport
        this.height = config.map.viewportHeight * 3;
        this.minRooms = config.map.minRoomsPerFloor;
        this.maxRooms = config.map.maxRoomsPerFloor;
        this.roomMinSize = config.map.roomMinSize;
        this.roomMaxSize = config.map.roomMaxSize;
        
        // Tile types: 0=wall, 1=floor, 2=up stairs, 3=down stairs
        this.map = Array(this.height).fill().map(() => Array(this.width).fill(0));
        this.rooms = [];
        this.upStairsPos = null;
        this.downStairsPos = null;
    }
    
    generate() {
        // Reset the map
        this.map = Array(this.height).fill().map(() => Array(this.width).fill(0));
        this.rooms = [];
        
        // Generate rooms
        const numRooms = randomInt(this.minRooms, this.maxRooms);
        
        for (let i = 0; i < numRooms; i++) {
            // Random room size
            const w = randomInt(this.roomMinSize, this.roomMaxSize);
            const h = randomInt(this.roomMinSize, this.roomMaxSize);
            
            // Random room position
            const x = randomInt(1, this.width - w - 1);
            const y = randomInt(1, this.height - h - 1);
            
            const newRoom = {
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
        
        return {
            map: this.map,
            upStairsPos: this.upStairsPos,
            downStairsPos: this.downStairsPos
        };
    }
    
    _createRoom(room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                this.map[y][x] = 1; // Floor
            }
        }
    }
    
    _createCorridor(roomA, roomB) {
        // Create an L-shaped corridor between two rooms
        const startX = roomA.centerX;
        const startY = roomA.centerY;
        const endX = roomB.centerX;
        const endY = roomB.centerY;
        
        // First go horizontally then vertically
        this._drawHorizontalCorridor(startX, endX, startY);
        this._drawVerticalCorridor(startY, endY, endX);
    }
    
    _drawHorizontalCorridor(startX, endX, y) {
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
    
    _drawVerticalCorridor(startY, endY, x) {
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
    
    _roomsIntersect(a, b) {
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
    generateVillage() {
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
        
        // Add the dungeon entrance (cave) near the edge
        const caveX = Math.floor(this.width / 2);
        const caveY = Math.floor(this.height * 0.8);
        
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
}
