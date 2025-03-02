import { Player } from './player';

export class StatsWidget {
  private isVisible: boolean;
  
  constructor() {
    this.isVisible = false;
  }

  isCurrentlyVisible(): boolean {
    return this.isVisible;
  }
  
  toggle(): void {
    this.isVisible = !this.isVisible;
  }
  
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, player: Player): void {
    if (!this.isVisible || !player) return;
    
    const popupX = canvas.width / 2 - 300; // Adjust position and size
    const popupY = canvas.height / 2 - 200;
    const popupWidth = 600;
    const popupHeight = 400;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Popup panel
    ctx.fillStyle = '#222';
    ctx.fillRect(popupX, popupY, popupWidth, popupHeight);
    
    // Popup border
    ctx.strokeStyle = '#gold';
    ctx.lineWidth = 2;
    ctx.strokeRect(popupX, popupY, popupWidth, popupHeight);
    
    // Title
    ctx.fillStyle = '#gold';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Player Status', popupX + popupWidth / 2, popupY + 30);
    ctx.textAlign = 'left';
    
    // Left side: Stats
    this.renderStats(ctx, popupX + 20, popupY + 60, player);
    
    // Right side: Inventory and Body Diagram
    this.renderInventoryAndBody(ctx, popupX + popupWidth / 2, popupY + 60, player, canvas);
    
    // Close button
    ctx.fillStyle = '#444';
    ctx.fillRect(popupX + popupWidth - 80, popupY + 10, 60, 25);
    ctx.strokeStyle = '#aaa';
    ctx.strokeRect(popupX + popupWidth - 80, popupY + 10, 60, 25);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Close', popupX + popupWidth - 50, popupY + 25);
    ctx.textAlign = 'left';
  }
  
  renderStats(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player): void {
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Stats:', x, y);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    let currentY = y + 25;
    
    const playerStats = player.getStats();
    ctx.fillText(`Health: ${playerStats.currentHealth}/${playerStats.maxHealth}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Mana: ${playerStats.currentMana}/${playerStats.maxMana}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Strength: ${playerStats.strength}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Dexterity: ${playerStats.dexterity}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Intelligence: ${playerStats.intelligence}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Level: ${playerStats.level}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Experience: ${playerStats.experience}/${playerStats.nextLevelExp}`, x + 10, currentY);
    
    // Add "Increase" buttons if player has level-up points
    if (player.hasLevelUpPoints()) {
      ctx.fillStyle = '#00ff00'; // Green color
      ctx.font = '12px Arial';
      
      let buttonY = y + 25;
      const buttonX = x + 150;
      const buttonWidth = 80;
      const buttonHeight = 20;
      
      // Example: Strength increase button
      ctx.fillRect(buttonX, buttonY - 15, buttonWidth, buttonHeight);
      ctx.fillStyle = '#000';
      ctx.fillText('Increase', buttonX + 10, buttonY);
      
      // Add click detection logic later
    }
  }
  
  renderInventoryAndBody(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player, canvas: HTMLCanvasElement): void {
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Equipment:', x, y);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    let currentY = y + 25;
    
    const equipment = player.getEquipment();
    ctx.fillText(`Weapon: ${equipment.weapon ? equipment.weapon.name : 'None'}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Armor: ${equipment.armor ? equipment.armor.name : 'None'}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Helmet: ${equipment.helmet ? equipment.helmet.name : 'None'}`, x + 10, currentY);
    currentY += 20;
    ctx.fillText(`Boots: ${equipment.boots ? equipment.boots.name : 'None'}`, x + 10, currentY);
    
    // Draw body diagram with equipment slots
    this.drawBodyDiagram(ctx, x + 10, currentY + 20);
    
    // Draw inventory
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Inventory:', x, currentY + 150);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    const inventory = player.getInventory();
    if (inventory.length === 0) {
      ctx.fillText('Empty', x + 10, currentY + 175);
    } else {
      inventory.slice(0, 5).forEach((item, index) => {
        ctx.fillText(`${index + 1}. ${item.name} ${item.quantity > 1 ? `(${item.quantity})` : ''}`,
          x + 10, currentY + 175 + index * 20);
      });
      
      if (inventory.length > 5) {
        ctx.fillText(`... and ${inventory.length - 5} more items`, x + 10, currentY + 275);
      }
    }
  }
  
  drawBodyDiagram(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Basic body outline
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 80, 120); // Body
    ctx.strokeRect(x + 20, y - 30, 40, 30); // Head/Helmet
    ctx.strokeRect(x, y + 30, 80, 30); // Armor
    ctx.strokeRect(x, y + 90, 80, 30); // Boots
    ctx.strokeRect(x - 30, y + 30, 30, 60); // Weapon
    
    // Add labels
    ctx.fillStyle = '#ddd';
    ctx.font = '12px Arial';
    ctx.fillText('Head', x + 25, y - 15);
    ctx.fillText('Armor', x + 25, y + 50);
    ctx.fillText('Boots', x + 25, y + 110);
    ctx.fillText('Weapon', x - 25, y + 50);
  }
  
  increaseStat(player: Player, stat: string): void {
    // Logic to decrement level-up points and increment the chosen stat
  }
}
