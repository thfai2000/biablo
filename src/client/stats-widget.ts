import { Player } from './player';
import { STAT_ICONS, SLOT_ICONS } from './icons';
import { EquipmentSlot } from './item';

// Define grid configuration
const INVENTORY_GRID = {
  rows: 4,
  cols: 4,
  cellSize: 40,
  padding: 5
};

// Add necessary type definitions
interface PlayerStats {
  maxHealth: number;
  currentHealth: number;
  maxMana: number;
  currentMana: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  level: number;
  experience: number;
  nextLevelExp: number;
  [key: string]: number;
}

interface Equipment {
  [key: string]: any;
  weapon: any;
  armor: any;
  helmet: any;
  boots: any;
}

interface ButtonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GridCell {
  x: number;
  y: number;
  item: any | null;
}

/**
 * Represents a widget that displays player stats, equipment, and inventory.
 */
export class StatsWidget {
  /**
   * The player whose stats are being displayed.
   */
  private player: Player | null = null;

  /**
   * The currently selected inventory item.
   */
  private selectedInventoryItem: any | null = null;

  /**
   * Indicates whether the widget is currently visible.
   */
  private isVisible: boolean = false;

  /**
   * A map of button bounds for inventory items.
   */
  private buttonBoundsMap: Map<string, ButtonBounds> = new Map();

  /**
   * The grid-based inventory system.
   */
  private inventoryGrid: GridCell[][] = [];

  /**
   * The timestamp of the last right-click event.
   */
  private lastRightClickTime: number = 0;

  private lastClickTime: number = 0;
  private lastClickedCell: { row: number, col: number } | null = null;
  private doubleClickThreshold: number = 300; // 300ms threshold for double-click

  /**
   * Initializes a new instance of the StatsWidget class.
   */
  constructor() {
    this.isVisible = false;
    this.initializeGrid();
  }

  /**
   * Initializes the inventory grid.
   */
  private initializeGrid() {
    this.inventoryGrid = Array(INVENTORY_GRID.rows).fill(null).map(() => 
      Array(INVENTORY_GRID.cols).fill(null).map(() => ({
        x: 0,
        y: 0,
        item: null
      }))
    );
  }

  /**
   * Sets the player whose stats are to be displayed.
   * @param player - The player whose stats are to be displayed.
   */
  setPlayer(player: Player): void {
    this.player = player;
    this.updateInventoryGrid();
  }

  /**
   * Updates the inventory grid based on the player's inventory.
   */
  private updateInventoryGrid(): void {
    if (!this.player) return;
    
    const inventory = this.player.getInventory();
    this.initializeGrid();
    
    inventory.forEach((item, index) => {
      const row = Math.floor(index / INVENTORY_GRID.cols);
      const col = index % INVENTORY_GRID.cols;
      if (row < INVENTORY_GRID.rows && col < INVENTORY_GRID.cols) {
        this.inventoryGrid[row][col].item = item;
      }
    });
  }

  /**
   * Checks if the widget is currently visible.
   * @returns True if the widget is visible, otherwise false.
   */
  isCurrentlyVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Toggles the visibility of the widget.
   */
  toggle(): void {
    this.isVisible = !this.isVisible;
  }

  /**
   * Renders the widget on the given canvas context.
   * @param ctx - The canvas rendering context.
   * @param canvas - The canvas element.
   */
  renderCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    if (!this.isVisible || !this.player) return;

    // Add a semi-transparent overlay for the entire canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate dimensions based on content
    const statsHeight = Object.keys(STAT_ICONS).length * 30 + 60; // Stats + padding
    const equipmentHeight = INVENTORY_GRID.cellSize * 4 + INVENTORY_GRID.padding * 5; // Equipment slots
    const inventoryHeight = (INVENTORY_GRID.cellSize + INVENTORY_GRID.padding) * INVENTORY_GRID.rows;
    const contentHeight = Math.max(statsHeight, equipmentHeight + inventoryHeight + 60); // Add padding for titles

    const popupWidth = 600; // Wider to accommodate equipment layout
    const popupHeight = contentHeight + 80; // Add padding for top/bottom
    const popupX = (canvas.width - popupWidth) / 2;
    const popupY = (canvas.height - popupHeight) / 2;

    // Draw widget background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(popupX, popupY, popupWidth, popupHeight);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(popupX, popupY, popupWidth, popupHeight);

    // Title
    ctx.fillStyle = '#aaa';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Character', popupX + popupWidth / 2, popupY + 30);

    // Left side: Stats
    this.renderStatsSection(ctx, popupX + 40, popupY + 60);
    
    // Right side: Equipment and Inventory (with more horizontal space)
    this.renderEquipmentSection(ctx, popupX + popupWidth * 0.45, popupY + 60, popupWidth * 0.55, canvas);
  }

  /**
   * Renders the stats section of the widget.
   * @param ctx - The canvas rendering context.
   * @param x - The x-coordinate of the stats section.
   * @param y - The y-coordinate of the stats section.
   */
  private renderStatsSection(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.player) return;
    const stats = this.player.getStats() as PlayerStats;

    ctx.textAlign = 'left';
    ctx.font = '16px Arial';
    
    Object.entries(STAT_ICONS).forEach(([stat, icon], index) => {
      const yPos = y + index * 30;
      ctx.fillStyle = '#aaa';
      ctx.fillText(`${icon} ${stat.charAt(0).toUpperCase() + stat.slice(1)}: ${stats[stat]}`, x, yPos);
    });
  }

  /**
   * Renders the equipment section of the widget.
   * @param ctx - The canvas rendering context.
   * @param x - The x-coordinate of the equipment section.
   * @param y - The y-coordinate of the equipment section.
   * @param popupWidth - The width of the popup.
   * @param canvas - The canvas element.
   */
  private renderEquipmentSection(ctx: CanvasRenderingContext2D, x: number, y: number, popupWidth: number, canvas: HTMLCanvasElement): void {
    if (!this.player) return;

    const equipment = this.player.getEquipment() as Equipment;
    const slotSize = INVENTORY_GRID.cellSize;
    const padding = INVENTORY_GRID.padding;
    
    // Calculate center position
    const centerX = x;
    const startY = y + 30;

    // Layout configuration
    const positions = {
      [EquipmentSlot.HEAD]: { x: centerX + slotSize, y: startY },
      [EquipmentSlot.NECK]: { x: centerX + slotSize * 2 + padding, y: startY },
      [EquipmentSlot.RIGHT_HAND]: { x: centerX, y: startY + slotSize + padding },
      [EquipmentSlot.BODY]: { x: centerX + slotSize + padding, y: startY + slotSize + padding },
      [EquipmentSlot.LEFT_HAND]: { x: centerX + slotSize * 2 + padding * 2, y: startY + slotSize + padding },
      [EquipmentSlot.HANDS]: { x: centerX, y: startY + (slotSize + padding) * 2 },
      [EquipmentSlot.RING1]: { x: centerX + slotSize + padding, y: startY + (slotSize + padding) * 2 },
      [EquipmentSlot.RING2]: { x: centerX + slotSize * 2 + padding * 2, y: startY + (slotSize + padding) * 2 },
      [EquipmentSlot.FEET]: { x: centerX + slotSize + padding, y: startY + (slotSize + padding) * 3 }
    };

    // Draw equipment slots in the defined positions
    Object.entries(SLOT_ICONS).forEach(([slot, icon]) => {
      const position = positions[slot as EquipmentSlot];
      if (position) {
        this.renderEquipmentSlot(
          ctx,
          position.x,
          position.y,
          slot as EquipmentSlot,
          icon,
          equipment[slot]
        );
      }
    });

    // Inventory section
    const inventoryY = startY + (slotSize + padding) * 4 + 40;
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('Inventory', x, inventoryY - 10);

    this.renderInventoryGrid(ctx, x, inventoryY);
  }

  /**
   * Renders the inventory grid.
   * @param ctx - The canvas rendering context.
   * @param x - The x-coordinate of the inventory grid.
   * @param y - The y-coordinate of the inventory grid.
   */
  private renderInventoryGrid(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    this.inventoryGrid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellX = x + colIndex * (INVENTORY_GRID.cellSize + INVENTORY_GRID.padding);
        const cellY = y + rowIndex * (INVENTORY_GRID.cellSize + INVENTORY_GRID.padding);
        
        // Update cell positions for click detection
        cell.x = cellX;
        cell.y = cellY;

        // Draw cell background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(cellX, cellY, INVENTORY_GRID.cellSize, INVENTORY_GRID.cellSize);
        ctx.strokeStyle = '#666';
        ctx.strokeRect(cellX, cellY, INVENTORY_GRID.cellSize, INVENTORY_GRID.cellSize);

        if (cell.item) {
          // Draw item icon or name
          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          const icon = cell.item.icon || '📦';
          ctx.fillText(icon, cellX + INVENTORY_GRID.cellSize / 2, cellY + INVENTORY_GRID.cellSize / 2);
          
          // Draw quantity if more than 1
          if (cell.item.quantity > 1) {
            ctx.fillStyle = '#aaa';
            ctx.font = '12px Arial';
            ctx.fillText(`x${cell.item.quantity}`, cellX + INVENTORY_GRID.cellSize - 10, cellY + INVENTORY_GRID.cellSize - 5);
          }
        }
      });
    });
  }

  /**
   * Renders an equipment slot.
   * @param ctx - The canvas rendering context.
   * @param x - The x-coordinate of the equipment slot.
   * @param y - The y-coordinate of the equipment slot.
   * @param slot - The equipment slot.
   * @param icon - The icon representing the slot.
   * @param item - The item in the slot.
   */
  private renderEquipmentSlot(ctx: CanvasRenderingContext2D, x: number, y: number, slot: EquipmentSlot, icon: string, item: any): void {
    // Draw slot background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, INVENTORY_GRID.cellSize, INVENTORY_GRID.cellSize);
    
    // Draw border with different style for empty vs occupied slots
    ctx.strokeStyle = item ? '#888' : '#444';
    ctx.strokeRect(x, y, INVENTORY_GRID.cellSize, INVENTORY_GRID.cellSize);

    if (item) {
      // Draw equipped item with full opacity
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.icon || '📦', x + INVENTORY_GRID.cellSize / 2, y + INVENTORY_GRID.cellSize / 2);
      
      // Draw a subtle highlight to show it's equipped
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.strokeRect(x + 1, y + 1, INVENTORY_GRID.cellSize - 2, INVENTORY_GRID.cellSize - 2);
    } else {
      // Draw empty slot icon with reduced opacity
      ctx.fillStyle = 'rgba(102, 102, 102, 0.4)';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(icon, x + INVENTORY_GRID.cellSize / 2, y + INVENTORY_GRID.cellSize / 2);
    }
  }

  /**
   * Handles click events on the canvas.
   * @param x - The x-coordinate of the click.
   * @param y - The y-coordinate of the click.
   * @param canvas - The canvas element.
   * @param isRightClick - Indicates if the click is a right-click.
   */
  handleCanvasClick(x: number, y: number, canvas: HTMLCanvasElement, isRightClick: boolean = false): void {
    if (!this.isVisible || !this.player) return;

    // Check for right-click cooldown (prevent accidental double clicks)
    if (isRightClick) {
      const now = Date.now();
      if (now - this.lastRightClickTime < 500) return; // 500ms cooldown
      this.lastRightClickTime = now;
    }

    // Check inventory grid clicks
    for (let row = 0; row < this.inventoryGrid.length; row++) {
      for (let col = 0; col < this.inventoryGrid[row].length; col++) {
        const cell = this.inventoryGrid[row][col];
        if (x >= cell.x && x <= cell.x + INVENTORY_GRID.cellSize &&
            y >= cell.y && y <= cell.y + INVENTORY_GRID.cellSize) {
          
          if (cell.item) {
            const now = Date.now();
            
            if (!isRightClick) {
              // Check for double-click
              if (this.lastClickedCell && 
                  this.lastClickedCell.row === row && 
                  this.lastClickedCell.col === col &&
                  now - this.lastClickTime < this.doubleClickThreshold) {
                
                // Double-click detected
                if (cell.item.type === 'potion') {
                  this.player.useItem(cell.item.id);
                } else if (['weapon', 'armor', 'helmet', 'boots'].includes(cell.item.type)) {
                  this.player.equipItem(cell.item.id);
                }
                this.updateInventoryGrid();
                
                // Reset click tracking
                this.lastClickTime = 0;
                this.lastClickedCell = null;
              } else {
                // First click - just select the item
                this.lastClickTime = now;
                this.lastClickedCell = { row, col };
                this.selectedInventoryItem = cell.item;
              }
            } else {
              // Right click behavior remains the same
              if (cell.item.type === 'potion') {
                this.player.useItem(cell.item.id);
                this.updateInventoryGrid();
              }
            }
          } else {
            // Clicked empty cell - reset click tracking
            this.lastClickTime = 0;
            this.lastClickedCell = null;
          }
          return;
        }
      }
    }
    
    // Clicked outside inventory - reset click tracking
    this.lastClickTime = 0;
    this.lastClickedCell = null;
  }
}
