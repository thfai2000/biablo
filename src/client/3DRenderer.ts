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
  private floorGeometries: Map<number, THREE.Group>;
  private playerMeshes: Map<string, THREE.Object3D>;
  private npcMeshes: Map<string, THREE.Object3D>;
  private lights: THREE.Light[];
  private tileSize: number;
  private modelCache: Map<string, THREE.Object3D>;
  private clock: THREE.Clock;
  private mixers: THREE.AnimationMixer[];
  
  // Camera modes
  private cameraMode: 'thirdPerson' | 'isometric' | 'firstPerson';
  private cameraOffset: THREE.Vector3;

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
    this.cameraMode = 'isometric';
    this.cameraOffset = new THREE.Vector3(this.tileSize * 10, this.tileSize * 15, this.tileSize * 10);

    // Set up Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    // Set up fog for atmosphere
    this.scene.fog = new THREE.FogExp2(0x000000, config.render3D.fogDensity);

    // Set up camera
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.initCamera();

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true 
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Set up orbit controls for debugging
    this.controls = null;
    
    // Initialize lighting
    this.setupLighting();
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(canvas));
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
    }
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, this.config.render3D.lightIntensity);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    
    // Adjust shadow properties based on configuration
    const shadowQuality = this.config.render3D.shadowQuality;
    if (shadowQuality === 'high') {
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
    } else if (shadowQuality === 'medium') {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
    } else {
      sunLight.shadow.mapSize.width = 512;
      sunLight.shadow.mapSize.height = 512;
    }
    
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    
    this.scene.add(sunLight);
    this.lights.push(sunLight);

    // Point lights for atmosphere
    const pointLight1 = new THREE.PointLight(0xff7700, 1, 50);
    pointLight1.position.set(0, 5, 0);
    this.scene.add(pointLight1);
    this.lights.push(pointLight1);
  }

  private onWindowResize(canvas: HTMLCanvasElement): void {
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
      this.scene.remove(this.floorGeometries.get(floorLevel)!);
    }

    const floorGroup = new THREE.Group();
    const { map } = floorData;

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
              
              // Create tree top (cone)
              const treeTop = new THREE.Mesh(
                new THREE.ConeGeometry(this.tileSize/2, this.tileSize, 8),
                treeMaterial
              );
              treeTop.position.set(posX, posY + this.tileSize, posZ);
              treeTop.castShadow = true;
              floorGroup.add(treeTop);
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
    const posY = pos.z * this.tileSize;
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

  public updatePlayer(id: string, x: number, y: number, z: number): void {
    let playerObj = this.playerMeshes.get(id);
    
    if (!playerObj) {
      // Create a temporary mesh while model loads
      const geometry = new THREE.SphereGeometry(this.tileSize / 2, 16, 16);
      const material = id === 'self' 
        ? new THREE.MeshStandardMaterial({ color: 0xff0000 }) // Red for main player
        : new THREE.MeshStandardMaterial({ color: 0x0000ff }); // Blue for other players
      
      playerObj = new THREE.Mesh(geometry, material);
      playerObj.castShadow = true;
      this.scene.add(playerObj);
      this.playerMeshes.set(id, playerObj);
      
      // Try to load player model
      this.loadModel('/models/character.fbx', 0.01).then(model => {
        if (model) {
          this.scene.remove(playerObj!);
          model.castShadow = true;
          this.scene.add(model);
          this.playerMeshes.set(id, model);
        }
      }).catch(err => {
        console.warn('Falling back to basic player model:', err);
      });
    }
    
    // Convert game coordinates to scene coordinates
    const posX = x - (this.config.map.viewportWidth * this.tileSize) / 2;
    const posY = z; // Y in 3D space is height (z in game space)
    const posZ = y - (this.config.map.viewportHeight * this.tileSize) / 2;
    
    playerObj.position.set(posX, posY, posZ);
    
    // If this is the main player, update camera
    if (id === 'self' && this.cameraMode !== 'isometric') {
      this.updateCameraPosition(playerObj);
    }
  }

  private updateCameraPosition(playerObj: THREE.Object3D): void {
    if (this.cameraMode === 'thirdPerson') {
      // Third-person camera follows behind player
      const offset = new THREE.Vector3(0, this.tileSize * 2, this.tileSize * 4);
      this.camera.position.copy(playerObj.position).add(offset);
      this.camera.lookAt(playerObj.position);
    } else if (this.cameraMode === 'firstPerson') {
      // First-person camera is at player position
      this.camera.position.copy(playerObj.position);
      this.camera.position.y += this.tileSize / 2; // Eye level
      
      // Look in the direction player is facing
      // This would use a player direction vector in a real game
      const lookTarget = new THREE.Vector3(
        playerObj.position.x, 
        playerObj.position.y + this.tileSize / 2,
        playerObj.position.z - this.tileSize
      );
      this.camera.lookAt(lookTarget);
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
    // Update animation mixers
    const delta = this.clock.getDelta();
    this.mixers.forEach(mixer => mixer.update(delta));
    
    // Update controls if enabled
    if (this.controls) {
      this.controls.update();
    }
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
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
}
