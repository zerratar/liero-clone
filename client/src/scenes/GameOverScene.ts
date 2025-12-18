import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  private resultData: any;

  constructor() {
    super('GameOverScene');
  }

  init(data: { winner: string, scores: { name: string, kills: number, lives: number | string }[], onRestart: () => void, onMenu: () => void }) {
      this.resultData = data;
  }

  create() {
    const { width, height } = this.scale;

    // Dark overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);

    // Title
    this.add.text(width / 2, 100, 'GAME OVER', {
        fontSize: '64px', color: '#ff0000', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 4
    }).setOrigin(0.5);

    // Winner
    this.add.text(width / 2, 180, `WINNER: ${this.resultData.winner}`, {
        fontSize: '40px', color: '#00ff00', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Scores
    let y = 280;
    this.add.text(width / 2, y, 'SCORES', { fontSize: '24px', color: '#aaaaaa' }).setOrigin(0.5);
    y += 40;

    this.resultData.scores.sort((a: any, b: any) => b.kills - a.kills);

    this.resultData.scores.forEach((s: any) => {
        const text = `${s.name} - Kills: ${s.kills}`;
        this.add.text(width / 2, y, text, {
            fontSize: '28px', color: '#ffffff'
        }).setOrigin(0.5);
        y += 40;
    });

    // Buttons
    const btnY = height - 150;
    
    // Play Again
    const playAgainBtn = this.add.container(width / 2 - 120, btnY);
    const bg1 = this.add.rectangle(0, 0, 200, 60, 0x00aa00).setInteractive({ useHandCursor: true });
    const txt1 = this.add.text(0, 0, 'PLAY AGAIN', { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    playAgainBtn.add([bg1, txt1]);
    
    bg1.on('pointerdown', () => {
        if (this.resultData.onRestart) this.resultData.onRestart();
    });
    bg1.on('pointerover', () => bg1.setFillStyle(0x00cc00));
    bg1.on('pointerout', () => bg1.setFillStyle(0x00aa00));

    // Menu
    const menuBtn = this.add.container(width / 2 + 120, btnY);
    const bg2 = this.add.rectangle(0, 0, 200, 60, 0xaa0000).setInteractive({ useHandCursor: true });
    const txt2 = this.add.text(0, 0, 'EXIT TO MENU', { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    menuBtn.add([bg2, txt2]);

    bg2.on('pointerdown', () => {
        if (this.resultData.onMenu) this.resultData.onMenu();
    });
    bg2.on('pointerover', () => bg2.setFillStyle(0xcc0000));
    bg2.on('pointerout', () => bg2.setFillStyle(0xaa0000));
  }
}
