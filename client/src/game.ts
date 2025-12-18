import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { WeaponSelectScene } from './scenes/WeaponSelectScene';
import { LobbyScene } from './scenes/LobbyScene';
import { RoomScene } from './scenes/RoomScene';
import { InGameMenuScene } from './scenes/InGameMenuScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1
  },
  scene: [BootScene, MenuScene, LobbyScene, RoomScene, WeaponSelectScene, GameScene, InGameMenuScene, GameOverScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  }
};

new Phaser.Game(config);
