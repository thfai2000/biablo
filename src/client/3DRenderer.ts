import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GameConfig, FloorData } from '../types/game-config';

export class GameRenderer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls | null;
  private config: GameConfig;
  // Add new properties for camera control
  private playerRotation: number = 0;
  private cameraRotation: { x: number; y: number } = { x: 0, y: 0 };
  private readonly MIN_POLAR_ANGLE: number = 0;
  private readonly MAX_POLAR_ANGLE: number = Math.PI / 2;
  private readonly CAMERA_DISTANCE: number = 10;
  private readonly MOUSE_SENSITIVITY: number = 0.002;
  private floorGeometries: Map<number, THREE.Group>;
  private playerMeshes: Map<string, THREE.Object3D>;
  private npcMeshes: Map<string, THREE.Object3D>;
  private lights: THREE.Light[];
  private tileSize: number;
  private modelCache: Map<string, THREE.Object3D>;
  private clock: THREE.Clock;
  private mixers: THREE.AnimationMixer[];
  private collisionObjects: THREE.Object3D[] = [];
  
  // Camera modes
  private cameraMode: 'thirdPerson' | 'isometric' | 'firstPerson';
  private cameraOffset: THREE.Vector3;
  private playerLastPosition: THREE.Vector3 = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, config: GameConfig) {
    this.config = config;
    this.tileSize = config.map.tileSize;
    this.floorGeometries = new Map();
    this.playerMeshes = new Map();
    this.npcMeshes = new Map();
    this.lights = [];
    this.modelCache = new Map();
    this.mixers = [];
    this.clock = new THREE.Clock();
    
    // Default camera settings
    this.cameraMode = 'thirdPerson';
    this.cameraOffset = new THREE.Vector3(this.tileSize * 10, this.tileSize * 20, this.tileSize * 10);

    // Set up Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111); // Lighter background to verify rendering

    // Set up camera with better initial position and FOV
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 15, 20);
    this.camera.lookAt(0, 0, 0);

    // Set up renderer with proper size
    this.renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true,
      alpha: true
    });
    
    // Ensure renderer size matches canvas size
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio
    this.renderer.shadowMap.enabled = true;
    
    // Enable orbit controls by default for testing
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    
    // Setup lighting with increased intensity
    this.setupLighting();
    
    // Start animation loop
    this.animate();
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(canvas));

    // Add mouse move listener for camera rotation
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    
    // Lock pointer for better camera control
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });
    
    // Remove orbit controls as we'll implement our own camera system
    this.controls = null;
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    if (this.controls) {
      this.controls.update();
    }
    
    this.render();
  }

  private initCamera(): void {
    if (this.cameraMode === 'isometric') {
      // Set up isometric-style camera
      this.camera.position.set(
        this.cameraOffset.x,
        this.cameraOffset.y,
        this.cameraOffset.z
      );
      this.camera.lookAt(0, 0, 0);
    } else if (this.cameraMode === 'firstPerson') {
      // First person camera doesn't need special setup as it's handled in updateCameraPosition
    }
  }

  private setupLighting(): void {
    // Ambient light with increased intensity
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);

    // Directional light with better position and increased intensity
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(10, 20, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.far = 50;
    this.scene.add(sunLight);
    this.lights.push(sunLight);

    // Point lights for atmosphere
    const pointLight1 = new THREE.PointLight(0xff7700, 1, 50);
    pointLight1.position.set(0, 5, 0);
    pointLight1.castShadow = true;
    this.scene.add(pointLight1);
    this.lights.push(pointLight1);
  }

  public onWindowResize(canvas: HTMLCanvasElement): void {
    // Update camera aspect ratio
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  public enableDebugControls(): void {
    // Enable orbit controls for debugging
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
  }

  public setCameraMode(mode: 'thirdPerson' | 'isometric' | 'firstPerson'): void {
    this.cameraMode = mode;
    // Update camera position based on mode
    this.initCamera();
  }

  public loadFloor(floorLevel: number, floorData: FloorData): void {
    // Remove existing floor if it exists
    if (this.floorGeometries.has(floorLevel)) {
      const existingFloor = this.floorGeometries.get(floorLevel)!;
      // Remove all collision objects from this floor
      this.collisionObjects = this.collisionObjects.filter(obj => !existingFloor.children.includes(obj));
      this.scene.remove(existingFloor);
    }

    const floorGroup = new THREE.Group();
    const { map } = floorData;

    // Clear existing collision objects
    this.collisionObjects = [];

    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.7 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.9 });
    const upStairsMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.5 });
    const downStairsMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 });
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });

    // Geometries for reuse
    const cubeGeometry = new THREE.BoxGeometry(this.tileSize, this.tileSize, this.tileSize);
    
    // Create meshes for each tile
    for (let z = 0; z < map.length; z++) {
      for (let y = 0; y < map[z].length; y++) {
        for (let x = 0; x < map[z][y].length; x++) {
          const tileType = map[z][y][x];
          let mesh: THREE.Mesh | null = null;
          
          const posX = x * this.tileSize - (map[z][y].length * this.tileSize) / 2;
          const posY = z * this.tileSize; // Y in 3D space is height
          const posZ = y * this.tileSize - (map[z].length * this.tileSize) / 2;
          
          switch (tileType) {
            case 0: // Wall
              mesh = new THREE.Mesh(cubeGeometry, wallMaterial);
              mesh.position.set(posX, posY, posZ);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              // Add to collision objects
              this.collisionObjects.push(mesh);
              break;
              
            case 1: // Floor
              mesh = new THREE.Mesh(cubeGeometry, floorMaterial);
              mesh.position.set(posX, posY - this.tileSize/2, posZ);
              mesh.scale.set(1, 0.1, 1); // Make it thinner
              mesh.receiveShadow = true;
              break;
              
            case 2: // Up stairs
              mesh = new THREE.Mesh(cubeGeometry, upStairsMaterial);
              mesh.position.set(posX, posY - this.tileSize/3, posZ);
              mesh.scale.set(1, 0.3, 1);
              mesh.receiveShadow = true;
              break;
              
            case 3: // Down stairs
              mesh = new THREE.Mesh(cubeGeometry, downStairsMaterial);
              mesh.position.set(posX, posY - this.tileSize/3, posZ);
              mesh.scale.set(1, 0.3, 1);
              mesh.receiveShadow = true;
              break;
              
            case 4: // Tree
              // Create floor under tree
              const treeFloor = new THREE.Mesh(cubeGeometry, floorMaterial);
              treeFloor.position.set(posX, posY - this.tileSize/2, posZ);
              treeFloor.scale.set(1, 0.1, 1);
              treeFloor.receiveShadow = true;
              floorGroup.add(treeFloor);
              
              // Create trunk
              const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(this.tileSize/8, this.tileSize/6, this.tileSize, 8),
                trunkMaterial
              );
              trunk.position.set(posX, posY + this.tileSize/2, posZ);
              trunk.castShadow = true;
              floorGroup.add(trunk);
              this.collisionObjects.push(trunk);
              
              // Create tree top (cone)
              const treeTop = new THREE.Mesh(
                new THREE.ConeGeometry(this.tileSize/2, this.tileSize, 8),
                treeMaterial
              );
              treeTop.position.set(posX, posY + this.tileSize, posZ);
              treeTop.castShadow = true;
              floorGroup.add(treeTop);
              this.collisionObjects.push(treeTop);
              break;
          }
          
          if (mesh) {
            floorGroup.add(mesh);
          }
        }
      }
    }

    // Add stairs props
    if (floorData.upStairsPos) {
      this.createStairsProp(floorGroup, floorData.upStairsPos, 'up');
    }
    if (floorData.downStairsPos) {
      this.createStairsProp(floorGroup, floorData.downStairsPos, 'down');
    }

    this.scene.add(floorGroup);
    this.floorGeometries.set(floorLevel, floorGroup);
  }
  
  private createStairsProp(group: THREE.Group, pos: { x: number, y: number, z: number }, type: 'up' | 'down'): void {
    // Create an effect or marker for stairs
    const stairsEffect = new THREE.Mesh(
      new THREE.CylinderGeometry(this.tileSize / 3, this.tileSize / 2, this.tileSize / 2, 16),
      new THREE.MeshStandardMaterial({ 
        color: type === 'up' ? 0x0088ff : 0xff8800,
        emissive: type === 'up' ? 0x0044aa : 0xaa4400,
        transparent: true,
        opacity: 0.7
      })
    );
    
    const posX = pos.x * this.tileSize - (this.config.map.viewportWidth * this.tileSize) / 2;
    const posY = (pos.z || 0) * this.tileSize + (this.tileSize / 4); // Position slightly above ground
    const posZ = pos.y * this.tileSize - (this.config.map.viewportHeight * this.tileSize) / 2;
    
    stairsEffect.position.set(posX, posY, posZ);
    
    // Add animation
    const stairsAnimation = () => {
      stairsEffect.rotation.y += 0.01;
      requestAnimationFrame(stairsAnimation);
    };
    stairsAnimation();
    
    group.add(stairsEffect);
  }

  // Load a 3D model (using FBX format as an example)
  public async loadModel(modelPath: string, scale: number = 1): Promise<THREE.Object3D | null> {
    // Check cache first
    if (this.modelCache.has(modelPath)) {
      return this.modelCache.get(modelPath)!.clone();
    }
    
    try {
      const loader = new FBXLoader();
      return new Promise((resolve, reject) => {
        loader.load(
          modelPath,
          (object) => {
            object.scale.set(scale, scale, scale);
            
            // Cache the model
            this.modelCache.set(modelPath, object.clone());
            
            // Check if model has animations
            if (object.animations && object.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(object);
              const action = mixer.clipAction(object.animations[0]);
              action.play();
              this.mixers.push(mixer);
            }
            
            resolve(object);
          },
          undefined,
          (error) => {
            console.error('Error loading model:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Failed to load model:', error);
      return null;
    }
  }

  public updatePlayer(id: string, x: number, y: number, z: number, rotation: number = 0): void {
    let playerObj = this.playerMeshes.get(id);
    
    if (!playerObj) {
      // Create a more detailed player mesh group
      const playerGroup = new THREE.Group();
      
      // Create body (slightly taller box)
      const bodyGeometry = new THREE.BoxGeometry(this.tileSize * 0.4, this.tileSize * 1.2, this.tileSize * 0.4);
      const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: id === 'self' ? 0x3366cc : 0xcc3366 // Blue for self, red for others
      });
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
      bodyMesh.position.y = this.tileSize * 0.6; // Lift body up
      bodyMesh.castShadow = true;
      playerGroup.add(bodyMesh);
      
      // Create head (smaller box)
      const headGeometry = new THREE.BoxGeometry(this.tileSize * 0.3, this.tileSize * 0.3, this.tileSize * 0.3);
      const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
      const headMesh = new THREE.Mesh(headGeometry, headMaterial);
      headMesh.position.y = this.tileSize * 1.35; // Position above body
      headMesh.castShadow = true;
      playerGroup.add(headMesh);
      
      // Add player group to scene
      this.scene.add(playerGroup);
      this.playerMeshes.set(id, playerGroup);
      playerObj = playerGroup;
    }
    
    // Convert game coordinates to scene coordinates
    const posX = x - (this.config.map.viewportWidth * this.tileSize) / 2;
    const posY = z; // Y in 3D space is height (z in game space)
    const posZ = y - (this.config.map.viewportHeight * this.tileSize) / 2;
    
    // Store last position for collision calculations
    if (id === 'self') {
      this.playerLastPosition.set(playerObj.position.x, playerObj.position.y, playerObj.position.z);
    }
    
    // Update player position
    playerObj.position.set(posX, posY, posZ);
    
    // Update player rotation and camera for self
    if (id === 'self') {
      this.playerRotation = rotation;
      playerObj.rotation.y = rotation;
      this.updateCameraPosition(playerObj);
    } else {
      // Smooth rotation for other players
      const targetRotation = rotation;
      const currentRotation = playerObj.rotation.y;
      // Interpolate rotation
      playerObj.rotation.y = currentRotation + (targetRotation - currentRotation) * 0.1;
    }
  }

  private updateCameraPosition(playerObj: THREE.Object3D): void {
    // Skip if there's no player object yet
    if (!playerObj) return;

    if (this.cameraMode === 'firstPerson') {
      // First person - position camera at player's head height
      const headPosition = playerObj.position.clone().add(new THREE.Vector3(0, this.tileSize * 1.35, 0));
      this.camera.position.copy(headPosition);
      
      // Calculate look direction
      const lookDirection = new THREE.Vector3(
        Math.sin(this.cameraRotation.x) * Math.cos(this.cameraRotation.y),
        Math.sin(this.cameraRotation.y),
        Math.cos(this.cameraRotation.x) * Math.cos(this.cameraRotation.y)
      );
      
      // Look in the direction of camera rotation
      this.camera.lookAt(headPosition.clone().add(lookDirection.multiplyScalar(10)));
    } else if (this.cameraMode === 'thirdPerson') {
      // Third person - position camera behind player
      const cameraOffset = new THREE.Vector3(
        Math.sin(this.cameraRotation.x) * Math.cos(this.cameraRotation.y) * -this.CAMERA_DISTANCE,
        Math.sin(this.cameraRotation.y) * this.CAMERA_DISTANCE + this.tileSize * 1.5, // Add height offset
        Math.cos(this.cameraRotation.x) * Math.cos(this.cameraRotation.y) * -this.CAMERA_DISTANCE
      );
      
      // Position camera behind player
      const desiredCameraPosition = playerObj.position.clone().add(cameraOffset);
      
      // Check for camera collision with environment
      const rayCaster = new THREE.Raycaster();
      rayCaster.set(playerObj.position.clone().add(new THREE.Vector3(0, this.tileSize * 1.35, 0)), 
                   cameraOffset.clone().normalize().negate());
      
      const intersects = rayCaster.intersectObjects(this.collisionObjects);
      if (intersects.length > 0 && intersects[0].distance < cameraOffset.length()) {
        // If collision, move camera to collision point
        const adjustedDistance = Math.max(2, intersects[0].distance * 0.9);
        cameraOffset.normalize().multiplyScalar(adjustedDistance);
        this.camera.position.copy(playerObj.position.clone().add(new THREE.Vector3(0, this.tileSize * 1.35, 0)).add(cameraOffset));
      } else {
        // No collision, use desired position
        this.camera.position.copy(desiredCameraPosition);
      }
      
      // Make camera look at player position at head height
      const lookAtPoint = playerObj.position.clone();
      lookAtPoint.y += this.tileSize * 1.35; // Look at player's head height
      this.camera.lookAt(lookAtPoint);
    } else if (this.cameraMode === 'isometric') {
      // Isometric view - fixed angle
      const isoDistance = this.CAMERA_DISTANCE * 3; // Increased distance for better overview
      const isoOffset = new THREE.Vector3(isoDistance, isoDistance * 1.5, isoDistance);
      
      // Position camera at fixed isometric angle from player
      this.camera.position.copy(playerObj.position.clone().add(isoOffset));
      
      // Look at player
      this.camera.lookAt(playerObj.position);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement) {
      // Update camera rotation based on mouse movement
      this.cameraRotation.x -= event.movementX * this.MOUSE_SENSITIVITY;
      this.cameraRotation.y = Math.max(
        this.MIN_POLAR_ANGLE,
        Math.min(
          this.MAX_POLAR_ANGLE,
          this.cameraRotation.y + event.movementY * this.MOUSE_SENSITIVITY
        )
      );
    }
  }

  public updateNPC(id: string, type: string, x: number, y: number, z: number): void {
    let npcObj = this.npcMeshes.get(id);
    
    if (!npcObj) {
      // Create new NPC mesh while model loads
      let geometry;
      let material;
      
      // Different geometry based on NPC type
      switch (type) {
        case 'zombie':
          geometry = new THREE.BoxGeometry(this.tileSize / 2, this.tileSize, this.tileSize / 2);
          material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
          break;
        case 'skeleton':
          geometry = new THREE.BoxGeometry(this.tileSize / 2, this.tileSize, this.tileSize / 2);
          material = new THREE.MeshStandardMaterial({ color: 0xffffff });
          break;
        default:
          geometry = new THREE.SphereGeometry(this.tileSize / 2, 8, 8);
          material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      }
      
      npcObj = new THREE.Mesh(geometry, material);
      npcObj.castShadow = true;
      this.scene.add(npcObj);
      this.npcMeshes.set(id, npcObj);
      
      // Try to load NPC model
      const modelPath = `/models/${type}.fbx`;
      this.loadModel(modelPath, 0.01).then(model => {
        if (model) {
          this.scene.remove(npcObj!);
          model.castShadow = true;
          this.scene.add(model);
          this.npcMeshes.set(id, model);
        }
      }).catch(err => {
        console.warn(`Falling back to basic ${type} model:`, err);
      });
    }
    
    // Convert game coordinates to scene coordinates
    const posX = x - (this.config.map.viewportWidth * this.tileSize) / 2;
    const posY = z; // Y in 3D space is height (z in game space)
    const posZ = y - (this.config.map.viewportHeight * this.tileSize) / 2;
    
    npcObj.position.set(posX, posY, posZ);
  }

  public removeEntity(id: string): void {
    // Remove player mesh
    if (this.playerMeshes.has(id)) {
      this.scene.remove(this.playerMeshes.get(id)!);
      this.playerMeshes.delete(id);
    }
    
    // Remove NPC mesh
    if (this.npcMeshes.has(id)) {
      this.scene.remove(this.npcMeshes.get(id)!);
      this.npcMeshes.delete(id);
    }
  }

  public render(): void {
    // First render the 3D scene
    this.renderer.clear(false, true, false); // Only clear depth buffer
    
    // Update animation mixers
    const delta = this.clock.getDelta();
    this.mixers.forEach(mixer => mixer.update(delta));
    
    // Update controls if enabled
    if (this.controls) {
      this.controls.update();
    }
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Now render UI on top using an overlay canvas
    this.renderGameUI();
  }

  private renderGameUI(): void {
    // Create or get the overlay canvas for UI
    let overlayCanvas = document.getElementById('ui-overlay') as HTMLCanvasElement;
    if (!overlayCanvas) {
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.id = 'ui-overlay';
      overlayCanvas.style.position = 'absolute';
      overlayCanvas.style.top = '0';
      overlayCanvas.style.left = '0';
      overlayCanvas.style.pointerEvents = 'none';
      this.renderer.domElement.parentElement?.appendChild(overlayCanvas);
    }

    // Match overlay size to main canvas
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    overlayCanvas.style.width = `${width}px`;
    overlayCanvas.style.height = `${height}px`;

    // Get 2D context for UI rendering
    const ctx = overlayCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    // Let the game render its UI
    const game = (window as any).game;
    if (game) {
      game.renderUI(ctx);
    }
  }

  public updateUIText(textElements: any[]): void {
    // Implementation for updating UI text
  }

  public renderStatsWidget(playerData: any): void {
    // Implementation for rendering stats widget
  }

  public dispose(): void {
    // Clean up resources
    this.renderer.dispose();
    this.modelCache.clear();
    
    // Remove all objects from scene
    while(this.scene.children.length > 0) { 
      this.scene.remove(this.scene.children[0]); 
    }
  }
  
  // Toggle camera modes
  public toggleCameraMode(): void {
    // Cycle through camera modes
    if (this.cameraMode === 'thirdPerson') {
      this.cameraMode = 'firstPerson';
    } else if (this.cameraMode === 'firstPerson') {
      this.cameraMode = 'isometric';
    } else {
      this.cameraMode = 'thirdPerson';
    }
    
    console.log(`Camera mode switched to ${this.cameraMode}`);
    
    // Update camera position immediately
    const playerObj = this.playerMeshes.get('self');
    if (playerObj) {
      this.updateCameraPosition(playerObj);
    }
  }
}
