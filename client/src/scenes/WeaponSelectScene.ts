import Phaser from 'phaser';
import { WEAPONS } from '../../../shared/weapons';
import { Socket } from 'socket.io-client';

export class WeaponSelectScene extends Phaser.Scene {
  private selectedWeapons: string[] = [];
  private maxWeapons = 5;
  private titleText!: Phaser.GameObjects.Text;
  private socket!: Socket;
  private statusText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Text;
  private weaponTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private roomConfig: any;

  constructor() {
    super('WeaponSelectScene');
  }

  init(data: { roomConfig: any }) {
      this.roomConfig = data.roomConfig;
  }

  create() {
    this.socket = this.registry.get('socket');
    const { width, height } = this.scale;

    this.titleText = this.add.text(width / 2, 30, `SELECT ${this.maxWeapons} WEAPONS (0/${this.maxWeapons})`, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const weaponList = Object.values(WEAPONS);
    let y = 70;
    let x = 50;

    weaponList.forEach((weapon) => {
        const btn = this.add.text(x, y, weapon.name, {
            fontSize: '16px',
            color: '#aaaaaa'
        }).setInteractive();

        btn.setData('id', weapon.id);
        this.weaponTexts.set(weapon.id, btn);

        btn.on('pointerdown', () => this.toggleWeapon(weapon.id, btn));
        
        y += 30;
        if (y > height - 100) {
            y = 70;
            x += 150;
        }
    });

    // Random Button
    const randomBtn = this.add.text(width / 2, height - 90, 'RANDOM WEAPONS', {
        fontSize: '20px',
        color: '#00ffff'
    }).setOrigin(0.5).setInteractive();

    randomBtn.on('pointerdown', () => {
        this.selectRandomWeapons();
    });

    this.startBtn = this.add.text(width / 2, height - 50, 'READY', {
        fontSize: '24px',
        color: '#00ff00'
    }).setOrigin(0.5).setInteractive();

    this.statusText = this.add.text(width / 2, height - 20, '', {
        fontSize: '16px', color: '#ffff00'
    }).setOrigin(0.5);

    this.startBtn.on('pointerdown', () => {
        if (this.selectedWeapons.length === this.maxWeapons) {
            this.startBtn.setVisible(false);
            randomBtn.setVisible(false);
            this.statusText.setText('Waiting for other players...');
            this.socket.emit('playerReadyForMatch', this.selectedWeapons);
        } else {
            alert(`Please select exactly ${this.maxWeapons} weapons.`);
        }
    });

    this.socket.on('matchReadyUpdate', (data: { ready: number, total: number }) => {
        this.statusText.setText(`Waiting for players (${data.ready}/${data.total})...`);
    });

    this.socket.on('matchStart', () => {
        this.scene.start('GameScene', { weapons: this.selectedWeapons, roomConfig: this.roomConfig });
    });
  }

  selectRandomWeapons() {
      // Clear current
      this.selectedWeapons = [];
      this.weaponTexts.forEach(btn => btn.setColor('#aaaaaa'));

      // Pick random
      const allIds = Object.keys(WEAPONS);
      const shuffled = allIds.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, this.maxWeapons);

      selected.forEach(id => {
          this.selectedWeapons.push(id);
          const btn = this.weaponTexts.get(id);
          if (btn) btn.setColor('#ffff00');
      });

      this.updateTitle();
  }

  toggleWeapon(id: string, textObj: Phaser.GameObjects.Text) {
      const idx = this.selectedWeapons.indexOf(id);
      if (idx >= 0) {
          this.selectedWeapons.splice(idx, 1);
          textObj.setColor('#aaaaaa');
      } else {
          if (this.selectedWeapons.length < this.maxWeapons) {
              this.selectedWeapons.push(id);
              textObj.setColor('#ffff00');
          }
      }
      this.updateTitle();
  }

  updateTitle() {
      this.titleText.setText(`SELECT ${this.maxWeapons} WEAPONS (${this.selectedWeapons.length}/${this.maxWeapons})`);
      if (this.selectedWeapons.length === this.maxWeapons) {
          this.titleText.setColor('#00ff00');
      } else {
          this.titleText.setColor('#ffffff');
      }
  }
}
