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

  // Create power-ups HUD (head-locked, below main HUD)
  const powerupsEntity = world.createTransformEntity(undefined, {
    parent: world.playerHeadEntity,
    persistent: true,
  });
  powerupsEntity.addComponent(PanelUI, { config: './ui/powerups.json' });
  powerupsEntity.addComponent(Follower);
  const puOff = powerupsEntity.getVectorView(Follower, 'offsetPosition');
  puOff[0] = 0; puOff[1] = 0.15; puOff[2] = -0.6;

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

  // Create pause panel
  const pauseEntity = world.createTransformEntity();
  pauseEntity.object3D!.position.set(0, 4, -2);
  pauseEntity.object3D!.visible = false;
  pauseEntity.addComponent(PanelUI, { config: './ui/pause.json' });

  // Create achievements panel
  const achievementsEntity = world.createTransformEntity();
  achievementsEntity.object3D!.position.set(0, 4, -2);
  achievementsEntity.object3D!.visible = false;
  achievementsEntity.addComponent(PanelUI, { config: './ui/achvmts.json' });

  // Create level transition panel (head-locked, center)
  const transitionEntity = world.createTransformEntity(undefined, {
    parent: world.playerHeadEntity,
    persistent: true,
  });
  transitionEntity.addComponent(PanelUI, { config: './ui/leveltransition.json' });
  transitionEntity.addComponent(Follower);
  const trOff = transitionEntity.getVectorView(Follower, 'offsetPosition');
  trOff[0] = 0; trOff[1] = 0; trOff[2] = -0.8;
  transitionEntity.object3D!.visible = false;

  // Create how-to-play panel
  const howtoEntity = world.createTransformEntity();
  howtoEntity.object3D!.position.set(0, 4, -2);
  howtoEntity.object3D!.visible = false;
  howtoEntity.addComponent(PanelUI, { config: './ui/howto.json' });

  // Create achievement notification panel (head-locked, top)
  const achNotifyEntity = world.createTransformEntity(undefined, {
    parent: world.playerHeadEntity,
    persistent: true,
  });
  achNotifyEntity.addComponent(PanelUI, { config: './ui/achnotify.json' });
  achNotifyEntity.addComponent(Follower);
  const anOff = achNotifyEntity.getVectorView(Follower, 'offsetPosition');
  anOff[0] = 0; anOff[1] = 0.32; anOff[2] = -0.6;
  achNotifyEntity.object3D!.visible = false;

  uiSystem.setPanelEntities(
    hudEntity, menuEntity, gameoverEntity, settingsEntity,
    pauseEntity, achievementsEntity, powerupsEntity, transitionEntity,
    howtoEntity, achNotifyEntity
  );
}

main();
