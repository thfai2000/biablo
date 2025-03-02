class Game {
  constructor(config) {
    this.config = config;
    this.currentFloor = config.game.initialFloor;
    this.player = new Player(config.player);
    this.floors = [];
    this.initializeFloors();
    this.messageLog = new MessageLog();
    this.interactableObjects = [];
  }

  initializeFloors() {
    // Create all floor maps
    for (let i = 0; i < this.config.game.totalFloors; i++) {
      this.floors.push(new Floor(i, this.config));
    }
  }

  changeFloor(newFloor) {
    if (newFloor >= 0 && newFloor < this.config.game.totalFloors) {
      this.currentFloor = newFloor;
      this.messageLog.addMessage(`You have arrived at floor ${newFloor}`);
      
      // Only spawn enemies if the floor has been visited before and is not the village
      if (newFloor !== this.config.game.villageFloor && !this.floors[newFloor].firstVisit) {
        this.floors[newFloor].respawnEnemies();
      }
      
      // Mark this floor as visited
      this.floors[newFloor].firstVisit = false;
      
      // Update interactable objects for the current floor
      this.updateInteractables();
    }
  }

  update() {
    // Update player, enemies and other game elements
    this.player.update();
    this.floors[this.currentFloor].update(this.player);
    
    // Check for interactable objects near player
    this.checkInteractions();
  }

  checkInteractions() {
    for (let obj of this.interactableObjects) {
      // Calculate distance between player and interactable object
      const distance = calculateDistance(this.player.x, this.player.y, obj.x, obj.y);
      
      // If player is within interaction range
      if (distance <= this.config.interaction.stairsProximity) {
        obj.isInRange = true;
      } else {
        obj.isInRange = false;
      }
    }
  }

  updateInteractables() {
    this.interactableObjects = [];
    
    // Add stairs to interactable objects
    const currentFloorMap = this.floors[this.currentFloor];
    if (currentFloorMap.upStairs) {
      this.interactableObjects.push({
        type: 'stairs',
        direction: 'up',
        x: currentFloorMap.upStairs.x,
        y: currentFloorMap.upStairs.y,
        isInRange: false,
        interact: () => {
          this.changeFloor(this.currentFloor - 1);
        }
      });
    }
    
    if (currentFloorMap.downStairs) {
      this.interactableObjects.push({
        type: 'stairs',
        direction: 'down',
        x: currentFloorMap.downStairs.x,
        y: currentFloorMap.downStairs.y,
        isInRange: false,
        interact: () => {
          this.changeFloor(this.currentFloor + 1);
        }
      });
    }
  }

  handleClick(x, y) {
    // Check if player clicked on any interactable object in range
    for (let obj of this.interactableObjects) {
      // Check if click is on the object and player is in range
      if (isPointInObject(x, y, obj) && obj.isInRange) {
        if (obj.type === 'stairs') {
          this.messageLog.addMessage(`Using ${obj.direction} stairs...`);
          obj.interact();
          return true;
        }
      }
    }
    
    // If no interaction occurred, return false
    return false;
  }

  render(ctx) {
    // Render current floor
    this.floors[this.currentFloor].render(ctx);
    
    // Render interactable objects with highlights if in range
    for (let obj of this.interactableObjects) {
      if (obj.isInRange) {
        // Draw highlight around interactable object
        ctx.fillStyle = this.config.interaction.clickableHighlightColor;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, this.config.interaction.stairsProximity / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Render player and UI elements
    this.player.render(ctx);
    this.messageLog.render(ctx);
  }
}

// Helper functions
function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function isPointInObject(clickX, clickY, obj) {
  // Simple circle collision for interactable objects
  const radius = 20; // Size of interactable area
  return calculateDistance(clickX, clickY, obj.x, obj.y) <= radius;
}
