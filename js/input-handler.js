class InputHandler {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.setupListeners();
  }
  
  setupListeners() {
    // Mouse click handler
    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Check if click is on an interactable object
      const interacted = this.game.handleClick(x, y);
      
      // If not interacted with object, move the player to clicked position
      if (!interacted) {
        this.game.player.moveTo(x, y);
      }
    });
    
    // Add keyboard movement (WASD)
    document.addEventListener('keydown', (event) => {
      switch(event.key) {
        case 'w': 
          this.game.player.moveDirection(0, -1);
          break;
        case 'a': 
          this.game.player.moveDirection(-1, 0);
          break;
        case 's': 
          this.game.player.moveDirection(0, 1);
          break;
        case 'd': 
          this.game.player.moveDirection(1, 0);
          break;
      }
    });
  }
}
