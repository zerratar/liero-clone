import Phaser from 'phaser';
import { WeaponDef } from '../../../shared/weapons';
import { Terrain } from './Terrain';

export class Projectile extends Phaser.GameObjects.Container {
  private velocity: Phaser.Math.Vector2;
  private def: WeaponDef;
  private terrain: Terrain;
  private life: number;
  private onExplode?: (x: number, y: number, radius: number, weaponId: string) => void;
  private isRemote: boolean;
  private checkHit?: (x: number, y: number, radius: number, owner: any, oldX?: number, oldY?: number) => boolean;
  private owner: any;

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, def: WeaponDef, terrain: Terrain, onExplode?: (x: number, y: number, radius: number, weaponId: string) => void, isRemote: boolean = false, checkHit?: (x: number, y: number, radius: number, owner: any, oldX?: number, oldY?: number) => boolean, owner?: any, speedMultiplier: number = 1) {
    super(scene, x, y);
    this.def = def;
    this.terrain = terrain;
    this.life = def.lifetime;
    this.onExplode = onExplode;
    this.isRemote = isRemote;
    this.checkHit = checkHit;
    this.owner = owner;

    const speed = def.speed * speedMultiplier;
    this.velocity = new Phaser.Math.Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // Visuals
    const graphics = scene.add.graphics();
    graphics.fillStyle(def.color, 1);
    
    if (def.id === 'napalm') {
        // Napalm looks like fire
        graphics.fillCircle(0, 0, 3);
        this.alpha = 0.8;
    } else {
        graphics.fillCircle(0, 0, 2);
    }
    
    this.add(graphics);

    scene.add.existing(this);
    
    // Auto-update
    this.scene.events.on('update', this.update, this);
  }

  destroy(fromScene?: boolean) {
      this.scene.events.off('update', this.update, this);
      super.destroy(fromScene);
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.life -= delta;

    if (this.life <= 0) {
      // Napalm just fades out or explodes small
      if (this.def.id === 'napalm') {
          this.explode(); 
      } else {
          this.explode();
      }
      return;
    }

    // Gravity
    this.velocity.y += this.def.gravity * dt;

    // Move with sub-stepping to prevent tunneling
    const speed = this.velocity.length();
    const stepSize = 2; // Check every 2 pixels
    const totalDist = speed * dt;
    
    // If speed is 0 (e.g. mine sitting on ground), don't move
    if (speed < 0.1) {
        // Still check collision if it falls? Gravity adds velocity.
        // If velocity is 0, totalDist is 0.
    }

    if (totalDist < stepSize) {
        // Simple move if slow
        const oldX = this.x;
        const oldY = this.y;
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        this.checkCollision(dt, oldX, oldY);
    } else {
        const steps = Math.ceil(totalDist / stepSize);
        const stepX = (this.velocity.x * dt) / steps;
        const stepY = (this.velocity.y * dt) / steps;

        for (let i = 0; i < steps; i++) {
            const oldX = this.x;
            const oldY = this.y;
            this.x += stepX;
            this.y += stepY;
            if (this.checkCollision(dt / steps, oldX, oldY)) {
                break;
            }
        }
    }
  }

  checkCollision(dt: number, oldX?: number, oldY?: number): boolean {
    if (this.terrain.isSolid(this.x, this.y)) {
        if (this.def.bounciness > 0) {
            // Simple bounce (invert velocity) - improve with normal later
            this.velocity.x *= -this.def.bounciness;
            this.velocity.y *= -this.def.bounciness;
            
            // Friction for napalm
            if (this.def.id === 'napalm') {
                this.velocity.x *= 0.8;
                this.velocity.y *= 0.8;
            }

            // Push out slightly
            this.x += this.velocity.x * dt;
            this.y += this.velocity.y * dt;
            return true; 
        } else {
            this.explode();
            return true;
        }
    }

    // Check worm collision
    if (this.checkHit && this.checkHit(this.x, this.y, 2, this.owner, oldX, oldY)) {
        this.explode();
        return true;
    }

    return false;
  }

  explode() {
    if (!this.isRemote) {
        this.terrain.carve(this.x, this.y, this.def.explosionRadius);
        if (this.onExplode) {
            this.onExplode(this.x, this.y, this.def.explosionRadius, this.def.id);
        }
    }
    this.destroy();
  }
}
