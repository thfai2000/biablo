import { Player } from './player';

// Define our own simple icons since we can't import them
const STAT_ICONS = {
  strength: '💪',
  dexterity: '🏃',
  intelligence: '🧠'
};

// Interface for storing UI-specific data per inventory item
interface ButtonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class StatsWidget {
  private player: Player | null = null;
  private selectedInventoryItem: any | null = null;
  private isVisible: boolean = false;
  private buttonBoundsMap: Map<string, ButtonBounds> = new Map();
  
  constructor() {
    this.isVisible = false;
  }

  setPlayer(player: Player): void {
    this.player = player;
  }
  
  isCurrentlyVisible(): boolean {
    return this.isVisible;
  }
  
  toggle(): void {
    this.isVisible = !this.isVisible;
  }
  
  renderCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    if (!this.isVisible || !this.player) return;
    
    const popupX = canvas.width / 2 - 300;
    const popupY = canvas.height / 2 - 200;
    const popupWidth = 600;
    const popupHeight = 400;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Popup panel with background
    ctx.fillStyle = '#333';
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
    this.renderStatsSection(ctx, popupX + 20, popupY + 60);
    
    // Right side: Equipment and Inventory
    this.renderEquipmentSection(ctx, popupX + popupWidth / 2, popupY + 60, popupWidth, canvas);
    
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
  
  private renderStatsSection(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.player) return;
    const playerStats = this.player.getStats();
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Stats:', x, y);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    let currentY = y + 25;
    
    // Level and Experience
    ctx.fillText(`Level: ${playerStats.level}`, x + 10, currentY);
    currentY += 20;
    
    // Experience bar
    const expBarWidth = 150;
    const expBarHeight = 10;
    const expProgress = Math.min(playerStats.experience / playerStats.nextLevelExp, 1);
    
    // Bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 10, currentY, expBarWidth, expBarHeight);
    
    // Progress bar
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x + 10, currentY, expBarWidth * expProgress, expBarHeight);
    
    // Text
    ctx.fillStyle = 'white';
    ctx.fillText(`Experience: ${playerStats.experience}/${playerStats.nextLevelExp}`, x + 10, currentY + 25);
    currentY += 40;
    
    // Core stats
    const statNames = ['strength', 'dexterity', 'intelligence'];
    statNames.forEach(statName => {
      const icon = STAT_ICONS[statName as keyof typeof STAT_ICONS];
      ctx.fillText(`${icon} ${statName.charAt(0).toUpperCase() + statName.slice(1)}: ${playerStats[statName as keyof typeof playerStats]}`, 
                   x + 10, currentY);
      currentY += 20;
    });
    
    // Health and Mana bars
    currentY += 10;
    
    // Health bar
    const barWidth = 150;
    const barHeight = 12;
    const healthPercent = playerStats.currentHealth / playerStats.maxHealth;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 10, currentY, barWidth, barHeight);
    
    ctx.fillStyle = '#e53935';
    ctx.fillRect(x + 10, currentY, barWidth * healthPercent, barHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`❤️ Health: ${playerStats.currentHealth}/${playerStats.maxHealth}`, x + 10, currentY + 25);
    currentY += 35;
    
    // Mana bar
    const manaPercent = playerStats.currentMana / playerStats.maxMana;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 10, currentY, barWidth, barHeight);
    
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(x + 10, currentY, barWidth * manaPercent, barHeight);
    
    ctx.fillStyle = 'white';
    ctx.fillText(`🔮 Mana: ${playerStats.currentMana}/${playerStats.maxMana}`, x + 10, currentY + 25);
  }
  
  private renderEquipmentSection(ctx: CanvasRenderingContext2D, x: number, y: number, popupWidth: number, canvas: HTMLCanvasElement): void {
    if (!this.player) return;
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Equipment:', x, y);
    
    // Display equipment
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    let currentY = y + 25;
    
    const equipment = this.player.getEquipment();
    
    // Equipment slots
    const slots = [
      { name: 'Weapon', item: equipment.weapon },
      { name: 'Armor', item: equipment.armor },
      { name: 'Helmet', item: equipment.helmet },
      { name: 'Boots', item: equipment.boots }
    ];
    
    slots.forEach(slot => {
      ctx.fillText(`${slot.name}: ${slot.item ? slot.item.name : 'None'}`, x + 10, currentY);
      currentY += 25;
      
      if (slot.item && slot.item.stats) {
        const stats = slot.item.stats;
        ctx.font = '12px Arial';
        ctx.fillStyle = '#aaa';
        
        if (stats.damage) {
          ctx.fillText(`Damage: +${stats.damage}`, x + 20, currentY);
          currentY += 15;
        }
        if (stats.defense) {
          ctx.fillText(`Defense: +${stats.defense}`, x + 20, currentY);
          currentY += 15;
        }
        if (stats.strengthBonus) {
          ctx.fillText(`Strength: +${stats.strengthBonus}`, x + 20, currentY);
          currentY += 15;
        }
        if (stats.dexterityBonus) {
          ctx.fillText(`Dexterity: +${stats.dexterityBonus}`, x + 20, currentY);
          currentY += 15;
        }
        if (stats.intelligenceBonus) {
          ctx.fillText(`Intelligence: +${stats.intelligenceBonus}`, x + 20, currentY);
          currentY += 15;
        }
        
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        currentY += 5;
      }
    });
    
    // Inventory header
    currentY += 10;
    ctx.fillStyle = '#aaa';
    ctx.fillText('Inventory:', x, currentY);
    currentY += 25;
    
    // Draw inventory
    const inventory = this.player.getInventory();
    
    // Clear button bounds map before redrawing
    this.buttonBoundsMap.clear();
    
    if (inventory.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.fillText('Empty', x + 10, currentY);
    } else {
      // Show only first 8 items to avoid overflow
      const itemsToShow = inventory.slice(0, 8);
      
      itemsToShow.forEach((item, index) => {
        const isSelected = item === this.selectedInventoryItem;
        
        // Highlight selected item
        if (isSelected) {
          ctx.fillStyle = '#444';
          ctx.fillRect(x, currentY - 15, 200, 20);
          ctx.fillStyle = '#ffcc00';
        } else {
          ctx.fillStyle = 'white';
        }
        
        ctx.fillText(`${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`, x + 10, currentY);
        
        // Add button for using/equipping if there's room
        if (item.type === 'potion' || ['weapon', 'armor', 'helmet', 'boots'].includes(item.type)) {
          const buttonText = item.type === 'potion' ? 'Use' : 'Equip';
          const buttonWidth = 60;
          const buttonHeight = 20;
          const buttonX = x + 180;
          const buttonY = currentY - 15;
          
          // Button background
          ctx.fillStyle = item.type === 'potion' ? '#4CAF50' : '#2196F3';
          ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
          
          // Button text
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.fillText(buttonText, buttonX + 20, buttonY + 14);
          
          // Store button position for click handling
          this.buttonBoundsMap.set(item.id, { 
            x: buttonX, 
            y: buttonY, 
            width: buttonWidth, 
            height: buttonHeight 
          });
        }
        
        currentY += 25;
      });
      
      if (inventory.length > 8) {
        ctx.fillStyle = '#aaa';
        ctx.fillText(`...and ${inventory.length - 8} more items`, x + 10, currentY);
      }
    }
  }
  
  handleCanvasClick(x: number, y: number, canvas: HTMLCanvasElement): void {
    if (!this.isVisible || !this.player) return;
    
    const popupX = canvas.width / 2 - 300;
    const popupY = canvas.height / 2 - 200;
    const popupWidth = 600;
    const popupHeight = 400;
    
    // Check if close button was clicked
    if (x >= popupX + popupWidth - 80 && x <= popupX + popupWidth - 20 && 
        y >= popupY + 10 && y <= popupY + 35) {
      this.toggle();
      return;
    }
    
    // Check if an inventory item button was clicked
    const inventory = this.player.getInventory();
    
    for (const item of inventory) {
      const buttonBounds = this.buttonBoundsMap.get(item.id);
      if (buttonBounds) {
        if (x >= buttonBounds.x && x <= buttonBounds.x + buttonBounds.width && 
            y >= buttonBounds.y && y <= buttonBounds.y + buttonBounds.height) {
          if (item.type === 'potion') {
            this.player.useItem(item.id);
          } else if (['weapon', 'armor', 'helmet', 'boots'].includes(item.type)) {
            this.player.equipItem(item.id);
          }
          return;
        }
      }
    }
    
    // Check for inventory item selection
    const equipmentY = popupY + 60;
    let inventoryStartY = equipmentY + 25;
    
    // Add height for equipment section
    const equipment = this.player.getEquipment();
    const slots = [equipment.weapon, equipment.armor, equipment.helmet, equipment.boots];
    slots.forEach(item => {
      inventoryStartY += 25;
      if (item && item.stats) {
        let statCount = 0;
        if (item.stats.damage) statCount++;
        if (item.stats.defense) statCount++;
        if (item.stats.strengthBonus) statCount++;
        if (item.stats.dexterityBonus) statCount++;
        if (item.stats.intelligenceBonus) statCount++;
        
        inventoryStartY += statCount * 15 + 5;
      }
    });
    
    inventoryStartY += 35;
    
    // Check if clicking in inventory item area
    const inventoryX = popupX + popupWidth / 2;
    const itemHeight = 25;
    
    for (let i = 0; i < Math.min(inventory.length, 8); i++) {
      const itemY = inventoryStartY + i * itemHeight;
      if (x >= inventoryX && x <= inventoryX + 200 && 
          y >= itemY - 15 && y <= itemY + 5) {
        this.selectedInventoryItem = this.selectedInventoryItem === inventory[i] ? null : inventory[i];
        return;
      }
    }
  }
}
