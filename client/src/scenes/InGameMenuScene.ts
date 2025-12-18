import Phaser from 'phaser';

export class InGameMenuScene extends Phaser.Scene {

  constructor() {
    super('InGameMenuScene');
  }

  create() {
    const { width, height } = this.scale;

    // Semi-transparent background
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    // Title
    this.add.text(width / 2, height / 2 - 100, 'MENU', {
        fontSize: '32px',
        color: '#fff',
        fontStyle: 'bold'
    }).setOrigin(0.5);

    // Resume Button
    const resumeBtn = this.add.text(width / 2, height / 2 - 20, 'RESUME', {
        fontSize: '24px',
        color: '#0f0'
    }).setOrigin(0.5).setInteractive();

    resumeBtn.on('pointerdown', () => {
        this.scene.stop();
        this.scene.resume('GameScene');
    });

    // Leave Button
    const leaveBtn = this.add.text(width / 2, height / 2 + 40, 'LEAVE MATCH', {
        fontSize: '24px',
        color: '#f00'
    }).setOrigin(0.5).setInteractive();

    leaveBtn.on('pointerdown', () => {
        // Disconnect/Leave logic
        // For now, just reload page or go back to lobby
        // Ideally, emit 'leaveRoom'
        // this.socket.emit('leaveRoom'); // Server handles disconnect, but explicit leave is better
        
        // Force reload to ensure clean state for now, or transition
        window.location.reload(); 
    });

    // Input to close menu
    this.input.keyboard!.on('keydown-ESC', () => {
        this.scene.stop();
        this.scene.resume('GameScene');
    });
  }
}
