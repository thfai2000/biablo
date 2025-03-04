import { Player } from './player';
import { STAT_ICONS, SLOT_ICONS } from './icons';
import { EquipmentSlot } from './item';
import * as THREE from 'three';

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
  mesh?: THREE.Mesh;
}


export class StatsWidget {
  private player: Player | null = null;
  private selectedInventoryItem: any | null = null;
  private isVisible: boolean = false;
  private buttonBoundsMap: Map<string, ButtonBounds> = new Map();
  private inventoryGrid: GridCell[][] = [];
  private lastRightClickTime: number = 0;
  private lastClickTime: number = 0;
  private lastClickedCell: { row: number, col: number } | null = null;
  private doubleClickThreshold: number = 300;

  // Three.js specific properties
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private raycaster: THREE.Raycaster;
  private textureLoader: THREE.TextureLoader;
  private uiMeshes: THREE.Object3D[] = [];
  private textSprites: THREE.Sprite[] = [];

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera();
    this.raycaster = new THREE.Raycaster();
    this.textureLoader = new THREE.TextureLoader();
    this.isVisible = false;
    this.initializeGrid();
    this.initializeThreeJS();
  }

  private initializeThreeJS(): void {
    // Create scene for UI
    this.scene = new THREE.Scene();
    
    // Create orthographic camera for UI
    const frustumSize = 1000;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      1,
      1000
    );
    this.camera.position.z = 100;

    // Initialize raycaster for UI interaction
    this.raycaster = new THREE.Raycaster();
    
    // Initialize texture loader
    this.textureLoader = new THREE.TextureLoader();
  }

  private initializeGrid(): void {
    // Implementation for initializing grid
  }

  private createTextSprite(text: string, color: string = '#ffffff'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.font = '24px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    return new THREE.Sprite(material);
  }

  private updateUI(): void {
    if (!this.isVisible || !this.player) return;

    // Clear existing UI elements
    this.uiMeshes.forEach(mesh => this.scene.remove(mesh));
    this.textSprites.forEach(sprite => this.scene.remove(sprite));
    this.uiMeshes = [];
    this.textSprites = [];

    // Create background panel
    const panelGeometry = new THREE.PlaneGeometry(800, 600);
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.85
    });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    this.scene.add(panel);
    this.uiMeshes.push(panel);

    // Add stats text
    const stats = this.player.getStats();
    Object.entries(STAT_ICONS).forEach(([stat, icon], index) => {
      const text = `${icon} ${stat}: ${stats[stat]}`;
      const sprite = this.createTextSprite(text);
      sprite.position.set(-300, 250 - index * 40, 1);
      this.scene.add(sprite);
      this.textSprites.push(sprite);
    });

    // Create inventory grid
    this.updateInventoryGrid();
  }

  private updateInventoryGrid(): void {
    if (!this.player) return;

    const inventory = this.player.getInventory();
    const cellGeometry = new THREE.PlaneGeometry(INVENTORY_GRID.cellSize, INVENTORY_GRID.cellSize);
    const emptyMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.5
    });

    // Clear existing grid meshes
    this.inventoryGrid.forEach(row => {
      row.forEach(cell => {
        if (cell.mesh) {
          this.scene.remove(cell.mesh);
        }
      });
    });

    // Create new grid
    this.initializeGrid();

    inventory.forEach((item, index) => {
      const row = Math.floor(index / INVENTORY_GRID.cols);
      const col = index % INVENTORY_GRID.cols;
      
      if (row < INVENTORY_GRID.rows && col < INVENTORY_GRID.cols) {
        const cell = this.inventoryGrid[row][col];
        cell.item = item;

        // Create cell mesh
        const cellMesh = new THREE.Mesh(cellGeometry, emptyMaterial);
        const x = (col - INVENTORY_GRID.cols / 2) * (INVENTORY_GRID.cellSize + INVENTORY_GRID.padding);
        const y = (INVENTORY_GRID.rows / 2 - row) * (INVENTORY_GRID.cellSize + INVENTORY_GRID.padding);
        cellMesh.position.set(x, y - 100, 1); // Position below stats

        this.scene.add(cellMesh);
        cell.mesh = cellMesh;

        // Add item icon if exists
        if (item) {
          const iconSprite = this.createTextSprite(item.icon || '📦');
          iconSprite.position.copy(cellMesh.position);
          iconSprite.position.z = 2;
          this.scene.add(iconSprite);
          this.textSprites.push(iconSprite);
        }
      }
    });
  }

  // ... rest of the existing methods ...

  public handleCanvasClick(x: number, y: number, canvas: HTMLCanvasElement, isRightClick: boolean = false): void {
    if (!this.isVisible || !this.player) return;

    // Convert mouse coordinates to normalized device coordinates
    const mouse = new THREE.Vector2(
      (x / canvas.width) * 2 - 1,
      -(y / canvas.height) * 2 + 1
    );

    // Update raycaster
    this.raycaster.setFromCamera(mouse, this.camera);

    // Check intersections with inventory grid
    const intersects = this.raycaster.intersectObjects(this.uiMeshes);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      // Find which grid cell was clicked
      this.inventoryGrid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell.mesh === intersect.object) {
            this.handleCellClick(rowIndex, colIndex, isRightClick);
          }
        });
      });
    }
  }

  private handleCellClick(row: number, col: number, isRightClick: boolean): void {
    const cell = this.inventoryGrid[row][col];
    if (!cell.item) return;

    const now = Date.now();
    
    if (!isRightClick) {
      // Handle double-click
      if (this.lastClickedCell && 
          this.lastClickedCell.row === row && 
          this.lastClickedCell.col === col &&
          now - this.lastClickTime < this.doubleClickThreshold) {
        
        if (cell.item.type === 'potion') {
          this.player?.useItem(cell.item.id);
        } else if (['weapon', 'armor', 'helmet', 'boots'].includes(cell.item.type)) {
          this.player?.equipItem(cell.item.id);
        }
        this.updateInventoryGrid();
        
        this.lastClickTime = 0;
        this.lastClickedCell = null;
      } else {
        this.lastClickTime = now;
        this.lastClickedCell = { row, col };
        this.selectedInventoryItem = cell.item;
      }
    } else {
      if (cell.item.type === 'potion') {
        this.player?.useItem(cell.item.id);
        this.updateInventoryGrid();
      }
    }
  }

  // Public methods remain mostly the same
  setPlayer(player: Player): void {
    this.player = player;
    this.updateInventoryGrid();
  }

  isCurrentlyVisible(): boolean {
    return this.isVisible;
  }

  toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.updateUI();
    }
  }
}
