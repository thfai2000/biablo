class MessageLog {
  constructor() {
    this.messages = [];
    this.maxMessages = 5;
  }
  
  addMessage(message) {
    // Add timestamp to message
    const now = new Date();
    const timeString = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    this.messages.push({
      text: message,
      time: timeString,
      age: 0
    });
    
    // Limit number of messages
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }
  
  update() {
    // Age messages and remove old ones
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].age++;
      
      // Remove messages older than 8 seconds (assuming 60 fps)
      if (this.messages[i].age > 480) {
        this.messages.splice(i, 1);
      }
    }
  }
  
  render(ctx) {
    // Render messages at the bottom of the screen
    const canvas = ctx.canvas;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = 'white';
    
    for (let i = 0; i < this.messages.length; i++) {
      ctx.fillText(
        `[${this.messages[i].time}] ${this.messages[i].text}`, 
        20, 
        canvas.height - 20 - (i * 20)
      );
    }
  }
}
