import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export class LobbyScene extends Phaser.Scene {
  private socket!: Socket;
  private roomContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('LobbyScene');
  }

  create() {
    const serverUrl = `http://${window.location.hostname}:3001`;
    this.socket = io(serverUrl);
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
      const dialogWidth = 400;
      const dialogHeight = 380;
      const dialogX = width / 2 - dialogWidth / 2;
      const dialogY = height / 2 - dialogHeight / 2;

      const dialogBg = this.add.graphics();
      dialogBg.fillStyle(0x222222, 0.95);
      dialogBg.fillRoundedRect(dialogX, dialogY, dialogWidth, dialogHeight, 16);
      dialogBg.lineStyle(2, 0x555555, 1);
      dialogBg.strokeRoundedRect(dialogX, dialogY, dialogWidth, dialogHeight, 16);
      container.add(dialogBg);
      
      const title = this.add.text(width/2, dialogY + 40, 'CREATE NEW ROOM', { 
          fontSize: '28px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial Black'
      }).setOrigin(0.5);
      container.add(title);
      
      // Input Field
      const inputY = dialogY + 100;
      const inputBg = this.add.graphics();
      inputBg.fillStyle(0x000000, 0.5);
      inputBg.lineStyle(2, 0x444444);
      inputBg.fillRoundedRect(width/2 - 150, inputY - 25, 300, 50, 8);
      inputBg.strokeRoundedRect(width/2 - 150, inputY - 25, 300, 50, 8);
      container.add(inputBg);
      
      let inputText = 'My Room';
      const inputDisplay = this.add.text(width/2, inputY, inputText, { 
          fontSize: '24px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);
      container.add(inputDisplay);

      // Cursor
      const cursor = this.add.text(0, inputY, '|', {
          fontSize: '24px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0, 0.5);
      container.add(cursor);

      const updateCursorPos = () => {
          cursor.x = inputDisplay.x + inputDisplay.width / 2 + 2;
      };
      updateCursorPos();

      // Blink animation
      const cursorTween = this.tweens.add({
          targets: cursor,
          alpha: 0,
          duration: 500,
          yoyo: true,
          repeat: -1
      });

      const inputLabel = this.add.text(width/2 - 145, inputY - 40, 'ROOM NAME', {
          fontSize: '12px', color: '#aaaaaa', fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      container.add(inputLabel);
      
      // Map Size Selector
      const optionY = dialogY + 170;
      let mapSize: 'small' | 'medium' | 'large' = 'small';
      
      const mapSizeLabel = this.add.text(width/2, optionY - 25, 'MAP SIZE', {
          fontSize: '14px', color: '#aaaaaa', fontStyle: 'bold'
      }).setOrigin(0.5);

      const mapSizeBtn = this.add.text(width/2, optionY, 'SMALL', {
          fontSize: '20px', color: '#00ffff', fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      const mapLeftArrow = this.add.text(width/2 - 80, optionY, '<', { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const mapRightArrow = this.add.text(width/2 + 80, optionY, '>', { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const updateMapText = () => {
           mapSizeBtn.setText(mapSize.toUpperCase());
      };

      const cycleMapSize = (dir: number) => {
          const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
          let idx = sizes.indexOf(mapSize);
          idx = (idx + dir + sizes.length) % sizes.length;
          mapSize = sizes[idx];
          updateMapText();
      }

      mapSizeBtn.on('pointerdown', () => cycleMapSize(1));
      mapLeftArrow.on('pointerdown', () => cycleMapSize(-1));
      mapRightArrow.on('pointerdown', () => cycleMapSize(1));

      container.add([mapSizeLabel, mapSizeBtn, mapLeftArrow, mapRightArrow]);

      // Lives Selector
      const livesY = dialogY + 240;
      let lives = 5;
      const livesOptions = [1, 3, 5, 10, 999];
      let livesIndex = 2; // Default to 5

      const livesTitle = this.add.text(width/2, livesY - 25, 'LIVES', {
          fontSize: '14px', color: '#aaaaaa', fontStyle: 'bold'
      }).setOrigin(0.5);

      const livesLabel = this.add.text(width/2, livesY, '5', {
          fontSize: '20px', color: '#00ffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      
      const leftArrow = this.add.text(width/2 - 80, livesY, '<', {
          fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const rightArrow = this.add.text(width/2 + 80, livesY, '>', {
          fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const updateLivesText = () => {
          lives = livesOptions[livesIndex];
          livesLabel.setText(`${lives === 999 ? 'UNLIMITED' : lives}`);
      };

      leftArrow.on('pointerdown', () => {
          livesIndex = (livesIndex - 1 + livesOptions.length) % livesOptions.length;
          updateLivesText();
      });

      rightArrow.on('pointerdown', () => {
          livesIndex = (livesIndex + 1) % livesOptions.length;
          updateLivesText();
      });

      container.add([livesTitle, livesLabel, leftArrow, rightArrow]);

      // Buttons
      const btnY = dialogY + 300;
      const createBtn = this.createButton(width/2 - 85, btnY, 'CREATE', 0x00aa00, () => {
          if (inputText.length > 0) {
              this.socket.emit('createRoom', { name: inputText, config: { mapSize, lives } });
              cleanup();
          }
      });
      
      const cancelBtn = this.createButton(width/2 + 85, btnY, 'CANCEL', 0xaa0000, () => {
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
          updateCursorPos();
      };
      
      this.input.keyboard!.on('keydown', keyHandler);
      
      const cleanup = () => {
          this.input.keyboard!.off('keydown', keyHandler);
          cursorTween.remove();
          container.destroy();
      };
  }
}
