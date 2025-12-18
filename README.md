# Liero Remake

A modern web-based remake of the classic **Liero**, built with **Phaser 3** and **Socket.io**. Experience real-time destructible terrain, intense worm combat, and ninja rope physics in your browser.

## Features

*   **Real-time Multiplayer:** Create or join rooms to battle friends or strangers.
*   **Destructible Terrain:** Fully pixel-perfect destructible map. Carve your own tunnels!
*   **Ninja Rope:** Classic physics-based rope for swinging and traversing the map.
*   **Weapon Arsenal:** 10+ unique weapons including:
    *   **Bazooka:** Classic explosive rocket (now with cooldown).
    *   **Grenade / Cluster Bomb:** Chargeable throwables with bouncy physics.
    *   **Shotgun:** Fires a spread of pellets.
    *   **Mini Nuke:** Massive destruction.
    *   **Napalm:** Arcing projectiles that ignite on impact.
    *   **Laser, Chaingun, Mines, and more.**
*   **Game Modes:**
    *   **Deathmatch:** Fight for the highest kill count.
    *   **Survival:** Configurable lives (1, 3, 5, 10, or Unlimited). Last worm standing wins.
*   **Configurable Rooms:**
    *   **Map Size:** Small (Screen size), Medium, or Large.
    *   **Lives:** Set the stakes for the match.
*   **Minimap:** Automatically enabled for larger maps to track opponents.

## Controls

| Action | Key / Input |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` or `Arrow Keys` |
| **Jump** | `W` or `Up Arrow` |
| **Aim** | Mouse Cursor |
| **Fire** | `Left Mouse Button` (Hold to charge specific weapons like Grenades) |
| **Ninja Rope** | `Right Mouse Button` (Hold to swing) |
| **Adjust Rope** | `W` / `S` (or Up/Down) while hanging |
| **Dig** | Hold `Left` + `Right` (e.g., `A` + `D`) while pushing against a wall |
| **Select Weapon** | Number Keys `1` - `5` |
| **Menu** | `ESC` |

## Installation & Setup

### Prerequisites
- Node.js (v16+)
- npm

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Game
1. Start the development server (Client & Server):
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to:
   `http://localhost:3000`

## Building for Production
To build both the client and server for production:
```bash
npm run build
```

## Tech Stack
- **Client:** Phaser 3, TypeScript, Vite
- **Server:** Node.js, Socket.io, Express
- **Shared:** TypeScript interfaces for state synchronization

## Credits
This game and documentation were fully AI Coded by **Gemini 3 Pro**.
