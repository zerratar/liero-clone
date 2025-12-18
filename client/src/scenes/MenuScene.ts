import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 3, 'LIERO REMAKE', {
      fontSize: '32px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const startBtn = this.add.text(width / 2, height / 2, 'START GAME', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive();

    startBtn.on('pointerover', () => startBtn.setColor('#ffff00'));
    startBtn.on('pointerout', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerdown', () => this.scene.start('LobbyScene'));

    this.add.text(width / 2, height - 50, 'Controls: WASD/Arrows to Move, Click to Shoot, Right Click Rope', {
        fontSize: '10px',
        color: '#aaaaaa'
    }).setOrigin(0.5);
  }
}
