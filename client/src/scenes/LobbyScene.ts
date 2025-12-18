import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export class LobbyScene extends Phaser.Scene {
  private socket!: Socket;
  private roomContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('LobbyScene');
  }

  create() {
    this.socket = io('http://localhost:3001');
    this.registry.set('socket', this.socket);

    const { width, height } = this.scale;

    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a1a).setOrigin(0);
    
    // Header
    const header = this.add.graphics();
    header.fillStyle(0x2a2a2a, 1);
    header.fillRect(0, 0, width, 80);
    
    this.add.text(40, 40, 'LIERO REMAKE', { 
        fontSize: '32px', 
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: 'Arial'
    }).setOrigin(0, 0.5);

    // Room List Container
    this.roomContainer = this.add.container(40, 100);

    // Create Room Button
    this.createButton(width - 150, 40, 'CREATE ROOM', 0x00aa00, () => {
        this.showCreateRoomDialog();
    });

    // Socket Events
    this.socket.on('roomListUpdate', (rooms: any[]) => {
        this.updateRoomList(rooms);
    });

    this.socket.on('roomCreated', (roomId: string) => {
        this.socket.emit('joinRoom', roomId);
    });

    this.socket.on('joinedRoom', (room: any) => {
        this.scene.start('RoomScene', { room });
    });

    // Initial fetch
    this.socket.emit('getRooms');
  }

  createButton(x: number, y: number, text: string, color: number, onClick: () => void) {
      const btn = this.add.container(x, y);
      
      const bg = this.add.graphics();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-70, -20, 140, 40, 8);
      
      const txt = this.add.text(0, 0, text, {
          fontSize: '16px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold'
      }).setOrigin(0.5);
      
      btn.add([bg, txt]);
      
      btn.setSize(140, 40);
      btn.setInteractive({ useHandCursor: true })
         .on('pointerdown', () => {
             this.tweens.add({
                 targets: btn,
                 scaleX: 0.95,
                 scaleY: 0.95,
                 duration: 50,
                 yoyo: true,
                 onComplete: onClick
             });
         })
         .on('pointerover', () => {
             bg.clear();
             const c = Phaser.Display.Color.IntegerToColor(color);
             c.lighten(20);
             bg.fillStyle(c.color, 1);
             bg.fillRoundedRect(-70, -20, 140, 40, 8);
         })
         .on('pointerout', () => {
             bg.clear();
             bg.fillStyle(color, 1);
             bg.fillRoundedRect(-70, -20, 140, 40, 8);
         });
         
      return btn;
  }

  updateRoomList(rooms: any[]) {
      this.roomContainer.removeAll(true);

      if (rooms.length === 0) {
          this.roomContainer.add(this.add.text(0, 20, 'No rooms found. Create one!', {
              fontSize: '18px', color: '#888'
          }));
          return;
      }

      let y = 0;
      rooms.forEach(room => {
          const roomBg = this.add.graphics();
          roomBg.fillStyle(0x333333, 1);
          roomBg.fillRoundedRect(0, y, 600, 50, 8);
          
          const nameText = this.add.text(20, y + 25, room.name, {
              fontSize: '20px', color: '#fff', fontStyle: 'bold'
          }).setOrigin(0, 0.5);
          
          const countText = this.add.text(300, y + 25, `${room.players.length} / ${room.maxPlayers} Players`, {
              fontSize: '16px', color: '#aaa'
          }).setOrigin(0, 0.5);
          
          const joinBtn = this.add.container(520, y + 25);
          const joinBg = this.add.graphics();
          joinBg.fillStyle(0x0066cc, 1);
          joinBg.fillRoundedRect(-40, -15, 80, 30, 5);
          const joinTxt = this.add.text(0, 0, 'JOIN', { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
          joinBtn.add([joinBg, joinTxt]);
          
          joinBtn.setSize(80, 30);
          joinBtn.setInteractive({ useHandCursor: true })
                 .on('pointerdown', () => this.socket.emit('joinRoom', room.id));

          this.roomContainer.add([roomBg, nameText, countText, joinBtn]);
          y += 60;
      });
  }

  showCreateRoomDialog() {
      const { width, height } = this.scale;
      
      const container = this.add.container(0, 0);
      
      // Overlay
      const bg = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7).setInteractive();
      container.add(bg);
      
      // Dialog
      const dialogBg = this.add.graphics();
      dialogBg.fillStyle(0x2a2a2a, 1);
      dialogBg.fillRoundedRect(width/2 - 200, height/2 - 100, 400, 200, 12);
      dialogBg.lineStyle(2, 0x444444, 1);
      dialogBg.strokeRoundedRect(width/2 - 200, height/2 - 100, 400, 200, 12);
      container.add(dialogBg);
      
      const title = this.add.text(width/2, height/2 - 60, 'Create New Room', { 
          fontSize: '24px', color: '#fff', fontStyle: 'bold' 
      }).setOrigin(0.5);
      container.add(title);
      
      // Input Field
      const inputBg = this.add.graphics();
      inputBg.fillStyle(0x111111, 1);
      inputBg.fillRoundedRect(width/2 - 150, height/2 - 10, 300, 40, 5);
      container.add(inputBg);
      
      let inputText = 'My Room';
      const inputDisplay = this.add.text(width/2, height/2 + 10, inputText, { 
          fontSize: '20px', color: '#fff'
      }).setOrigin(0.5);
      container.add(inputDisplay);
      
      // Map Size Selector
      let mapSize: 'small' | 'medium' | 'large' = 'small';
      const mapSizeBtn = this.add.text(width/2, height/2 + 40, 'Map Size: Small', {
          fontSize: '16px', color: '#00ffff'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      mapSizeBtn.on('pointerdown', () => {
          if (mapSize === 'small') mapSize = 'medium';
          else if (mapSize === 'medium') mapSize = 'large';
          else mapSize = 'small';
          mapSizeBtn.setText(`Map Size: ${mapSize.charAt(0).toUpperCase() + mapSize.slice(1)}`);
      });
      container.add(mapSizeBtn);

      // Lives Selector
      let lives = 5;
      const livesOptions = [1, 3, 5, 10, 999];
      let livesIndex = 2; // Default to 5

      const livesLabel = this.add.text(width/2, height/2 + 70, `Lives: ${lives}`, {
          fontSize: '16px', color: '#00ffff'
      }).setOrigin(0.5);
      
      const leftArrow = this.add.text(width/2 - 60, height/2 + 70, '<', {
          fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const rightArrow = this.add.text(width/2 + 60, height/2 + 70, '>', {
          fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const updateLivesText = () => {
          lives = livesOptions[livesIndex];
          livesLabel.setText(`Lives: ${lives === 999 ? 'Unlimited' : lives}`);
      };

      leftArrow.on('pointerdown', () => {
          livesIndex = (livesIndex - 1 + livesOptions.length) % livesOptions.length;
          updateLivesText();
      });

      rightArrow.on('pointerdown', () => {
          livesIndex = (livesIndex + 1) % livesOptions.length;
          updateLivesText();
      });

      container.add([livesLabel, leftArrow, rightArrow]);

      // Buttons
      const createBtn = this.createButton(width/2 - 80, height/2 + 110, 'CREATE', 0x00aa00, () => {
          if (inputText.length > 0) {
              this.socket.emit('createRoom', { name: inputText, config: { mapSize, lives } });
              cleanup();
          }
      });
      
      const cancelBtn = this.createButton(width/2 + 80, height/2 + 110, 'CANCEL', 0xaa0000, () => {
          cleanup();
      });
      
      container.add([createBtn, cancelBtn]);
      
      // Input Handling
      const keyHandler = (event: KeyboardEvent) => {
          if (event.key === 'Backspace') {
              inputText = inputText.slice(0, -1);
          } else if (event.key.length === 1 && inputText.length < 20) {
              inputText += event.key;
          }
          inputDisplay.setText(inputText);
      };
      
      this.input.keyboard!.on('keydown', keyHandler);
      
      const cleanup = () => {
          this.input.keyboard!.off('keydown', keyHandler);
          container.destroy();
      };
  }
}
