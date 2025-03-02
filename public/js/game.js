/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/client/dungeon-generator.ts":
/*!*****************************************!*\
  !*** ./src/client/dungeon-generator.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DungeonGenerator = void 0;
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
        this.map = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
        this.rooms = [];
        this.upStairsPos = null;
        this.downStairsPos = null;
    }
    generate() {
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
                if (y - i >= 0)
                    this.map[y - i][x] = 1;
                if (y + i < this.height)
                    this.map[y + i][x] = 1;
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
                if (x - i >= 0)
                    this.map[y][x - i] = 1;
                if (x + i < this.width)
                    this.map[y][x + i] = 1;
            }
        }
    }
    _roomsIntersect(a, b) {
        // Check if two rooms intersect, including a buffer
        const buffer = 2; // Minimum space between rooms
        return (a.x - buffer < b.x + b.w + buffer &&
            a.x + a.w + buffer > b.x - buffer &&
            a.y - buffer < b.y + b.h + buffer &&
            a.y + a.h + buffer > b.y - buffer);
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
    // Helper methods
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
exports.DungeonGenerator = DungeonGenerator;


/***/ }),

/***/ "./src/client/player.ts":
/*!******************************!*\
  !*** ./src/client/player.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Player = void 0;
const utils_1 = __webpack_require__(/*! ./utils */ "./src/client/utils.ts");
class Player {
    constructor(config) {
        this.config = config.player;
        this.x = 0;
        this.y = 0;
        this.currentFloor = 0;
        this.moveSpeed = this.config.initialStats.baseSpeed;
        // Set up keyboard controls
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            action: false,
            toggleMap: false
        };
        // Add cooldown for action key
        this.actionCooldown = 1000; // 1 second cooldown
        this.lastActionTime = 0;
        // Minimap settings
        this.showMinimap = true; // Default to showing the minimap
        this.minimapSize = 150; // Size of the minimap in pixels
        this.minimapScale = 0.2; // Scale factor for the minimap
        this._setupInput();
    }
    _setupInput() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                    this.keys.up = true;
                    break;
                case 'ArrowDown':
                case 's':
                    this.keys.down = true;
                    break;
                case 'ArrowLeft':
                case 'a':
                    this.keys.left = true;
                    break;
                case 'ArrowRight':
                case 'd':
                    this.keys.right = true;
                    break;
                case ' ':
                case 'Enter':
                    this.keys.action = true;
                    break;
                case 'm': // Add key to toggle minimap
                    this.keys.toggleMap = true;
                    this.toggleMinimap();
                    break;
            }
        });
        document.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                    this.keys.up = false;
                    break;
                case 'ArrowDown':
                case 's':
                    this.keys.down = false;
                    break;
                case 'ArrowLeft':
                case 'a':
                    this.keys.left = false;
                    break;
                case 'ArrowRight':
                case 'd':
                    this.keys.right = false;
                    break;
                case ' ':
                case 'Enter':
                    this.keys.action = false;
                    break;
                case 'm':
                    this.keys.toggleMap = false;
                    break;
            }
        });
    }
    update(map, upStairsPos, downStairsPos) {
        // Store previous position
        const oldX = this.x;
        const oldY = this.y;
        // Handle movement
        if (this.keys.up) {
            this.y -= this.moveSpeed;
        }
        if (this.keys.down) {
            this.y += this.moveSpeed;
        }
        if (this.keys.left) {
            this.x -= this.moveSpeed;
        }
        if (this.keys.right) {
            this.x += this.moveSpeed;
        }
        // Get reference to game for tileSize
        const game = window.game;
        // Collision detection with walls
        const tileX = Math.floor(this.x / game.tileSize);
        const tileY = Math.floor(this.y / game.tileSize);
        // Ensure player stays on walkable tiles
        if (tileX < 0 || tileX >= map[0].length || tileY < 0 || tileY >= map.length || map[tileY][tileX] === 0) {
            // Collision with a wall or out of bounds, revert to previous position
            this.x = oldX;
            this.y = oldY;
        }
        // Check for stairs interaction with cooldown
        const currentTime = Date.now();
        if (this.keys.action && currentTime - this.lastActionTime > this.actionCooldown) {
            // Handle up stairs
            if (upStairsPos && tileX === upStairsPos.x && tileY === upStairsPos.y) {
                this.currentFloor--;
                this.lastActionTime = currentTime; // Update last action time
                (0, utils_1.displayMessage)(`Going up to floor ${this.currentFloor}`);
                return { floorChange: true, direction: 'up' };
            }
            // Handle down stairs
            if (downStairsPos && tileX === downStairsPos.x && tileY === downStairsPos.y) {
                this.currentFloor++;
                this.lastActionTime = currentTime; // Update last action time
                (0, utils_1.displayMessage)(`Going down to floor ${this.currentFloor}`);
                return { floorChange: true, direction: 'down' };
            }
        }
        return { floorChange: false };
    }
    placeAtStairs(direction, upStairsPos, downStairsPos) {
        const game = window.game;
        // Place player at the appropriate stairs position after changing floors
        if (direction === 'up' && downStairsPos) {
            this.x = downStairsPos.x * game.tileSize;
            this.y = downStairsPos.y * game.tileSize;
        }
        else if (direction === 'down' && upStairsPos) {
            this.x = upStairsPos.x * game.tileSize;
            this.y = upStairsPos.y * game.tileSize;
        }
    }
    toggleMinimap() {
        this.showMinimap = !this.showMinimap;
        (0, utils_1.displayMessage)(`Minimap ${this.showMinimap ? 'enabled' : 'disabled'}`);
    }
    draw(ctx, offsetX, offsetY, map, upStairsPos, downStairsPos) {
        const game = window.game;
        // Draw the player
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(this.x - offsetX, this.y - offsetY, game.tileSize / 2, 0, Math.PI * 2);
        ctx.fill();
        // Try to get map data from game.currentFloor if not provided directly
        let mapData = map;
        let upStairsPosition = upStairsPos;
        let downStairsPosition = downStairsPos;
        // If map data not provided, try to get it from the game object
        if (!mapData && game && game.dungeonFloors) {
            const currentFloorData = game.dungeonFloors[this.currentFloor];
            if (currentFloorData) {
                mapData = currentFloorData.map;
                upStairsPosition = currentFloorData.upStairsPos;
                downStairsPosition = currentFloorData.downStairsPos;
            }
        }
        // Draw the minimap if map data is available
        if (mapData) {
            this.drawMinimap(ctx, mapData, upStairsPosition, downStairsPosition);
        }
        else {
            console.warn('No map data available for minimap rendering');
        }
    }
    drawMinimap(ctx, map, upStairsPos, downStairsPos) {
        if (!this.showMinimap || !map)
            return;
        const game = window.game;
        // Save the current context state
        ctx.save();
        const margin = 10;
        const mapSize = this.minimapSize;
        const tileSize = Math.max(2, game.tileSize * this.minimapScale); // Ensure tiles are at least 2px
        // Position the minimap in the top-right corner
        const minimapX = ctx.canvas.width - mapSize - margin;
        const minimapY = margin;
        // Draw minimap background with higher opacity
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(minimapX, minimapY, mapSize, mapSize);
        // Calculate scaling to fit the map in the minimap area
        const mapWidth = map[0].length * tileSize;
        const mapHeight = map.length * tileSize;
        const scaleX = mapSize / mapWidth;
        const scaleY = mapSize / mapHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed
        // Center the map in the minimap area
        const scaledWidth = mapWidth * scale;
        const scaledHeight = mapHeight * scale;
        const offsetX = minimapX + (mapSize - scaledWidth) / 2;
        const offsetY = minimapY + (mapSize - scaledHeight) / 2;
        // Apply scaling
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        // Draw the map tiles
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                // Only draw the tile if it's walkable
                if (map[y][x] === 1) {
                    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }
            }
        }
        // Draw stairs on minimap
        if (upStairsPos) {
            ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            ctx.fillRect(upStairsPos.x * tileSize, upStairsPos.y * tileSize, tileSize, tileSize);
        }
        if (downStairsPos) {
            ctx.fillStyle = 'rgba(255, 165, 0, 1)';
            ctx.fillRect(downStairsPos.x * tileSize, downStairsPos.y * tileSize, tileSize, tileSize);
        }
        // Draw player position on minimap
        const playerTileX = Math.floor(this.x / game.tileSize);
        const playerTileY = Math.floor(this.y / game.tileSize);
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
        ctx.fillRect(playerTileX * tileSize, playerTileY * tileSize, tileSize, tileSize);
        // Restore the context state
        ctx.restore();
        // Draw border around minimap (after restore to ensure it's not scaled)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(minimapX, minimapY, mapSize, mapSize);
    }
}
exports.Player = Player;


/***/ }),

/***/ "./src/client/utils.ts":
/*!*****************************!*\
  !*** ./src/client/utils.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fetchGameConfig = fetchGameConfig;
exports.displayMessage = displayMessage;
exports.randomInt = randomInt;
/**
 * Fetches the game configuration from the server
 */
async function fetchGameConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        console.error('Error fetching game config:', error);
        return null;
    }
}
/**
 * Display a message in the message log
 */
function displayMessage(message, type = 'info') {
    const messageLog = document.getElementById('message-log');
    if (messageLog) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.textContent = message;
        messageLog.appendChild(messageElement);
        // Scroll to the bottom
        messageLog.scrollTop = messageLog.scrollHeight;
        // Limit the number of messages
        while (messageLog.childElementCount > 50) {
            messageLog.removeChild(messageLog.firstChild);
        }
    }
    else {
        console.log(`[${type}] ${message}`);
    }
}
/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!****************************!*\
  !*** ./src/client/game.ts ***!
  \****************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Game = void 0;
const player_1 = __webpack_require__(/*! ./player */ "./src/client/player.ts");
const dungeon_generator_1 = __webpack_require__(/*! ./dungeon-generator */ "./src/client/dungeon-generator.ts");
const utils_1 = __webpack_require__(/*! ./utils */ "./src/client/utils.ts");
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 32;
        this.config = null;
        this.player = null;
        this.floors = {};
        this.currentFloor = 0;
        this.cameraX = 0;
        this.cameraY = 0;
        this.lastTime = 0;
        // Assets
        this.assets = {
            tiles: {
                wall: '#333',
                floor: '#555',
                upStairs: '#77f',
                downStairs: '#f77'
            }
        };
        this.init();
    }
    async init() {
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        // Load game config
        this.config = await (0, utils_1.fetchGameConfig)();
        if (!this.config) {
            (0, utils_1.displayMessage)('Could not load game configuration', 'danger');
            return;
        }
        // Initialize player
        this.player = new player_1.Player(this.config);
        // Generate the initial floor (village)
        this.generateFloor(0);
        // Start in the village
        this.currentFloor = 0;
        const startPos = this.getStartingPosition(0);
        if (this.player && startPos) {
            this.player.x = startPos.x * this.tileSize;
            this.player.y = startPos.y * this.tileSize;
        }
        (0, utils_1.displayMessage)('Welcome to the village! Find the cave to enter the dungeon.', 'info');
        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    generateFloor(level) {
        if (this.floors[level]) {
            return; // Floor already generated
        }
        if (!this.config)
            return;
        const generator = new dungeon_generator_1.DungeonGenerator(this.config, level);
        if (level === 0) {
            // Generate village
            this.floors[level] = generator.generateVillage();
        }
        else {
            // Generate dungeon floor
            this.floors[level] = generator.generate();
        }
        (0, utils_1.displayMessage)(`Generated floor ${level}`, 'info');
    }
    getStartingPosition(level) {
        const floor = this.floors[level];
        if (!floor || !floor.map)
            return null;
        // Find a suitable starting position on the floor
        if (level === 0) {
            // Start in center of village
            const map = floor.map;
            return {
                x: Math.floor(map[0].length / 2),
                y: Math.floor(map.length / 2)
            };
        }
        else {
            // Start at up stairs for dungeon floors
            return floor.upStairsPos || {
                x: Math.floor(floor.map[0].length / 2),
                y: Math.floor(floor.map.length / 2)
            };
        }
    }
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight * 0.9; // 90% of window height
    }
    updateCamera() {
        if (!this.player)
            return;
        // Calculate the camera position to follow the player
        const viewportWidth = this.canvas.width;
        const viewportHeight = this.canvas.height;
        // Center the camera on the player
        this.cameraX = this.player.x - viewportWidth / 2;
        this.cameraY = this.player.y - viewportHeight / 2;
        // Limit camera to map boundaries
        const currentMap = this.floors[this.currentFloor]?.map;
        if (!currentMap)
            return;
        const mapWidth = currentMap[0].length * this.tileSize;
        const mapHeight = currentMap.length * this.tileSize;
        this.cameraX = Math.max(0, Math.min(this.cameraX, mapWidth - viewportWidth));
        this.cameraY = Math.max(0, Math.min(this.cameraY, mapHeight - viewportHeight));
    }
    gameLoop(currentTime) {
        // Calculate delta time
        const deltaTime = (currentTime - this.lastTime) / 1000; // in seconds
        this.lastTime = currentTime;
        // Make sure the current floor is generated
        if (!this.floors[this.currentFloor]) {
            this.generateFloor(this.currentFloor);
        }
        // Get floor data
        const floorData = this.floors[this.currentFloor];
        if (!floorData || !this.player) {
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }
        const { map, upStairsPos, downStairsPos } = floorData;
        // Update player - convert null to undefined for the stairs positions
        const result = this.player.update(map, upStairsPos || undefined, downStairsPos || undefined);
        // Handle floor changes
        if (result.floorChange) {
            this.currentFloor = this.player.currentFloor;
            // Make sure the floor is generated
            if (!this.floors[this.currentFloor]) {
                this.generateFloor(this.currentFloor);
            }
            const currentFloor = this.floors[this.currentFloor];
            if (currentFloor && result.direction) {
                // Place player at appropriate stairs
                this.player.placeAtStairs(result.direction, currentFloor.upStairsPos || undefined, currentFloor.downStairsPos || undefined);
            }
        }
        // Update camera
        this.updateCamera();
        // Render the game
        this.render();
        // Continue the game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Get current map
        const floorData = this.floors[this.currentFloor];
        if (!floorData || !floorData.map || !this.player)
            return;
        const { map, upStairsPos, downStairsPos } = floorData;
        // Calculate visible tile range based on camera position
        const startCol = Math.floor(this.cameraX / this.tileSize);
        const endCol = Math.min(map[0].length, startCol + Math.ceil(this.canvas.width / this.tileSize) + 1);
        const startRow = Math.floor(this.cameraY / this.tileSize);
        const endRow = Math.min(map.length, startRow + Math.ceil(this.canvas.height / this.tileSize) + 1);
        // Draw the map
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const tileType = map[y][x];
                switch (tileType) {
                    case 0: // Wall
                        this.ctx.fillStyle = this.assets.tiles.wall;
                        break;
                    case 1: // Floor
                        this.ctx.fillStyle = this.assets.tiles.floor;
                        break;
                    case 2: // Up stairs
                        this.ctx.fillStyle = this.assets.tiles.upStairs;
                        break;
                    case 3: // Down stairs
                        this.ctx.fillStyle = this.assets.tiles.downStairs;
                        break;
                }
                this.ctx.fillRect(x * this.tileSize - this.cameraX, y * this.tileSize - this.cameraY, this.tileSize, this.tileSize);
            }
        }
        // Draw the player
        this.player.draw(this.ctx, this.cameraX, this.cameraY, map, upStairsPos || undefined, downStairsPos || undefined);
        // Draw UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Floor: ${this.currentFloor}`, 10, 20);
        // Draw instructions
        this.ctx.fillText('Use arrow keys or WASD to move', 10, 40);
        this.ctx.fillText('Press Space or Enter at stairs to change floors', 10, 60);
    }
}
exports.Game = Game;
// Initialize game when the page loads
window.addEventListener('load', () => {
    window.game = new Game();
});

})();

/******/ })()
;
//# sourceMappingURL=game.js.map