// Grid-based Bomberman game logic

export const GRID_W = 13;
export const GRID_H = 11;
export const CELL_SIZE = 1.0;

export enum CellType {
  Empty = 0,
  HardBlock = 1,
  SoftBlock = 2,
  Bomb = 3,
  Explosion = 4,
  PowerUp = 5,
}

export enum PowerUpType {
  ExtraBomb = 0,
  BlastRange = 1,
  Speed = 2,
  PassThrough = 3,
  RemoteDetonate = 4,
  Shield = 5,
}

export enum GameState {
  Menu = 0,
  Playing = 1,
  Paused = 2,
  GameOver = 3,
  Victory = 4,
}

export enum GameMode {
  Classic = 0,
  Timed = 1,
  Survival = 2,
  Puzzle = 3,
}

export interface BombData {
  x: number;
  y: number;
  timer: number;
  range: number;
  owner: 'player' | 'enemy';
  remote: boolean;
}

export interface ExplosionData {
  x: number;
  y: number;
  timer: number;
}

export interface EnemyData {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  moveTimer: number;
  moveSpeed: number;
  alive: boolean;
  type: 'wander' | 'chase' | 'bomber';
  visualX: number;
  visualY: number;
  bombCooldown: number;
}

export interface PowerUpData {
  x: number;
  y: number;
  type: PowerUpType;
  collected: boolean;
}

export class GameManager {
  grid: CellType[][] = [];
  bombs: BombData[] = [];
  explosions: ExplosionData[] = [];
  enemies: EnemyData[] = [];
  powerUps: PowerUpData[] = [];

  playerX = 1;
  playerY = 1;
  playerVisualX = 1;
  playerVisualY = 1;
  playerMoveTimer = 0;

  maxBombs = 1;
  activeBombs = 0;
  blastRange = 2;
  speed = 4.0;
  hasPassThrough = false;
  hasRemoteDetonate = false;
  hasShield = false;
  shieldTimer = 0;

  score = 0;
  level = 1;
  lives = 3;
  enemiesKilled = 0;
  blocksDestroyed = 0;
  timeElapsed = 0;
  timeLimit = 180;
  comboCount = 0;
  comboTimer = 0;

  state = GameState.Menu;
  mode = GameMode.Classic;

  // Achievement tracking
  achievements: string[] = [];
  totalGames = 0;
  totalScore = 0;
  bestScore = 0;
  maxCombo = 0;
  totalEnemiesKilled = 0;
  perfectClears = 0;

  // Settings
  sfxVolume = 0.7;
  musicVolume = 0.5;
  difficulty = 1; // 0=easy, 1=normal, 2=hard

  // Theme
  themeIndex = 0;
  themes = [
    { name: 'Neon Grid', floorColor: 0x001122, gridColor: 0x00ffff, accentColor: 0xff00ff },
    { name: 'Cyber Punk', floorColor: 0x110022, gridColor: 0xff00ff, accentColor: 0x00ff88 },
    { name: 'Solar Flare', floorColor: 0x221100, gridColor: 0xff8800, accentColor: 0xffcc00 },
    { name: 'Deep Space', floorColor: 0x000811, gridColor: 0x4488ff, accentColor: 0x88ccff },
    { name: 'Toxic Glow', floorColor: 0x002200, gridColor: 0x00ff44, accentColor: 0x88ff00 },
  ];

  get currentTheme() { return this.themes[this.themeIndex]; }

  initGrid() {
    this.grid = [];
    for (let y = 0; y < GRID_H; y++) {
      this.grid[y] = [];
      for (let x = 0; x < GRID_W; x++) {
        // Hard blocks in alternating pattern (classic Bomberman)
        if (x % 2 === 0 && y % 2 === 0) {
          this.grid[y][x] = CellType.HardBlock;
        } else {
          this.grid[y][x] = CellType.Empty;
        }
      }
    }

    // Fill with soft blocks (leave corners clear for spawns)
    const clearZones = [
      [1, 1], [2, 1], [1, 2], // Player spawn (top-left)
      [GRID_W - 2, 1], [GRID_W - 3, 1], [GRID_W - 2, 2], // Enemy spawn TR
      [1, GRID_H - 2], [2, GRID_H - 2], [1, GRID_H - 3], // Enemy spawn BL
      [GRID_W - 2, GRID_H - 2], [GRID_W - 3, GRID_H - 2], [GRID_W - 2, GRID_H - 3], // Enemy spawn BR
    ];

    const softBlockDensity = 0.4 + this.difficulty * 0.1;

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (this.grid[y][x] !== CellType.Empty) continue;
        if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
          this.grid[y][x] = CellType.HardBlock; // Border walls
          continue;
        }
        if (clearZones.some(([cx, cy]) => cx === x && cy === y)) continue;
        if (Math.random() < softBlockDensity) {
          this.grid[y][x] = CellType.SoftBlock;
        }
      }
    }
  }

  spawnEnemies() {
    this.enemies = [];
    const count = 2 + this.level + this.difficulty;
    const spawns = [
      { x: GRID_W - 2, y: 1 },
      { x: 1, y: GRID_H - 2 },
      { x: GRID_W - 2, y: GRID_H - 2 },
      { x: Math.floor(GRID_W / 2), y: 1 },
      { x: Math.floor(GRID_W / 2), y: GRID_H - 2 },
      { x: 1, y: Math.floor(GRID_H / 2) },
      { x: GRID_W - 2, y: Math.floor(GRID_H / 2) },
    ];

    const types: Array<'wander' | 'chase' | 'bomber'> = ['wander', 'chase', 'bomber'];
    for (let i = 0; i < Math.min(count, spawns.length); i++) {
      const sp = spawns[i];
      const type = types[i % types.length];
      this.enemies.push({
        x: sp.x, y: sp.y,
        targetX: sp.x, targetY: sp.y,
        moveTimer: 0,
        moveSpeed: 0.8 + this.difficulty * 0.3 + (type === 'chase' ? 0.3 : 0),
        alive: true,
        type,
        visualX: sp.x, visualY: sp.y,
        bombCooldown: 0,
      });
    }
  }

  startGame(mode: GameMode = GameMode.Classic) {
    this.mode = mode;
    this.state = GameState.Playing;
    this.score = 0;
    this.level = 1;
    this.lives = mode === GameMode.Survival ? 1 : 3;
    this.enemiesKilled = 0;
    this.blocksDestroyed = 0;
    this.timeElapsed = 0;
    this.timeLimit = mode === GameMode.Timed ? 120 : 9999;
    this.maxBombs = 1;
    this.activeBombs = 0;
    this.blastRange = 2;
    this.speed = 4.0;
    this.hasPassThrough = false;
    this.hasRemoteDetonate = false;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.bombs = [];
    this.explosions = [];
    this.powerUps = [];
    this.totalGames++;

    this.playerX = 1;
    this.playerY = 1;
    this.playerVisualX = 1;
    this.playerVisualY = 1;
    this.playerMoveTimer = 0;

    this.initGrid();
    this.spawnEnemies();
  }

  nextLevel() {
    this.level++;
    this.bombs = [];
    this.explosions = [];
    this.powerUps = [];
    this.activeBombs = 0;
    this.playerX = 1;
    this.playerY = 1;
    this.playerVisualX = 1;
    this.playerVisualY = 1;
    this.playerMoveTimer = 0;

    this.initGrid();
    this.spawnEnemies();

    // Level bonus
    this.score += this.level * 500;
    this.checkAchievements();
  }

  canMove(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
    const cell = this.grid[y][x];
    if (cell === CellType.HardBlock) return false;
    if (cell === CellType.SoftBlock && !this.hasPassThrough) return false;
    if (cell === CellType.Bomb) return false;
    return true;
  }

  movePlayer(dx: number, dy: number, delta: number): boolean {
    if (this.state !== GameState.Playing) return false;
    if (this.playerMoveTimer > 0) return false;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;
    if (!this.canMove(nx, ny)) return false;

    this.playerX = nx;
    this.playerY = ny;
    this.playerMoveTimer = 1.0 / this.speed;

    // Check power-up pickup
    const pIdx = this.powerUps.findIndex(p => p.x === nx && p.y === ny && !p.collected);
    if (pIdx >= 0) {
      this.collectPowerUp(pIdx);
    }

    // Check enemy collision
    this.checkPlayerEnemyCollision();

    return true;
  }

  placeBomb(): boolean {
    if (this.state !== GameState.Playing) return false;
    if (this.activeBombs >= this.maxBombs) return false;
    if (this.bombs.some(b => b.x === this.playerX && b.y === this.playerY)) return false;

    this.bombs.push({
      x: this.playerX,
      y: this.playerY,
      timer: 3.0,
      range: this.blastRange,
      owner: 'player',
      remote: this.hasRemoteDetonate,
    });
    this.grid[this.playerY][this.playerX] = CellType.Bomb;
    this.activeBombs++;
    return true;
  }

  detonateRemote() {
    const remote = this.bombs.find(b => b.remote && b.owner === 'player');
    if (remote) {
      remote.timer = 0;
    }
  }

  update(delta: number): { exploded: BombData[], destroyed: Array<{x: number, y: number}>, powerUpsSpawned: PowerUpData[], enemiesHit: EnemyData[], playerHit: boolean, levelComplete: boolean } {
    const result = {
      exploded: [] as BombData[],
      destroyed: [] as Array<{x: number, y: number}>,
      powerUpsSpawned: [] as PowerUpData[],
      enemiesHit: [] as EnemyData[],
      playerHit: false,
      levelComplete: false,
    };

    if (this.state !== GameState.Playing) return result;

    this.timeElapsed += delta;
    if (this.playerMoveTimer > 0) this.playerMoveTimer -= delta;
    if (this.shieldTimer > 0) this.shieldTimer -= delta;
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Timed mode check
    if (this.mode === GameMode.Timed && this.timeElapsed >= this.timeLimit) {
      this.state = GameState.GameOver;
      this.updateStats();
      return result;
    }

    // Interpolate player visual position
    const lerpSpeed = 12;
    this.playerVisualX += (this.playerX - this.playerVisualX) * Math.min(1, lerpSpeed * delta);
    this.playerVisualY += (this.playerY - this.playerVisualY) * Math.min(1, lerpSpeed * delta);

    // Update bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.timer -= delta;
      if (bomb.timer <= 0) {
        result.exploded.push(bomb);
        this.explodeBomb(bomb, result);
        this.bombs.splice(i, 1);
        if (bomb.owner === 'player') this.activeBombs--;
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer -= delta;
      if (this.explosions[i].timer <= 0) {
        const exp = this.explosions[i];
        if (this.grid[exp.y][exp.x] === CellType.Explosion) {
          this.grid[exp.y][exp.x] = CellType.Empty;
        }
        this.explosions.splice(i, 1);
      }
    }

    // Update enemies
    this.updateEnemies(delta, result);

    // Check level complete
    if (this.enemies.every(e => !e.alive)) {
      if (this.mode === GameMode.Survival) {
        this.nextLevel();
      } else {
        result.levelComplete = true;
        if (this.level >= 5 + this.difficulty * 2) {
          this.state = GameState.Victory;
          this.score += 5000;
        } else {
          this.nextLevel();
        }
      }
    }

    return result;
  }

  private explodeBomb(bomb: BombData, result: { destroyed: Array<{x: number, y: number}>, powerUpsSpawned: PowerUpData[], enemiesHit: EnemyData[], playerHit: boolean }) {
    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const explosionCells: Array<{x: number, y: number}> = [];

    for (const [dx, dy] of dirs) {
      for (let r = 0; r <= bomb.range; r++) {
        if (dx === 0 && dy === 0 && r > 0) break;
        const ex = bomb.x + dx * r;
        const ey = bomb.y + dy * r;
        if (ex < 0 || ex >= GRID_W || ey < 0 || ey >= GRID_H) break;

        const cell = this.grid[ey][ex];
        if (cell === CellType.HardBlock) break;

        if (cell === CellType.SoftBlock) {
          this.grid[ey][ex] = CellType.Explosion;
          result.destroyed.push({ x: ex, y: ey });
          this.blocksDestroyed++;
          this.score += 10;
          this.comboCount++;
          this.comboTimer = 2.0;
          if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

          // Chance to drop power-up
          if (Math.random() < 0.3) {
            const types = [PowerUpType.ExtraBomb, PowerUpType.BlastRange, PowerUpType.Speed,
              PowerUpType.PassThrough, PowerUpType.RemoteDetonate, PowerUpType.Shield];
            const weights = [3, 3, 2, 1, 1, 1];
            const total = weights.reduce((a, b) => a + b, 0);
            let rnd = Math.random() * total;
            let pType = types[0];
            for (let ti = 0; ti < types.length; ti++) {
              rnd -= weights[ti];
              if (rnd <= 0) { pType = types[ti]; break; }
            }
            const pu: PowerUpData = { x: ex, y: ey, type: pType, collected: false };
            this.powerUps.push(pu);
            result.powerUpsSpawned.push(pu);
          }
          break; // Stop propagation at destroyed block
        }

        if (cell === CellType.Bomb) {
          // Chain explosion
          const chainBomb = this.bombs.find(b => b.x === ex && b.y === ey);
          if (chainBomb) chainBomb.timer = 0;
        }

        this.grid[ey][ex] = CellType.Explosion;
        explosionCells.push({ x: ex, y: ey });
      }
    }

    for (const cell of explosionCells) {
      this.explosions.push({ x: cell.x, y: cell.y, timer: 0.5 });
    }

    // Check player hit
    if (explosionCells.some(c => c.x === this.playerX && c.y === this.playerY)) {
      if (this.hasShield && this.shieldTimer > 0) {
        this.hasShield = false;
        this.shieldTimer = 0;
      } else {
        result.playerHit = true;
        this.lives--;
        if (this.lives <= 0) {
          this.state = GameState.GameOver;
          this.updateStats();
        } else {
          // Respawn at safe spot
          this.playerX = 1;
          this.playerY = 1;
          this.playerVisualX = 1;
          this.playerVisualY = 1;
          this.shieldTimer = 3.0; // Brief invincibility
          this.hasShield = true;
        }
      }
    }

    // Check enemies hit
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const ex = Math.round(enemy.visualX);
      const ey = Math.round(enemy.visualY);
      if (explosionCells.some(c => c.x === ex && c.y === ey)) {
        enemy.alive = false;
        this.enemiesKilled++;
        this.totalEnemiesKilled++;
        const baseScore = enemy.type === 'bomber' ? 300 : enemy.type === 'chase' ? 200 : 100;
        this.score += baseScore * (1 + this.comboCount * 0.5);
        this.comboCount++;
        this.comboTimer = 2.0;
        result.enemiesHit.push(enemy);
      }
    }

    this.score += this.comboCount > 1 ? this.comboCount * 50 : 0;
    this.checkAchievements();
  }

  private updateEnemies(delta: number, result: { enemiesHit: EnemyData[], playerHit: boolean }) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      enemy.moveTimer -= delta;
      if (enemy.bombCooldown > 0) enemy.bombCooldown -= delta;

      // Interpolate visual position
      enemy.visualX += (enemy.x - enemy.visualX) * Math.min(1, 8 * delta);
      enemy.visualY += (enemy.y - enemy.visualY) * Math.min(1, 8 * delta);

      if (enemy.moveTimer <= 0) {
        enemy.moveTimer = 1.0 / enemy.moveSpeed;

        if (enemy.type === 'chase') {
          // Move toward player
          const dx = this.playerX - enemy.x;
          const dy = this.playerY - enemy.y;
          const moves: Array<[number, number]> = [];
          if (Math.abs(dx) >= Math.abs(dy)) {
            moves.push([Math.sign(dx), 0], [0, Math.sign(dy) || 1]);
          } else {
            moves.push([0, Math.sign(dy)], [Math.sign(dx) || 1, 0]);
          }
          moves.push([-Math.sign(dx) || 1, 0], [0, -Math.sign(dy) || 1]);

          let moved = false;
          for (const [mx, my] of moves) {
            const nx = enemy.x + mx;
            const ny = enemy.y + my;
            if (this.canMoveEnemy(nx, ny)) {
              enemy.x = nx;
              enemy.y = ny;
              moved = true;
              break;
            }
          }
          if (!moved) {
            // Random fallback
            this.randomMoveEnemy(enemy);
          }
        } else if (enemy.type === 'bomber') {
          // Move randomly but place bombs
          this.randomMoveEnemy(enemy);
          if (enemy.bombCooldown <= 0 && Math.random() < 0.3) {
            this.placeEnemyBomb(enemy);
            enemy.bombCooldown = 4.0;
          }
        } else {
          // Wander randomly
          this.randomMoveEnemy(enemy);
        }

        // Check collision with player
        if (enemy.x === this.playerX && enemy.y === this.playerY) {
          if (this.hasShield && this.shieldTimer > 0) {
            this.hasShield = false;
            this.shieldTimer = 0;
          } else {
            result.playerHit = true;
            this.lives--;
            if (this.lives <= 0) {
              this.state = GameState.GameOver;
              this.updateStats();
            } else {
              this.playerX = 1;
              this.playerY = 1;
              this.playerVisualX = 1;
              this.playerVisualY = 1;
              this.shieldTimer = 3.0;
              this.hasShield = true;
            }
          }
        }
      }
    }
  }

  private canMoveEnemy(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
    const cell = this.grid[y][x];
    return cell === CellType.Empty || cell === CellType.PowerUp;
  }

  private randomMoveEnemy(enemy: EnemyData) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const [dx, dy] of shuffled) {
      const nx = enemy.x + dx;
      const ny = enemy.y + dy;
      if (this.canMoveEnemy(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
        return;
      }
    }
  }

  private placeEnemyBomb(enemy: EnemyData) {
    if (this.bombs.some(b => b.x === enemy.x && b.y === enemy.y)) return;
    this.bombs.push({
      x: enemy.x, y: enemy.y,
      timer: 3.5,
      range: 1 + this.difficulty,
      owner: 'enemy',
      remote: false,
    });
    this.grid[enemy.y][enemy.x] = CellType.Bomb;
  }

  private collectPowerUp(index: number) {
    const pu = this.powerUps[index];
    pu.collected = true;
    this.score += 50;

    switch (pu.type) {
      case PowerUpType.ExtraBomb:
        this.maxBombs = Math.min(this.maxBombs + 1, 8);
        break;
      case PowerUpType.BlastRange:
        this.blastRange = Math.min(this.blastRange + 1, 8);
        break;
      case PowerUpType.Speed:
        this.speed = Math.min(this.speed + 0.5, 8);
        break;
      case PowerUpType.PassThrough:
        this.hasPassThrough = true;
        break;
      case PowerUpType.RemoteDetonate:
        this.hasRemoteDetonate = true;
        break;
      case PowerUpType.Shield:
        this.hasShield = true;
        this.shieldTimer = 15;
        break;
    }
  }

  private checkPlayerEnemyCollision() {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.x === this.playerX && enemy.y === this.playerY) {
        if (this.hasShield && this.shieldTimer > 0) {
          this.hasShield = false;
          this.shieldTimer = 0;
        } else {
          this.lives--;
          if (this.lives <= 0) {
            this.state = GameState.GameOver;
            this.updateStats();
          } else {
            this.playerX = 1;
            this.playerY = 1;
            this.playerVisualX = 1;
            this.playerVisualY = 1;
            this.shieldTimer = 3.0;
            this.hasShield = true;
          }
        }
        break;
      }
    }
  }

  private updateStats() {
    if (this.score > this.bestScore) this.bestScore = this.score;
    this.totalScore += this.score;
    if (this.enemies.every(e => !e.alive) && this.lives > 0) {
      this.perfectClears++;
    }
  }

  checkAchievements() {
    const checks: Array<{ id: string; name: string; cond: () => boolean }> = [
      { id: 'first_blood', name: 'First Blood', cond: () => this.totalEnemiesKilled >= 1 },
      { id: 'bomber_10', name: 'Demolition Expert', cond: () => this.blocksDestroyed >= 50 },
      { id: 'combo_3', name: 'Chain Reaction', cond: () => this.maxCombo >= 3 },
      { id: 'combo_5', name: 'Combo Master', cond: () => this.maxCombo >= 5 },
      { id: 'combo_10', name: 'Combo Legend', cond: () => this.maxCombo >= 10 },
      { id: 'score_5k', name: 'Score: 5000', cond: () => this.score >= 5000 },
      { id: 'score_10k', name: 'Score: 10000', cond: () => this.score >= 10000 },
      { id: 'score_50k', name: 'Score: 50000', cond: () => this.score >= 50000 },
      { id: 'level_3', name: 'Intermediate', cond: () => this.level >= 3 },
      { id: 'level_5', name: 'Veteran', cond: () => this.level >= 5 },
      { id: 'level_10', name: 'Master Bomber', cond: () => this.level >= 10 },
      { id: 'kill_10', name: 'Hunter', cond: () => this.totalEnemiesKilled >= 10 },
      { id: 'kill_50', name: 'Exterminator', cond: () => this.totalEnemiesKilled >= 50 },
      { id: 'kill_100', name: 'Genocide', cond: () => this.totalEnemiesKilled >= 100 },
      { id: 'perfect', name: 'Perfect Clear', cond: () => this.perfectClears >= 1 },
      { id: 'games_10', name: 'Dedicated', cond: () => this.totalGames >= 10 },
      { id: 'speed_max', name: 'Speed Demon', cond: () => this.speed >= 8 },
      { id: 'bombs_max', name: 'Arsenal', cond: () => this.maxBombs >= 8 },
      { id: 'range_max', name: 'Long Range', cond: () => this.blastRange >= 8 },
      { id: 'all_powerups', name: 'Fully Loaded', cond: () => this.maxBombs > 1 && this.blastRange > 2 && this.speed > 4 && this.hasPassThrough && this.hasRemoteDetonate },
      { id: 'survive_5min', name: 'Survivor', cond: () => this.timeElapsed >= 300 },
      { id: 'no_damage_level', name: 'Untouchable', cond: () => this.level > 1 && this.lives === 3 },
      { id: 'blocks_100', name: 'Wrecking Ball', cond: () => this.blocksDestroyed >= 100 },
      { id: 'blocks_500', name: 'Demolisher', cond: () => this.blocksDestroyed >= 500 },
      { id: 'enemy_bomber', name: 'Taste Your Own Medicine', cond: () => this.enemies.some(e => !e.alive && e.type === 'bomber') },
      { id: 'hard_complete', name: 'Nightmare Slayer', cond: () => this.difficulty === 2 && this.state === GameState.Victory },
      { id: 'timed_win', name: 'Speed Runner', cond: () => this.mode === GameMode.Timed && this.state === GameState.Victory },
      { id: 'survival_l5', name: 'Endurance', cond: () => this.mode === GameMode.Survival && this.level >= 5 },
      { id: 'survival_l10', name: 'Iron Will', cond: () => this.mode === GameMode.Survival && this.level >= 10 },
      { id: 'total_50k', name: 'Career: 50K', cond: () => this.totalScore >= 50000 },
      { id: 'chain_bomb', name: 'Chain Bomber', cond: () => this.comboCount >= 3 },
      { id: 'shield_save', name: 'Shield Bearer', cond: () => this.hasShield },
      { id: 'remote_kill', name: 'Remote Assassin', cond: () => this.hasRemoteDetonate && this.enemiesKilled > 0 },
      { id: 'passthrough', name: 'Ghost Walker', cond: () => this.hasPassThrough },
      { id: 'max_power', name: 'Maximum Power', cond: () => this.maxBombs >= 5 && this.blastRange >= 5 && this.speed >= 6 },
      { id: 'quick_clear', name: 'Quick Clear', cond: () => this.timeElapsed < 60 && this.enemies.every(e => !e.alive) },
      { id: 'bomb_chain_3', name: 'Triple Chain', cond: () => this.comboCount >= 3 },
      { id: 'no_bombs_die', name: 'Pacifist Death', cond: () => this.activeBombs === 0 && this.lives < 3 },
      { id: 'play_all_modes', name: 'Versatile', cond: () => this.totalGames >= 4 },
      { id: 'score_100k', name: 'Score: 100K', cond: () => this.totalScore >= 100000 },
    ];

    for (const check of checks) {
      if (!this.achievements.includes(check.id) && check.cond()) {
        this.achievements.push(check.id);
      }
    }
  }

  getAchievementName(id: string): string {
    const names: Record<string, string> = {
      first_blood: 'First Blood', bomber_10: 'Demolition Expert', combo_3: 'Chain Reaction',
      combo_5: 'Combo Master', combo_10: 'Combo Legend', score_5k: 'Score: 5000',
      score_10k: 'Score: 10000', score_50k: 'Score: 50000', level_3: 'Intermediate',
      level_5: 'Veteran', level_10: 'Master Bomber', kill_10: 'Hunter', kill_50: 'Exterminator',
      kill_100: 'Genocide', perfect: 'Perfect Clear', games_10: 'Dedicated',
      speed_max: 'Speed Demon', bombs_max: 'Arsenal', range_max: 'Long Range',
      all_powerups: 'Fully Loaded', survive_5min: 'Survivor', no_damage_level: 'Untouchable',
      blocks_100: 'Wrecking Ball', blocks_500: 'Demolisher',
      enemy_bomber: 'Taste Your Own Medicine', hard_complete: 'Nightmare Slayer',
      timed_win: 'Speed Runner', survival_l5: 'Endurance', survival_l10: 'Iron Will',
      total_50k: 'Career: 50K', chain_bomb: 'Chain Bomber', shield_save: 'Shield Bearer',
      remote_kill: 'Remote Assassin', passthrough: 'Ghost Walker', max_power: 'Maximum Power',
      quick_clear: 'Quick Clear', bomb_chain_3: 'Triple Chain',
      no_bombs_die: 'Pacifist Death', play_all_modes: 'Versatile', score_100k: 'Score: 100K',
    };
    return names[id] || id;
  }
}
