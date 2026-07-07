import {
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
  Entity,
} from '@iwsdk/core';
import { GameManager, GameState, GameMode } from './game';
import { GameSystem } from './game-system';

const getDoc = (e: Entity) =>
  e.getValue(PanelDocument, 'document') as UIKitDocument | undefined;

const setText = (doc: UIKitDocument | undefined, id: string, text: string) =>
  (doc?.getElementById(id) as any)?.setProperties({ text });

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
}) {
  private game!: GameManager;
  private gameSystem!: GameSystem;
  private hudEntity!: Entity;
  private menuEntity!: Entity;
  private gameoverEntity!: Entity;
  private settingsEntity!: Entity;
  private hudDoc: UIKitDocument | null = null;
  private menuDoc: UIKitDocument | null = null;
  private gameoverDoc: UIKitDocument | null = null;
  private settingsDoc: UIKitDocument | null = null;
  private lastState: GameState = GameState.Menu;

  setRefs(refs: { game: GameManager; gameSystem: GameSystem }) {
    this.game = refs.game;
    this.gameSystem = refs.gameSystem;
  }

  setPanelEntities(hud: Entity, menu: Entity, gameover: Entity, settings: Entity) {
    this.hudEntity = hud;
    this.menuEntity = menu;
    this.gameoverEntity = gameover;
    this.settingsEntity = settings;
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

    onClick(doc, 'btn-settings', () => {
      this.showPanel('settings');
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

  private updateSettingsDisplay() {
    if (!this.settingsDoc) return;
    const diffNames = ['Easy', 'Normal', 'Hard'];
    setText(this.settingsDoc, 'diff-label', `Difficulty: ${diffNames[this.game.difficulty]}`);
    setText(this.settingsDoc, 'theme-label', `Theme: ${this.game.currentTheme.name}`);
  }

  private showPanel(state: 'menu' | 'playing' | 'gameover' | 'settings' | 'victory') {
    if (this.menuEntity) this.menuEntity.object3D!.visible = state === 'menu';
    if (this.gameoverEntity) this.gameoverEntity.object3D!.visible = state === 'gameover' || state === 'victory';
    if (this.settingsEntity) this.settingsEntity.object3D!.visible = state === 'settings';
    if (this.hudEntity) this.hudEntity.object3D!.visible = state === 'playing';
  }

  update(delta: number, time: number) {
    if (this.game.state !== this.lastState) {
      this.onStateChange(this.lastState, this.game.state);
      this.lastState = this.game.state;
    }

    if (this.game.state === GameState.Playing && this.hudDoc) {
      this.updateHUD();
    }

    if (this.game.state === GameState.Paused) {
      if (this.input.keyboard.getKeyDown('Escape')) {
        this.game.state = GameState.Playing;
        this.showPanel('playing');
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
    } else if (to === GameState.Paused) {
      this.showPanel('menu');
    } else if (to === GameState.Menu) {
      this.showPanel('menu');
    }
  }

  private updateHUD() {
    if (!this.hudDoc) return;
    setText(this.hudDoc, 'score', `Score: ${Math.floor(this.game.score)}`);
    setText(this.hudDoc, 'lives', `Lives: ${this.game.lives}`);
    setText(this.hudDoc, 'level', `Lv ${this.game.level}`);

    if (this.game.mode === GameMode.Timed) {
      const remaining = Math.max(0, this.game.timeLimit - this.game.timeElapsed);
      const min = Math.floor(remaining / 60);
      const sec = Math.floor(remaining % 60);
      setText(this.hudDoc, 'timer', `${min}:${sec.toString().padStart(2, '0')}`);
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
      setText(this.gameoverDoc, 'achievements', `Achievements: ${this.game.achievements.length}/40`);
    }
  }
}
