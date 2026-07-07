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
import { GameManager, GRID_W, GRID_H, CELL_SIZE, CellType, PowerUpType, GameState, BombData, EnemyData, PowerUpData } from './game';

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
  gridLine: null as LineBasicMaterial | null,
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
  powerUp: null as SphereGeometry | null,
  flat: null as BoxGeometry | null,
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
  private lights: PointLight[] = [];
  private animTime = 0;
  private lastGridHash = '';
  private explosionParticles: Array<{ mesh: Mesh; vel: Vector3; life: number }> = [];
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private cameraBasePos = new Vector3(0, 8, 6);
  private inputCooldown = 0;

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
    MAT.gridLine = new LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15 });

    const puColors = [0x00ff00, 0xff8800, 0xffff00, 0x8888ff, 0xff00ff, 0x00ffff];
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
    GEO.powerUp = new SphereGeometry(0.18, 8, 8);
    GEO.flat = new BoxGeometry(CELL_SIZE * 0.9, 0.02, CELL_SIZE * 0.9);
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

  update(delta: number, time: number) {
    this.animTime = time;

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

    // Update particles
    this.updateParticles(delta);

    // Camera shake
    this.updateShake(delta);

    // Animate lights
    for (let i = 0; i < this.lights.length; i++) {
      this.lights[i].intensity = 1.5 + Math.sin(time * 2 + i * 2) * 0.5;
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
    // Simple keyboard shortcuts for menu navigation handled by UI system
  }

  private rebuildGrid() {
    // Compute grid hash to avoid rebuilding every frame
    let hash = '';
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        hash += this.game.grid[y][x];
      }
    }
    if (hash === this.lastGridHash) return;
    this.lastGridHash = hash;

    // Remove stale meshes
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

    // Clean up removed blocks
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

    // Rotate player
    this.playerGroup.rotation.y = this.animTime * 0.5;
  }

  private updateBombVisuals() {
    const activeKeys = new Set<string>();

    for (const bomb of this.game.bombs) {
      const key = `${bomb.x}_${bomb.y}`;
      activeKeys.add(key);
      const [wx, , wz] = gridToWorld(bomb.x, bomb.y);

      if (!this.bombMeshes.has(key)) {
        const group = new Group();
        const body = new Mesh(GEO.bomb!, MAT.bomb!);
        body.position.y = 0.3;
        group.add(body);

        const glow = new Mesh(
          new SphereGeometry(0.32, 8, 8),
          MAT.bombGlow!.clone()
        );
        glow.position.y = 0.3;
        group.add(glow);

        group.position.set(wx, 0, wz);
        this.arenaGroup.add(group);
        this.bombMeshes.set(key, group);
      }

      const group = this.bombMeshes.get(key)!;
      // Pulse faster as timer decreases
      const urgency = 1 - bomb.timer / 3;
      const pulse = Math.sin(this.animTime * (5 + urgency * 15)) * 0.5 + 0.5;
      const glow = group.children[1] as Mesh;
      (glow.material as MeshBasicMaterial).opacity = 0.3 + pulse * 0.5;
      group.children[0].scale.setScalar(0.9 + pulse * 0.15);

      // Color shift to brighter red near detonation
      const emissiveIntensity = 0.3 + urgency * 0.7;
      (group.children[0] as Mesh).material = MAT.bomb!;
      MAT.bomb!.emissiveIntensity = emissiveIntensity;
    }

    // Remove detonated bombs
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

      // Color shift from white-hot to orange
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
        const mat = enemy.type === 'chase' ? MAT.enemyChase! :
          enemy.type === 'bomber' ? MAT.enemyBomber! : MAT.enemyWander!;
        const body = new Mesh(GEO.enemy!, mat);
        body.position.y = 0.35;
        group.add(body);

        // Eyes
        const eyeMat = new MeshBasicMaterial({ color: 0xffffff });
        const eyeGeo = new SphereGeometry(0.06, 6, 6);
        const eye1 = new Mesh(eyeGeo, eyeMat);
        eye1.position.set(-0.1, 0.45, -0.22);
        group.add(eye1);
        const eye2 = new Mesh(eyeGeo, eyeMat);
        eye2.position.set(0.1, 0.45, -0.22);
        group.add(eye2);

        this.arenaGroup.add(group);
        this.enemyMeshes.set(i, group);
      }

      const group = this.enemyMeshes.get(i)!;
      group.position.set(wx, 0, wz);

      // Bob animation
      group.children[0].position.y = 0.35 + Math.sin(this.animTime * 4 + i) * 0.05;
      group.rotation.y = Math.sin(this.animTime * 2 + i * 3) * 0.3;
    }

    // Clean up dead enemies
    for (const [id, group] of this.enemyMeshes) {
      if (!activeIds.has(id)) {
        this.arenaGroup.remove(group);
        this.enemyMeshes.delete(id);
      }
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

        // Ring around power-up
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
      // Float and spin
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

  private onBombExplode(bomb: BombData) {
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
  }

  hideGame() {
    this.playerGroup.visible = false;
    // Clean up all meshes
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
    this.lastGridHash = '';
  }

  applyTheme() {
    const theme = this.game.currentTheme;
    MAT.floor!.color.setHex(theme.floorColor);
    MAT.gridLine!.color.setHex(theme.gridColor);
    MAT.playerGlow!.color.setHex(theme.accentColor);
    this.scene.background = new Color(theme.floorColor);
    if (this.scene.fog) {
      (this.scene.fog as FogExp2).color.setHex(theme.floorColor);
    }
  }

  // --- Procedural audio ---
  private audioCtx: AudioContext | null = null;

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
}
