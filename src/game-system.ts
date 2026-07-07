import {
  createSystem,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Color,
  Vector3,
  AmbientLight,
  PointLight,
  DirectionalLight,
  FogExp2,
  AdditiveBlending,
  Float32BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  InputComponent,
} from '@iwsdk/core';
import { GameManager, GRID_W, GRID_H, CELL_SIZE, CellType, PowerUpType, GameState, BombData, EnemyData, PowerUpData, LaserData, ScorePopup, WarpPortalData, IcePatchData } from './game';

// Materials cache
const MAT = {
  floor: null as MeshStandardMaterial | null,
  hardBlock: null as MeshStandardMaterial | null,
  softBlock: null as MeshStandardMaterial | null,
  player: null as MeshStandardMaterial | null,
  playerGlow: null as MeshBasicMaterial | null,
  bomb: null as MeshStandardMaterial | null,
  bombGlow: null as MeshBasicMaterial | null,
  explosion: null as MeshBasicMaterial | null,
  enemyWander: null as MeshStandardMaterial | null,
  enemyChase: null as MeshStandardMaterial | null,
  enemyBomber: null as MeshStandardMaterial | null,
  enemyPatrol: null as MeshStandardMaterial | null,
  enemyTeleporter: null as MeshStandardMaterial | null,
  enemySplitter: null as MeshStandardMaterial | null,
  gridLine: null as LineBasicMaterial | null,
  borderWall: null as MeshStandardMaterial | null,
  borderGlow: null as MeshBasicMaterial | null,
  exitTile: null as MeshBasicMaterial | null,
  powerUp: new Map<number, MeshBasicMaterial>(),
};

// Geometries cache
const GEO = {
  cell: null as BoxGeometry | null,
  hardBlock: null as BoxGeometry | null,
  softBlock: null as BoxGeometry | null,
  player: null as CylinderGeometry | null,
  bomb: null as SphereGeometry | null,
  explosion: null as BoxGeometry | null,
  enemy: null as BoxGeometry | null,
  enemyTeleporter: null as SphereGeometry | null,
  powerUp: null as SphereGeometry | null,
  flat: null as BoxGeometry | null,
  borderPost: null as BoxGeometry | null,
  borderBar: null as BoxGeometry | null,
  exitTile: null as CylinderGeometry | null,
};

function gridToWorld(gx: number, gy: number): [number, number, number] {
  const offsetX = -(GRID_W * CELL_SIZE) / 2 + CELL_SIZE / 2;
  const offsetZ = -(GRID_H * CELL_SIZE) / 2 + CELL_SIZE / 2;
  return [offsetX + gx * CELL_SIZE, 0, offsetZ + gy * CELL_SIZE];
}

export class GameSystem extends createSystem({}) {
  private game!: GameManager;
  private arenaGroup!: Group;
  private blockMeshes: Map<string, Mesh> = new Map();
  private bombMeshes: Map<string, Group> = new Map();
  private explosionMeshes: Map<string, Mesh> = new Map();
  private enemyMeshes: Map<number, Group> = new Map();
  private powerUpMeshes: Map<string, Group> = new Map();
  private playerGroup!: Group;
  private gridLines!: LineSegments;
  private borderGroup!: Group;
  private exitMesh: Mesh | null = null;
  private lights: PointLight[] = [];
  private animTime = 0;
  private lastGridHash = '';
  private explosionParticles: Array<{ mesh: Mesh; vel: Vector3; life: number }> = [];
  private deathParticles: Array<{ mesh: Mesh; vel: Vector3; life: number; color: number }> = [];
  private teleportParticles: Array<{ mesh: Mesh; vel: Vector3; life: number }> = [];
  private laserMeshes: Map<number, Group> = new Map();
  private laserWarningMeshes: Map<number, Mesh[]> = new Map();
  private conveyorMeshes: Map<string, Group> = new Map();
  private warpPortalMeshes: Map<number, Group> = new Map();
  private icePatchMeshes: Map<string, Mesh> = new Map();
  private scorePopupMeshes: Array<{ group: Group; life: number }> = [];
  private powerUpCollectEffects: Array<{ mesh: Mesh; vel: Vector3; life: number }> = [];
  private dangerZonePool: Mesh[] = [];
  private dangerZoneActiveCount = 0;
  private trailPool: Mesh[] = [];
  private trailActiveCount = 0;
  private starfieldGroup!: Group;
  private starfieldStars: Mesh[] = [];
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private cameraBasePos = new Vector3(0, 8, 6);
  private inputCooldown = 0;
  private screenFlashMesh: Mesh | null = null;
  private timeFreezeOverlay: Mesh | null = null;

  setRefs(refs: { game: GameManager }) {
    this.game = refs.game;
  }

  setupScene() {
    this.initMaterials();
    this.initGeometries();

    // Fog
    this.scene.fog = new FogExp2(0x000811, 0.04);
    this.scene.background = new Color(0x000811);

    // Lights
    const ambient = new AmbientLight(0x112244, 0.4);
    this.scene.add(ambient);

    const dirLight = new DirectionalLight(0x4488ff, 0.6);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // Arena group
    this.arenaGroup = new Group();
    this.scene.add(this.arenaGroup);

    // Floor
    const floorGeo = new BoxGeometry(GRID_W * CELL_SIZE + 1, 0.05, GRID_H * CELL_SIZE + 1);
    const floorMesh = new Mesh(floorGeo, MAT.floor!);
    floorMesh.position.set(0, -0.05, 0);
    this.arenaGroup.add(floorMesh);

    // Grid lines
    this.createGridLines();

    // Arena border walls
    this.borderGroup = new Group();
    this.arenaGroup.add(this.borderGroup);
    this.createBorderWalls();

    // Player
    this.playerGroup = new Group();
    const playerBody = new Mesh(GEO.player!, MAT.player!);
    playerBody.position.y = 0.4;
    this.playerGroup.add(playerBody);

    // Player glow ring
    const glowRing = new Mesh(
      new CylinderGeometry(0.35, 0.35, 0.02, 16),
      MAT.playerGlow!
    );
    glowRing.position.y = 0.05;
    this.playerGroup.add(glowRing);

    // Player visor (eyes)
    const visorMat = new MeshBasicMaterial({ color: 0xffffff });
    const visorGeo = new BoxGeometry(0.18, 0.04, 0.02);
    const visor = new Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.48, -0.16);
    this.playerGroup.add(visor);

    this.arenaGroup.add(this.playerGroup);
    this.playerGroup.visible = false;

    // Point lights for ambiance
    const colors = [0x00ffff, 0xff00ff, 0x00ff88];
    for (let i = 0; i < 3; i++) {
      const pl = new PointLight(colors[i], 2, 15);
      pl.position.set(
        (i - 1) * (GRID_W * CELL_SIZE / 3),
        3,
        (i - 1) * (GRID_H * CELL_SIZE / 3)
      );
      this.scene.add(pl);
      this.lights.push(pl);
    }

    // Starfield background
    this.starfieldGroup = new Group();
    this.scene.add(this.starfieldGroup);
    const starGeo = new SphereGeometry(0.03, 4, 4);
    const starColors = [0x4488ff, 0x88ccff, 0xffffff, 0x44ffaa, 0xff88cc];
    for (let i = 0; i < 120; i++) {
      const starMat = new MeshBasicMaterial({
        color: starColors[i % starColors.length],
        transparent: true,
        opacity: 0.3 + Math.random() * 0.5,
        blending: AdditiveBlending,
      });
      const star = new Mesh(starGeo, starMat);
      star.position.set(
        (Math.random() - 0.5) * 40,
        8 + Math.random() * 15,
        (Math.random() - 0.5) * 40
      );
      this.starfieldGroup.add(star);
      this.starfieldStars.push(star);
    }

    // Screen flash overlay (full-screen quad positioned above arena)
    const flashGeo = new BoxGeometry(30, 0.01, 30);
    const flashMat = new MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
    });
    this.screenFlashMesh = new Mesh(flashGeo, flashMat);
    this.screenFlashMesh.position.set(0, 7, 0);
    this.screenFlashMesh.visible = false;
    this.scene.add(this.screenFlashMesh);

    // Time freeze overlay (blue tint)
    const freezeGeo = new BoxGeometry(25, 0.01, 25);
    const freezeMat = new MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
    });
    this.timeFreezeOverlay = new Mesh(freezeGeo, freezeMat);
    this.timeFreezeOverlay.position.set(0, 0.5, 0);
    this.timeFreezeOverlay.visible = false;
    this.arenaGroup.add(this.timeFreezeOverlay);

    // Danger zone mesh pool (avoids per-frame allocation)
    const dzGeo = new BoxGeometry(CELL_SIZE * 0.85, 0.02, CELL_SIZE * 0.85);
    for (let pi = 0; pi < 50; pi++) {
      const dzMat = new MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.08, blending: AdditiveBlending });
      const mesh = new Mesh(dzGeo, dzMat);
      mesh.visible = false;
      mesh.position.y = 0.015;
      this.arenaGroup.add(mesh);
      this.dangerZonePool.push(mesh);
    }

    // Trail mesh pool
    const trGeo = new SphereGeometry(0.08, 6, 6);
    for (let pi = 0; pi < 15; pi++) {
      const trMat = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3, blending: AdditiveBlending });
      const mesh = new Mesh(trGeo, trMat);
      mesh.visible = false;
      mesh.position.y = 0.1;
      this.arenaGroup.add(mesh);
      this.trailPool.push(mesh);
    }
  }

  private initMaterials() {
    MAT.floor = new MeshStandardMaterial({ color: 0x001122, metalness: 0.8, roughness: 0.3 });
    MAT.hardBlock = new MeshStandardMaterial({ color: 0x334466, metalness: 0.6, roughness: 0.4, emissive: 0x112233, emissiveIntensity: 0.3 });
    MAT.softBlock = new MeshStandardMaterial({ color: 0x885522, metalness: 0.3, roughness: 0.6, emissive: 0x442200, emissiveIntensity: 0.2 });
    MAT.player = new MeshStandardMaterial({ color: 0x00ccff, metalness: 0.5, roughness: 0.3, emissive: 0x0066ff, emissiveIntensity: 0.5 });
    MAT.playerGlow = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6, blending: AdditiveBlending });
    MAT.bomb = new MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2, emissive: 0xff0000, emissiveIntensity: 0.3 });
    MAT.bombGlow = new MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8, blending: AdditiveBlending });
    MAT.explosion = new MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.9, blending: AdditiveBlending });
    MAT.enemyWander = new MeshStandardMaterial({ color: 0xff4488, metalness: 0.4, roughness: 0.5, emissive: 0xff0044, emissiveIntensity: 0.4 });
    MAT.enemyChase = new MeshStandardMaterial({ color: 0xff0000, metalness: 0.4, roughness: 0.5, emissive: 0xff0000, emissiveIntensity: 0.6 });
    MAT.enemyBomber = new MeshStandardMaterial({ color: 0xff8800, metalness: 0.4, roughness: 0.5, emissive: 0xff4400, emissiveIntensity: 0.5 });
    MAT.enemyPatrol = new MeshStandardMaterial({ color: 0x8844ff, metalness: 0.4, roughness: 0.5, emissive: 0x4400ff, emissiveIntensity: 0.5 });
    MAT.enemyTeleporter = new MeshStandardMaterial({ color: 0x00ff88, metalness: 0.6, roughness: 0.3, emissive: 0x00ff44, emissiveIntensity: 0.7 });
    MAT.enemySplitter = new MeshStandardMaterial({ color: 0xffcc44, metalness: 0.5, roughness: 0.4, emissive: 0xff8800, emissiveIntensity: 0.5 });
    MAT.gridLine = new LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15 });
    MAT.borderWall = new MeshStandardMaterial({ color: 0x223344, metalness: 0.7, roughness: 0.3, emissive: 0x00ffff, emissiveIntensity: 0.15 });
    MAT.borderGlow = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4, blending: AdditiveBlending });
    MAT.exitTile = new MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8, blending: AdditiveBlending });

    const puColors = [0x00ff00, 0xff8800, 0xffff00, 0x8888ff, 0xff00ff, 0x00ffff, 0xff6644, 0x4488ff, 0xff88ff, 0xff4400];
    for (let i = 0; i < puColors.length; i++) {
      MAT.powerUp.set(i, new MeshBasicMaterial({ color: puColors[i], transparent: true, opacity: 0.9, blending: AdditiveBlending }));
    }
  }

  private initGeometries() {
    GEO.cell = new BoxGeometry(CELL_SIZE * 0.95, 0.1, CELL_SIZE * 0.95);
    GEO.hardBlock = new BoxGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9, CELL_SIZE * 0.9);
    GEO.softBlock = new BoxGeometry(CELL_SIZE * 0.85, CELL_SIZE * 0.7, CELL_SIZE * 0.85);
    GEO.player = new CylinderGeometry(0.15, 0.25, 0.6, 8);
    GEO.bomb = new SphereGeometry(0.25, 12, 12);
    GEO.explosion = new BoxGeometry(CELL_SIZE * 0.9, 0.8, CELL_SIZE * 0.9);
    GEO.enemy = new BoxGeometry(0.45, 0.55, 0.45);
    GEO.enemyTeleporter = new SphereGeometry(0.28, 10, 10);
    GEO.powerUp = new SphereGeometry(0.18, 8, 8);
    GEO.flat = new BoxGeometry(CELL_SIZE * 0.9, 0.02, CELL_SIZE * 0.9);
    GEO.borderPost = new BoxGeometry(0.15, 1.2, 0.15);
    GEO.borderBar = new BoxGeometry(CELL_SIZE, 0.06, 0.06);
    GEO.exitTile = new CylinderGeometry(0.35, 0.35, 0.05, 12);
  }

  private createGridLines() {
    const positions: number[] = [];
    const offsetX = -(GRID_W * CELL_SIZE) / 2;
    const offsetZ = -(GRID_H * CELL_SIZE) / 2;

    for (let x = 0; x <= GRID_W; x++) {
      positions.push(offsetX + x * CELL_SIZE, 0.01, offsetZ);
      positions.push(offsetX + x * CELL_SIZE, 0.01, offsetZ + GRID_H * CELL_SIZE);
    }
    for (let y = 0; y <= GRID_H; y++) {
      positions.push(offsetX, 0.01, offsetZ + y * CELL_SIZE);
      positions.push(offsetX + GRID_W * CELL_SIZE, 0.01, offsetZ + y * CELL_SIZE);
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.gridLines = new LineSegments(geo, MAT.gridLine!);
    this.arenaGroup.add(this.gridLines);
  }

  private createBorderWalls() {
    // Create neon border posts at corners of the arena
    const hw = (GRID_W * CELL_SIZE) / 2;
    const hh = (GRID_H * CELL_SIZE) / 2;

    // Corner posts
    const corners = [[-hw, -hh], [-hw, hh], [hw, -hh], [hw, hh]];
    for (const [cx, cz] of corners) {
      const post = new Mesh(GEO.borderPost!, MAT.borderWall!);
      post.position.set(cx, 0.6, cz);
      this.borderGroup.add(post);

      // Glow caps
      const cap = new Mesh(
        new SphereGeometry(0.1, 8, 8),
        MAT.borderGlow!
      );
      cap.position.set(cx, 1.2, cz);
      this.borderGroup.add(cap);
    }

    // Horizontal bars (top and bottom)
    for (let x = 0; x < GRID_W; x++) {
      const [wx, , _wz] = gridToWorld(x, 0);
      // Top bar
      const barTop = new Mesh(GEO.borderBar!, MAT.borderGlow!);
      barTop.position.set(wx, 1.0, -hh);
      this.borderGroup.add(barTop);
      // Bottom bar
      const barBot = new Mesh(GEO.borderBar!, MAT.borderGlow!);
      barBot.position.set(wx, 1.0, hh);
      this.borderGroup.add(barBot);
    }

    // Vertical bars (left and right)
    for (let y = 0; y < GRID_H; y++) {
      const [_wx, , wz] = gridToWorld(0, y);
      const barLeft = new Mesh(GEO.borderBar!, MAT.borderGlow!);
      barLeft.position.set(-hw, 1.0, wz);
      barLeft.rotation.y = Math.PI / 2;
      this.borderGroup.add(barLeft);
      const barRight = new Mesh(GEO.borderBar!, MAT.borderGlow!);
      barRight.position.set(hw, 1.0, wz);
      barRight.rotation.y = Math.PI / 2;
      this.borderGroup.add(barRight);
    }
  }

  update(delta: number, time: number) {
    this.animTime = time;

    if (this.game.state === GameState.LevelTransition) {
      this.game.update(delta);
      // Animate a brief flash
      this.updateParticles(delta);
      this.updateDeathParticles(delta);
      this.updateTeleportParticles(delta);
      return;
    }

    if (this.game.state !== GameState.Playing) {
      this.handleMenuInput();
      return;
    }

    this.handleGameInput(delta);

    // Update game logic
    const result = this.game.update(delta);

    // Handle events
    for (const bomb of result.exploded) {
      this.onBombExplode(bomb);
    }
    for (const pos of result.destroyed) {
      this.spawnBlockDestroyEffect(pos.x, pos.y);
    }
    for (const enemy of result.enemiesHit) {
      this.spawnEnemyDeathEffect(enemy);
    }
    if (result.enemyTeleported) {
      this.spawnTeleportEffect(result.enemyTeleported);
      this.playTeleportSound();
    }
    if (result.exitRevealedNow) {
      this.createExitMesh();
      this.playExitRevealSound();
    }
    if (result.powerUpsSpawned.length > 0) {
      this.playPowerUpSpawnSound();
    }
    if (result.bombKicked) {
      this.playBombKickSound();
    }
    for (const laser of result.laserFired) {
      this.playLaserSound();
      this.shakeTimer = 0.15;
      this.shakeIntensity = 0.08;
    }

    // Rebuild visual grid
    this.rebuildGrid();

    // Update player visual
    this.updatePlayerVisual();

    // Update enemies visual
    this.updateEnemyVisuals();

    // Update bombs visual
    this.updateBombVisuals();

    // Update explosion visuals
    this.updateExplosionVisuals();

    // Update power-up visuals
    this.updatePowerUpVisuals();

    // Update exit tile
    this.updateExitVisual();

    // Update hazard visuals
    this.updateLaserVisuals(time);
    this.updateConveyorVisuals(time);
    this.updateIcePatchVisuals(time);
    this.updateDangerZoneVisuals(time);
    this.updateTrailVisuals();
    this.updateWarpPortalVisuals(time);
    this.updateScorePopupVisuals(delta);
    this.updatePowerUpCollectEffects(delta);

    // Update particles
    this.updateParticles(delta);
    this.updateDeathParticles(delta);
    this.updateTeleportParticles(delta);

    // Camera shake
    this.updateShake(delta);

    // Animate lights
    for (let i = 0; i < this.lights.length; i++) {
      this.lights[i].intensity = 1.5 + Math.sin(time * 2 + i * 2) * 0.5;
    }

    // Animate border glow
    const borderPulse = Math.sin(time * 1.5) * 0.15 + 0.4;
    MAT.borderGlow!.opacity = borderPulse;

    // Animate starfield
    for (let i = 0; i < this.starfieldStars.length; i++) {
      const star = this.starfieldStars[i];
      const mat = star.material as MeshBasicMaterial;
      mat.opacity = 0.2 + Math.sin(time * (0.5 + (i % 7) * 0.3) + i) * 0.3;
      star.position.y += Math.sin(time * 0.3 + i * 0.1) * 0.002;
    }

    // Screen flash effect
    if (this.screenFlashMesh) {
      if (this.game.screenFlash) {
        this.screenFlashMesh.visible = true;
        (this.screenFlashMesh.material as MeshBasicMaterial).color.setHex(this.game.screenFlash.color);
        (this.screenFlashMesh.material as MeshBasicMaterial).opacity = this.game.screenFlash.intensity;
      } else {
        this.screenFlashMesh.visible = false;
      }
    }

    // Time freeze visual effect
    if (this.timeFreezeOverlay) {
      if (this.game.hasTimeFreeze) {
        this.timeFreezeOverlay.visible = true;
        const pulse = Math.sin(time * 4) * 0.03 + 0.08;
        (this.timeFreezeOverlay.material as MeshBasicMaterial).opacity = pulse;
      } else {
        this.timeFreezeOverlay.visible = false;
      }
    }

    // Periodically update music intensity (~2x/sec)
    if (Math.floor(time * 2) !== Math.floor((time - delta) * 2)) {
      this.updateMusicIntensity();
    }
  }

  private handleGameInput(delta: number) {
    if (this.inputCooldown > 0) {
      this.inputCooldown -= delta;
      return;
    }

    const kb = this.input.keyboard;
    let dx = 0, dy = 0;

    if (kb.getKeyPressed('KeyW') || kb.getKeyPressed('ArrowUp')) dy = -1;
    else if (kb.getKeyPressed('KeyS') || kb.getKeyPressed('ArrowDown')) dy = 1;
    else if (kb.getKeyPressed('KeyA') || kb.getKeyPressed('ArrowLeft')) dx = -1;
    else if (kb.getKeyPressed('KeyD') || kb.getKeyPressed('ArrowRight')) dx = 1;

    // XR input
    const right = this.input.xr.gamepads.right;
    const left = this.input.xr.gamepads.left;
    if (left) {
      const stick = left.getAxesValues(InputComponent.Thumbstick);
      if (stick) {
        if (Math.abs(stick.x) > 0.5 || Math.abs(stick.y) > 0.5) {
          if (Math.abs(stick.x) > Math.abs(stick.y)) {
            dx = stick.x > 0 ? 1 : -1;
          } else {
            dy = stick.y > 0 ? 1 : -1;
          }
        }
      }
    }

    if (dx !== 0 || dy !== 0) {
      if (this.game.movePlayer(dx, dy, delta)) {
        this.inputCooldown = 0.12;
        this.playMoveSound();
      }
    }

    // Place bomb
    if (kb.getKeyDown('Space') || kb.getKeyDown('KeyE')) {
      if (this.game.placeBomb()) {
        this.playBombPlaceSound();
      }
    }
    if (right?.getButtonDown(InputComponent.Trigger)) {
      if (this.game.placeBomb()) {
        this.playBombPlaceSound();
      }
    }
    if (right?.getButtonDown(InputComponent.A_Button)) {
      if (this.game.placeBomb()) {
        this.playBombPlaceSound();
      }
    }

    // Remote detonate
    if (kb.getKeyDown('KeyR') || right?.getButtonDown(InputComponent.B_Button)) {
      this.game.detonateRemote();
    }

    // Pause
    if (kb.getKeyDown('Escape') || left?.getButtonDown(InputComponent.B_Button)) {
      this.game.state = GameState.Paused;
    }
  }

  private handleMenuInput() {
    // Menu navigation handled by UI system
  }

  private rebuildGrid() {
    let hash = '';
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        hash += this.game.grid[y][x];
      }
    }
    if (hash === this.lastGridHash) return;
    this.lastGridHash = hash;

    const activeKeys = new Set<string>();

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const cell = this.game.grid[y][x];
        const key = `${x}_${y}`;
        const [wx, , wz] = gridToWorld(x, y);

        if (cell === CellType.HardBlock) {
          activeKeys.add(key);
          if (!this.blockMeshes.has(key)) {
            const mesh = new Mesh(GEO.hardBlock!, MAT.hardBlock!);
            mesh.position.set(wx, CELL_SIZE * 0.45, wz);
            this.arenaGroup.add(mesh);
            this.blockMeshes.set(key, mesh);
          }
        } else if (cell === CellType.SoftBlock) {
          activeKeys.add(key);
          if (!this.blockMeshes.has(key)) {
            const mesh = new Mesh(GEO.softBlock!, MAT.softBlock!);
            mesh.position.set(wx, CELL_SIZE * 0.35, wz);
            this.arenaGroup.add(mesh);
            this.blockMeshes.set(key, mesh);
          }
        }
      }
    }

    for (const [key, mesh] of this.blockMeshes) {
      if (!activeKeys.has(key)) {
        this.arenaGroup.remove(mesh);
        this.blockMeshes.delete(key);
      }
    }
  }

  private updatePlayerVisual() {
    const [wx, , wz] = gridToWorld(this.game.playerVisualX, this.game.playerVisualY);
    this.playerGroup.position.set(wx, 0, wz);
    this.playerGroup.visible = true;

    // Shield effect
    if (this.game.hasShield && this.game.shieldTimer > 0) {
      const pulse = Math.sin(this.animTime * 8) * 0.2 + 0.8;
      MAT.playerGlow!.opacity = pulse * 0.8;
      MAT.playerGlow!.color.setHex(0x00ffff);
    } else {
      MAT.playerGlow!.opacity = 0.4 + Math.sin(this.animTime * 3) * 0.2;
      MAT.playerGlow!.color.setHex(0x00ffff);
    }

    // Rotate player slowly
    this.playerGroup.rotation.y = this.animTime * 0.5;
  }

  private updateBombVisuals() {
    const activeKeys = new Set<string>();

    for (const bomb of this.game.bombs) {
      const key = `${bomb.x}_${bomb.y}`;
      activeKeys.add(key);
      const [wx, , wz] = gridToWorld(bomb.slideVisualX, bomb.slideVisualY);

      if (!this.bombMeshes.has(key)) {
        const group = new Group();

        if (bomb.isMine) {
          // Mine: flat disc with glowing ring
          const disc = new Mesh(
            new CylinderGeometry(0.3, 0.3, 0.08, 16),
            new MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 })
          );
          disc.position.y = 0.04;
          group.add(disc);

          const ring = new Mesh(
            new CylinderGeometry(0.35, 0.35, 0.03, 16),
            new MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6, blending: AdditiveBlending })
          );
          ring.position.y = 0.04;
          group.add(ring);

          // Warning dot on top
          const dot = new Mesh(
            new SphereGeometry(0.06, 6, 6),
            new MeshBasicMaterial({ color: 0xff0000, blending: AdditiveBlending })
          );
          dot.position.y = 0.1;
          group.add(dot);
        } else {
          const body = new Mesh(GEO.bomb!, MAT.bomb!);
          body.position.y = 0.3;
          group.add(body);

          const glow = new Mesh(
            new SphereGeometry(0.32, 8, 8),
            MAT.bombGlow!.clone()
          );
          glow.position.y = 0.3;
          group.add(glow);

          // Fuse spark
          const spark = new Mesh(
            new SphereGeometry(0.05, 6, 6),
            new MeshBasicMaterial({ color: 0xffcc00, blending: AdditiveBlending })
          );
          spark.position.set(0, 0.55, 0);
          group.add(spark);
        }

        group.position.set(wx, 0, wz);
        this.arenaGroup.add(group);
        this.bombMeshes.set(key, group);
      }

      const group = this.bombMeshes.get(key)!;
      // Update position each frame (handles sliding bombs)
      const [bwx, , bwz] = gridToWorld(bomb.slideVisualX, bomb.slideVisualY);
      group.position.set(bwx, 0, bwz);

      if (bomb.isMine) {
        // Mine pulsing glow
        const pulse = Math.sin(this.animTime * 3) * 0.3 + 0.7;
        if (group.children[1]) {
          (group.children[1] as Mesh).material = new MeshBasicMaterial({
            color: 0xff8800, transparent: true, opacity: pulse * 0.6, blending: AdditiveBlending
          });
        }
        // Warning dot blink
        if (group.children[2]) {
          group.children[2].visible = Math.sin(this.animTime * 4) > 0;
        }
      } else {
        const urgency = 1 - bomb.timer / 3;
        const pulse = Math.sin(this.animTime * (5 + urgency * 15)) * 0.5 + 0.5;
        const glow = group.children[1] as Mesh;
        (glow.material as MeshBasicMaterial).opacity = 0.3 + pulse * 0.5;
        group.children[0].scale.setScalar(0.9 + pulse * 0.15);

        // Fuse spark flicker
        const spark = group.children[2];
        if (spark) {
          spark.position.y = 0.55 + Math.sin(this.animTime * 20) * 0.02;
          (spark as Mesh).material = new MeshBasicMaterial({
            color: urgency > 0.7 ? 0xff0000 : 0xffcc00,
            blending: AdditiveBlending,
          });
          spark.visible = Math.sin(this.animTime * 30) > -0.3;
        }

        MAT.bomb!.emissiveIntensity = 0.3 + urgency * 0.7;
      }
    }

    for (const [key, group] of this.bombMeshes) {
      if (!activeKeys.has(key)) {
        this.arenaGroup.remove(group);
        this.bombMeshes.delete(key);
      }
    }
  }

  private updateExplosionVisuals() {
    const activeKeys = new Set<string>();

    for (const exp of this.game.explosions) {
      const key = `${exp.x}_${exp.y}`;
      activeKeys.add(key);
      const [wx, , wz] = gridToWorld(exp.x, exp.y);

      if (!this.explosionMeshes.has(key)) {
        const mesh = new Mesh(GEO.explosion!, MAT.explosion!.clone());
        mesh.position.set(wx, 0.4, wz);
        this.arenaGroup.add(mesh);
        this.explosionMeshes.set(key, mesh);
      }

      const mesh = this.explosionMeshes.get(key)!;
      const life = exp.timer / 0.5;
      mesh.scale.setScalar(0.5 + life * 0.5);
      (mesh.material as MeshBasicMaterial).opacity = life * 0.9;

      const c = new Color();
      c.setHSL(0.08 * life, 1, 0.5 + life * 0.3);
      (mesh.material as MeshBasicMaterial).color = c;
    }

    for (const [key, mesh] of this.explosionMeshes) {
      if (!activeKeys.has(key)) {
        this.arenaGroup.remove(mesh);
        this.explosionMeshes.delete(key);
      }
    }
  }

  private updateEnemyVisuals() {
    const activeIds = new Set<number>();

    for (let i = 0; i < this.game.enemies.length; i++) {
      const enemy = this.game.enemies[i];
      if (!enemy.alive) {
        if (this.enemyMeshes.has(i)) {
          this.arenaGroup.remove(this.enemyMeshes.get(i)!);
          this.enemyMeshes.delete(i);
        }
        continue;
      }
      activeIds.add(i);
      const [wx, , wz] = gridToWorld(enemy.visualX, enemy.visualY);

      if (!this.enemyMeshes.has(i)) {
        const group = new Group();

        if (enemy.isBoss) {
          // Boss: larger body with crown and HP bar
          const bossMat = new MeshStandardMaterial({
            color: 0xffcc00, metalness: 0.7, roughness: 0.2,
            emissive: 0xff8800, emissiveIntensity: 0.6,
          });
          const bossBody = new Mesh(new BoxGeometry(0.7, 0.8, 0.7), bossMat);
          bossBody.position.y = 0.5;
          group.add(bossBody); // [0] body

          // Crown spikes
          const spikeMat = new MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.8, blending: AdditiveBlending });
          for (let s = 0; s < 4; s++) {
            const spike = new Mesh(new CylinderGeometry(0, 0.06, 0.25, 4), spikeMat);
            const angle = (s / 4) * Math.PI * 2;
            spike.position.set(Math.cos(angle) * 0.25, 0.95, Math.sin(angle) * 0.25);
            group.add(spike); // [1-4] spikes
          }

          // HP bar background
          const hpBg = new Mesh(
            new BoxGeometry(0.9, 0.08, 0.08),
            new MeshBasicMaterial({ color: 0x222222 })
          );
          hpBg.position.set(0, 1.2, 0);
          group.add(hpBg); // [5]

          // HP bar fill
          const hpFill = new Mesh(
            new BoxGeometry(0.86, 0.06, 0.06),
            new MeshBasicMaterial({ color: 0x00ff44 })
          );
          hpFill.position.set(0, 1.2, 0);
          group.add(hpFill); // [6]

          // Boss eyes (larger, red)
          const bossEyeMat = new MeshBasicMaterial({ color: 0xff0000 });
          const bossEyeGeo = new SphereGeometry(0.08, 6, 6);
          const be1 = new Mesh(bossEyeGeo, bossEyeMat);
          be1.position.set(-0.15, 0.6, -0.34);
          group.add(be1);
          const be2 = new Mesh(bossEyeGeo, bossEyeMat);
          be2.position.set(0.15, 0.6, -0.34);
          group.add(be2);
        } else {
          const mat = this.getEnemyMaterial(enemy.type);

          if (enemy.type === 'teleporter') {
            const body = new Mesh(GEO.enemyTeleporter!, mat);
            body.position.y = 0.35;
            group.add(body);

            const ring = new Mesh(
              new CylinderGeometry(0.35, 0.35, 0.04, 12),
              MAT.enemyTeleporter!.clone()
            );
            ring.position.y = 0.15;
            group.add(ring);
          } else if (enemy.type === 'splitter') {
            // Splitter: two-part body with a glowing split line
            const body = new Mesh(GEO.enemy!, mat);
            body.position.y = 0.35;
            group.add(body);

            // Split line
            const splitLine = new Mesh(
              new BoxGeometry(0.5, 0.03, 0.5),
              new MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7, blending: AdditiveBlending })
            );
            splitLine.position.y = 0.35;
            group.add(splitLine);
          } else {
            const body = new Mesh(GEO.enemy!, mat);
            body.position.y = 0.35;
            group.add(body);
          }

          // Eyes
          const eyeMat = new MeshBasicMaterial({ color: 0xffffff });
          const eyeGeo = new SphereGeometry(0.06, 6, 6);
          const eye1 = new Mesh(eyeGeo, eyeMat);
          eye1.position.set(-0.1, 0.45, -0.22);
          group.add(eye1);
          const eye2 = new Mesh(eyeGeo, eyeMat);
          eye2.position.set(0.1, 0.45, -0.22);
          group.add(eye2);

          // HP indicator for multi-hp non-boss enemies
          if (enemy.hp > 1) {
            const hpMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            const hpGeo = new SphereGeometry(0.04, 6, 6);
            for (let h = 0; h < enemy.hp; h++) {
              const dot = new Mesh(hpGeo, hpMat);
              dot.position.set((h - (enemy.hp - 1) / 2) * 0.12, 0.7, 0);
              group.add(dot);
            }
          }
        }

        this.arenaGroup.add(group);
        this.enemyMeshes.set(i, group);
      }

      const group = this.enemyMeshes.get(i)!;
      group.position.set(wx, 0, wz);

      // Animations per type
      if (enemy.isBoss) {
        group.children[0].position.y = 0.5 + Math.sin(this.animTime * 2) * 0.1;
        group.rotation.y = this.animTime * 0.5;

        // HP bar update
        const hpPct = enemy.hp / enemy.maxHp;
        const hpFill = group.children[6] as Mesh;
        if (hpFill) {
          hpFill.scale.x = Math.max(hpPct, 0.01);
          hpFill.position.x = (hpPct - 1) * 0.43;
          const hpMat = hpFill.material as MeshBasicMaterial;
          if (hpPct > 0.5) hpMat.color.setHex(0x00ff44);
          else if (hpPct > 0.25) hpMat.color.setHex(0xffcc00);
          else hpMat.color.setHex(0xff0000);
        }

        // Phase visual feedback
        const bossMat = (group.children[0] as Mesh).material as MeshStandardMaterial;
        if (enemy.bossPhase >= 2) {
          bossMat.emissive.setHex(0xff0000);
          bossMat.emissiveIntensity = 0.6 + Math.sin(this.animTime * 8) * 0.3;
        } else if (enemy.bossPhase >= 1) {
          bossMat.emissive.setHex(0xff6600);
          bossMat.emissiveIntensity = 0.5 + Math.sin(this.animTime * 4) * 0.2;
        }

        // Crown spike rotation
        for (let s = 1; s <= 4; s++) {
          if (group.children[s]) group.children[s].rotation.y = this.animTime * 2;
        }
      } else if (enemy.type === 'patrol') {
        group.children[0].position.y = 0.35;
        group.rotation.y = (enemy.patrolDir * Math.PI) / 2;
      } else if (enemy.type === 'teleporter') {
        group.children[0].position.y = 0.35 + Math.sin(this.animTime * 5 + i) * 0.08;
        if (group.children[1]) {
          group.children[1].rotation.y = this.animTime * 3;
        }
      } else if (enemy.type === 'splitter') {
        group.children[0].position.y = 0.35 + Math.sin(this.animTime * 3 + i) * 0.06;
        // Pulsing split line
        if (group.children[1]) {
          const splitPulse = Math.sin(this.animTime * 6 + i) * 0.3 + 0.7;
          (group.children[1] as Mesh).scale.set(1, 1, 1);
          ((group.children[1] as Mesh).material as MeshBasicMaterial).opacity = splitPulse * 0.7;
        }
        group.rotation.y = this.animTime * 1.5;
      } else {
        group.children[0].position.y = 0.35 + Math.sin(this.animTime * 4 + i) * 0.05;
        group.rotation.y = Math.sin(this.animTime * 2 + i * 3) * 0.3;
      }
    }

    for (const [id, group] of this.enemyMeshes) {
      if (!activeIds.has(id)) {
        this.arenaGroup.remove(group);
        this.enemyMeshes.delete(id);
      }
    }
  }

  private getEnemyMaterial(type: EnemyData['type']): MeshStandardMaterial {
    switch (type) {
      case 'chase': return MAT.enemyChase!;
      case 'bomber': return MAT.enemyBomber!;
      case 'patrol': return MAT.enemyPatrol!;
      case 'teleporter': return MAT.enemyTeleporter!;
      case 'splitter': return MAT.enemySplitter!;
      default: return MAT.enemyWander!;
    }
  }

  private updatePowerUpVisuals() {
    const activeKeys = new Set<string>();

    for (const pu of this.game.powerUps) {
      if (pu.collected) continue;
      const key = `${pu.x}_${pu.y}`;
      activeKeys.add(key);
      const [wx, , wz] = gridToWorld(pu.x, pu.y);

      if (!this.powerUpMeshes.has(key)) {
        const group = new Group();
        const mat = MAT.powerUp.get(pu.type) || MAT.powerUp.get(0)!;
        const sphere = new Mesh(GEO.powerUp!, mat);
        sphere.position.y = 0.4;
        group.add(sphere);

        const ring = new Mesh(
          new CylinderGeometry(0.25, 0.25, 0.02, 12),
          mat.clone()
        );
        ring.position.y = 0.15;
        group.add(ring);

        group.position.set(wx, 0, wz);
        this.arenaGroup.add(group);
        this.powerUpMeshes.set(key, group);
      }

      const group = this.powerUpMeshes.get(key)!;
      group.children[0].position.y = 0.4 + Math.sin(this.animTime * 3) * 0.1;
      group.children[0].rotation.y = this.animTime * 2;
      group.children[1].rotation.y = -this.animTime * 1.5;
    }

    for (const [key, group] of this.powerUpMeshes) {
      if (!activeKeys.has(key)) {
        this.arenaGroup.remove(group);
        this.powerUpMeshes.delete(key);
      }
    }
  }

  private createExitMesh() {
    if (this.exitMesh) {
      this.arenaGroup.remove(this.exitMesh);
    }
    const [wx, , wz] = gridToWorld(this.game.exitX, this.game.exitY);
    this.exitMesh = new Mesh(GEO.exitTile!, MAT.exitTile!);
    this.exitMesh.position.set(wx, 0.03, wz);
    this.arenaGroup.add(this.exitMesh);
  }

  private updateExitVisual() {
    if (!this.exitMesh || !this.game.exitRevealed) return;
    this.exitMesh.rotation.y = this.animTime * 2;
    MAT.exitTile!.opacity = 0.5 + Math.sin(this.animTime * 4) * 0.3;
    this.exitMesh.scale.setScalar(0.8 + Math.sin(this.animTime * 3) * 0.2);
  }

  private onBombExplode(_bomb: BombData) {
    this.shakeTimer = 0.3;
    this.shakeIntensity = 0.15;
    this.playExplosionSound();
  }

  private spawnBlockDestroyEffect(gx: number, gy: number) {
    const [wx, , wz] = gridToWorld(gx, gy);
    for (let i = 0; i < 6; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const geo = new BoxGeometry(size, size, size);
      const mat = new MeshBasicMaterial({
        color: new Color().setHSL(0.08 + Math.random() * 0.05, 0.8, 0.5),
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(
        wx + (Math.random() - 0.5) * 0.3,
        0.3 + Math.random() * 0.3,
        wz + (Math.random() - 0.5) * 0.3
      );
      this.arenaGroup.add(mesh);
      this.explosionParticles.push({
        mesh,
        vel: new Vector3(
          (Math.random() - 0.5) * 3,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 3
        ),
        life: 0.8 + Math.random() * 0.4,
      });
    }
  }

  private spawnEnemyDeathEffect(enemy: EnemyData) {
    const [wx, , wz] = gridToWorld(enemy.visualX, enemy.visualY);
    const deathColor = this.getEnemyDeathColor(enemy.type);
    const particleCount = enemy.isBoss ? 25 : 10;
    for (let i = 0; i < particleCount; i++) {
      const size = enemy.isBoss ? (0.08 + Math.random() * 0.12) : (0.06 + Math.random() * 0.08);
      const geo = new BoxGeometry(size, size, size);
      const mat = new MeshBasicMaterial({
        color: deathColor,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(
        wx + (Math.random() - 0.5) * 0.3,
        0.3 + Math.random() * 0.4,
        wz + (Math.random() - 0.5) * 0.3
      );
      this.arenaGroup.add(mesh);
      this.deathParticles.push({
        mesh,
        vel: new Vector3(
          (Math.random() - 0.5) * 4,
          3 + Math.random() * 3,
          (Math.random() - 0.5) * 4
        ),
        life: 1.0 + Math.random() * 0.5,
        color: deathColor,
      });
    }
    if (enemy.isBoss) {
      this.playBossDeathSound();
    } else {
      this.playEnemyDeathSound(enemy.type);
    }
  }

  private getEnemyDeathColor(type: EnemyData['type']): number {
    switch (type) {
      case 'chase': return 0xff0000;
      case 'bomber': return 0xff8800;
      case 'patrol': return 0x8844ff;
      case 'teleporter': return 0x00ff88;
      case 'splitter': return 0xffcc44;
      default: return 0xff4488;
    }
  }

  private spawnTeleportEffect(enemy: EnemyData) {
    const [wx, , wz] = gridToWorld(enemy.visualX, enemy.visualY);
    for (let i = 0; i < 8; i++) {
      const size = 0.04 + Math.random() * 0.06;
      const geo = new SphereGeometry(size, 6, 6);
      const mat = new MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(geo, mat);
      const angle = (i / 8) * Math.PI * 2;
      mesh.position.set(
        wx + Math.cos(angle) * 0.4,
        0.3 + Math.random() * 0.5,
        wz + Math.sin(angle) * 0.4
      );
      this.arenaGroup.add(mesh);
      this.teleportParticles.push({
        mesh,
        vel: new Vector3(
          Math.cos(angle) * 1.5,
          2 + Math.random() * 2,
          Math.sin(angle) * 1.5
        ),
        life: 0.6 + Math.random() * 0.4,
      });
    }
  }

  private updateParticles(delta: number) {
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const p = this.explosionParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.arenaGroup.remove(p.mesh);
        this.explosionParticles.splice(i, 1);
        continue;
      }
      p.vel.y -= 9.8 * delta;
      p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
      (p.mesh.material as MeshBasicMaterial).opacity = p.life;
      p.mesh.rotation.x += delta * 5;
      p.mesh.rotation.z += delta * 3;
    }
  }

  private updateDeathParticles(delta: number) {
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const p = this.deathParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.arenaGroup.remove(p.mesh);
        this.deathParticles.splice(i, 1);
        continue;
      }
      p.vel.y -= 7 * delta;
      p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
      (p.mesh.material as MeshBasicMaterial).opacity = p.life * 0.8;
      p.mesh.scale.setScalar(0.5 + p.life * 0.5);
    }
  }

  private updateTeleportParticles(delta: number) {
    for (let i = this.teleportParticles.length - 1; i >= 0; i--) {
      const p = this.teleportParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.arenaGroup.remove(p.mesh);
        this.teleportParticles.splice(i, 1);
        continue;
      }
      p.vel.y -= 3 * delta;
      p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
      (p.mesh.material as MeshBasicMaterial).opacity = p.life;
      p.mesh.scale.setScalar(p.life);
    }
  }

  private updateShake(delta: number) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const shake = this.shakeIntensity * (this.shakeTimer / 0.3);
      this.camera.position.set(
        this.cameraBasePos.x + (Math.random() - 0.5) * shake,
        this.cameraBasePos.y + (Math.random() - 0.5) * shake * 0.5,
        this.cameraBasePos.z + (Math.random() - 0.5) * shake
      );
    }
  }

  showGame() {
    this.playerGroup.visible = true;
    this.arenaGroup.visible = true;
    this.lastGridHash = ''; // Force rebuild
    this.startAmbientMusic();
  }

  hideGame() {
    this.stopAmbientMusic();
    this.playerGroup.visible = false;
    for (const [, mesh] of this.blockMeshes) this.arenaGroup.remove(mesh);
    this.blockMeshes.clear();
    for (const [, mesh] of this.bombMeshes) this.arenaGroup.remove(mesh);
    this.bombMeshes.clear();
    for (const [, mesh] of this.explosionMeshes) this.arenaGroup.remove(mesh);
    this.explosionMeshes.clear();
    for (const [, mesh] of this.enemyMeshes) this.arenaGroup.remove(mesh);
    this.enemyMeshes.clear();
    for (const [, mesh] of this.powerUpMeshes) this.arenaGroup.remove(mesh);
    this.powerUpMeshes.clear();
    for (const [, group] of this.laserMeshes) this.arenaGroup.remove(group);
    this.laserMeshes.clear();
    for (const [, meshes] of this.laserWarningMeshes) {
      for (const m of meshes) this.arenaGroup.remove(m);
    }
    this.laserWarningMeshes.clear();
    for (const [, group] of this.conveyorMeshes) this.arenaGroup.remove(group);
    this.conveyorMeshes.clear();
    for (const [, group] of this.warpPortalMeshes) this.arenaGroup.remove(group);
    this.warpPortalMeshes.clear();
    for (const [, mesh] of this.icePatchMeshes) this.arenaGroup.remove(mesh);
    this.icePatchMeshes.clear();
    for (const sp of this.scorePopupMeshes) this.arenaGroup.remove(sp.group);
    this.scorePopupMeshes.length = 0;
    for (const p of this.powerUpCollectEffects) this.arenaGroup.remove(p.mesh);
    this.powerUpCollectEffects.length = 0;
    for (const m of this.dangerZonePool) m.visible = false;
    this.dangerZoneActiveCount = 0;
    for (const m of this.trailPool) m.visible = false;
    this.trailActiveCount = 0;
    if (this.exitMesh) {
      this.arenaGroup.remove(this.exitMesh);
      this.exitMesh = null;
    }
    this.lastGridHash = '';
  }

  applyTheme() {
    const theme = this.game.currentTheme;
    MAT.floor!.color.setHex(theme.floorColor);
    MAT.gridLine!.color.setHex(theme.gridColor);
    MAT.playerGlow!.color.setHex(theme.accentColor);
    MAT.borderGlow!.color.setHex(theme.gridColor);
    MAT.borderWall!.emissive.setHex(theme.gridColor);
    this.scene.background = new Color(theme.floorColor);
    if (this.scene.fog) {
      (this.scene.fog as FogExp2).color.setHex(theme.floorColor);
    }
  }

  // --- Hazard visuals ---

  private updateLaserVisuals(time: number) {
    // Clean up old laser meshes
    for (const [, group] of this.laserMeshes) {
      this.arenaGroup.remove(group);
    }
    this.laserMeshes.clear();
    for (const [, meshes] of this.laserWarningMeshes) {
      for (const m of meshes) this.arenaGroup.remove(m);
    }
    this.laserWarningMeshes.clear();

    for (let li = 0; li < this.game.lasers.length; li++) {
      const laser = this.game.lasers[li];

      if (laser.active) {
        // Draw active laser beam
        const group = new Group();
        const beamMat = new MeshBasicMaterial({
          color: 0xff0044,
          transparent: true,
          opacity: 0.6 + Math.sin(time * 30) * 0.3,
          blending: AdditiveBlending,
        });

        if (laser.axis === 'row') {
          for (let x = 1; x < GRID_W - 1; x++) {
            const [wx, , wz] = gridToWorld(x, laser.index);
            const beam = new Mesh(new BoxGeometry(CELL_SIZE * 0.8, 0.6, 0.08), beamMat);
            beam.position.set(wx, 0.3, wz);
            group.add(beam);
          }
        } else {
          for (let y = 1; y < GRID_H - 1; y++) {
            const [wx, , wz] = gridToWorld(laser.index, y);
            const beam = new Mesh(new BoxGeometry(0.08, 0.6, CELL_SIZE * 0.8), beamMat);
            beam.position.set(wx, 0.3, wz);
            group.add(beam);
          }
        }
        this.arenaGroup.add(group);
        this.laserMeshes.set(li, group);
      } else if (laser.warningTimer > 0) {
        // Draw warning indicators
        const meshes: Mesh[] = [];
        const warningMat = new MeshBasicMaterial({
          color: 0xff4400,
          transparent: true,
          opacity: 0.15 + Math.sin(time * 6) * 0.1,
          blending: AdditiveBlending,
        });

        if (laser.axis === 'row') {
          for (let x = 1; x < GRID_W - 1; x++) {
            const [wx, , wz] = gridToWorld(x, laser.index);
            const warn = new Mesh(new BoxGeometry(CELL_SIZE * 0.9, 0.02, CELL_SIZE * 0.9), warningMat);
            warn.position.set(wx, 0.02, wz);
            this.arenaGroup.add(warn);
            meshes.push(warn);
          }
        } else {
          for (let y = 1; y < GRID_H - 1; y++) {
            const [wx, , wz] = gridToWorld(laser.index, y);
            const warn = new Mesh(new BoxGeometry(CELL_SIZE * 0.9, 0.02, CELL_SIZE * 0.9), warningMat);
            warn.position.set(wx, 0.02, wz);
            this.arenaGroup.add(warn);
            meshes.push(warn);
          }
        }
        this.laserWarningMeshes.set(li, meshes);
      }
    }
  }

  private updateConveyorVisuals(time: number) {
    const activeKeys = new Set<string>();

    for (const conv of this.game.conveyors) {
      const key = `${conv.x}_${conv.y}`;
      activeKeys.add(key);
      const [wx, , wz] = gridToWorld(conv.x, conv.y);

      if (!this.conveyorMeshes.has(key)) {
        const group = new Group();
        // Base tile
        const baseMat = new MeshBasicMaterial({
          color: 0x4444ff,
          transparent: true,
          opacity: 0.4,
          blending: AdditiveBlending,
        });
        const base = new Mesh(new BoxGeometry(CELL_SIZE * 0.85, 0.03, CELL_SIZE * 0.85), baseMat);
        base.position.y = 0.02;
        group.add(base);

        // Arrow indicators (3 small triangles pointing in direction)
        const arrowMat = new MeshBasicMaterial({
          color: 0x8888ff,
          transparent: true,
          opacity: 0.7,
          blending: AdditiveBlending,
        });
        for (let a = 0; a < 3; a++) {
          const arrow = new Mesh(
            new CylinderGeometry(0, 0.08, 0.15, 3),
            arrowMat
          );
          const offset = (a - 1) * 0.25;
          arrow.position.set(
            conv.dx === 0 ? offset : conv.dx * (a - 1) * 0.2,
            0.1,
            conv.dy === 0 ? offset : conv.dy * (a - 1) * 0.2
          );
          // Rotate arrow to point in conveyor direction
          if (conv.dx > 0) arrow.rotation.z = -Math.PI / 2;
          else if (conv.dx < 0) arrow.rotation.z = Math.PI / 2;
          else if (conv.dy > 0) arrow.rotation.x = Math.PI;
          // dy < 0 is default orientation
          group.add(arrow);
        }

        group.position.set(wx, 0, wz);
        this.arenaGroup.add(group);
        this.conveyorMeshes.set(key, group);
      }

      // Animate arrows
      const group = this.conveyorMeshes.get(key)!;
      for (let a = 1; a <= 3; a++) {
        if (group.children[a]) {
          const phase = (time * 3 + a * 0.5) % 1;
          (group.children[a] as Mesh).material = new MeshBasicMaterial({
            color: 0x8888ff,
            transparent: true,
            opacity: 0.3 + phase * 0.5,
            blending: AdditiveBlending,
          });
        }
      }
    }

    for (const [key, group] of this.conveyorMeshes) {
      if (!activeKeys.has(key)) {
        this.arenaGroup.remove(group);
        this.conveyorMeshes.delete(key);
      }
    }
  }

  private updateIcePatchVisuals(time: number) {
    const activeKeys = new Set<string>();

    for (const patch of this.game.icePatches) {
      const key = `${patch.x}_${patch.y}`;
      activeKeys.add(key);
      const [wx, , wz] = gridToWorld(patch.x, patch.y);

      if (!this.icePatchMeshes.has(key)) {
        const mat = new MeshBasicMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.3,
          blending: AdditiveBlending,
        });
        const mesh = new Mesh(new BoxGeometry(CELL_SIZE * 0.88, 0.02, CELL_SIZE * 0.88), mat);
        mesh.position.set(wx, 0.015, wz);
        this.arenaGroup.add(mesh);
        this.icePatchMeshes.set(key, mesh);
      }

      const mesh = this.icePatchMeshes.get(key)!;
      (mesh.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(time * 2 + patch.x + patch.y) * 0.1;
    }

    for (const [key, mesh] of this.icePatchMeshes) {
      if (!activeKeys.has(key)) {
        this.arenaGroup.remove(mesh);
        this.icePatchMeshes.delete(key);
      }
    }
  }

  private updateDangerZoneVisuals(time: number) {
    let poolIdx = 0;
    const opacity = 0.06 + Math.sin(time * 4) * 0.04;

    for (const zone of this.game.dangerZones) {
      for (const cell of zone.cells) {
        if (poolIdx >= this.dangerZonePool.length) break;
        const mesh = this.dangerZonePool[poolIdx];
        const [wx, , wz] = gridToWorld(cell.x, cell.y);
        mesh.position.set(wx, 0.015, wz);
        (mesh.material as MeshBasicMaterial).opacity = opacity;
        mesh.visible = true;
        poolIdx++;
      }
    }
    for (let idx = poolIdx; idx < this.dangerZonePool.length; idx++) {
      this.dangerZonePool[idx].visible = false;
    }
    this.dangerZoneActiveCount = poolIdx;
  }

  private updateTrailVisuals() {
    let poolIdx = 0;

    for (const t of this.game.playerTrail) {
      const alpha = 1 - t.age / 0.5;
      if (alpha <= 0 || poolIdx >= this.trailPool.length) continue;
      const mesh = this.trailPool[poolIdx];
      const [wx, , wz] = gridToWorld(t.x, t.y);
      mesh.position.set(wx, 0.1, wz);
      mesh.scale.setScalar(alpha);
      (mesh.material as MeshBasicMaterial).opacity = alpha * 0.3;
      mesh.visible = true;
      poolIdx++;
    }
    for (let idx = poolIdx; idx < this.trailPool.length; idx++) {
      this.trailPool[idx].visible = false;
    }
    this.trailActiveCount = poolIdx;
  }

  // --- Warp portal visuals ---

  private updateWarpPortalVisuals(time: number) {
    const activeIds = new Set<number>();

    for (let i = 0; i < this.game.warpPortals.length; i++) {
      const portal = this.game.warpPortals[i];
      activeIds.add(i);

      if (!this.warpPortalMeshes.has(i)) {
        const group = new Group();
        const portalColors = [0x00ffff, 0xff88ff];

        // Portal A
        const ringGeoA = new CylinderGeometry(0.35, 0.35, 0.04, 16);
        const ringMatA = new MeshBasicMaterial({
          color: portalColors[0], transparent: true, opacity: 0.7, blending: AdditiveBlending,
        });
        const ringA = new Mesh(ringGeoA, ringMatA);
        const [ax, , az] = gridToWorld(portal.ax, portal.ay);
        ringA.position.set(ax, 0.04, az);
        group.add(ringA);

        // Portal A center glow
        const centerA = new Mesh(
          new CylinderGeometry(0.2, 0.2, 0.02, 12),
          new MeshBasicMaterial({ color: portalColors[0], transparent: true, opacity: 0.4, blending: AdditiveBlending })
        );
        centerA.position.set(ax, 0.06, az);
        group.add(centerA);

        // Portal B
        const ringGeoB = new CylinderGeometry(0.35, 0.35, 0.04, 16);
        const ringMatB = new MeshBasicMaterial({
          color: portalColors[1], transparent: true, opacity: 0.7, blending: AdditiveBlending,
        });
        const ringB = new Mesh(ringGeoB, ringMatB);
        const [bx, , bz] = gridToWorld(portal.bx, portal.by);
        ringB.position.set(bx, 0.04, bz);
        group.add(ringB);

        // Portal B center glow
        const centerB = new Mesh(
          new CylinderGeometry(0.2, 0.2, 0.02, 12),
          new MeshBasicMaterial({ color: portalColors[1], transparent: true, opacity: 0.4, blending: AdditiveBlending })
        );
        centerB.position.set(bx, 0.06, bz);
        group.add(centerB);

        this.arenaGroup.add(group);
        this.warpPortalMeshes.set(i, group);
      }

      const group = this.warpPortalMeshes.get(i)!;
      // Pulsate
      const pulse = Math.sin(time * 3 + i * 2) * 0.2 + 0.6;
      for (let c = 0; c < group.children.length; c++) {
        const child = group.children[c] as Mesh;
        (child.material as MeshBasicMaterial).opacity = pulse * (c % 2 === 0 ? 0.7 : 0.4);
        child.rotation.y = time * (c < 2 ? 2 : -2);
      }

      // Dim when on cooldown
      if (portal.cooldown > 0) {
        for (const child of group.children) {
          ((child as Mesh).material as MeshBasicMaterial).opacity *= 0.3;
        }
      }
    }

    for (const [id, group] of this.warpPortalMeshes) {
      if (!activeIds.has(id)) {
        this.arenaGroup.remove(group);
        this.warpPortalMeshes.delete(id);
      }
    }
  }

  // --- Score popup visuals ---

  private updateScorePopupVisuals(delta: number) {
    // Spawn new popups from game state
    while (this.game.scorePopups.length > 0) {
      const pop = this.game.scorePopups.shift()!;
      this.spawnScorePopup(pop);
    }

    // Spawn power-up name popups
    while (this.game.powerUpPopups.length > 0) {
      const pop = this.game.powerUpPopups.shift()!;
      this.spawnPowerUpNamePopup(pop);
    }

    // Update existing popups
    for (let i = this.scorePopupMeshes.length - 1; i >= 0; i--) {
      const sp = this.scorePopupMeshes[i];
      sp.life -= delta;
      if (sp.life <= 0) {
        this.arenaGroup.remove(sp.group);
        this.scorePopupMeshes.splice(i, 1);
        continue;
      }
      // Float upward
      sp.group.position.y += delta * 1.5;
      // Fade out
      const alpha = Math.min(1, sp.life / 0.5);
      for (const child of sp.group.children) {
        ((child as Mesh).material as MeshBasicMaterial).opacity = alpha;
      }
      sp.group.scale.setScalar(0.8 + (1 - sp.life / 1.5) * 0.3);
    }
  }

  private spawnScorePopup(pop: { x: number; y: number; value: number; color: number }) {
    const group = new Group();
    const [wx, , wz] = gridToWorld(pop.x, pop.y);
    group.position.set(wx, 1.2, wz);

    // Create number display using small cubes as digit-like shapes
    const digits = String(pop.value);
    const spacing = 0.12;
    const startX = -(digits.length - 1) * spacing / 2;
    const mat = new MeshBasicMaterial({
      color: pop.color, transparent: true, opacity: 1, blending: AdditiveBlending,
    });

    for (let d = 0; d < Math.min(digits.length, 6); d++) {
      const block = new Mesh(
        new BoxGeometry(0.08, 0.12, 0.02),
        mat.clone()
      );
      block.position.x = startX + d * spacing;
      group.add(block);
    }

    // + sign
    const plus = new Mesh(
      new BoxGeometry(0.06, 0.06, 0.02),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: AdditiveBlending })
    );
    plus.position.x = startX - spacing;
    group.add(plus);

    this.arenaGroup.add(group);
    this.scorePopupMeshes.push({ group, life: 1.5 });
  }

  private spawnPowerUpNamePopup(pop: { x: number; y: number; name: string; color: number }) {
    const group = new Group();
    const [wx, , wz] = gridToWorld(pop.x, pop.y);
    group.position.set(wx, 1.5, wz);

    // Create letter-like blocks for the name (simplified visual)
    const chars = pop.name.substring(0, 12);
    const spacing = 0.1;
    const startX = -(chars.length - 1) * spacing / 2;
    const mat = new MeshBasicMaterial({
      color: pop.color, transparent: true, opacity: 1, blending: AdditiveBlending,
    });

    for (let c = 0; c < chars.length; c++) {
      if (chars[c] === ' ') continue;
      const block = new Mesh(
        new BoxGeometry(0.06, 0.1, 0.015),
        mat.clone()
      );
      block.position.x = startX + c * spacing;
      group.add(block);
    }

    this.arenaGroup.add(group);
    this.scorePopupMeshes.push({ group, life: 2.0 });
  }

  // --- Power-up collection effect ---

  spawnPowerUpCollectEffect(gx: number, gy: number, color: number) {
    const [wx, , wz] = gridToWorld(gx, gy);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const size = 0.04 + Math.random() * 0.06;
      const geo = new SphereGeometry(size, 6, 6);
      const mat = new MeshBasicMaterial({
        color, transparent: true, opacity: 1, blending: AdditiveBlending,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(
        wx + Math.cos(angle) * 0.2,
        0.4,
        wz + Math.sin(angle) * 0.2
      );
      this.arenaGroup.add(mesh);
      this.powerUpCollectEffects.push({
        mesh,
        vel: new Vector3(
          Math.cos(angle) * 2 + (Math.random() - 0.5),
          3 + Math.random() * 2,
          Math.sin(angle) * 2 + (Math.random() - 0.5)
        ),
        life: 0.8 + Math.random() * 0.4,
      });
    }
  }

  private updatePowerUpCollectEffects(delta: number) {
    for (let i = this.powerUpCollectEffects.length - 1; i >= 0; i--) {
      const p = this.powerUpCollectEffects[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.arenaGroup.remove(p.mesh);
        this.powerUpCollectEffects.splice(i, 1);
        continue;
      }
      p.vel.y -= 6 * delta;
      p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
      (p.mesh.material as MeshBasicMaterial).opacity = p.life;
      p.mesh.scale.setScalar(p.life);
    }
  }

  // --- Procedural audio ---
  private audioCtx: AudioContext | null = null;
  private musicNodes: { oscs: OscillatorNode[]; masterGain: GainNode; filter: BiquadFilterNode } | null = null;

  private getAudioCtx(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  private playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'square') {
    try {
      const ctx = this.getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume * this.game.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* audio may not be available */ }
  }

  private playNoise(duration: number, volume: number) {
    try {
      const ctx = this.getAudioCtx();
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * this.game.sfxVolume, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch { /* audio may not be available */ }
  }

  playMoveSound() {
    this.playTone(440, 0.05, 0.1, 'sine');
  }

  playBombPlaceSound() {
    this.playTone(220, 0.15, 0.2, 'square');
    this.playTone(165, 0.2, 0.15, 'square');
  }

  playExplosionSound() {
    this.playNoise(0.4, 0.4);
    this.playTone(80, 0.3, 0.3, 'sawtooth');
  }

  playPowerUpSound() {
    this.playTone(660, 0.1, 0.15, 'sine');
    setTimeout(() => this.playTone(880, 0.1, 0.15, 'sine'), 50);
    setTimeout(() => this.playTone(1100, 0.15, 0.12, 'sine'), 100);
  }

  playDeathSound() {
    this.playTone(440, 0.15, 0.3, 'sawtooth');
    setTimeout(() => this.playTone(330, 0.15, 0.25, 'sawtooth'), 100);
    setTimeout(() => this.playTone(220, 0.3, 0.2, 'sawtooth'), 200);
  }

  playVictorySound() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.2, 0.15, 'sine'), i * 150);
    });
  }

  private playEnemyDeathSound(type: EnemyData['type']) {
    if (type === 'teleporter') {
      this.playTone(800, 0.1, 0.2, 'sine');
      setTimeout(() => this.playTone(400, 0.2, 0.15, 'sine'), 50);
    } else if (type === 'bomber') {
      this.playNoise(0.2, 0.3);
      this.playTone(150, 0.2, 0.2, 'sawtooth');
    } else if (type === 'splitter') {
      // Splitting sound: ascending tones
      this.playTone(300, 0.08, 0.15, 'square');
      setTimeout(() => this.playTone(450, 0.08, 0.15, 'square'), 40);
      setTimeout(() => this.playTone(600, 0.1, 0.12, 'sine'), 80);
    } else {
      this.playTone(300, 0.1, 0.2, 'square');
      setTimeout(() => this.playTone(200, 0.15, 0.15, 'square'), 60);
    }
  }

  private playTeleportSound() {
    this.playTone(1200, 0.05, 0.1, 'sine');
    setTimeout(() => this.playTone(600, 0.1, 0.1, 'sine'), 30);
    setTimeout(() => this.playTone(1500, 0.08, 0.08, 'sine'), 80);
  }

  private playExitRevealSound() {
    this.playTone(440, 0.15, 0.15, 'sine');
    setTimeout(() => this.playTone(660, 0.15, 0.15, 'sine'), 100);
    setTimeout(() => this.playTone(880, 0.2, 0.12, 'sine'), 200);
  }

  private playPowerUpSpawnSound() {
    this.playTone(550, 0.08, 0.08, 'sine');
  }

  playLevelCompleteSound() {
    const notes = [440, 554, 659, 880];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.15, 0.12, 'sine'), i * 120);
    });
  }

  playComboSound(count: number) {
    const freq = 400 + count * 80;
    this.playTone(Math.min(freq, 1600), 0.08, 0.1, 'sine');
  }

  private playLaserSound() {
    this.playTone(150, 0.3, 0.25, 'sawtooth');
    this.playTone(200, 0.2, 0.15, 'square');
    this.playNoise(0.15, 0.2);
  }

  playConveyorSound() {
    this.playTone(180, 0.08, 0.06, 'sine');
  }

  playBombKickSound() {
    this.playTone(350, 0.08, 0.15, 'square');
    setTimeout(() => this.playTone(500, 0.06, 0.1, 'sine'), 30);
  }

  playWarpSound() {
    this.playTone(1000, 0.08, 0.12, 'sine');
    setTimeout(() => this.playTone(600, 0.1, 0.1, 'sine'), 40);
    setTimeout(() => this.playTone(1200, 0.12, 0.08, 'sine'), 80);
  }

  playIceSlideSound() {
    this.playTone(1500, 0.06, 0.06, 'sine');
    this.playTone(1800, 0.04, 0.04, 'sine');
  }

  playAchievementSound() {
    const notes = [660, 880, 1100, 1320];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.15, 0.1, 'sine'), i * 80);
    });
  }

  playMultiplierSound(mult: number) {
    const freq = 500 + mult * 100;
    this.playTone(freq, 0.12, 0.1, 'sine');
    setTimeout(() => this.playTone(freq * 1.5, 0.1, 0.08, 'sine'), 60);
  }

  playTimeFreezeSound() {
    this.playTone(1200, 0.15, 0.12, 'sine');
    setTimeout(() => this.playTone(600, 0.2, 0.1, 'sine'), 80);
    setTimeout(() => this.playTone(300, 0.3, 0.08, 'sine'), 160);
  }

  playMagnetSound() {
    this.playTone(800, 0.08, 0.1, 'sine');
    setTimeout(() => this.playTone(900, 0.08, 0.1, 'sine'), 50);
    setTimeout(() => this.playTone(1000, 0.1, 0.08, 'sine'), 100);
  }

  playWaveCompleteSound() {
    const notes = [330, 440, 554, 660, 880];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.12, 0.1, 'sine'), i * 100);
    });
  }

  startAmbientMusic() {
    if (this.musicNodes) return;
    try {
      const ctx = this.getAudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(this.game.musicVolume * 0.12, ctx.currentTime + 2);
      masterGain.connect(ctx.destination);

      // Theme-specific bass frequencies
      const themeFreqs = [
        { bass: 55, sub: 27.5, pad: 110, fifth: 82.5 }, // Neon Grid
        { bass: 65, sub: 32.5, pad: 130, fifth: 97.5 }, // Cyber Punk
        { bass: 49, sub: 24.5, pad: 98, fifth: 73.5 },  // Solar Flare
        { bass: 44, sub: 22, pad: 88, fifth: 66 },       // Deep Space
        { bass: 58, sub: 29, pad: 116, fifth: 87 },      // Toxic Glow
      ];
      const tf = themeFreqs[this.game.themeIndex % themeFreqs.length];

      // Bass drone
      const bass = ctx.createOscillator();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(tf.bass, ctx.currentTime);
      const bassGain = ctx.createGain();
      bassGain.gain.setValueAtTime(0.4, ctx.currentTime);
      bass.connect(bassGain);
      bassGain.connect(masterGain);
      bass.start();

      // Sub-bass
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(tf.sub, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.2, ctx.currentTime);
      sub.connect(subGain);
      subGain.connect(masterGain);
      sub.start();

      // Pad with filter sweep
      const pad = ctx.createOscillator();
      pad.type = 'triangle';
      pad.frequency.setValueAtTime(tf.pad, ctx.currentTime);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.Q.setValueAtTime(2, ctx.currentTime);
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.15, ctx.currentTime);
      pad.connect(filter);
      filter.connect(padGain);
      padGain.connect(masterGain);
      pad.start();

      // LFO for filter modulation
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(200, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      // Fifth interval
      const fifth = ctx.createOscillator();
      fifth.type = 'sine';
      fifth.frequency.setValueAtTime(tf.fifth, ctx.currentTime);
      const fifthGain = ctx.createGain();
      fifthGain.gain.setValueAtTime(0.1, ctx.currentTime);
      fifth.connect(fifthGain);
      fifthGain.connect(masterGain);
      fifth.start();

      this.musicNodes = { oscs: [bass, sub, pad, lfo, fifth], masterGain, filter };
    } catch { /* audio may not be available */ }
  }

  stopAmbientMusic() {
    if (!this.musicNodes) return;
    try {
      const ctx = this.getAudioCtx();
      this.musicNodes.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      const nodes = this.musicNodes;
      setTimeout(() => {
        for (const osc of nodes.oscs) {
          try { osc.stop(); } catch { /* already stopped */ }
        }
      }, 1200);
    } catch { /* ignore */ }
    this.musicNodes = null;
  }

  updateMusicIntensity() {
    if (!this.musicNodes) return;
    try {
      const ctx = this.getAudioCtx();
      const vol = this.game.musicVolume * 0.12;
      const boss = this.game.enemies.find(e => e.isBoss && e.alive);
      const intensity = boss ? (boss.bossPhase >= 2 ? 1.8 : boss.bossPhase >= 1 ? 1.4 : 1.1) : 1.0;
      this.musicNodes.masterGain.gain.linearRampToValueAtTime(vol * intensity, ctx.currentTime + 0.5);
      const filterFreq = 300 + this.game.level * 30 + (boss ? 200 : 0);
      this.musicNodes.filter.frequency.linearRampToValueAtTime(Math.min(filterFreq, 1200), ctx.currentTime + 1);
    } catch { /* ignore */ }
  }

  playBossDeathSound() {
    this.playNoise(0.5, 0.4);
    this.playTone(200, 0.15, 0.3, 'sawtooth');
    setTimeout(() => this.playTone(150, 0.2, 0.25, 'sawtooth'), 100);
    setTimeout(() => this.playTone(100, 0.3, 0.2, 'sawtooth'), 200);
    setTimeout(() => {
      this.playTone(400, 0.2, 0.15, 'sine');
      this.playTone(600, 0.2, 0.12, 'sine');
    }, 400);
  }
}
