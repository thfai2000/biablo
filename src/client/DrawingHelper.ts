import * as THREE from 'three';
import { Position } from '../types/game-config';

export class DrawingHelper {
  private static minimapScene: THREE.Scene | null = null;
  private static minimapCamera: THREE.OrthographicCamera | null = null;
  private static minimapRenderer: THREE.WebGLRenderer | null = null;

  static setupMinimap(width: number, height: number): void {
    // Create minimap scene
    this.minimapScene = new THREE.Scene();
    this.minimapScene.background = new THREE.Color(0x000000);

    // Create orthographic camera for minimap
    const aspect = width / height;
    this.minimapCamera = new THREE.OrthographicCamera(
      -width / 2, width / 2,
      height / 2, -height / 2,
      1, 1000
    );
    this.minimapCamera.position.z = 100;

    // Create minimap renderer
    this.minimapRenderer = new THREE.WebGLRenderer({ alpha: true });
    this.minimapRenderer.setSize(width, height);
    this.minimapRenderer.domElement.style.position = 'absolute';
    this.minimapRenderer.domElement.style.top = '10px';
    this.minimapRenderer.domElement.style.right = '10px';
    this.minimapRenderer.domElement.style.border = '2px solid white';
    document.body.appendChild(this.minimapRenderer.domElement);
  }

  static updateMinimap(
    mapData: number[][],
    tileSize: number,
    playerPosition: THREE.Vector3,
    upStairsPos?: Position,
    downStairsPos?: Position
  ): void {
    if (!this.minimapScene || !this.minimapCamera || !this.minimapRenderer) return;

    // Clear existing minimap
    while(this.minimapScene.children.length > 0) {
      this.minimapScene.remove(this.minimapScene.children[0]);
    }

    // Create materials
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, transparent: true, opacity: 0.8 });
    const treeMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22, transparent: true, opacity: 0.8 });
    const upStairsMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const downStairsMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // Create geometries
    const tileGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
    const treeGeometry = new THREE.RingGeometry(1, 5, 32);

    // Create minimap tiles
    const mapGroup = new THREE.Group();
    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[y].length; x++) {
        const tileType = mapData[y][x];
        if (tileType === 1 || tileType === 4) { // Floor or tree location
          const tile = new THREE.Mesh(tileGeometry, floorMaterial);
          tile.position.set(
            x * tileSize - (mapData[y].length * tileSize) / 2,
            y * tileSize - (mapData.length * tileSize) / 2,
            0
          );
          mapGroup.add(tile);

          if (tileType === 4) { // Add tree marker
            const treeMark = new THREE.Mesh(treeGeometry, treeMaterial);
            treeMark.position.copy(tile.position);
            mapGroup.add(treeMark);
          }
        }
      }
    }

    // Add stairs markers
    if (upStairsPos) {
      const upStairs = new THREE.Mesh(tileGeometry, upStairsMaterial);
      upStairs.position.set(
        upStairsPos.x * tileSize - (mapData[0].length * tileSize) / 2,
        upStairsPos.y * tileSize - (mapData.length * tileSize) / 2,
        1
      );
      mapGroup.add(upStairs);
    }

    if (downStairsPos) {
      const downStairs = new THREE.Mesh(tileGeometry, downStairsMaterial);
      downStairs.position.set(
        downStairsPos.x * tileSize - (mapData[0].length * tileSize) / 2,
        downStairsPos.y * tileSize - (mapData.length * tileSize) / 2,
        1
      );
      mapGroup.add(downStairs);
    }

    // Add player marker
    const playerMarker = new THREE.Mesh(
      new THREE.CircleGeometry(tileSize / 2, 32),
      playerMaterial
    );
    playerMarker.position.set(
      playerPosition.x - (mapData[0].length * tileSize) / 2,
      playerPosition.z - (mapData.length * tileSize) / 2, // Note: y in game space is z in 3D space
      2
    );
    mapGroup.add(playerMarker);

    this.minimapScene.add(mapGroup);
    this.minimapRenderer.render(this.minimapScene, this.minimapCamera);
  }

  static dispose(): void {
    if (this.minimapRenderer) {
      this.minimapRenderer.dispose();
      this.minimapRenderer.domElement.remove();
      this.minimapRenderer = null;
    }
    this.minimapScene = null;
    this.minimapCamera = null;
  }
}