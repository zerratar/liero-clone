import { PlayerState, RoomConfig } from '../../../shared/types';

export interface Room {
    id: string;
    name: string;
    players: PlayerState[];
    maxPlayers: number;
    state: 'waiting' | 'playing' | 'ended';
    seed?: number;
    config: RoomConfig;
}

export class RoomManager {
    private rooms: Record<string, Room> = {};

    createRoom(name: string, hostId: string, config: RoomConfig = { mapSize: 'small', lives: 5 }): Room {
        const id = Math.random().toString(36).substring(2, 7).toUpperCase();
        const room: Room = {
            id,
            name,
            players: [],
            maxPlayers: 4,
            state: 'waiting',
            config
        };
        this.rooms[id] = room;
        return room;
    }

    getRoom(id: string): Room | undefined {
        return this.rooms[id];
    }

    getAllRooms(): Room[] {
        return Object.values(this.rooms);
    }

    joinRoom(roomId: string, player: PlayerState): boolean {
        const room = this.rooms[roomId];
        if (!room) return false;
        if (room.players.length >= room.maxPlayers) return false;
        if (room.state !== 'waiting') return false;

        room.players.push(player);
        return true;
    }

    leaveRoom(roomId: string, playerId: string) {
        const room = this.rooms[roomId];
        if (room) {
            room.players = room.players.filter(p => p.id !== playerId);
            if (room.players.length === 0) {
                delete this.rooms[roomId];
            }
        }
    }
}
