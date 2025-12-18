import Phaser from 'phaser';
import { Socket } from 'socket.io-client';

export class RoomScene extends Phaser.Scene {
  private socket!: Socket;
  private room: any;
  private playerListText: Phaser.GameObjects.Text[] = [];
  private actionBtn!: Phaser.GameObjects.Text;
  private isHost: boolean = false;

  constructor() {
    super('RoomScene');
  }

  init(data: { room: any }) {
      this.room = data.room;
      this.socket = this.registry.get('socket');
      
      // Check if I am host
      const myId = this.socket.id;
      const me = this.room.players.find((p: any) => p.id === myId);
      this.isHost = me?.isHost || false;
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, 30, `ROOM: ${this.room.name}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
    
    const mapSize = this.room.config?.mapSize || 'small';
    this.add.text(width / 2, 55, `Map Size: ${mapSize.toUpperCase()}`, { fontSize: '16px', color: '#aaa' }).setOrigin(0.5);

    this.actionBtn = this.add.text(width / 2, height - 50, '', {
        fontSize: '20px', color: '#fff'
    }).setOrigin(0.5).setInteractive();

    this.updateActionButton();

    this.actionBtn.on('pointerdown', () => {
        if (this.isHost) {
            // Check if everyone is ready
            const allReady = this.room.players.every((p: any) => p.isHost || p.isReady);
            if (allReady) {
                this.socket.emit('startGame');
            } else {
                alert('Wait for all players to be ready!');
            }
        } else {
            this.socket.emit('toggleReady');
        }
    });

    this.socket.on('roomPlayerUpdate', (players: any[]) => {
        this.room.players = players;
        
        // Re-check host status just in case
        const myId = this.socket.id;
        const me = this.room.players.find((p: any) => p.id === myId);
        this.isHost = me?.isHost || false;
        
        this.updatePlayerList();
        this.updateActionButton();
    });

    this.socket.on('gameStarted', () => {
        this.scene.start('WeaponSelectScene', { roomConfig: this.room.config });
    });

    this.updatePlayerList();
  }

  updatePlayerList() {
      this.playerListText.forEach(t => t.destroy());
      this.playerListText = [];

      let y = 70;
      this.room.players.forEach((p: any) => {
          let status = '';
          let color = '#aaa';

          if (p.isHost) {
              status = ' [HOST]';
              color = '#ff0'; // Yellow for host
          } else if (p.isReady) {
              status = ' [READY]';
              color = '#0f0'; // Green for ready
          }

          const text = this.add.text(50, y, (p.name || p.id) + status, {
              fontSize: '16px', color: color
          });
          this.playerListText.push(text);
          y += 30;
      });
  }

  updateActionButton() {
      if (this.isHost) {
          const allReady = this.room.players.every((p: any) => p.isHost || p.isReady);
          this.actionBtn.setText('START GAME');
          this.actionBtn.setColor(allReady ? '#0f0' : '#555');
      } else {
          // Find myself
          const myId = this.socket.id;
          const me = this.room.players.find((p: any) => p.id === myId);
          if (me?.isReady) {
              this.actionBtn.setText('NOT READY');
              this.actionBtn.setColor('#f00');
          } else {
              this.actionBtn.setText('READY');
              this.actionBtn.setColor('#0f0');
          }
      }
  }
}
