import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load assets here
    // For now, we'll generate textures programmatically if needed
  }

  create() {
    this.scene.start('MenuScene');
  }
}
