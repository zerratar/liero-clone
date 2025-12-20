import Phaser from 'phaser';
import { Terrain } from './Terrain';
import { WeaponDef, WEAPONS } from '../../../shared/weapons';
import { Projectile } from './Projectile';
import { Socket } from 'socket.io-client';

export class Worm extends Phaser.GameObjects.Container {
  public terrain: Terrain;
  private socket?: Socket; // Optional because remote worms might not need it, or we pass it to all
  public velocity: Phaser.Math.Vector2;
  private isOnGround: boolean = false;
  private radius: number = 4;
  public hp: number = 100;
  
  // Rope
  public ropeActive: boolean = false;

  public ropeAnchor: Phaser.Math.Vector2 | null = null;
  private ropeLength: number = 0;
  public ropeGraphics: Phaser.GameObjects.Graphics;

  // Weapons
  private weapons: WeaponDef[] = [WEAPONS['bazooka'], WEAPONS['grenade'], WEAPONS['shotgun']];
  private currentWeapon: WeaponDef;
  private projectiles: Projectile[] = [];
  public onProjectileExplode?: (x: number, y: number, radius: number, weaponId: string) => void;
  public onDeath?: () => void;
  public onDamage?: (amount: number) => void;
  public isInvulnerable: boolean = false;
  public isDead: boolean = false;
  
  private lastFireTime: number = 0;
  public isCharging: boolean = false;
  public chargeLevel: number = 0; // 0 to 1
  private chargeStartTime: number = 0;

  public healthBar: Phaser.GameObjects.Graphics;
  public nameText: Phaser.GameObjects.Text;
  private bodyGraphics: Phaser.GameObjects.Graphics;
  public aimGraphics: Phaser.GameObjects.Graphics;
  private color: number;
  private animationTimer: number = 0;
  private shieldGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, terrain: Terrain, socket?: Socket, color: number = 0xE57373, name: string = 'Worm') {
    super(scene, x, y);
    this.terrain = terrain;
    this.socket = socket;
    this.color = color;
    this.velocity = new Phaser.Math.Vector2(0, 0);
    this.currentWeapon = this.weapons[0];

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
    this.aimGraphics.y = -4; // Move pivot up to chest/shoulder height
    // Aim line (Laser sight style)
    this.aimGraphics.lineStyle(1, 0xff0000, 0.3);
    this.aimGraphics.lineBetween(0, 0, 30, 0);
    this.add(this.aimGraphics);

    this.ropeGraphics = scene.add.graphics();
    
    // Health Bar
    this.healthBar = scene.add.graphics();
    this.add(this.healthBar);
    
    // Name Tag
    // Only show name tag if it's NOT the local player (or if we want to see our own name but different color)
    // User requested: "I dont see my own player name. It shouldnt be 'Player' on top of my player. it should just say my name + a color distinguishable for me."
    // So we show it, but maybe different color.
    const nameColor = '#00ff00'; // Green for self
    
    this.nameText = scene.add.text(0, -25, name, {
        fontSize: '10px',
        color: nameColor,
        stroke: '#000000',
        strokeThickness: 2
    }).setOrigin(0.5);
    this.add(this.nameText);
    
    this.updateHealthBar();

    scene.add.existing(this);
    this.setDepth(10);
  }

  public get aimAngle(): number {
      return this.aimGraphics.rotation;
  }
  
  public set aimAngle(val: number) {
      this.aimGraphics.rotation = val;
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

  update(_time: number, delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys, pointer: Phaser.Input.Pointer, wasd?: any) {
    const dt = delta / 1000; // seconds

    // Charge Logic
    if (this.isCharging) {
        const maxChargeTime = 1000; // 1 second to full charge
        const elapsed = this.scene.time.now - this.chargeStartTime;
        this.chargeLevel = Math.min(1, elapsed / maxChargeTime);
    }

    // Aim
    // Use world coordinates if available (pointer.worldX/Y are updated by the camera)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    
    // Rotate Aim Graphics only
    this.aimGraphics.rotation = angle;
    
    // Flip Body based on Aim Direction
    if (Math.abs(angle) > Math.PI / 2) {
        this.bodyGraphics.scaleX = -1; // Face Left
    } else {
        this.bodyGraphics.scaleX = 1; // Face Right
    }

    // Input
    const left = cursors.left.isDown || (wasd && wasd.left.isDown);
    const right = cursors.right.isDown || (wasd && wasd.right.isDown);
    const up = cursors.up.isDown || (wasd && wasd.up.isDown);
    const down = cursors.down.isDown || (wasd && wasd.down.isDown);

    // Digging Logic (Hold Dir + Press Opposite)
    if (left && right) {
        // Digging
        if (this.velocity.x > 10) {
            // Moving Right -> Dig Right
            this.dig(1);
        } else if (this.velocity.x < -10) {
            // Moving Left -> Dig Left
            this.dig(-1);
        } else {
            // Fallback to aim direction if stuck
            if (Math.abs(this.aimGraphics.rotation) < Math.PI / 2) {
                this.dig(1);
            } else {
                this.dig(-1);
            }
        }
    }

    if (left) {
      this.velocity.x -= 10;
    } else if (right) {
      this.velocity.x += 10;
    } else {
      this.velocity.x *= 0.9; // Friction
    }

    // Max Speed Cap
    const maxSpeed = 150;
    if (this.velocity.x > maxSpeed) this.velocity.x = maxSpeed;
    if (this.velocity.x < -maxSpeed) this.velocity.x = -maxSpeed;

    if (up && this.isOnGround) {
      this.velocity.y = -200;
      this.isOnGround = false;
    }

    // Gravity
    if (!this.isOnGround) {
        this.velocity.y += 500 * dt;
    } else {
        // Check if we walked off a cliff
        // Check slightly below the worm
        if (!this.terrain.isSolid(this.x, this.y + this.radius + 2)) {
            this.isOnGround = false;
            this.velocity.y += 500 * dt;
        } else {
            this.velocity.y = 0;
        }
    }

    // Rope Logic
    if (this.ropeActive && this.ropeAnchor) {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.ropeAnchor.x, this.ropeAnchor.y);
        const dir = new Phaser.Math.Vector2(this.ropeAnchor.x - this.x, this.ropeAnchor.y - this.y).normalize();
        
        // Rope Control: Shorten/Lengthen
        if (up) {
            this.ropeLength -= 150 * dt; // Faster reeling
        } else if (down) {
            this.ropeLength += 150 * dt;
        }
        
        // Ensure min length
        if (this.ropeLength < 0) this.ropeLength = 0;

        // Spring/Constraint force
        if (dist > this.ropeLength) {
            const force = (dist - this.ropeLength) * 10; // Spring constant
            this.velocity.x += dir.x * force * dt;
            this.velocity.y += dir.y * force * dt;
            
            // Damping
            this.velocity.x *= 0.99;
            this.velocity.y *= 0.99;
        }
    }

    // Apply Velocity with Sub-stepping
    const speed = this.velocity.length();
    const stepSize = 2; // Check every 2 pixels
    const totalDist = speed * dt;

    if (totalDist < stepSize) {
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        this.checkCollision();
    } else {
        const steps = Math.ceil(totalDist / stepSize);
        const stepX = (this.velocity.x * dt) / steps;
        const stepY = (this.velocity.y * dt) / steps;

        for (let i = 0; i < steps; i++) {
            this.x += stepX;
            this.y += stepY;
            this.checkCollision();
            // If we hit something and stopped, maybe we should stop iterating?
            // But checkCollision modifies position (pushes out) and velocity (stops).
            // If velocity is zeroed, we should stop.
            if (this.velocity.lengthSq() < 0.1) break;
        }
    }
    
    this.drawRope();

    // Update Projectiles list (cleanup only, updates are handled by scene event)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (!p.active) {
            this.projectiles.splice(i, 1);
        }
    }
    
    this.animationTimer += dt;
    this.drawWorm();
  }

  drawWorm() {
      this.bodyGraphics.clear();
      this.bodyGraphics.fillStyle(this.color, 1);

      // Head (Upright)
      this.bodyGraphics.fillCircle(0, -6, 4);
      
      // Eye
      this.bodyGraphics.fillStyle(0xFFFFFF, 1);
      this.bodyGraphics.fillCircle(2, -7, 2);
      this.bodyGraphics.fillStyle(0x000000, 1);
      this.bodyGraphics.fillCircle(3, -7, 1);

      // Body Segments (L-Shape)
      this.bodyGraphics.fillStyle(this.color, 1);
      const segments = 5;
      
      for (let i = 1; i <= segments; i++) {
          let offsetX = 0;
          let offsetY = 0;
          
          // Base L-Shape positions (Facing Right)
          // Smooth curve from (0, -6) down to (-X, 0)
          if (i === 1) { offsetX = -1; offsetY = -3.5; }
          else if (i === 2) { offsetX = -2; offsetY = -1.0; }
          else { 
              // Tail on ground
              offsetX = -2 - ((i-2) * 2.2); 
              offsetY = 1.5; 
          }

          // Animation
          if (Math.abs(this.velocity.x) > 10 && this.isOnGround) {
              // Walking: Wiggle tail
              if (i > 2) {
                  offsetY += Math.sin(this.animationTimer * 20 + i) * 2;
                  // Compress/Stretch
                  offsetX += Math.cos(this.animationTimer * 20) * 1;
              }
          } else if (!this.isOnGround) {
              // Jumping: Curl up
              // Transition to a ball shape
              if (i === 3) { offsetX = -2; offsetY = 0; }
              if (i === 4) { offsetX = -1; offsetY = 2; }
              if (i === 5) { offsetX = 0; offsetY = 3; }
          }
          
          const size = 4 - (i * 0.4);
          this.bodyGraphics.fillCircle(offsetX, offsetY, size);
      }
  }

  trigger(time: number, isDown: boolean) {
      if (isDown) {
          if (this.currentWeapon.chargeable) {
              if (!this.isCharging) {
                  this.isCharging = true;
                  this.chargeStartTime = time;
                  this.chargeLevel = 0;
              }
          } else {
              this.fire(time);
          }
      } else {
          if (this.isCharging) {
              this.fire(time, this.chargeLevel);
              this.isCharging = false;
              this.chargeLevel = 0;
          }
      }
  }

  fire(time: number, charge: number = 0) {
      if (this.ropeActive) return; // Double check: Cannot fire if rope is active
      if (time < this.lastFireTime + this.currentWeapon.fireRateMs) return;
      this.lastFireTime = time;

      let angle = this.aimGraphics.rotation;
      if (this.currentWeapon.id !== 'laser') {
          const spread = this.currentWeapon.spread;
          angle = this.aimGraphics.rotation + (Math.random() - 0.5) * spread;
      }

      // Calculate speed multiplier based on charge
      // Min speed 20% of max, max speed 100%
      // Or if charge is 0 (tap), maybe 20%?
      // If weapon is chargeable, use charge. Else 1.
      let speedMultiplier = 1;
      if (this.currentWeapon.chargeable) {
          speedMultiplier = 0.2 + (0.8 * charge);
      }

      if (this.socket) {
          this.socket.emit('playerFired', {
              x: this.x,
              y: this.y,
              angle: angle,
              weaponId: this.currentWeapon.id,
              charge: charge // Send charge to server/other clients
          });
      }

      if (this.currentWeapon.id === 'laser') {
          this.fireLaser();
      } else {
          const pellets = this.currentWeapon.pellets || 1;
          for (let i = 0; i < pellets; i++) {
              let projectileAngle = angle;
              if (pellets > 1) {
                  // Recalculate spread for each pellet
                  const spread = this.currentWeapon.spread;
                  projectileAngle = this.aimGraphics.rotation + (Math.random() - 0.5) * spread;
              }

              const p = new Projectile(this.scene, this.x, this.y, projectileAngle, this.currentWeapon, this.terrain, this.onProjectileExplode, false, (x, y, r, owner, oldX, oldY) => {
                  if (oldX !== undefined && oldY !== undefined) {
                      const hit = (this.scene as any).checkLineWormHit(oldX, oldY, x, y, owner);
                      return !!hit;
                  }
                  return (this.scene as any).checkWormHit ? (this.scene as any).checkWormHit(x, y, r, owner) : false;
              }, this, speedMultiplier);
              this.projectiles.push(p);
          }
      }
  }

  fireLaser() {
      const maxDist = 500;
      const endX = this.x + Math.cos(this.aimGraphics.rotation) * maxDist;
      const endY = this.y + Math.sin(this.aimGraphics.rotation) * maxDist;
      
      const hit = this.terrain.raycast(this.x, this.y, endX, endY);
      let targetX = hit ? hit.x : endX;
      let targetY = hit ? hit.y : endY;

      // Check for worm hit along the path
      const wormHit = (this.scene as any).checkLineWormHit(this.x, this.y, targetX, targetY, this);
      if (wormHit) {
          targetX = wormHit.x;
          targetY = wormHit.y;
      }

      // Visual Beam
      const graphics = this.scene.add.graphics();
      graphics.lineStyle(2, this.currentWeapon.color, 1);
      graphics.lineBetween(this.x, this.y, targetX, targetY);
      
      // Fade out
      this.scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 100,
          onComplete: () => graphics.destroy()
      });

      // Explosion/Damage at impact
      if ((hit || wormHit) && this.onProjectileExplode) {
          // If we hit a worm, we still want to explode/damage
          this.onProjectileExplode(targetX, targetY, this.currentWeapon.explosionRadius, this.currentWeapon.id);
          // Only carve if we hit terrain (or if laser always carves?)
          // Laser usually carves a bit at the end.
          this.terrain.carve(targetX, targetY, this.currentWeapon.terrainDestruction);
      }
  }

  setWeapons(weaponIds: string[]) {
      this.weapons = [];
      weaponIds.forEach(id => {
          if (WEAPONS[id]) {
              this.weapons.push(WEAPONS[id]);
          }
      });
      if (this.weapons.length > 0) {
          this.currentWeapon = this.weapons[0];
      }
  }

  selectWeapon(index: number) {
      if (index >= 0 && index < this.weapons.length) {
          this.currentWeapon = this.weapons[index];
      }
  }

  getCurrentWeaponName(): string {
      return this.currentWeapon.name;
  }

  fireRope() {
      if (this.ropeActive) return;

      const maxLen = 2000; // Increased range significantly
      // Use aimGraphics.rotation instead of this.aimAngle (getter) just to be explicit, though getter works
      const targetX = this.x + Math.cos(this.aimGraphics.rotation) * maxLen;
      const targetY = this.y + Math.sin(this.aimGraphics.rotation) * maxLen;

      const hit = this.terrain.raycast(this.x, this.y, targetX, targetY);
      if (hit) {
          this.ropeActive = true;
          this.ropeAnchor = hit;
          this.ropeLength = Phaser.Math.Distance.Between(this.x, this.y, hit.x, hit.y);
      }
  }

  releaseRope() {
      this.ropeActive = false;
      this.ropeAnchor = null;
  }

  checkCollision() {
    // Check bottom (Ground)
    if (this.terrain.isSolid(this.x, this.y + this.radius)) {
        // Push up until free
        let pushed = 0;
        while (this.terrain.isSolid(this.x, this.y + this.radius) && pushed < 10) {
            this.y -= 1;
            pushed++;
        }
        
        if (this.velocity.y > 0) {
            this.velocity.y = 0;
            this.isOnGround = true;
            // Snap to pixel grid to stop jitter
            this.y = Math.floor(this.y);
        }
    }
    // Do not set isOnGround = false here. 
    // It is handled by the cliff check in update() and the jump logic.
    // Setting it false here causes flickering when standing on top of terrain without penetrating.
    
    // Check top (Ceiling)
    if (this.terrain.isSolid(this.x, this.y - this.radius)) {
        let pushed = 0;
        while (this.terrain.isSolid(this.x, this.y - this.radius) && pushed < 10) {
            this.y += 1;
            pushed++;
        }
        if (this.velocity.y < 0) this.velocity.y = 0;
    }

    // Check right
    if (this.terrain.isSolid(this.x + this.radius, this.y)) {
        let pushed = 0;
        while (this.terrain.isSolid(this.x + this.radius, this.y) && pushed < 10) {
            this.x -= 1;
            pushed++;
        }
        if (this.velocity.x > 0) this.velocity.x = 0;
        this.x = Math.floor(this.x);
    }

    // Check left
    if (this.terrain.isSolid(this.x - this.radius, this.y)) {
        let pushed = 0;
        while (this.terrain.isSolid(this.x - this.radius, this.y) && pushed < 10) {
            this.x += 1;
            pushed++;
        }
        if (this.velocity.x < 0) this.velocity.x = 0;
        this.x = Math.floor(this.x);
    }
  }

  dig(dir: number) {
      // Dig in front of the worm
      const digDist = 10;
      const digRadius = 8;
      const targetX = this.x + dir * digDist;
      const targetY = this.y;
      
      this.terrain.carve(targetX, targetY, digRadius);
  }

  drawRope() {
      this.ropeGraphics.clear();
      if (this.ropeActive && this.ropeAnchor) {
          // Rope: Brownish
          this.ropeGraphics.lineStyle(1, 0x8B4513); 
          this.ropeGraphics.lineBetween(this.x, this.y - 4, this.ropeAnchor.x, this.ropeAnchor.y);
          
          // Hook: Gray
          this.ropeGraphics.fillStyle(0x808080, 1);
          this.ropeGraphics.fillRect(this.ropeAnchor.x - 2, this.ropeAnchor.y - 2, 4, 4);
      }
  }

  setInvulnerable(duration: number) {
      this.isInvulnerable = true;
      this.alpha = 0.5;
      this.shieldGraphics.setVisible(false);
      
      this.scene.time.delayedCall(duration, () => {
          if (this.active) {
            this.isInvulnerable = false;
            this.alpha = 1;
            this.shieldGraphics.setVisible(false);
          }
      });
  }

  takeDamage(amount: number) {
      if (this.isInvulnerable || this.isDead) {
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
          }
          return;
      }

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
      
      if (this.onDamage) {
          this.onDamage(amount);
      }

      if (this.hp <= 0 && this.onDeath) {
          this.isDead = true;
          this.onDeath();
      }
  }
}
