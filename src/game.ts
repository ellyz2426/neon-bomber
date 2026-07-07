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
  Exit = 6,
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
  LevelTransition = 5,
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
  type: 'wander' | 'chase' | 'bomber' | 'patrol' | 'teleporter';
  visualX: number;
  visualY: number;
  bombCooldown: number;
  patrolDir: number; // for patrol type
  teleportCooldown: number; // for teleporter type
  hp: number;
}

export interface PowerUpData {
  x: number;
  y: number;
  type: PowerUpType;
  collected: boolean;
}

// Puzzle level definitions
interface PuzzleLevel {
  name: string;
  softBlocks: Array<[number, number]>;
  enemies: Array<{ x: number; y: number; type: EnemyData['type'] }>;
  powerUps: Array<{ x: number; y: number; type: PowerUpType }>;
  exitPos: [number, number];
  maxBombs: number;
  blastRange: number;
  timeLimit: number;
  hint: string;
}

const PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    name: 'The Corridor',
    softBlocks: [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9],
      [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9]],
    enemies: [{ x: 11, y: 9, type: 'wander' }],
    powerUps: [{ x: 5, y: 3, type: PowerUpType.BlastRange }],
    exitPos: [11, 9],
    maxBombs: 1,
    blastRange: 2,
    timeLimit: 90,
    hint: 'Blast through the corridor walls',
  },
  {
    name: 'Chain Reaction',
    softBlocks: [[1, 3], [2, 3], [3, 3], [5, 3], [7, 3], [9, 3], [11, 3],
      [1, 7], [3, 7], [5, 7], [7, 7], [9, 7], [10, 7], [11, 7]],
    enemies: [{ x: 11, y: 1, type: 'chase' }, { x: 11, y: 9, type: 'wander' }],
    powerUps: [{ x: 3, y: 1, type: PowerUpType.ExtraBomb }],
    exitPos: [11, 5],
    maxBombs: 2,
    blastRange: 3,
    timeLimit: 120,
    hint: 'Use chain explosions to clear the path',
  },
  {
    name: 'The Gauntlet',
    softBlocks: [[1, 3], [1, 5], [1, 7], [3, 1], [3, 3], [3, 5], [3, 7], [3, 9],
      [5, 1], [5, 3], [5, 5], [5, 7], [5, 9], [7, 1], [7, 3], [7, 5], [7, 7], [7, 9],
      [9, 1], [9, 3], [9, 5], [9, 7], [9, 9], [11, 3], [11, 5], [11, 7]],
    enemies: [
      { x: 5, y: 1, type: 'patrol' },
      { x: 7, y: 5, type: 'chase' },
      { x: 9, y: 9, type: 'bomber' },
      { x: 11, y: 1, type: 'teleporter' },
    ],
    powerUps: [
      { x: 3, y: 1, type: PowerUpType.Speed },
      { x: 7, y: 9, type: PowerUpType.Shield },
    ],
    exitPos: [11, 9],
    maxBombs: 2,
    blastRange: 2,
    timeLimit: 180,
    hint: 'Navigate the maze while avoiding four enemy types',
  },
  {
    name: 'Demolition Derby',
    softBlocks: [],
    enemies: [
      { x: 3, y: 3, type: 'bomber' },
      { x: 9, y: 3, type: 'bomber' },
      { x: 3, y: 7, type: 'bomber' },
      { x: 9, y: 7, type: 'bomber' },
      { x: 6, y: 5, type: 'chase' },
    ],
    powerUps: [
      { x: 1, y: 5, type: PowerUpType.Shield },
      { x: 11, y: 5, type: PowerUpType.ExtraBomb },
    ],
    exitPos: [6, 1],
    maxBombs: 3,
    blastRange: 3,
    timeLimit: 150,
    hint: 'Survive and eliminate all bomber enemies',
  },
  {
    name: 'Remote Control',
    softBlocks: [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9],
      [4, 1], [4, 3], [4, 5], [4, 7], [4, 9],
      [6, 1], [6, 3], [6, 5], [6, 7], [6, 9],
      [8, 1], [8, 3], [8, 5], [8, 7], [8, 9],
      [10, 1], [10, 2], [10, 3], [10, 5], [10, 7], [10, 8], [10, 9]],
    enemies: [
      { x: 11, y: 1, type: 'teleporter' },
      { x: 11, y: 9, type: 'patrol' },
    ],
    powerUps: [
      { x: 1, y: 3, type: PowerUpType.RemoteDetonate },
      { x: 5, y: 5, type: PowerUpType.PassThrough },
    ],
    exitPos: [11, 5],
    maxBombs: 1,
    blastRange: 4,
    timeLimit: 150,
    hint: 'Use remote detonate for precision strikes',
  },
];

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

  // Level transition
  transitionTimer = 0;
  transitionDuration = 2.5;

  // Exit tile for puzzle mode
  exitX = -1;
  exitY = -1;
  exitRevealed = false;

  // Puzzle hint
  puzzleHint = '';

  // Achievement tracking
  achievements: string[] = [];
  totalGames = 0;
  totalScore = 0;
  bestScore = 0;
  maxCombo = 0;
  totalEnemiesKilled = 0;
  perfectClears = 0;
  totalBlocksDestroyed = 0;
  totalPowerUpsCollected = 0;
  totalBombsPlaced = 0;
  longestSurvivalTime = 0;
  fastestLevelClear = 9999;

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

  constructor() {
    this.loadHighScores();
  }

  // Persistence
  loadHighScores() {
    try {
      const data = localStorage.getItem('neon-bomber-save');
      if (data) {
        const save = JSON.parse(data);
        this.bestScore = save.bestScore || 0;
        this.totalScore = save.totalScore || 0;
        this.totalGames = save.totalGames || 0;
        this.totalEnemiesKilled = save.totalEnemiesKilled || 0;
        this.totalBlocksDestroyed = save.totalBlocksDestroyed || 0;
        this.totalPowerUpsCollected = save.totalPowerUpsCollected || 0;
        this.totalBombsPlaced = save.totalBombsPlaced || 0;
        this.perfectClears = save.perfectClears || 0;
        this.maxCombo = save.maxCombo || 0;
        this.longestSurvivalTime = save.longestSurvivalTime || 0;
        this.fastestLevelClear = save.fastestLevelClear || 9999;
        this.achievements = save.achievements || [];
        this.difficulty = save.difficulty ?? 1;
        this.themeIndex = save.themeIndex ?? 0;
        this.sfxVolume = save.sfxVolume ?? 0.7;
      }
    } catch { /* localStorage may not be available */ }
  }

  saveHighScores() {
    try {
      const save = {
        bestScore: this.bestScore,
        totalScore: this.totalScore,
        totalGames: this.totalGames,
        totalEnemiesKilled: this.totalEnemiesKilled,
        totalBlocksDestroyed: this.totalBlocksDestroyed,
        totalPowerUpsCollected: this.totalPowerUpsCollected,
        totalBombsPlaced: this.totalBombsPlaced,
        perfectClears: this.perfectClears,
        maxCombo: this.maxCombo,
        longestSurvivalTime: this.longestSurvivalTime,
        fastestLevelClear: this.fastestLevelClear,
        achievements: this.achievements,
        difficulty: this.difficulty,
        themeIndex: this.themeIndex,
        sfxVolume: this.sfxVolume,
      };
      localStorage.setItem('neon-bomber-save', JSON.stringify(save));
    } catch { /* localStorage may not be available */ }
  }

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

  initPuzzleGrid(puzzleIndex: number) {
    const puzzle = PUZZLE_LEVELS[puzzleIndex % PUZZLE_LEVELS.length];
    this.puzzleHint = puzzle.hint;

    this.grid = [];
    for (let y = 0; y < GRID_H; y++) {
      this.grid[y] = [];
      for (let x = 0; x < GRID_W; x++) {
        if (x % 2 === 0 && y % 2 === 0) {
          this.grid[y][x] = CellType.HardBlock;
        } else {
          this.grid[y][x] = CellType.Empty;
        }
      }
    }

    // Border walls
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
          this.grid[y][x] = CellType.HardBlock;
        }
      }
    }

    // Place puzzle soft blocks
    for (const [bx, by] of puzzle.softBlocks) {
      if (bx >= 0 && bx < GRID_W && by >= 0 && by < GRID_H && this.grid[by][bx] === CellType.Empty) {
        this.grid[by][bx] = CellType.SoftBlock;
      }
    }

    // Spawn puzzle enemies
    this.enemies = [];
    for (const eData of puzzle.enemies) {
      this.enemies.push({
        x: eData.x, y: eData.y,
        targetX: eData.x, targetY: eData.y,
        moveTimer: 0,
        moveSpeed: 0.8 + this.difficulty * 0.2,
        alive: true,
        type: eData.type,
        visualX: eData.x, visualY: eData.y,
        bombCooldown: 0,
        patrolDir: 0,
        teleportCooldown: 5,
        hp: eData.type === 'teleporter' ? 2 : 1,
      });
    }

    // Place puzzle power-ups
    this.powerUps = [];
    for (const puData of puzzle.powerUps) {
      this.powerUps.push({
        x: puData.x, y: puData.y,
        type: puData.type,
        collected: false,
      });
      this.grid[puData.y][puData.x] = CellType.PowerUp;
    }

    // Set puzzle constraints
    this.maxBombs = puzzle.maxBombs;
    this.blastRange = puzzle.blastRange;
    this.timeLimit = puzzle.timeLimit;

    // Exit position (hidden under last soft block, or placed at exit if no blocks above it)
    this.exitX = puzzle.exitPos[0];
    this.exitY = puzzle.exitPos[1];
    this.exitRevealed = false;

    // Clear player spawn area
    for (const [cx, cy] of [[1, 1], [2, 1], [1, 2]]) {
      if (this.grid[cy][cx] === CellType.SoftBlock) {
        this.grid[cy][cx] = CellType.Empty;
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
      { x: 3, y: 1 },
      { x: GRID_W - 4, y: GRID_H - 2 },
    ];

    const types: Array<EnemyData['type']> = ['wander', 'chase', 'bomber', 'patrol', 'teleporter'];
    for (let i = 0; i < Math.min(count, spawns.length); i++) {
      const sp = spawns[i];
      // Introduce patrol/teleporter in later levels
      let type: EnemyData['type'];
      if (this.level <= 2) {
        type = types[i % 3]; // wander, chase, bomber only
      } else if (this.level <= 4) {
        type = types[i % 4]; // add patrol
      } else {
        type = types[i % 5]; // all types
      }
      const speedBase = 0.8 + this.difficulty * 0.3;
      const speedMod = type === 'chase' ? 0.3 : type === 'patrol' ? 0.1 : type === 'teleporter' ? -0.2 : 0;
      this.enemies.push({
        x: sp.x, y: sp.y,
        targetX: sp.x, targetY: sp.y,
        moveTimer: 0,
        moveSpeed: speedBase + speedMod,
        alive: true,
        type,
        visualX: sp.x, visualY: sp.y,
        bombCooldown: 0,
        patrolDir: 0,
        teleportCooldown: 6 + Math.random() * 4,
        hp: type === 'teleporter' ? 2 : 1,
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
    this.timeLimit = mode === GameMode.Timed ? 120 : mode === GameMode.Puzzle ? 90 : 9999;
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
    this.exitX = -1;
    this.exitY = -1;
    this.exitRevealed = false;
    this.puzzleHint = '';
    this.totalGames++;

    this.playerX = 1;
    this.playerY = 1;
    this.playerVisualX = 1;
    this.playerVisualY = 1;
    this.playerMoveTimer = 0;

    if (mode === GameMode.Puzzle) {
      this.initPuzzleGrid(0);
    } else {
      this.initGrid();
      this.spawnEnemies();
    }

    this.saveHighScores();
  }

  beginLevelTransition() {
    this.state = GameState.LevelTransition;
    this.transitionTimer = this.transitionDuration;
  }

  nextLevel() {
    this.level++;
    this.bombs = [];
    this.explosions = [];
    this.activeBombs = 0;
    this.playerX = 1;
    this.playerY = 1;
    this.playerVisualX = 1;
    this.playerVisualY = 1;
    this.playerMoveTimer = 0;
    this.exitX = -1;
    this.exitY = -1;
    this.exitRevealed = false;

    if (this.mode === GameMode.Puzzle) {
      // Keep existing power-up states but reset placement
      this.powerUps = [];
      this.initPuzzleGrid(this.level - 1);
    } else {
      this.powerUps = [];
      this.initGrid();
      this.spawnEnemies();
    }

    // Level bonus
    this.score += this.level * 500;

    // Track fastest clear
    if (this.timeElapsed < this.fastestLevelClear) {
      this.fastestLevelClear = this.timeElapsed;
    }

    this.checkAchievements();
    this.state = GameState.Playing;
  }

  canMove(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
    const cell = this.grid[y][x];
    if (cell === CellType.HardBlock) return false;
    if (cell === CellType.SoftBlock && !this.hasPassThrough) return false;
    if (cell === CellType.Bomb) return false;
    return true;
  }

  movePlayer(dx: number, dy: number, _delta: number): boolean {
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

    // Check puzzle exit
    if (this.mode === GameMode.Puzzle && this.exitRevealed && nx === this.exitX && ny === this.exitY) {
      if (this.enemies.every(e => !e.alive)) {
        this.beginLevelTransition();
        return true;
      }
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
    this.totalBombsPlaced++;
    return true;
  }

  detonateRemote() {
    const remote = this.bombs.find(b => b.remote && b.owner === 'player');
    if (remote) {
      remote.timer = 0;
    }
  }

  update(delta: number): {
    exploded: BombData[];
    destroyed: Array<{ x: number; y: number }>;
    powerUpsSpawned: PowerUpData[];
    enemiesHit: EnemyData[];
    playerHit: boolean;
    levelComplete: boolean;
    exitRevealedNow: boolean;
    enemyTeleported: EnemyData | null;
  } {
    const result = {
      exploded: [] as BombData[],
      destroyed: [] as Array<{ x: number; y: number }>,
      powerUpsSpawned: [] as PowerUpData[],
      enemiesHit: [] as EnemyData[],
      playerHit: false,
      levelComplete: false,
      exitRevealedNow: false,
      enemyTeleported: null as EnemyData | null,
    };

    if (this.state === GameState.LevelTransition) {
      this.transitionTimer -= delta;
      if (this.transitionTimer <= 0) {
        this.nextLevel();
      }
      return result;
    }

    if (this.state !== GameState.Playing) return result;

    this.timeElapsed += delta;
    if (this.playerMoveTimer > 0) this.playerMoveTimer -= delta;
    if (this.shieldTimer > 0) this.shieldTimer -= delta;
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Track survival time
    if (this.mode === GameMode.Survival && this.timeElapsed > this.longestSurvivalTime) {
      this.longestSurvivalTime = this.timeElapsed;
    }

    // Timed mode check
    if ((this.mode === GameMode.Timed || this.mode === GameMode.Puzzle) && this.timeElapsed >= this.timeLimit) {
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

    // Check exit reveal for puzzle mode
    if (this.mode === GameMode.Puzzle && !this.exitRevealed && this.exitX >= 0) {
      // Reveal exit when the cell at exit position is cleared
      if (this.grid[this.exitY][this.exitX] === CellType.Empty) {
        this.exitRevealed = true;
        this.grid[this.exitY][this.exitX] = CellType.Exit;
        result.exitRevealedNow = true;
      }
    }

    // Check level complete
    const allDead = this.enemies.every(e => !e.alive);
    if (allDead) {
      if (this.mode === GameMode.Puzzle) {
        // In puzzle mode, must reach exit
        if (this.exitRevealed && this.playerX === this.exitX && this.playerY === this.exitY) {
          result.levelComplete = true;
          if (this.level >= PUZZLE_LEVELS.length) {
            this.state = GameState.Victory;
            this.score += 10000;
          } else {
            this.beginLevelTransition();
          }
        }
        // else: wait for player to reach exit
      } else if (this.mode === GameMode.Survival) {
        this.beginLevelTransition();
      } else {
        result.levelComplete = true;
        if (this.level >= 5 + this.difficulty * 2) {
          this.state = GameState.Victory;
          this.score += 5000;
        } else {
          this.beginLevelTransition();
        }
      }
    }

    return result;
  }

  private explodeBomb(bomb: BombData, result: { destroyed: Array<{ x: number; y: number }>; powerUpsSpawned: PowerUpData[]; enemiesHit: EnemyData[]; playerHit: boolean; exitRevealedNow: boolean }) {
    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const explosionCells: Array<{ x: number; y: number }> = [];

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
          this.totalBlocksDestroyed++;
          this.score += 10;
          this.comboCount++;
          this.comboTimer = 2.0;
          if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

          // Check if this reveals the exit in puzzle mode
          if (this.mode === GameMode.Puzzle && ex === this.exitX && ey === this.exitY) {
            // Will be revealed after explosion clears
          }

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
          this.playerX = 1;
          this.playerY = 1;
          this.playerVisualX = 1;
          this.playerVisualY = 1;
          this.shieldTimer = 3.0;
          this.hasShield = true;
        }
      }
    }

    // Check enemies hit
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const eex = Math.round(enemy.visualX);
      const eey = Math.round(enemy.visualY);
      if (explosionCells.some(c => c.x === eex && c.y === eey)) {
        enemy.hp--;
        if (enemy.hp <= 0) {
          enemy.alive = false;
          this.enemiesKilled++;
          this.totalEnemiesKilled++;
          const baseScore = enemy.type === 'bomber' ? 300 :
            enemy.type === 'chase' ? 200 :
            enemy.type === 'teleporter' ? 400 :
            enemy.type === 'patrol' ? 250 : 100;
          this.score += baseScore * (1 + this.comboCount * 0.5);
          this.comboCount++;
          this.comboTimer = 2.0;
          result.enemiesHit.push(enemy);
        }
      }
    }

    this.score += this.comboCount > 1 ? this.comboCount * 50 : 0;
    this.checkAchievements();
  }

  private updateEnemies(delta: number, result: { enemiesHit: EnemyData[]; playerHit: boolean; enemyTeleported: EnemyData | null }) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      enemy.moveTimer -= delta;
      if (enemy.bombCooldown > 0) enemy.bombCooldown -= delta;

      // Interpolate visual position
      enemy.visualX += (enemy.x - enemy.visualX) * Math.min(1, 8 * delta);
      enemy.visualY += (enemy.y - enemy.visualY) * Math.min(1, 8 * delta);

      // Teleporter logic
      if (enemy.type === 'teleporter') {
        enemy.teleportCooldown -= delta;
        if (enemy.teleportCooldown <= 0) {
          this.teleportEnemy(enemy);
          enemy.teleportCooldown = 5 + Math.random() * 5;
          result.enemyTeleported = enemy;
        }
      }

      if (enemy.moveTimer <= 0) {
        enemy.moveTimer = 1.0 / enemy.moveSpeed;

        if (enemy.type === 'chase') {
          this.chaseMoveEnemy(enemy);
        } else if (enemy.type === 'bomber') {
          this.randomMoveEnemy(enemy);
          if (enemy.bombCooldown <= 0 && Math.random() < 0.3) {
            this.placeEnemyBomb(enemy);
            enemy.bombCooldown = 4.0;
          }
        } else if (enemy.type === 'patrol') {
          this.patrolMoveEnemy(enemy);
        } else if (enemy.type === 'teleporter') {
          // Teleporters chase slowly
          if (Math.random() < 0.6) {
            this.chaseMoveEnemy(enemy);
          } else {
            this.randomMoveEnemy(enemy);
          }
        } else {
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

  private chaseMoveEnemy(enemy: EnemyData) {
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
      this.randomMoveEnemy(enemy);
    }
  }

  private patrolMoveEnemy(enemy: EnemyData) {
    // Patrols follow walls, changing direction when blocked
    const dirMap: Array<[number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const [dx, dy] = dirMap[enemy.patrolDir % 4];
    const nx = enemy.x + dx;
    const ny = enemy.y + dy;

    if (this.canMoveEnemy(nx, ny)) {
      enemy.x = nx;
      enemy.y = ny;
    } else {
      // Turn clockwise
      enemy.patrolDir = (enemy.patrolDir + 1) % 4;
      const [dx2, dy2] = dirMap[enemy.patrolDir];
      const nx2 = enemy.x + dx2;
      const ny2 = enemy.y + dy2;
      if (this.canMoveEnemy(nx2, ny2)) {
        enemy.x = nx2;
        enemy.y = ny2;
      } else {
        // Turn again or stay
        enemy.patrolDir = (enemy.patrolDir + 1) % 4;
      }
    }
  }

  private teleportEnemy(enemy: EnemyData) {
    // Find a random empty cell to teleport to
    const empties: Array<[number, number]> = [];
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        if (this.grid[y][x] === CellType.Empty) {
          // Don't teleport next to player (at least 3 cells away)
          const dist = Math.abs(x - this.playerX) + Math.abs(y - this.playerY);
          if (dist >= 3) {
            empties.push([x, y]);
          }
        }
      }
    }
    if (empties.length > 0) {
      const [tx, ty] = empties[Math.floor(Math.random() * empties.length)];
      enemy.x = tx;
      enemy.y = ty;
      enemy.visualX = tx;
      enemy.visualY = ty;
    }
  }

  private canMoveEnemy(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
    const cell = this.grid[y][x];
    return cell === CellType.Empty || cell === CellType.PowerUp || cell === CellType.Exit;
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
    this.totalPowerUpsCollected++;

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
    this.saveHighScores();
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
      // New achievements
      { id: 'kill_teleporter', name: 'Phase Shifter', cond: () => this.enemies.some(e => !e.alive && e.type === 'teleporter') },
      { id: 'kill_patrol', name: 'Route Breaker', cond: () => this.enemies.some(e => !e.alive && e.type === 'patrol') },
      { id: 'puzzle_complete', name: 'Puzzle Master', cond: () => this.mode === GameMode.Puzzle && this.state === GameState.Victory },
      { id: 'bombs_100', name: 'Bomb Happy', cond: () => this.totalBombsPlaced >= 100 },
      { id: 'powerups_20', name: 'Collector', cond: () => this.totalPowerUpsCollected >= 20 },
      { id: 'survive_10min', name: 'Endurance Runner', cond: () => this.timeElapsed >= 600 },
      { id: 'combo_15', name: 'Combo Freak', cond: () => this.maxCombo >= 15 },
      { id: 'level_15', name: 'Legend', cond: () => this.level >= 15 },
      { id: 'blocks_1000', name: 'Total Destruction', cond: () => this.totalBlocksDestroyed >= 1000 },
      { id: 'fast_clear', name: 'Speedster', cond: () => this.fastestLevelClear < 30 },
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
      kill_teleporter: 'Phase Shifter', kill_patrol: 'Route Breaker',
      puzzle_complete: 'Puzzle Master', bombs_100: 'Bomb Happy', powerups_20: 'Collector',
      survive_10min: 'Endurance Runner', combo_15: 'Combo Freak', level_15: 'Legend',
      blocks_1000: 'Total Destruction', fast_clear: 'Speedster',
    };
    return names[id] || id;
  }

  get totalAchievementCount() { return 50; }

  getEnemyCountForNextLevel(): number {
    return 2 + (this.level + 1) + this.difficulty;
  }
}
