import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PlayerState } from '../../shared/types';
import { RoomManager } from './rooms/RoomManager';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager();
// Map socket ID to room ID
const socketRooms: Record<string, string> = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Lobby Events
  socket.on('createRoom', (data: { name: string, config: any }) => {
      // Handle both old string format and new object format for backward compatibility if needed
      let name = '';
      let config = { mapSize: 'small', lives: 5 };
      
      if (typeof data === 'string') {
          name = data;
      } else {
          name = data.name;
          if (data.config) config = { ...config, ...data.config };
      }

      const room = roomManager.createRoom(name, socket.id, config as any);
      socket.emit('roomCreated', room.id);
      io.emit('roomListUpdate', roomManager.getAllRooms());
  });

  socket.on('getRooms', () => {
      socket.emit('roomListUpdate', roomManager.getAllRooms());
  });

  socket.on('joinRoom', (roomId: string) => {
      const room = roomManager.getRoom(roomId);
      const isHost = room && room.players.length === 0;

      const player: PlayerState = {
          id: socket.id,
          x: 0, y: 0, vx: 0, vy: 0, aimAngle: 0,
          ropeActive: false, ropeAnchor: null,
          hp: 100,
          score: 0,
          name: `Player ${socket.id.substr(0, 4)}`,
          isReady: false,
          isHost: isHost || false,
          lives: room ? room.config.lives : 5,
          kills: 0
      };

      if (roomManager.joinRoom(roomId, player)) {
          socketRooms[socket.id] = roomId;
          socket.join(roomId);
          
          const room = roomManager.getRoom(roomId);
          socket.emit('joinedRoom', room);
          io.to(roomId).emit('roomPlayerUpdate', room?.players);
      } else {
          socket.emit('error', 'Cannot join room');
      }
  });

  socket.on('toggleReady', () => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
              const player = room.players.find(p => p.id === socket.id);
              if (player) {
                  player.isReady = !player.isReady;
                  io.to(roomId).emit('roomPlayerUpdate', room.players);
              }
          }
      }
  });

  socket.on('playerReadyForMatch', (weapons: string[]) => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
              const player = room.players.find(p => p.id === socket.id);
              if (player) {
                  (player as any).isMatchReady = true;
                  // Store weapons if needed, or client sends them again? 
                  // For now client keeps them.
              }
              
              // Check if all match ready
              const readyCount = room.players.filter(p => (p as any).isMatchReady).length;
              const totalCount = room.players.length;
              
              io.to(roomId).emit('matchReadyUpdate', { ready: readyCount, total: totalCount });

              const allReady = room.players.every(p => (p as any).isMatchReady);
              if (allReady) {
                  io.to(roomId).emit('matchStart');
              }
          }
      }
  });

  socket.on('playerLoaded', () => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
              const player = room.players.find(p => p.id === socket.id);
              if (player) {
                  (player as any).isLoaded = true;
              }
              
              // Check if all loaded
              const allLoaded = room.players.every(p => (p as any).isLoaded);
              if (allLoaded) {
                  // Reset loaded flags for next time?
                  room.players.forEach(p => (p as any).isLoaded = false);
                  // Start countdown
                  io.to(roomId).emit('startCountdown');
              }
          }
      }
  });

  socket.on('startGame', () => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
              room.state = 'playing';
              const seed = Math.random() * 100000;
              room.seed = seed;
              io.to(roomId).emit('gameStarted', { seed });
              
              // Initialize positions
              // Spread players out across the map (width 800)
              const spawnPoints = [100, 700, 300, 500];
              room.players.forEach((p, i) => {
                  p.x = spawnPoints[i % spawnPoints.length];
                  p.y = 50;
                  p.vx = 0;
                  p.vy = 0;
                  p.hp = 100;
              });
              // We don't emit currentPlayers here anymore, we wait for clients to ask or we emit it but they might miss it.
              // Better to let them ask.
          }
      }
  });

  socket.on('requestGameSync', () => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
              const playersMap = room.players.reduce((acc, p) => ({...acc, [p.id]: p}), {});
              socket.emit('currentPlayers', playersMap);
              if (room.seed !== undefined) {
                  socket.emit('gameSeed', { seed: room.seed });
              }
          }
      }
  });

  // Game Events (Scoped to Room)
  socket.on('playerMovement', (movementData) => {
    const roomId = socketRooms[socket.id];
    if (roomId) {
        socket.to(roomId).emit('playerMoved', { ...movementData, id: socket.id });
    }
  });

  socket.on('playerFired', (data) => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          socket.to(roomId).emit('playerFired', { ...data, id: socket.id });
      }
  });

  socket.on('terrainExplosion', (data) => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          socket.to(roomId).emit('terrainExplosion', data);
      }
  });

  socket.on('playerDied', (killerId: string) => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
          const room = roomManager.getRoom(roomId);
          if (room) {
              // Update Score & Kills
              if (killerId && killerId !== socket.id) {
                  const killer = room.players.find(p => p.id === killerId);
                  if (killer) {
                      killer.score = (killer.score || 0) + 1;
                      killer.kills = (killer.kills || 0) + 1;
                  }
              } else {
                  // Suicide? -1?
                  const victim = room.players.find(p => p.id === socket.id);
                  if (victim) {
                      victim.score = (victim.score || 0) - 1;
                  }
              }

              // Handle Victim Lives
              const victim = room.players.find(p => p.id === socket.id);
              if (victim) {
                  if (victim.lives !== undefined && victim.lives < 999) {
                      victim.lives--;
                  }

                  if (victim.lives !== undefined && victim.lives <= 0 && victim.lives < 999) {
                      // Player Eliminated
                      io.to(roomId).emit('playerEliminated', victim.id);
                      io.to(roomId).emit('scoreUpdate', room.players);
                      
                      // Check Win Condition
                      const activePlayers = room.players.filter(p => (p.lives === undefined || p.lives > 0 || p.lives >= 999));
                      if (activePlayers.length <= 1 && room.players.length > 1) {
                          // Game Over
                          room.state = 'ended';
                          const winner = activePlayers.length === 1 ? activePlayers[0] : null;
                          io.to(roomId).emit('gameOver', { winner });
                      }
                  } else {
                      // Respawn Victim
                      victim.hp = 100;
                      victim.x = Math.random() * 700 + 50;
                      victim.y = 50;
                      victim.vx = 0;
                      victim.vy = 0;
                      
                      // Broadcast updates
                      io.to(roomId).emit('playerRespawn', victim);
                      io.to(roomId).emit('scoreUpdate', room.players);
                  }
              }
          }
      }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const roomId = socketRooms[socket.id];
    if (roomId) {
        const room = roomManager.getRoom(roomId);
        roomManager.leaveRoom(roomId, socket.id);
        
        if (room && room.players.length > 0) {
             // Check if host left
             const hasHost = room.players.some(p => p.isHost);
             if (!hasHost) {
                 room.players[0].isHost = true; // Assign new host
             }
             
             io.to(roomId).emit('roomPlayerUpdate', room.players);
        }
        
        io.to(roomId).emit('playerDisconnected', socket.id);
        delete socketRooms[socket.id];
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
