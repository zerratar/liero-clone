import Phaser from 'phaser';
import { PlayerState } from '../../../shared/types';

export class RemoteWorm extends Phaser.GameObjects.Container {
  public ropeGraphics: Phaser.GameObjects.Graphics;
  public healthBar: Phaser.GameObjects.Graphics;
  public nameText: Phaser.GameObjects.Text;
  public hp: number = 100;
  public isInvulnerable: boolean = false;
  
  private bodyGraphics: Phaser.GameObjects.Graphics;
  public aimGraphics: Phaser.GameObjects.Graphics;
  private shieldGraphics: Phaser.GameObjects.Graphics;
  private animationTimer: number = 0;
  private velocity: { x: number, y: number } = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, state: PlayerState) {
    super(scene, state.x, state.y);
    
    // Body Visuals
    this.bodyGraphics = scene.add.graphics();
    this.add(this.bodyGraphics);

    // Shield Visuals (Initially hidden)
    this.shieldGraphics = scene.add.graphics();
    this.shieldGraphics.lineStyle(4, 0x00ffff, 0.5); // Thicker, brighter stroke, but lower alpha to match container
    this.shieldGraphics.fillStyle(0x00ffff, 0.3); // Higher alpha fill
    this.shieldGraphics.strokeCircle(0, 0, 16); // Larger radius
    this.shieldGraphics.fillCircle(0, 0, 16);
    this.shieldGraphics.setVisible(false);
    this.add(this.shieldGraphics);
    
    // Aim Visuals
    this.aimGraphics = scene.add.graphics();
    this.aimGraphics.y = -4;
    this.aimGraphics.lineStyle(1, 0xff0000, 0.3);
    this.aimGraphics.lineBetween(0, 0, 30, 0);
    this.add(this.aimGraphics);

    this.ropeGraphics = scene.add.graphics();
    
    // Health Bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);
    
    // Name Tag
    // Use name from state if available, otherwise ID
    const name = state.name || `Player ${state.id.substr(0, 4)}`;
    this.nameText = scene.add.text(0, -25, name, {
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
    }).setOrigin(0.5);
    this.add(this.nameText);
    
    scene.add.existing(this);
    this.setDepth(10);
    this.updateState(state);
  }

  updateHealthBar() {
      this.healthBar.clear();
      // Background
      this.healthBar.fillStyle(0xff0000, 1);
      this.healthBar.fillRect(-10, -15, 20, 4);
      // Health
      const width = (this.hp / 100) * 20;
      this.healthBar.fillStyle(0x00ff00, 1);
      this.healthBar.fillRect(-10, -15, width, 4);
  }

  takeDamage(amount: number) {
      if (this.isInvulnerable) {
          this.shieldGraphics.setVisible(true);
          this.shieldGraphics.alpha = 1;
          this.scene.tweens.killTweensOf(this.shieldGraphics);
          this.scene.tweens.add({
              targets: this.shieldGraphics,
              alpha: 0,
              duration: 200,
              onComplete: () => {
                  this.shieldGraphics.setVisible(false);
              }
          });
          return;
      }

      // Remote worms take damage visually, but their HP is synced from server state.
      // However, for immediate feedback, we show damage.
      // But if they are invulnerable (e.g. just respawned), we shouldn't show damage.
      // Since we don't sync 'isInvulnerable' flag yet, we can rely on the fact that
      // if the server says they have full HP, they will snap back.
      // But to avoid the "health reduced but fill up immediately" glitch, we should check if we can.
      
      // For now, let's just show the visual hit effect but NOT reduce HP locally if we suspect desync.
      // Actually, the best way is to trust the server state for HP bar, and only show floating text here.
      // But floating text is also misleading if no damage was taken.
      
      // If we want to support invulnerability on remote worms, we need to sync that state.
      // For now, let's just apply the visual flash but be conservative with HP bar.
      
      // Wait, the user complaint was likely about the BOT or LOCAL player.
      // If it was about RemoteWorm, we need to sync invulnerability.
      
      this.hp -= amount;
      if (this.hp < 0) this.hp = 0;

      // Visual Cue
      const text = this.scene.add.text(this.x, this.y - 20, `-${amount}`, {
          fontSize: '14px',
          color: '#ff0000',
          fontStyle: 'bold'
      }).setOrigin(0.5);

      this.scene.tweens.add({
          targets: text,
          y: this.y - 50,
          alpha: 0,
          duration: 1000,
          onComplete: () => text.destroy()
      });

      // Flash
      this.scene.tweens.add({
          targets: this,
          alpha: 0.5,
          duration: 50,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
              this.alpha = 1;
          }
      });
      
      this.updateHealthBar();
  }

  setInvulnerable(duration: number) {
      this.isInvulnerable = true;
      this.alpha = 0.5;
      this.shieldGraphics.setVisible(false);
      
      // Clear any existing timer
      // (If we had a timer property, we would clear it here. For simplicity, we just set a new delayed call)
      // A more robust way is to store the timer event, but for now this is fine as long as we don't spam it.
      
      this.scene.time.delayedCall(duration, () => {
          this.isInvulnerable = false;
          this.alpha = 1;
          this.shieldGraphics.setVisible(false);
      });
  }

  updateState(state: PlayerState) {
      this.x = state.x;
      this.y = state.y;
      this.velocity = { x: state.vx, y: state.vy };
      
      // Sync HP
      if (state.hp !== undefined) {
          this.hp = state.hp;
          this.updateHealthBar();
      }
      
      // Rotate Aim Graphics
      this.aimGraphics.rotation = state.aimAngle;
      
      // Flip Body
      if (Math.abs(state.aimAngle) > Math.PI / 2) {
          this.bodyGraphics.scaleX = -1;
      } else {
          this.bodyGraphics.scaleX = 1;
      }
      
      this.hp = state.hp;
      
      // Update Name if changed (and not default)
      if (state.name && this.nameText.text !== state.name) {
          this.nameText.setText(state.name);
      }
      
      this.drawRope(state);
      this.updateHealthBar();
  }

  update(dt: number) {
      this.animationTimer += dt;
      this.drawWorm();
  }

  drawWorm() {
      this.bodyGraphics.clear();
      const color = 0x0000ff; // Blue for remote players

      // Head (Upright)
      this.bodyGraphics.fillStyle(color, 1);
      this.bodyGraphics.fillCircle(0, -6, 4);
      
      // Eye
      this.bodyGraphics.fillStyle(0xFFFFFF, 1);
      this.bodyGraphics.fillCircle(2, -7, 2);
      this.bodyGraphics.fillStyle(0x000000, 1);
      this.bodyGraphics.fillCircle(3, -7, 1);

      // Body Segments (L-Shape)
      this.bodyGraphics.fillStyle(color, 1);
      const segments = 5;
      
      for (let i = 1; i <= segments; i++) {
          let offsetX = 0;
          let offsetY = 0;
          
          // Base L-Shape positions (Facing Right)
          if (i === 1) { offsetX = -1; offsetY = -3.5; }
          else if (i === 2) { offsetX = -2; offsetY = -1.0; }
          else { 
              // Tail on ground
              offsetX = -2 - ((i-2) * 2.2); 
              offsetY = 1.5; 
          }

          // Animation
          const isOnGround = Math.abs(this.velocity.y) < 10;

          if (Math.abs(this.velocity.x) > 10 && isOnGround) {
              // Walking: Wiggle tail
              if (i > 2) {
                  offsetY += Math.sin(this.animationTimer * 20 + i) * 2;
                  offsetX += Math.cos(this.animationTimer * 20) * 1;
              }
          } else if (!isOnGround) {
              // Jumping: Curl up
              if (i === 3) { offsetX = -2; offsetY = 0; }
              if (i === 4) { offsetX = -1; offsetY = 2; }
              if (i === 5) { offsetX = 0; offsetY = 3; }
          }
          
          const size = 4 - (i * 0.4);
          this.bodyGraphics.fillCircle(offsetX, offsetY, size);
      }
  }

  drawRope(state: PlayerState) {
      this.ropeGraphics.clear();
      if (state.ropeActive && state.ropeAnchor) {
          // Rope: Brownish
          this.ropeGraphics.lineStyle(1, 0x8B4513);
          this.ropeGraphics.lineBetween(this.x, this.y - 4, state.ropeAnchor.x, state.ropeAnchor.y);
          
          // Hook: Gray
          this.ropeGraphics.fillStyle(0x808080, 1);
          this.ropeGraphics.fillRect(state.ropeAnchor.x - 2, state.ropeAnchor.y - 2, 4, 4);
      }
  }
}
