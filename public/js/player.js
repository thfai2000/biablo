/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
/*!******************************!*\
  !*** ./src/client/player.ts ***!
  \******************************/

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

})();

/******/ })()
;
//# sourceMappingURL=player.js.map