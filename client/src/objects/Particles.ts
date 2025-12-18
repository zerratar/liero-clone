import Phaser from 'phaser';
import { Terrain } from './Terrain';

export class BloodParticle {
    public x: number;
    public y: number;
    private velocity: Phaser.Math.Vector2;
    private terrain: Terrain;
    public color: number;
    public active: boolean = true;

    constructor(_scene: Phaser.Scene, x: number, y: number, terrain: Terrain, color: number = 0xff0000) {
        this.x = x;
        this.y = y;
        this.terrain = terrain;
        this.color = color;
        
        // Random velocity spread
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 50;
        this.velocity = new Phaser.Math.Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    update(dt: number) {
        if (!this.active) return;

        // Gravity
        this.velocity.y += 500 * dt;

        // Move
        const nextX = this.x + this.velocity.x * dt;
        const nextY = this.y + this.velocity.y * dt;

        // Check collision
        if (this.terrain.isSolid(Math.round(nextX), Math.round(nextY))) {
            this.terrain.stain(Math.round(nextX), Math.round(nextY), this.color);
            this.active = false;
        } else {
            this.x = nextX;
            this.y = nextY;
        }

        // Bounds check
        if (this.x < 0 || this.x > this.terrain.width || this.y < 0 || this.y > this.terrain.height) {
            this.active = false;
        }
    }
    
    // Render is handled by the stain, but we could draw a pixel while moving if we wanted.
    // For now, let's just draw a pixel to the scene's graphics if we want to see it in air.
    // But for performance, maybe just a single graphics object in GameScene handling all particles.
}

export class Gib extends Phaser.GameObjects.Container {
    private velocity: Phaser.Math.Vector2;
    private terrain: Terrain;
    private color: number;
    private lifeTime: number = 5; // seconds
    private bounceFactor: number = 0.5;
    private graphics: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, x: number, y: number, terrain: Terrain, color: number = 0xff0000) {
        super(scene, x, y);
        this.terrain = terrain;
        this.color = color;
        
        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 100;
        this.velocity = new Phaser.Math.Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);

        // Visuals
        this.graphics = scene.add.graphics();
        this.graphics.fillStyle(color, 1);
        // Random shape
        const size = Math.random() * 3 + 2;
        this.graphics.fillRect(-size/2, -size/2, size, size);
        this.add(this.graphics);
        
        scene.add.existing(this);
        scene.events.on('update', this.update, this);
    }

    destroy() {
        this.scene.events.off('update', this.update, this);
        super.destroy();
    }

    update(_time: number, delta: number) {
        const dt = delta / 1000;
        this.lifeTime -= dt;
        
        // Fade out in the last 2 seconds
        if (this.lifeTime < 2) {
            this.alpha = this.lifeTime / 2;
        }
        
        if (this.lifeTime <= 0) {
            this.destroy();
            return;
        }

        // Gravity
        this.velocity.y += 500 * dt;

        // Move X
        let nextX = this.x + this.velocity.x * dt;
        if (this.terrain.isSolid(Math.round(nextX), Math.round(this.y))) {
            this.velocity.x *= -this.bounceFactor;
            nextX = this.x;
        }
        this.x = nextX;

        // Move Y
        let nextY = this.y + this.velocity.y * dt;
        if (this.terrain.isSolid(Math.round(this.x), Math.round(nextY))) {
            this.velocity.y *= -this.bounceFactor;
            this.velocity.x *= 0.8; // Friction
            nextY = this.y;
            
            // Stop if slow
            if (Math.abs(this.velocity.y) < 20) this.velocity.y = 0;
        }
        this.y = nextY;

        // Stain trail occasionally
        if (Math.random() < 0.3) {
             this.terrain.stain(Math.round(this.x), Math.round(this.y), this.color);
        }

        // Rotation
        this.rotation += this.velocity.x * dt * 0.1;
    }
}
