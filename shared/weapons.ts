export interface WeaponDef {
  id: string;
  name: string;
  type: 'projectile' | 'hitscan' | 'grenade';
  damage: number;
  explosionRadius: number;
  terrainDestruction: number;
  speed: number;
  gravity: number;
  bounciness: number;
  lifetime: number;
  recoil: number;
  shotsPerLoad: number;
  loadTimeMs: number;
  fireRateMs: number;
  spread: number;
  color: number;
  chargeable?: boolean;
  pellets?: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  bazooka: {
    id: 'bazooka',
    name: 'Bazooka',
    type: 'projectile',
    damage: 20,
    explosionRadius: 30,
    terrainDestruction: 30,
    speed: 300,
    gravity: 0, // Rockets fly straight (mostly)
    bounciness: 0,
    lifetime: 2000,
    recoil: 2,
    shotsPerLoad: 1,
    loadTimeMs: 1000,
    fireRateMs: 600,
    spread: 0,
    color: 0xffaa00,
    chargeable: false
  },
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    type: 'grenade',
    damage: 30,
    explosionRadius: 40,
    terrainDestruction: 40,
    speed: 400, // Increased max speed for charge
    gravity: 300,
    bounciness: 0.5,
    lifetime: 3000,
    recoil: 1,
    shotsPerLoad: 3,
    loadTimeMs: 1500,
    fireRateMs: 500,
    spread: 0.1,
    color: 0x00ff00,
    chargeable: true
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    type: 'hitscan', // Or fast projectile
    damage: 4,
    explosionRadius: 3,
    terrainDestruction: 3,
    speed: 800,
    gravity: 0,
    bounciness: 0,
    lifetime: 500,
    recoil: 4,
    shotsPerLoad: 2,
    loadTimeMs: 1200,
    fireRateMs: 500,
    spread: 0.2,
    color: 0xffffff,
    chargeable: false,
    pellets: 6
  },
  chaingun: {
    id: 'chaingun',
    name: 'Chaingun',
    type: 'hitscan',
    damage: 2,
    explosionRadius: 2,
    terrainDestruction: 2,
    speed: 900,
    gravity: 0,
    bounciness: 0,
    lifetime: 1000,
    recoil: 0.5,
    shotsPerLoad: 50,
    loadTimeMs: 2000,
    fireRateMs: 100,
    spread: 0.05,
    color: 0xffff00,
    chargeable: false
  },
  cluster: {
    id: 'cluster',
    name: 'Cluster Bomb',
    type: 'grenade',
    damage: 10,
    explosionRadius: 20,
    terrainDestruction: 20,
    speed: 400, // Increased max speed
    gravity: 300,
    bounciness: 0.6,
    lifetime: 2500,
    recoil: 2,
    shotsPerLoad: 2,
    loadTimeMs: 2000,
    fireRateMs: 500,
    spread: 0,
    color: 0xff00ff,
    chargeable: true
  },
  laser: {
    id: 'laser',
    name: 'Laser',
    type: 'hitscan',
    damage: 2, // Per tick/segment
    explosionRadius: 5,
    terrainDestruction: 5,
    speed: 0, // Instant
    gravity: 0,
    bounciness: 0,
    lifetime: 100, // Short visual life
    recoil: 0,
    shotsPerLoad: 100, // Continuous beam feel
    loadTimeMs: 2000,
    fireRateMs: 20, // Very fast fire rate
    spread: 0,
    color: 0x00ffff,
    chargeable: false
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    type: 'grenade',
    damage: 40,
    explosionRadius: 50,
    terrainDestruction: 50,
    speed: 300, // Increased max speed
    gravity: 500,
    bounciness: 0,
    lifetime: 10000, // Long life
    recoil: 1,
    shotsPerLoad: 3,
    loadTimeMs: 2000,
    fireRateMs: 1000,
    spread: 0,
    color: 0x00aa00,
    chargeable: true
  },
  napalm: {
    id: 'napalm',
    name: 'Napalm',
    type: 'projectile',
    damage: 5,
    explosionRadius: 15,
    terrainDestruction: 5,
    speed: 300,
    gravity: 300, // Increased gravity
    bounciness: 0, // Explode on impact
    lifetime: 10000, // Long lifetime so it doesn't airburst
    recoil: 1,
    shotsPerLoad: 30,
    loadTimeMs: 3000,
    fireRateMs: 50, // Fast stream
    spread: 0.3, // Wide spread
    color: 0xff4400,
    chargeable: false
  },
  dart: {
    id: 'dart',
    name: 'Dart',
    type: 'projectile',
    damage: 10,
    explosionRadius: 2,
    terrainDestruction: 0,
    speed: 600,
    gravity: 50,
    bounciness: 0,
    lifetime: 2000,
    recoil: 0,
    shotsPerLoad: 5,
    loadTimeMs: 500,
    fireRateMs: 200,
    spread: 0.01,
    color: 0xaaaaaa,
    chargeable: false
  },
  nuke: {
    id: 'nuke',
    name: 'Mini Nuke',
    type: 'projectile',
    damage: 100,
    explosionRadius: 100,
    terrainDestruction: 100,
    speed: 150,
    gravity: 100,
    bounciness: 0.1,
    lifetime: 4000,
    recoil: 10,
    shotsPerLoad: 1,
    loadTimeMs: 5000,
    fireRateMs: 1000, // Prevent spam
    spread: 0,
    color: 0xff0000,
    chargeable: false
  }
};
