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
            action: false
        };
        
        // Add cooldown for action key
        this.actionCooldown = 1000; // 1 second cooldown
        this.lastActionTime = 0;
        
        this._setupInput();
    }
    
    _setupInput() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
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
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.key) {
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
                displayMessage(`Going up to floor ${this.currentFloor}`);
                return { floorChange: true, direction: 'up' };
            }
            
            // Handle down stairs
            if (downStairsPos && tileX === downStairsPos.x && tileY === downStairsPos.y) {
                this.currentFloor++;
                this.lastActionTime = currentTime; // Update last action time
                displayMessage(`Going down to floor ${this.currentFloor}`);
                return { floorChange: true, direction: 'down' };
            }
        }
        
        return { floorChange: false };
    }
    
    placeAtStairs(direction, upStairsPos, downStairsPos) {
        // Place player at the appropriate stairs position after changing floors
        if (direction === 'up' && downStairsPos) {
            this.x = downStairsPos.x * game.tileSize;
            this.y = downStairsPos.y * game.tileSize;
        } else if (direction === 'down' && upStairsPos) {
            this.x = upStairsPos.x * game.tileSize;
            this.y = upStairsPos.y * game.tileSize;
        }
    }
    
    draw(ctx, offsetX, offsetY) {
        // Draw the player
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(
            this.x - offsetX, 
            this.y - offsetY, 
            game.tileSize / 2, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
    }
}
