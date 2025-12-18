import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { Terrain } from '../objects/Terrain';
import { Worm } from '../objects/Worm';
import { BotWorm } from '../objects/BotWorm';
import { RemoteWorm } from '../objects/RemoteWorm';
import { PlayerState } from '../../../shared/types';
import { WEAPONS } from '../../../shared/weapons';
import { Projectile } from '../objects/Projectile';
import { BloodParticle, Gib } from '../objects/Particles';

export class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private terrain!: Terrain;
  private worm!: Worm;
  private bot!: BotWorm;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: any;
  private otherPlayers: Record<string, RemoteWorm> = {};
  private weaponText!: Phaser.GameObjects.Text;
  private initialWeapons: string[] = [];
  private isGameRunning: boolean = false;
  private countdownText?: Phaser.GameObjects.Text;
  private bloodParticles: BloodParticle[] = [];
  private bloodGraphics!: Phaser.GameObjects.Graphics;
  private roomConfig: any;
  private mapWidth: number = 800;
  private mapHeight: number = 600;
  private statsText?: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  init(data: { weapons: string[], roomConfig?: any }) {
      this.initialWeapons = data.weapons || ['bazooka', 'grenade', 'shotgun'];
      this.roomConfig = data.roomConfig;
      
      if (this.roomConfig && this.roomConfig.mapSize) {
          switch (this.roomConfig.mapSize) {
              case 'medium':
                  this.mapWidth = 1600;
                  this.mapHeight = 1200;
                  break;
              case 'large':
                  this.mapWidth = 2400;
                  this.mapHeight = 1800;
                  break;
              default: // small
                  this.mapWidth = 800;
                  this.mapHeight = 600;
                  break;
          }
      }
  }

  create() {
    this.socket = this.registry.get('socket');
    if (!this.socket) {
        // Fallback for direct dev testing if needed
        this.socket = io('http://localhost:3001');
    }
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('currentPlayers', (players: Record<string, PlayerState>) => {
        Object.keys(players).forEach((id) => {
            if (id === this.socket.id) {
                // Sync my position from server spawn point
                this.worm.x = players[id].x;
                this.worm.y = players[id].y;
                
                // Check if stuck and carve
                this.ensureClearSpace(this.worm.x, this.worm.y, true);
                return;
            }
            this.addOtherPlayer(players[id]);
        });
        // If we have other players, remove the bot
        // Only remove bot if there are ACTUAL other players connected
        if (Object.keys(this.otherPlayers).length > 0 && this.bot) {
            this.bot.destroy();
            this.bot = undefined as any;
        } else if (!this.bot) {
             // If no other players and no bot, maybe respawn bot?
             // For now, assume bot is created in create() and only destroyed here.
        }
    });

    this.socket.on('scoreUpdate', (players: PlayerState[]) => {
        // Update local score display
        let text = '';
        players.forEach(p => {
            const livesText = (p.lives === undefined || p.lives >= 999) ? '∞' : p.lives;
            text += `${p.name}: Kills: ${p.kills || 0} | Lives: ${livesText}\n`;
        });
        if (this.statsText) {
            this.statsText.setText(text);
        }
    });

    this.socket.on('playerEliminated', (playerId: string) => {
        if (playerId === this.socket.id) {
            // I am dead permanently
            this.worm.setVisible(false);
            this.worm.setActive(false);
            this.add.text(this.scale.width/2, this.scale.height/2, 'ELIMINATED', {
                fontSize: '64px', color: '#ff0000', stroke: '#000', strokeThickness: 6
            }).setOrigin(0.5).setScrollFactor(0);
        } else if (this.otherPlayers[playerId]) {
            this.otherPlayers[playerId].setVisible(false);
            this.otherPlayers[playerId].setActive(false);
        }
    });

    this.socket.on('gameOver', (data: { winner: PlayerState | null }) => {
        const winnerName = data.winner ? data.winner.name : 'No One';
        this.add.text(this.scale.width/2, this.scale.height/2 - 100, 'GAME OVER', {
            fontSize: '64px', color: '#ffffff', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0);
        
        this.add.text(this.scale.width/2, this.scale.height/2, `Winner: ${winnerName}`, {
            fontSize: '48px', color: '#00ff00', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);

        // Stop game
        this.isGameRunning = false;
    });

    this.socket.on('startCountdown', () => {
        this.startCountdown();
    });

    const handleSeed = (seed: number) => {
        if (seed) {
            // Regenerate terrain with new seed
            this.terrain.regenerate(seed);
            
            // Re-carve spawn points for everyone because terrain is fresh
            if (this.worm) this.ensureClearSpace(this.worm.x, this.worm.y, true);
            if (this.bot) this.ensureClearSpace(this.bot.x, this.bot.y, false);
            Object.values(this.otherPlayers).forEach(p => this.ensureClearSpace(p.x, p.y, false));
        }
    };

    this.socket.on('gameStarted', (data: { seed: number }) => {
        handleSeed(data.seed);
    });

    this.socket.on('gameSeed', (data: { seed: number }) => {
        handleSeed(data.seed);
    });

    this.socket.on('newPlayer', (playerInfo: PlayerState) => {
        this.addOtherPlayer(playerInfo);
        // If a new player joins, remove the bot
        if (this.bot) {
            this.bot.destroy();
            this.bot = undefined as any;
        }
    });

    this.socket.on('playerMoved', (playerInfo: PlayerState) => {
        if (this.otherPlayers[playerInfo.id]) {
            this.otherPlayers[playerInfo.id].updateState(playerInfo);
        }
    });

    this.socket.on('playerDisconnected', (playerId: string) => {
        if (this.otherPlayers[playerId]) {
            this.otherPlayers[playerId].destroy();
            delete this.otherPlayers[playerId];
        }
    });

    this.socket.on('playerFired', (data: { id: string, x: number, y: number, angle: number, weaponId: string, charge?: number }) => {
        if (this.otherPlayers[data.id]) {
            // Visual only projectile for other players
            // We don't need full physics simulation for them as the explosion event handles the terrain/damage
            // BUT we want to see the projectile moving.
            // So we spawn a "dummy" projectile that doesn't trigger local events but looks real.
            
            // However, Projectile class is currently tied to local logic.
            // Let's use the existing Projectile class but give it a "remote" flag or just no callbacks?
            // Actually, if we just spawn it, it will move and hit terrain locally.
            // If terrain is synced, it should hit roughly same place.
            // But the 'terrainExplosion' event comes from the shooter.
            // So we should NOT let this remote projectile trigger explosion/damage locally.
            
            const weaponDef = WEAPONS[data.weaponId];
            if (weaponDef) {
                if (data.weaponId === 'laser') {
                    // Instant beam
                    this.fireRemoteLaser(data.x, data.y, data.angle, weaponDef);
                } else {
                    // Projectile
                    let speedMultiplier = 1;
                    if (weaponDef.chargeable && data.charge !== undefined) {
                        speedMultiplier = 0.2 + (0.8 * data.charge);
                    }
                    
                    const pellets = weaponDef.pellets || 1;
                    for (let i = 0; i < pellets; i++) {
                        let angle = data.angle;
                        if (pellets > 1) {
                            // Apply spread locally for visuals
                            angle = data.angle + (Math.random() - 0.5) * weaponDef.spread;
                        }
                        new Projectile(this, data.x, data.y, angle, weaponDef, this.terrain, undefined, true, undefined, undefined, speedMultiplier); 
                    }
                    // undefined callback means it won't trigger 'terrainExplosion' emit or local damage check logic attached to the worm
                    // isRemote=true prevents local terrain carving
                }
            }
        }
    });

    this.socket.on('terrainExplosion', (data: { x: number, y: number, radius: number, weaponId?: string }) => {
        this.terrain.carve(data.x, data.y, data.radius);
        
        if (data.weaponId === 'spawn') {
            // No particles, no damage, just carving
            return;
        }

        this.createExplosionParticles(data.x, data.y, data.radius, data.weaponId);
        
        // Check if I took damage from this remote explosion
        if (this.worm) {
            const dist = Phaser.Math.Distance.Between(data.x, data.y, this.worm.x, this.worm.y);
            if (dist < data.radius + 10) {
                const dmg = Math.floor((1 - dist / (data.radius + 15)) * 20);
                if (dmg > 0) {
                    this.worm.takeDamage(dmg);
                }
            }
        }
    });

    this.socket.on('playerRespawn', (playerInfo: PlayerState) => {
        if (playerInfo.id === this.socket.id) {
            // Me
            this.worm.x = playerInfo.x;
            this.worm.y = playerInfo.y;
            this.worm.hp = 100;
            this.worm.alpha = 1; // Reset transparency
            this.worm.updateHealthBar();
            
            // Check if stuck and carve
            this.ensureClearSpace(this.worm.x, this.worm.y, true);
        } else if (this.otherPlayers[playerInfo.id]) {
            // Other
            this.otherPlayers[playerInfo.id].updateState(playerInfo);
            this.otherPlayers[playerInfo.id].alpha = 1; // Reset transparency
            // Ensure they have space locally
            this.ensureClearSpace(playerInfo.x, playerInfo.y, false);
        }
    });

    const clientText = this.add.text(10, 10, 'Liero Remake - Client Connected', { color: '#0f0' }).setDepth(100).setScrollFactor(0);
    this.weaponText = this.add.text(10, 30, 'Weapon: Bazooka', { color: '#fff' }).setDepth(100).setScrollFactor(0);
    this.statsText = this.add.text(10, 50, '', { color: '#ffff00', fontSize: '14px' }).setDepth(100).setScrollFactor(0);
    
    // Store for minimap ignore
    (this as any).clientText = clientText;
    if (this.statsText) (this as any).statsText = this.statsText;

    // Background (Brighter)
    this.add.rectangle(0, 0, this.mapWidth * 1.5, this.mapHeight * 1.5, 0x2a2a2a).setOrigin(0, 0).setDepth(-2);

    // Create Terrain
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    
    // Use a fixed seed for now to ensure sync, or get from server
    // Ideally server sends this in 'currentPlayers' or a new 'gameStart' event
    // For now, let's use a hardcoded seed so all clients match
    const seed = 12345; 
    this.terrain = new Terrain(this, this.mapWidth, this.mapHeight, seed);
    
    // Blood Graphics (for flying blood)
    this.bloodGraphics = this.add.graphics();
    this.bloodGraphics.setDepth(5); // Above terrain, below worms

    // Terrain Drop Shadow
    // We create a clone of the terrain texture, tint it black, and place it behind
    this.add.image(5, 5, 'terrain').setOrigin(0, 0).setDepth(-1).setTint(0x000000).setAlpha(0.5);
    
    // Hook into terrain refresh to update shadow
    const originalRefresh = this.terrain.texture.refresh;
    this.terrain.texture.refresh = () => {
        originalRefresh.call(this.terrain.texture);
        // Shadow updates automatically because it uses the same texture key 'terrain'
        // But we might need to ensure it redraws if Phaser caches it weirdly.
        // Actually, since it's the same Texture object, it should update.
        return this.terrain.texture;
    };

    // Create Worm (initially off-screen until synced)
    // Pass a random name or ID if available, for now just "Player"
    const myName = `Player ${Math.floor(Math.random() * 1000)}`;
    this.worm = new Worm(this, -100, -100, this.terrain, this.socket, undefined, myName);
    this.cameras.main.startFollow(this.worm, true, 0.1, 0.1);
    
    if (this.initialWeapons.length > 0) {
        this.worm.setWeapons(this.initialWeapons);
    }
    
    const handleExplosion = (x: number, y: number, radius: number, weaponId: string) => {
        if (this.socket && this.socket.connected) {
            this.socket.emit('terrainExplosion', { x, y, radius, weaponId });
        }
        this.applyExplosion(x, y, radius, weaponId, true);
    };

    const handleBotExplosion = (x: number, y: number, radius: number, weaponId: string) => {
        // Do NOT emit to socket
        this.applyExplosion(x, y, radius, weaponId, false);
    };

    this.worm.onProjectileExplode = handleExplosion;
    this.worm.onDamage = (amount: number) => {
        // More blood: 3x amount
        for (let i = 0; i < amount * 3; i++) {
            this.bloodParticles.push(new BloodParticle(this, this.worm.x, this.worm.y, this.terrain));
        }
    };
    this.worm.onDeath = () => {
        this.socket.emit('playerDied', null);
        // Spawn Gibs
        for (let i = 0; i < 10; i++) {
            new Gib(this, this.worm.x, this.worm.y, this.terrain);
        }
        // More blood: 100 particles
        for (let i = 0; i < 100; i++) {
            this.bloodParticles.push(new BloodParticle(this, this.worm.x, this.worm.y, this.terrain));
        }
    };

    // Create Bot - ONLY if single player
    // We will check this in 'currentPlayers' or 'newPlayer' as well to remove it
    this.bot = new BotWorm(this, 400, 50, this.terrain);
    this.bot.setTarget(this.worm); // Target the player
    this.ensureClearSpace(400, 50, false); // Carve for bot locally
    
    this.bot.onProjectileExplode = handleBotExplosion;
    this.bot.onDamage = (amount: number) => {
        for (let i = 0; i < amount * 3; i++) {
            this.bloodParticles.push(new BloodParticle(this, this.bot.x, this.bot.y, this.terrain, 0x990000)); // Darker blood for bot
        }
    };
    this.bot.onDeath = () => {
        for (let i = 0; i < 10; i++) {
            new Gib(this, this.bot.x, this.bot.y, this.terrain, 0x999999); // Grey gibs
        }
        for (let i = 0; i < 100; i++) {
            this.bloodParticles.push(new BloodParticle(this, this.bot.x, this.bot.y, this.terrain, 0x990000));
        }
        // Bot respawn logic
        this.time.delayedCall(2000, () => {
            if (this.bot) {
                this.bot.x = 400;
                this.bot.y = 50;
                this.bot.hp = 100;
                this.bot.updateHealthBar();
                this.bot.setActive(true);
                this.bot.setVisible(true);
                this.ensureClearSpace(400, 50, false); // Carve for bot respawn
            }
        });
        // Hide bot temporarily
        this.bot.setActive(false);
        this.bot.setVisible(false);
        this.bot.x = -1000; // Move away
    };

    // Input
    if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
    }
    
    // Mouse for firing
    // Removed pointerdown/up for firing, handled in update loop for auto-fire
    
    // Disable context menu
    this.input.mouse?.disableContextMenu();

    // Weapon Selection Keys
    this.input.keyboard?.on('keydown-ONE', () => { this.worm.selectWeapon(0); this.updateWeaponText(); });
    this.input.keyboard?.on('keydown-TWO', () => { this.worm.selectWeapon(1); this.updateWeaponText(); });
    this.input.keyboard?.on('keydown-THREE', () => { this.worm.selectWeapon(2); this.updateWeaponText(); });
    this.input.keyboard?.on('keydown-FOUR', () => { this.worm.selectWeapon(3); this.updateWeaponText(); });
    this.input.keyboard?.on('keydown-FIVE', () => { this.worm.selectWeapon(4); this.updateWeaponText(); });

    // Menu
    this.input.keyboard?.on('keydown-ESC', () => {
        this.scene.pause();
        this.scene.launch('InGameMenuScene');
    });

    // Minimap - Only if map is larger than screen
    if (this.mapWidth > this.scale.width || this.mapHeight > this.scale.height) {
        const minimapWidth = 200;
        const minimapHeight = minimapWidth * (this.mapHeight / this.mapWidth);
        const minimap = this.cameras.add(this.scale.width - minimapWidth - 10, 10, minimapWidth, minimapHeight);
        minimap.setZoom(minimapWidth / this.mapWidth);
        minimap.setBackgroundColor(0x111111);
        minimap.centerOn(this.mapWidth / 2, this.mapHeight / 2);
        minimap.setName('minimap');
        
        // Ignore UI
        if (this.weaponText) minimap.ignore(this.weaponText);
        if ((this as any).clientText) minimap.ignore((this as any).clientText);
        if (this.statsText) minimap.ignore(this.statsText);

        // Ignore Worm Details
        if (this.worm) {
            minimap.ignore(this.worm.nameText);
            minimap.ignore(this.worm.healthBar);
            minimap.ignore(this.worm.aimGraphics);
            minimap.ignore(this.worm.ropeGraphics);
        }

        // Ignore Bot Details
        if (this.bot) {
            minimap.ignore(this.bot.nameText);
            minimap.ignore(this.bot.healthBar);
            minimap.ignore(this.bot.aimGraphics);
            minimap.ignore(this.bot.ropeGraphics);
        }
        
        // Border
        const border = this.add.graphics();
        border.lineStyle(2, 0xffffff, 0.5);
        border.strokeRect(this.scale.width - minimapWidth - 10, 10, minimapWidth, minimapHeight);
        border.setScrollFactor(0).setDepth(1000);
    }

    // Request game state sync
    this.socket.emit('requestGameSync');
    
    // Notify server we are loaded and ready for countdown
    this.socket.emit('playerLoaded');
  }

  ensureClearSpace(x: number, y: number, emit: boolean = false) {
      if (this.terrain.isSolid(x, y)) {
          const radius = 20;
          this.terrain.carve(x, y, radius);
          if (emit && this.socket && this.socket.connected) {
              this.socket.emit('terrainExplosion', { x, y, radius, weaponId: 'spawn' });
          }
      }
  }

  carveSpawn(x: number, y: number) {
      this.ensureClearSpace(x, y, true);
  }

  applyExplosion(x: number, y: number, radius: number, weaponId: string, isSelf: boolean) {
      this.createExplosionParticles(x, y, radius, weaponId);

      // Damage Check
      const checkDamage = (w: Worm, isOwner: boolean) => {
          const dist = Phaser.Math.Distance.Between(x, y, w.x, w.y);
          if (dist < radius + 10) {
              if (isOwner && radius <= 10) {
                  return; 
              }
              const dmg = Math.floor((1 - dist / (radius + 15)) * 20);
              if (dmg > 0) w.takeDamage(dmg);
          }
      };
      
      checkDamage(this.worm, isSelf);
      if (this.bot) checkDamage(this.bot, false); // Bot never owns the explosion in this context (simplified)
      Object.values(this.otherPlayers).forEach(p => checkDamage(p as any, false));
  }

  checkWormHit(x: number, y: number, radius: number, owner: any): boolean {
      const worms = [this.worm, this.bot, ...Object.values(this.otherPlayers)].filter(w => w && w !== owner);
      
      for (const w of worms) {
          if (!w.active) continue;
          const dist = Phaser.Math.Distance.Between(x, y, w.x, w.y);
          if (dist < radius + 5) {
              return true;
          }
      }
      return false;
  }

  checkLineWormHit(x1: number, y1: number, x2: number, y2: number, owner: any) {
      const worms = [this.worm, this.bot, ...Object.values(this.otherPlayers)].filter(w => w && w !== owner && w.active);
      let closestHit = null;
      let minT = 1.0;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx*dx + dy*dy;
      if (lenSq === 0) return null;

      for (const w of worms) {
          const wx = w.x;
          const wy = w.y;
          
          // Project w onto line
          let t = ((wx - x1) * dx + (wy - y1) * dy) / lenSq;
          // Clamp to segment
          t = Math.max(0, Math.min(1, t));
          
          const cx = x1 + t * dx;
          const cy = y1 + t * dy;
          
          const distSq = (wx - cx)*(wx - cx) + (wy - cy)*(wy - cy);
          const hitRadius = 8; // Generous hit box (worm radius is ~4)
          
          if (distSq < hitRadius * hitRadius) {
              if (t < minT) {
                  minT = t;
                  closestHit = { worm: w, x: cx, y: cy };
              }
          }
      }
      return closestHit;
  }

  updateWeaponText() {
      if (this.weaponText) {
          this.weaponText.setText(`Weapon: ${this.worm.getCurrentWeaponName()}`);
      }
  }

  createExplosionParticles(x: number, y: number, _radius: number, weaponId?: string) {
      let color = 0xffaa00;
      let scaleStart = 0.5;
      let lifespan = 300;
      let quantity = 10;
      let blendMode = 'ADD';
      let gravityY = 0;
      let speed = { min: 50, max: 200 };

      if (weaponId === 'laser') {
          color = 0x00ffff;
          scaleStart = 0.3;
          lifespan = 100;
          quantity = 5;
      } else if (weaponId === 'napalm') {
          color = 0xff4400;
          scaleStart = 0.4;
          lifespan = 600;
          quantity = 8;
          gravityY = 300; // Liquid dripping down
          speed = { min: 10, max: 60 }; // Low explosive force, just a splash
      } else if (weaponId === 'grenade' || weaponId === 'cluster') {
          color = 0x555555; // Smoke
          scaleStart = 0.8;
          lifespan = 600;
      } else if (weaponId === 'nuke') {
          color = 0xff0000; // Red/Orange core
          scaleStart = 2.0; 
          lifespan = 1000; 
          quantity = 100; 
          speed = { min: 20, max: 150 }; // Slower expansion to match radius
      } else if (weaponId === 'shotgun') {
          scaleStart = 0.2; // Small particles
          quantity = 3; // Few particles per pellet
          lifespan = 200;
      }

      const particles = this.add.particles(x, y, 'particle', {
          speed: speed,
          angle: { min: 0, max: 360 },
          scale: { start: scaleStart, end: 0 },
          blendMode: blendMode,
          lifespan: lifespan,
          gravityY: gravityY,
          quantity: quantity,
          tint: color
      });
      
      // Create a texture for the particle if it doesn't exist
      if (!this.textures.exists('particle')) {
          const graphics = this.make.graphics({ x: 0, y: 0 });
          graphics.fillStyle(0xffffff, 1); // White base, tinted later
          graphics.fillCircle(4, 4, 4);
          graphics.generateTexture('particle', 8, 8);
      }
      
      // Auto destroy emitter
      this.time.delayedCall(lifespan, () => {
          particles.destroy();
      });
  }

  addOtherPlayer(playerInfo: PlayerState) {
      const otherWorm = new RemoteWorm(this, playerInfo);
      this.otherPlayers[playerInfo.id] = otherWorm;
      
      // Hide details on minimap
      const mm = this.cameras.getCamera('minimap');
      if (mm) {
          mm.ignore(otherWorm.nameText);
          mm.ignore(otherWorm.healthBar);
          mm.ignore(otherWorm.aimGraphics);
          mm.ignore(otherWorm.ropeGraphics);
      }

      // Ensure they have space locally (in case we missed their spawn event)
      this.ensureClearSpace(playerInfo.x, playerInfo.y, false);
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    
    // Update Remote Players
    Object.values(this.otherPlayers).forEach(p => p.update(dt));
    
    // Update Blood Particles
    this.bloodGraphics.clear();
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
        const p = this.bloodParticles[i];
        p.update(dt);
        if (!p.active) {
            this.bloodParticles.splice(i, 1);
        } else {
            // Draw flying blood
            this.bloodGraphics.fillStyle(p.color, 1);
            this.bloodGraphics.fillRect(p.x, p.y, 1, 1);
        }
    }
    
    // Refresh terrain texture if we have active blood particles or gibs (simplification: just refresh every frame if particles exist)
    this.terrain.refresh();

    if (this.worm && this.cursors) {
        if (this.isGameRunning) {
            const pointer = this.input.activePointer;
            this.worm.update(time, delta, this.cursors, pointer, this.wasd);
            
            // Auto-fire / Rope Logic
            // Priority: Rope > Fire
            // This prevents shooting while roping, and ensures rope works even if left click is not held.
            
            if (pointer.rightButtonDown()) {
                this.worm.fireRope();
            } else {
                this.worm.releaseRope();
                
                // Only fire if not roping (Right button not held)
                // Use trigger to handle charging
                this.worm.trigger(time, pointer.isDown);
            }

            // Send movement
            if (this.socket && this.socket.connected) {
                this.socket.emit('playerMovement', {
                    x: this.worm.x,
                    y: this.worm.y,
                    vx: this.worm.velocity.x,
                    vy: this.worm.velocity.y,
                    aimAngle: this.worm.aimAngle, // Use aimAngle, not rotation (which is now 0)
                    ropeActive: this.worm.ropeActive,
                    ropeAnchor: this.worm.ropeAnchor,
                    hp: this.worm.hp, // Sync HP
                    name: (this.worm as any).nameText?.text // Sync Name if possible, or send once on join
                });
            }
        } else {
            // Game not running (Countdown) - Physics only, no input
            // Pass dummy input to update() so gravity/collision still works
            const dummyCursors = { left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } } as any;
            const dummyWasd = { left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } };
            const dummyPointer = { worldX: this.worm.x + Math.cos(this.worm.aimAngle)*20, worldY: this.worm.y + Math.sin(this.worm.aimAngle)*20, isDown: false } as any;
            
            this.worm.update(time, delta, dummyCursors, dummyPointer, dummyWasd);

            // Send movement even during countdown so others see us falling/settling
            if (this.socket && this.socket.connected) {
                this.socket.emit('playerMovement', {
                    x: this.worm.x,
                    y: this.worm.y,
                    vx: 0,
                    vy: 0,
                    aimAngle: this.worm.aimAngle,
                    ropeActive: false,
                    ropeAnchor: null,
                    hp: this.worm.hp
                });
            }
        }
    }
    if (this.bot) {
        // Update bot always (so it falls during countdown)
        // Pass isFrozen = !isGameRunning
        // BotWorm.update expects (time, delta, cursors, pointer, isFrozen)
        // We pass empty cursors and a dummy pointer.
        // The bot calculates its own pointer internally in update() override, but we need to pass something to satisfy TS if we didn't change signature.
        // Actually we did change signature in BotWorm to ignore pointer arg mostly but we should pass valid structure.
        this.bot.update(time, delta, {}, { worldX: 0, worldY: 0, isDown: false }, !this.isGameRunning);
    }
  }

  fireRemoteLaser(x: number, y: number, angle: number, def: any) {
      const maxDist = 500;
      const endX = x + Math.cos(angle) * maxDist;
      const endY = y + Math.sin(angle) * maxDist;
      
      const hit = this.terrain.raycast(x, y, endX, endY);
      const targetX = hit ? hit.x : endX;
      const targetY = hit ? hit.y : endY;

      // Visual Beam
      const graphics = this.add.graphics();
      graphics.lineStyle(2, def.color, 1);
      graphics.lineBetween(x, y, targetX, targetY);
      
      // Fade out
      this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 100,
          onComplete: () => graphics.destroy()
      });
  }

  startCountdown() {
      this.isGameRunning = false;
      let count = 3;
      
      this.countdownText = this.add.text(400, 300, count.toString(), {
          fontSize: '64px',
          color: '#ff0000',
          stroke: '#000000',
          strokeThickness: 6
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
      
      this.cameras.getCamera('minimap')?.ignore(this.countdownText);

      const timer = this.time.addEvent({
          delay: 1000,
          callback: () => {
              count--;
              if (count > 0) {
                  this.countdownText?.setText(count.toString());
              } else if (count === 0) {
                  this.countdownText?.setText('GO!');
                  this.countdownText?.setColor('#00ff00');
                  this.isGameRunning = true;
              } else {
                  this.countdownText?.destroy();
                  timer.remove();
              }
          },
          repeat: 3
      });
  }
}
