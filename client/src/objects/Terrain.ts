import Phaser from 'phaser';

export class Terrain {
  private scene: Phaser.Scene;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  public texture: Phaser.Textures.CanvasTexture;
  public width: number;
  public height: number;
  public dirty: boolean = false;
  
  // Data buffer for physics: 0 = empty, 1 = dirt, 2 = rock
  private data: Uint8Array;
  private seed: number = 12345; // Default seed

  constructor(scene: Phaser.Scene, width: number, height: number, seed: number = 12345) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.data = new Uint8Array(width * height);

    // Create a CanvasTexture
    if (this.scene.textures.exists('terrain')) {
        this.scene.textures.remove('terrain');
    }
    this.texture = this.scene.textures.createCanvas('terrain', width, height)!;
    this.canvas = this.texture.getSourceImage() as HTMLCanvasElement;
    this.context = this.canvas.getContext('2d')!;
    
    // Add to scene
    this.scene.add.image(0, 0, 'terrain').setOrigin(0, 0).setDepth(0);

    this.generateLevel();
  }

  regenerate(seed: number) {
      this.seed = seed;
      this.generateLevel();
  }

  // Simple seeded random
  private random() {
      const x = Math.sin(this.seed++) * 10000;
      return x - Math.floor(x);
  }

  generateLevel() {
    // 1. Generate Data
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const index = y * this.width + x;
            
            // Improved noise generation (Seeded)
            // Layer 1: Large structures
            const n1 = Math.sin(x * 0.01 + this.seed) + Math.cos(y * 0.01 + this.seed);
            // Layer 2: Detail
            const n2 = Math.sin(x * 0.05 + this.seed*2) + Math.cos(y * 0.05 + this.seed*2);
            
            const noise = n1 + n2 * 0.5;
            
            if (noise > 0) {
                this.data[index] = 1; // Dirt
            } else {
                this.data[index] = 0; // Empty
            }
            
            // Borders are rock
            if (x < 10 || x > this.width - 10 || y < 10 || y > this.height - 10) {
                this.data[index] = 2; // Rock
            }
        }
    }
    
    // Post-process: Add scattered rocks (Rounder, fewer)
    // Use seeded random for rock placement
    const rockCount = 20; // Reduced from 50
    for (let i = 0; i < rockCount; i++) {
        const rx = this.random() * this.width;
        const ry = this.random() * this.height;
        this.createRock(rx, ry, 5 + this.random() * 10);
    }
    
    // 2. Draw to Canvas based on Data
    this.redraw();
  }
  
  createRock(cx: number, cy: number, radius: number) {
      const r2 = radius * radius;
      
      for (let y = Math.floor(cy - radius); y < cy + radius; y++) {
          for (let x = Math.floor(cx - radius); x < cx + radius; x++) {
              if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                  const dx = x - cx;
                  const dy = y - cy;
                  // Simple circle for round rocks
                  if (dx*dx + dy*dy <= r2) {
                      this.data[y * this.width + x] = 2;
                  }
              }
          }
      }
  }

  redraw() {
      const imgData = this.context.createImageData(this.width, this.height);
      const buffer = new Uint32Array(imgData.data.buffer);
      
      // Colors (ABGR format for little-endian)
      const colEmpty = 0x00000000; // Transparent
      
      for (let i = 0; i < this.data.length; i++) {
          const type = this.data[i];
          if (type === 0) buffer[i] = colEmpty;
          else if (type === 1) {
              // Liero-like Dirt: Dark Brown/Reddish
              // Base: #5D4037 (RGB: 93, 64, 55)
              // Noise: Vary slightly
              const noise = Math.floor(Math.random() * 20);
              const r = 93 + noise;
              const g = 64 + noise;
              const b = 55 + noise;
              
              // ABGR
              buffer[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
          }
          else if (type === 2) {
              // Rock Texture: Grey with noise
              const noise = Math.floor(Math.random() * 40);
              const val = 100 + noise;
              // ABGR
              buffer[i] = 0xFF000000 | (val << 16) | (val << 8) | val;
          }
      }
      
      this.context.putImageData(imgData, 0, 0);
      this.texture.refresh();
  }

  // Add blood stain
  stain(x: number, y: number, color: number) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      
      if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
      
      // Only stain if there is dirt/rock there? 
      // In Liero, blood stains the background too? No, usually just the dirt.
      // But if we want it to "stick", it should probably be drawn on top.
      // If we draw on empty space, it looks like floating blood.
      // Let's only stain solid ground.
      
      const idx = iy * this.width + ix;
      if (this.data[idx] !== 0) {
          // Draw pixel
          // We need to update the canvas directly for performance, 
          // but doing putImageData for 1 pixel is slow if done many times.
          // Better to batch or just use fillRect on context.
          
          // Convert integer color (0xRRGGBB) to CSS string
          const r = (color >> 16) & 0xFF;
          const g = (color >> 8) & 0xFF;
          const b = color & 0xFF;
          
          this.context.fillStyle = `rgb(${r},${g},${b})`;
          this.context.fillRect(ix, iy, 1, 1);
          
          this.dirty = true;
      }
  }

  refresh() {
      if (this.dirty) {
          this.texture.refresh();
          this.dirty = false;
      }
  }

  // Check if a point is solid
  isSolid(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return true;
    
    return this.data[iy * this.width + ix] !== 0;
  }

  // Carve a hole (explosion/digging)
  carve(x: number, y: number, radius: number) {
    const r2 = radius * radius;
    const startX = Math.max(0, Math.floor(x - radius));
    const endX = Math.min(this.width, Math.ceil(x + radius));
    const startY = Math.max(0, Math.floor(y - radius));
    const endY = Math.min(this.height, Math.ceil(y + radius));

    let changed = false;

    for (let cy = startY; cy < endY; cy++) {
        for (let cx = startX; cx < endX; cx++) {
            const dx = cx - x;
            const dy = cy - y;
            if (dx*dx + dy*dy <= r2) {
                const idx = cy * this.width + cx;
                if (this.data[idx] !== 2) { // Don't break rock
                    if (this.data[idx] !== 0) {
                        this.data[idx] = 0;
                        // Clear pixel on canvas directly to preserve other pixels (like blood)
                        this.context.clearRect(cx, cy, 1, 1);
                        changed = true;
                    }
                }
            }
        }
    }

    if (changed) {
        this.texture.refresh();
    }
  }

  // Raycast to find the first solid point
  raycast(x1: number, y1: number, x2: number, y2: number): Phaser.Math.Vector2 | null {
    const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const step = 2; // Check every 2 pixels
    const steps = dist / step;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;
        
        if (this.isSolid(cx, cy)) {
            return new Phaser.Math.Vector2(cx, cy);
        }
    }
    return null;
  }
}
