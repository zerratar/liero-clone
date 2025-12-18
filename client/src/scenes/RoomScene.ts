import Phaser from 'phaser';
import { Socket } from 'socket.io-client';

export class RoomScene extends Phaser.Scene {
  private socket!: Socket;
  private room: any;
  private playerListContainer!: Phaser.GameObjects.Container;
  private actionBtn!: Phaser.GameObjects.Container;
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

    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a1a).setOrigin(0);

    // Header
    this.add.text(width / 2, 50, `ROOM: ${this.room.name.toUpperCase()}`, { 
        fontSize: '32px', color: '#fff', fontStyle: 'bold', fontFamily: 'Arial Black' 
    }).setOrigin(0.5);
    
    const mapSize = this.room.config?.mapSize || 'small';
    const lives = this.room.config?.lives === 999 ? 'Unlimited' : (this.room.config?.lives || 5);
    
    this.add.text(width / 2, 90, `MAP: ${mapSize.toUpperCase()}  |  LIVES: ${lives}`, { 
        fontSize: '16px', color: '#aaaaaa', fontStyle: 'bold' 
    }).setOrigin(0.5);

    // Bot Info
    this.add.text(width / 2, height - 120, 'Note: If started with 1 player, a BOT will be added.', {
        fontSize: '14px', color: '#666666', fontStyle: 'italic'
    }).setOrigin(0.5);

    this.playerListContainer = this.add.container(0, 0);

    this.createActionButton();
    this.updateActionButton();

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

  createActionButton() {
      const { width, height } = this.scale;
      this.actionBtn = this.add.container(width / 2, height - 60);
      
      const bg = this.add.graphics();
      this.actionBtn.add(bg);
      
      const text = this.add.text(0, 0, '', {
          fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.actionBtn.add(text);

      this.actionBtn.setSize(200, 50);
      this.actionBtn.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
              if (this.isHost) {
                  const allReady = this.room.players.every((p: any) => p.isHost || p.isReady);
                  if (allReady) {
                      this.socket.emit('startGame');
                  } else {
                      // Shake effect or alert
                  }
              } else {
                  this.socket.emit('toggleReady');
              }
          });
      
      // Store references for update
      (this.actionBtn as any).bg = bg;
      (this.actionBtn as any).text = text;
  }

  updatePlayerList() {
      this.playerListContainer.removeAll(true);

      const startY = 150;
      const slotHeight = 70;
      const { width } = this.scale;
      const maxPlayers = 4;

      for (let i = 0; i < maxPlayers; i++) {
          const player = this.room.players[i];
          const y = startY + (i * slotHeight);
          const x = width / 2;

          // Slot Background
          const bg = this.add.graphics();
          
          if (player) {
              // Occupied Slot
              bg.fillStyle(0x333333, 1);
              bg.lineStyle(2, player.isReady || player.isHost ? 0x00ff00 : 0x555555, 1);
          } else {
              // Empty Slot
              bg.fillStyle(0x111111, 0.5);
              bg.lineStyle(2, 0x333333, 1);
          }
          
          bg.fillRoundedRect(x - 200, y, 400, 55, 8);
          bg.strokeRoundedRect(x - 200, y, 400, 55, 8);
          this.playerListContainer.add(bg);

          if (player) {
              // Player Name
              const nameText = this.add.text(x - 180, y + 27, player.name, {
                  fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
              }).setOrigin(0, 0.5);
              this.playerListContainer.add(nameText);

              // Status
              let statusText = '';
              let statusColor = '#aaaaaa';

              if (player.isHost) {
                  statusText = 'HOST';
                  statusColor = '#ffff00';
              } else if (player.isReady) {
                  statusText = 'READY';
                  statusColor = '#00ff00';
              } else {
                  statusText = 'NOT READY';
                  statusColor = '#ff0000';
              }

              const status = this.add.text(x + 180, y + 27, statusText, {
                  fontSize: '14px', color: statusColor, fontStyle: 'bold'
              }).setOrigin(1, 0.5);
              this.playerListContainer.add(status);
          } else {
              // Empty Slot Text
              const emptyText = this.add.text(x, y + 27, 'Waiting for player...', {
                  fontSize: '16px', color: '#444444', fontStyle: 'italic'
              }).setOrigin(0.5);
              this.playerListContainer.add(emptyText);
          }
      }
  }

  updateActionButton() {
      const bg = (this.actionBtn as any).bg as Phaser.GameObjects.Graphics;
      const text = (this.actionBtn as any).text as Phaser.GameObjects.Text;
      
      bg.clear();
      
      if (this.isHost) {
          const allReady = this.room.players.every((p: any) => p.isHost || p.isReady);
          
          if (allReady) {
              bg.fillStyle(0x00aa00, 1);
              text.setText('START GAME');
              this.actionBtn.setAlpha(1);
          } else {
              bg.fillStyle(0x555555, 1);
              text.setText('WAITING FOR READY');
              this.actionBtn.setAlpha(0.5);
          }
      } else {
          // Find me
          const me = this.room.players.find((p: any) => p.id === this.socket.id);
          if (me?.isReady) {
              bg.fillStyle(0xaa0000, 1);
              text.setText('CANCEL READY');
          } else {
              bg.fillStyle(0x00aa00, 1);
              text.setText('READY UP');
          }
          this.actionBtn.setAlpha(1);
      }
      
}
}
