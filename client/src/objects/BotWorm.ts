import { Worm } from './Worm';
import { Terrain } from './Terrain';

export class BotWorm extends Worm {
    private timer: number = 0;
    private moveState: 'idle' | 'left' | 'right' = 'idle';
    private nextMoveTime: number = 0;
    private jumpTimer: number = 0;
    private isRoping: boolean = false;
    private target: Worm | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, terrain: Terrain) {
        super(scene, x, y, terrain, undefined, 0x999999, '[CPU] Bot'); // Grey color for bot
    }

    setTarget(target: Worm) {
        this.target = target;
    }

    update(time: number, delta: number, _cursors: any, _pointer: any, isFrozen: boolean = false) {
        // AI Logic override
        this.timer += delta;
        
        if (!isFrozen) {
            if (this.timer > this.nextMoveTime) {
                // Change state
                const rand = Math.random();
                if (rand < 0.3) this.moveState = 'idle';
                else if (rand < 0.65) this.moveState = 'left';
                else this.moveState = 'right';
                
                this.nextMoveTime = this.timer + 500 + Math.random() * 1000;
            }

            // Jump occasionally
            let jump = false;
            if (this.timer > this.jumpTimer) {
                if (Math.random() < 0.3) jump = true;
                this.jumpTimer = this.timer + 1000 + Math.random() * 2000;
            }
            
            // Rope occasionally
            if (!this.isRoping && Math.random() < 0.005) {
                this.isRoping = true;
                // Stop roping after some time
                this.scene.time.delayedCall(500 + Math.random() * 1500, () => {
                    this.isRoping = false;
                });
            }

            // Fake input
            const botCursors = {
                left: { isDown: this.moveState === 'left' },
                right: { isDown: this.moveState === 'right' },
                up: { isDown: jump },
                down: { isDown: false }
            };
            
            let aimX = this.x + Math.cos(this.timer * 0.002) * 100;
            let aimY = this.y + Math.sin(this.timer * 0.002) * 100;
            let shouldFire = Math.random() < 0.02;

            if (this.target && this.target.active) {
                // Aim at target with some noise
                const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
                // More accurate if closer
                const inaccuracy = Math.max(0, dist * 0.1); 
                
                aimX = this.target.x + (Math.random() - 0.5) * inaccuracy;
                aimY = this.target.y + (Math.random() - 0.5) * inaccuracy;
                
                // Fire more often if we have a target
                shouldFire = Math.random() < 0.05;
            }

            const botPointer = {
                worldX: aimX,
                worldY: aimY,
                isDown: shouldFire,
                rightButtonDown: () => this.isRoping
            };

            super.update(time, delta, botCursors as any, botPointer as any, undefined);
            
            // Auto-fire logic needs to be explicit because GameScene handles player firing
            if (botPointer.isDown) {
                this.fire(time);
            }
        } else {
            // Frozen (Countdown) - Physics only
            const dummyCursors = { left: { isDown: false }, right: { isDown: false }, up: { isDown: false }, down: { isDown: false } };
            const dummyPointer = { x: this.x, y: this.y, isDown: false };
            super.update(time, delta, dummyCursors as any, dummyPointer as any, undefined);
        }
    }
}
