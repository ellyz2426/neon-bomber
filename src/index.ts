import {
  World,
  PanelUI,
  Follower,
} from '@iwsdk/core';

async function main() {
  const container = document.getElementById('app') as HTMLDivElement;

  const world = await World.create(container, {
    xr: { offer: 'once' },
    input: { canvasPointerEvents: true },
    render: {
      near: 0.01,
      far: 200,
      defaultLighting: false,
      camera: { position: [0, 8, 6], lookAt: [0, 0, 0] },
    },
    features: {
      grabbing: false,
      locomotion: { browserControls: true },
      physics: false,
      spatialUI: true,
    },
  });

  // Import systems dynamically to keep index clean
  const { GameManager } = await import('./game');
  const { GameSystem } = await import('./game-system');
  const { GameUISystem } = await import('./ui-system');

  const game = new GameManager();

  // Register systems
  world.registerSystem(GameSystem);
  world.registerSystem(GameUISystem);

  const gameSystem = world.getSystem(GameSystem)!;
  gameSystem.setRefs({ game });

  const uiSystem = world.getSystem(GameUISystem)!;
  uiSystem.setRefs({ game, gameSystem });

  // Setup scene
  gameSystem.setupScene();

  // Create HUD panel (head-locked)
  const hudEntity = world.createTransformEntity(undefined, {
    parent: world.playerHeadEntity,
    persistent: true,
  });
  hudEntity.addComponent(PanelUI, { config: './ui/hud.json' });
  hudEntity.addComponent(Follower);
  const fOff = hudEntity.getVectorView(Follower, 'offsetPosition');
  fOff[0] = 0; fOff[1] = 0.22; fOff[2] = -0.6;

  // Create menu panel (world-space, in front of player)
  const menuEntity = world.createTransformEntity();
  menuEntity.object3D!.position.set(0, 4, -2);
  menuEntity.addComponent(PanelUI, { config: './ui/menu.json' });

  // Create game-over panel (world-space, hidden initially)
  const gameoverEntity = world.createTransformEntity();
  gameoverEntity.object3D!.position.set(0, 4, -2);
  gameoverEntity.object3D!.visible = false;
  gameoverEntity.addComponent(PanelUI, { config: './ui/gameover.json' });

  // Create settings panel
  const settingsEntity = world.createTransformEntity();
  settingsEntity.object3D!.position.set(0, 4, -2);
  settingsEntity.object3D!.visible = false;
  settingsEntity.addComponent(PanelUI, { config: './ui/settings.json' });

  uiSystem.setPanelEntities(hudEntity, menuEntity, gameoverEntity, settingsEntity);
}

main();
