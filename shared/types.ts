export interface PlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  ropeActive: boolean;
  ropeAnchor: { x: number, y: number } | null;
  hp: number;
  score?: number;
  name: string;
  isReady?: boolean;
  isHost?: boolean;
  isMatchReady?: boolean;
  isLoaded?: boolean;
  lives?: number;
  kills?: number;
}

export interface RoomConfig {
  mapSize: 'small' | 'medium' | 'large';
  lives: number;
}

export interface GameState {
  players: Record<string, PlayerState>;
  // Terrain updates will be separate events
}

export interface ClientInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  rope: boolean;
  aimAngle: number;
  mouseX: number;
  mouseY: number;
}
