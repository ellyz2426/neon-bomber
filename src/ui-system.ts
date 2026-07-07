import {
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
  Entity,
  Follower,
} from '@iwsdk/core';
import { GameManager, GameState, GameMode } from './game';
import { GameSystem } from './game-system';

const getDoc = (e: Entity) =>
  e.getValue(PanelDocument, 'document') as UIKitDocument | undefined;

const setText = (doc: UIKitDocument | undefined, id: string, text: string) =>
  (doc?.getElementById(id) as any)?.setProperties({ text });

const setColor = (doc: UIKitDocument | undefined, id: string, color: string) =>
  (doc?.getElementById(id) as any)?.setProperties({ color });

const onClick = (doc: UIKitDocument, id: string, cb: () => void) => {
  const el = doc.getElementById(id) as any;
  el?.addEventListener('click', cb);
};

export class GameUISystem extends createSystem({
  hud: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/hud.json')],
  },
  menu: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/menu.json')],
  },
  gameover: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/gameover.json')],
  },
  settings: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/settings.json')],
  },
  pause: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/pause.json')],
  },
  achievements: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/achvmts.json')],
  },
  powerups: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/powerups.json')],
  },
  transition: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/leveltransition.json')],
  },
  howto: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/howto.json')],
  },
  achNotify: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/achnotify.json')],
  },
  stats: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/stats.json')],
  },
}) {
  private game!: GameManager;
  private gameSystem!: GameSystem;
  private hudEntity!: Entity;
  private menuEntity!: Entity;
  private gameoverEntity!: Entity;
  private settingsEntity!: Entity;
  private pauseEntity!: Entity;
  private achievementsEntity!: Entity;
  private powerupsEntity!: Entity;
  private transitionEntity!: Entity;
  private howtoEntity!: Entity;
  private achNotifyEntity!: Entity;
  private statsEntity!: Entity;

  private hudDoc: UIKitDocument | null = null;
  private menuDoc: UIKitDocument | null = null;
  private gameoverDoc: UIKitDocument | null = null;
  private settingsDoc: UIKitDocument | null = null;
  private pauseDoc: UIKitDocument | null = null;
  private achievementsDoc: UIKitDocument | null = null;
  private powerupsDoc: UIKitDocument | null = null;
  private transitionDoc: UIKitDocument | null = null;
  private howtoDoc: UIKitDocument | null = null;
  private achNotifyDoc: UIKitDocument | null = null;
  private statsDoc: UIKitDocument | null = null;

  private lastState: GameState = GameState.Menu;
  private lastCombo = 0;
  private lastMultiplier = 1;

  setRefs(refs: { game: GameManager; gameSystem: GameSystem }) {
    this.game = refs.game;
    this.gameSystem = refs.gameSystem;
  }

  setPanelEntities(
    hud: Entity, menu: Entity, gameover: Entity, settings: Entity,
    pause: Entity, achievements: Entity, powerups: Entity, transition: Entity,
    howto: Entity, achNotify: Entity, stats: Entity
  ) {
    this.hudEntity = hud;
    this.menuEntity = menu;
    this.gameoverEntity = gameover;
    this.settingsEntity = settings;
    this.pauseEntity = pause;
    this.achievementsEntity = achievements;
    this.powerupsEntity = powerups;
    this.transitionEntity = transition;
    this.howtoEntity = howto;
    this.achNotifyEntity = achNotify;
    this.statsEntity = stats;
  }

  init() {
    this.queries.hud.subscribe('qualify', (entity) => {
      this.hudDoc = getDoc(entity) || null;
    });

    this.queries.menu.subscribe('qualify', (entity) => {
      this.menuDoc = getDoc(entity) || null;
      if (this.menuDoc) this.wireMenuButtons();
    });

    this.queries.gameover.subscribe('qualify', (entity) => {
      this.gameoverDoc = getDoc(entity) || null;
      if (this.gameoverDoc) this.wireGameoverButtons();
    });

    this.queries.settings.subscribe('qualify', (entity) => {
      this.settingsDoc = getDoc(entity) || null;
      if (this.settingsDoc) this.wireSettingsButtons();
    });

    this.queries.pause.subscribe('qualify', (entity) => {
      this.pauseDoc = getDoc(entity) || null;
      if (this.pauseDoc) this.wirePauseButtons();
    });

    this.queries.achievements.subscribe('qualify', (entity) => {
      this.achievementsDoc = getDoc(entity) || null;
      if (this.achievementsDoc) this.wireAchievementsButtons();
    });

    this.queries.powerups.subscribe('qualify', (entity) => {
      this.powerupsDoc = getDoc(entity) || null;
    });

    this.queries.transition.subscribe('qualify', (entity) => {
      this.transitionDoc = getDoc(entity) || null;
    });

    this.queries.howto.subscribe('qualify', (entity) => {
      this.howtoDoc = getDoc(entity) || null;
      if (this.howtoDoc) this.wireHowtoButtons();
    });

    this.queries.achNotify.subscribe('qualify', (entity) => {
      this.achNotifyDoc = getDoc(entity) || null;
    });

    this.queries.stats.subscribe('qualify', (entity) => {
      this.statsDoc = getDoc(entity) || null;
      if (this.statsDoc) this.wireStatsButtons();
    });
  }

  private wireMenuButtons() {
    const doc = this.menuDoc!;

    onClick(doc, 'btn-classic', () => {
      this.game.startGame(GameMode.Classic);
      this.gameSystem.showGame();
      this.gameSystem.applyTheme();
      this.showPanel('playing');
    });

    onClick(doc, 'btn-timed', () => {
      this.game.startGame(GameMode.Timed);
      this.gameSystem.showGame();
      this.gameSystem.applyTheme();
      this.showPanel('playing');
    });

    onClick(doc, 'btn-survival', () => {
      this.game.startGame(GameMode.Survival);
      this.gameSystem.showGame();
      this.gameSystem.applyTheme();
      this.showPanel('playing');
    });

    onClick(doc, 'btn-puzzle', () => {
      this.game.startGame(GameMode.Puzzle);
      this.gameSystem.showGame();
      this.gameSystem.applyTheme();
      this.showPanel('playing');
    });

    onClick(doc, 'btn-endless', () => {
      this.game.startGame(GameMode.Endless);
      this.gameSystem.showGame();
      this.gameSystem.applyTheme();
      this.showPanel('playing');
    });

    onClick(doc, 'btn-settings', () => {
      this.showPanel('settings');
    });

    onClick(doc, 'btn-menu-ach', () => {
      this.updateAchievementsDisplay();
      this.showPanel('achievements');
    });

    onClick(doc, 'btn-howto', () => {
      this.showPanel('howto');
    });

    onClick(doc, 'btn-stats', () => {
      this.updateStatsDisplay();
      this.showPanel('stats');
    });
  }

  private wireGameoverButtons() {
    const doc = this.gameoverDoc!;

    onClick(doc, 'btn-retry', () => {
      this.game.startGame(this.game.mode);
      this.gameSystem.showGame();
      this.showPanel('playing');
    });

    onClick(doc, 'btn-menu', () => {
      this.game.state = GameState.Menu;
      this.gameSystem.hideGame();
      this.showPanel('menu');
    });
  }

  private wireSettingsButtons() {
    const doc = this.settingsDoc!;

    onClick(doc, 'btn-back', () => {
      this.showPanel('menu');
    });

    onClick(doc, 'btn-easy', () => {
      this.game.difficulty = 0;
      this.updateSettingsDisplay();
    });

    onClick(doc, 'btn-normal', () => {
      this.game.difficulty = 1;
      this.updateSettingsDisplay();
    });

    onClick(doc, 'btn-hard', () => {
      this.game.difficulty = 2;
      this.updateSettingsDisplay();
    });

    for (let i = 0; i < this.game.themes.length; i++) {
      onClick(doc, `btn-theme-${i}`, () => {
        this.game.themeIndex = i;
        this.gameSystem.applyTheme();
        this.updateSettingsDisplay();
      });
    }
  }

  private wirePauseButtons() {
    const doc = this.pauseDoc!;

    onClick(doc, 'btn-resume', () => {
      this.game.state = GameState.Playing;
      this.showPanel('playing');
    });

    onClick(doc, 'btn-achievements', () => {
      this.updateAchievementsDisplay();
      this.showPanel('achievements');
    });

    onClick(doc, 'btn-quit', () => {
      this.game.state = GameState.Menu;
      this.gameSystem.hideGame();
      this.showPanel('menu');
    });
  }

  private wireAchievementsButtons() {
    const doc = this.achievementsDoc!;

    onClick(doc, 'btn-ach-back', () => {
      if (this.game.state === GameState.Paused) {
        this.showPanel('pause');
      } else {
        this.showPanel('menu');
      }
    });
  }

  private wireHowtoButtons() {
    const doc = this.howtoDoc!;
    onClick(doc, 'btn-howto-back', () => {
      this.showPanel('menu');
    });
  }

  private wireStatsButtons() {
    const doc = this.statsDoc!;
    onClick(doc, 'btn-stats-back', () => {
      this.showPanel('menu');
    });
  }

  private updateStatsDisplay() {
    if (!this.statsDoc) return;
    const doc = this.statsDoc;
    setText(doc, 'stat-games', `Games Played: ${this.game.totalGames}`);
    setText(doc, 'stat-best', `Best Score: ${Math.floor(this.game.bestScore)}`);
    setText(doc, 'stat-total', `Total Score: ${Math.floor(this.game.totalScore)}`);
    setText(doc, 'stat-kills', `Enemies Killed: ${this.game.totalEnemiesKilled}`);
    setText(doc, 'stat-blocks', `Blocks Destroyed: ${this.game.totalBlocksDestroyed}`);
    setText(doc, 'stat-bombs', `Bombs Placed: ${this.game.totalBombsPlaced}`);
    setText(doc, 'stat-powerups', `Power-Ups Collected: ${this.game.totalPowerUpsCollected}`);
    setText(doc, 'stat-combos', `Best Combo: ${this.game.maxCombo}`);
    setText(doc, 'stat-perfects', `Perfect Clears: ${this.game.perfectClears}`);
    const survMin = Math.floor(this.game.longestSurvivalTime / 60);
    const survSec = Math.floor(this.game.longestSurvivalTime % 60);
    setText(doc, 'stat-survival', `Longest Survival: ${survMin}:${survSec.toString().padStart(2, '0')}`);
    if (this.game.fastestLevelClear < 9999) {
      const fastSec = Math.floor(this.game.fastestLevelClear);
      setText(doc, 'stat-fastest', `Fastest Clear: ${fastSec}s`);
    } else {
      setText(doc, 'stat-fastest', 'Fastest Clear: --');
    }
    setText(doc, 'stat-achievements', `Achievements: ${this.game.achievements.length}/${this.game.totalAchievementCount}`);

    // Per-mode scores
    const modes = ['Classic', 'Timed', 'Survival', 'Puzzle', 'Endless'];
    const keys = ['stat-classic', 'stat-timed', 'stat-survival-mode', 'stat-puzzle', 'stat-endless'];
    for (let i = 0; i < modes.length; i++) {
      const best = this.game.modeBestScores[modes[i]];
      setText(doc, keys[i], `${modes[i]}: ${best ? Math.floor(best) : '--'}`);
    }
  }

  private updateSettingsDisplay() {
    if (!this.settingsDoc) return;
    const diffNames = ['Easy', 'Normal', 'Hard'];
    setText(this.settingsDoc, 'diff-label', `Difficulty: ${diffNames[this.game.difficulty]}`);
    setText(this.settingsDoc, 'theme-label', `Theme: ${this.game.currentTheme.name}`);
    this.game.saveHighScores();
  }

  private updateAchievementsDisplay() {
    if (!this.achievementsDoc) return;
    const doc = this.achievementsDoc;
    setText(doc, 'ach-count', `${this.game.achievements.length} / ${this.game.totalAchievementCount} Unlocked`);

    // Show achievements in lines
    const allAchIds = Object.keys({
      first_blood: 1, bomber_10: 1, combo_3: 1, combo_5: 1, combo_10: 1,
      score_5k: 1, score_10k: 1, score_50k: 1, level_3: 1, level_5: 1, level_10: 1,
      kill_10: 1, kill_50: 1, kill_100: 1, perfect: 1, games_10: 1,
      speed_max: 1, bombs_max: 1, range_max: 1, all_powerups: 1,
      survive_5min: 1, no_damage_level: 1, blocks_100: 1, blocks_500: 1,
      enemy_bomber: 1, hard_complete: 1, timed_win: 1, survival_l5: 1,
      survival_l10: 1, total_50k: 1, chain_bomb: 1, shield_save: 1,
      remote_kill: 1, passthrough: 1, max_power: 1, quick_clear: 1,
      bomb_chain_3: 1, no_bombs_die: 1, play_all_modes: 1, score_100k: 1,
      kill_teleporter: 1, kill_patrol: 1, puzzle_complete: 1, bombs_100: 1,
      powerups_20: 1, survive_10min: 1, combo_15: 1, level_15: 1,
      blocks_1000: 1, fast_clear: 1,
    });

    for (let i = 0; i < 12; i++) {
      const achId = allAchIds[i];
      if (achId) {
        const unlocked = this.game.achievements.includes(achId);
        const name = this.game.getAchievementName(achId);
        const prefix = unlocked ? '[*] ' : '[ ] ';
        setText(doc, `ach-line-${i}`, prefix + name);
        setColor(doc, `ach-line-${i}`, unlocked ? '#00ff88' : '#446688');
      } else {
        setText(doc, `ach-line-${i}`, '');
      }
    }

    setText(doc, 'ach-stats', `Games: ${this.game.totalGames} -- Best: ${Math.floor(this.game.bestScore)} -- Total Kills: ${this.game.totalEnemiesKilled}`);
  }

  private showPanel(state: 'menu' | 'playing' | 'gameover' | 'settings' | 'victory' | 'pause' | 'achievements' | 'transition' | 'howto' | 'stats') {
    if (this.menuEntity) this.menuEntity.object3D!.visible = state === 'menu';
    if (this.gameoverEntity) this.gameoverEntity.object3D!.visible = state === 'gameover' || state === 'victory';
    if (this.settingsEntity) this.settingsEntity.object3D!.visible = state === 'settings';
    if (this.hudEntity) this.hudEntity.object3D!.visible = state === 'playing';
    if (this.pauseEntity) this.pauseEntity.object3D!.visible = state === 'pause';
    if (this.achievementsEntity) this.achievementsEntity.object3D!.visible = state === 'achievements';
    if (this.powerupsEntity) this.powerupsEntity.object3D!.visible = state === 'playing';
    if (this.transitionEntity) this.transitionEntity.object3D!.visible = state === 'transition';
    if (this.howtoEntity) this.howtoEntity.object3D!.visible = state === 'howto';
    if (this.statsEntity) this.statsEntity.object3D!.visible = state === 'stats';
  }

  update(delta: number, time: number) {
    if (this.game.state !== this.lastState) {
      this.onStateChange(this.lastState, this.game.state);
      this.lastState = this.game.state;
    }

    if (this.game.state === GameState.Playing) {
      if (this.hudDoc) this.updateHUD();
      if (this.powerupsDoc) this.updatePowerUpsHUD();

      // Achievement notifications
      if (this.game.achievementNotifications.length > 0 && this.achNotifyDoc) {
        const notif = this.game.achievementNotifications[0];
        setText(this.achNotifyDoc, 'ach-name', notif.name);
        if (this.achNotifyEntity) {
          this.achNotifyEntity.object3D!.visible = true;
        }
        this.gameSystem.playAchievementSound();
      } else if (this.achNotifyEntity) {
        this.achNotifyEntity.object3D!.visible = false;
      }

      // Combo sound
      if (this.game.comboCount > this.lastCombo && this.game.comboCount > 1) {
        this.gameSystem.playComboSound(this.game.comboCount);
      }
      this.lastCombo = this.game.comboCount;

      // Multiplier sound
      if (this.game.multiplier > this.lastMultiplier) {
        this.gameSystem.playMultiplierSound(this.game.multiplier);
      }
      this.lastMultiplier = this.game.multiplier;
    }

    if (this.game.state === GameState.Paused) {
      if (this.input.keyboard.getKeyDown('Escape')) {
        this.game.state = GameState.Playing;
        this.showPanel('playing');
      }
    }

    if (this.game.state === GameState.LevelTransition) {
      if (this.transitionDoc) {
        this.updateTransitionDisplay();
      }
    }
  }

  private onStateChange(from: GameState, to: GameState) {
    if (to === GameState.GameOver) {
      this.showPanel('gameover');
      this.updateGameoverDisplay(false);
      this.gameSystem.playDeathSound();
    } else if (to === GameState.Victory) {
      this.showPanel('victory');
      this.updateGameoverDisplay(true);
      this.gameSystem.playVictorySound();
      this.game.saveHighScores();
    } else if (to === GameState.Paused) {
      this.showPanel('pause');
      this.updatePauseDisplay();
    } else if (to === GameState.Menu) {
      this.showPanel('menu');
      this.game.saveHighScores();
    } else if (to === GameState.LevelTransition) {
      this.showPanel('transition');
      this.updateTransitionDisplay();
      this.gameSystem.playLevelCompleteSound();
    } else if (to === GameState.Playing && from === GameState.LevelTransition) {
      this.showPanel('playing');
    }
  }

  private updateHUD() {
    if (!this.hudDoc) return;
    setText(this.hudDoc, 'score', `Score: ${Math.floor(this.game.score)}`);
    setText(this.hudDoc, 'lives', `Lives: ${this.game.lives}`);

    if (this.game.mode === GameMode.Endless) {
      setText(this.hudDoc, 'level', `Wave ${this.game.endlessWave}`);
    } else {
      setText(this.hudDoc, 'level', `Lv ${this.game.level}`);
    }

    if (this.game.mode === GameMode.Timed || this.game.mode === GameMode.Puzzle) {
      const remaining = Math.max(0, this.game.timeLimit - this.game.timeElapsed);
      const min = Math.floor(remaining / 60);
      const sec = Math.floor(remaining % 60);
      setText(this.hudDoc, 'timer', `${min}:${sec.toString().padStart(2, '0')}`);
      // Color warning
      if (remaining < 30) {
        setColor(this.hudDoc, 'timer', '#ff4444');
      } else if (remaining < 60) {
        setColor(this.hudDoc, 'timer', '#ffcc00');
      } else {
        setColor(this.hudDoc, 'timer', '#88ccff');
      }
    } else if (this.game.mode === GameMode.Endless) {
      // Show wave timer
      const remaining = Math.max(0, this.game.endlessWaveTimer);
      const sec = Math.floor(remaining);
      setText(this.hudDoc, 'timer', `${sec}s`);
      if (remaining < 10) {
        setColor(this.hudDoc, 'timer', '#ff4444');
      } else {
        setColor(this.hudDoc, 'timer', '#88ccff');
      }
    } else {
      const min = Math.floor(this.game.timeElapsed / 60);
      const sec = Math.floor(this.game.timeElapsed % 60);
      setText(this.hudDoc, 'timer', `${min}:${sec.toString().padStart(2, '0')}`);
    }

    if (this.game.comboCount > 1) {
      setText(this.hudDoc, 'combo', `x${this.game.comboCount} COMBO`);
    } else {
      setText(this.hudDoc, 'combo', '');
    }

    if (this.game.multiplier > 1) {
      setText(this.hudDoc, 'multiplier', `x${this.game.multiplier} MULTI`);
    } else {
      setText(this.hudDoc, 'multiplier', '');
    }

    // Boss HP indicator
    const boss = this.game.enemies.find(e => e.isBoss && e.alive);
    if (boss) {
      const hpPct = Math.round((boss.hp / boss.maxHp) * 100);
      const phaseNames = ['', ' [ENRAGED]', ' [DESPERATE]'];
      setText(this.hudDoc, 'boss-hp', `BOSS ${hpPct}%${phaseNames[boss.bossPhase] || ''}`);
      setColor(this.hudDoc, 'boss-hp', hpPct > 50 ? '#ffcc00' : hpPct > 25 ? '#ff8800' : '#ff0000');
    } else {
      setText(this.hudDoc, 'boss-hp', '');
    }
  }

  private updatePowerUpsHUD() {
    if (!this.powerupsDoc) return;
    setText(this.powerupsDoc, 'pu-bombs', `B:${this.game.maxBombs}`);
    setText(this.powerupsDoc, 'pu-range', `R:${this.game.blastRange}`);
    setText(this.powerupsDoc, 'pu-speed', `S:${this.game.speed.toFixed(1)}`);
    setColor(this.powerupsDoc, 'pu-pass', this.game.hasPassThrough ? '#8888ff' : '#555555');
    setColor(this.powerupsDoc, 'pu-remote', this.game.hasRemoteDetonate ? '#ff00ff' : '#555555');
    const shieldActive = this.game.hasShield && this.game.shieldTimer > 0;
    setColor(this.powerupsDoc, 'pu-shield', shieldActive ? '#00ffff' : '#555555');
    setColor(this.powerupsDoc, 'pu-kick', this.game.hasBombKick ? '#ff6644' : '#555555');
    setColor(this.powerupsDoc, 'pu-freeze', this.game.hasTimeFreeze ? '#4488ff' : '#555555');
    setColor(this.powerupsDoc, 'pu-magnet', this.game.hasMagnet ? '#ff88ff' : '#555555');
  }

  private updatePauseDisplay() {
    if (!this.pauseDoc) return;
    setText(this.pauseDoc, 'pause-score', `Score: ${Math.floor(this.game.score)}`);
    setText(this.pauseDoc, 'pause-level', `Level ${this.game.level}`);
    const min = Math.floor(this.game.timeElapsed / 60);
    const sec = Math.floor(this.game.timeElapsed % 60);
    setText(this.pauseDoc, 'pause-time', `${min}:${sec.toString().padStart(2, '0')}`);
  }

  private updateTransitionDisplay() {
    if (!this.transitionDoc) return;
    setText(this.transitionDoc, 'transition-text', `LEVEL ${this.game.level + 1}`);
    setText(this.transitionDoc, 'transition-bonus', `+${(this.game.level + 1) * 500} Level Bonus`);
    const enemyCount = this.game.getEnemyCountForNextLevel();
    setText(this.transitionDoc, 'transition-enemies', `${enemyCount} enemies incoming`);
  }

  private updateGameoverDisplay(victory: boolean) {
    if (!this.gameoverDoc) return;
    setText(this.gameoverDoc, 'title', victory ? 'VICTORY!' : 'GAME OVER');
    setText(this.gameoverDoc, 'final-score', `Score: ${Math.floor(this.game.score)}`);
    setText(this.gameoverDoc, 'stats', `Level ${this.game.level} -- Enemies: ${this.game.enemiesKilled} -- Blocks: ${this.game.blocksDestroyed}`);
    setText(this.gameoverDoc, 'best-score', `Best: ${Math.floor(this.game.bestScore)}`);

    const newAchievements = this.game.achievements.slice(-3);
    if (newAchievements.length > 0) {
      const names = newAchievements.map(id => this.game.getAchievementName(id)).join(', ');
      setText(this.gameoverDoc, 'achievements', `Unlocked: ${names}`);
    } else {
      setText(this.gameoverDoc, 'achievements', `Achievements: ${this.game.achievements.length}/${this.game.totalAchievementCount}`);
    }
  }
}
