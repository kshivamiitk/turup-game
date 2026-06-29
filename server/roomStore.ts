import { randomInt } from "crypto";
import type { PlayerState, RoomState, SpectatorState } from "../types/game";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const roomCodeLength = 5;

export const roomStore = {
  rooms: new Map<string, RoomState>(),
  socketSessions: new Map<string, { roomCode: string; username: string; isSpectator: boolean }>()
};

export const emptyRoomTtlMs = 10 * 60 * 1000;

export function generateRoomCode(): string {
  let code = "";
  for (let index = 0; index < roomCodeLength; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
}

export function createRoom(host: Omit<PlayerState, "seat" | "ready" | "hand" | "bid" | "tricksWon">, targetScore: number): RoomState {
  let code = generateRoomCode();
  while (roomStore.rooms.has(code)) {
    code = generateRoomCode();
  }

  const now = Date.now();
  const hostPlayer: PlayerState = {
    ...host,
    seat: 0,
    ready: false,
    hand: [],
    bid: null,
    tricksWon: 0
  };

  const room: RoomState = {
    code,
    hostUsername: host.username,
    phase: "lobby",
    locked: false,
    targetScore,
    roundNumber: 0,
    winnerUsername: null,
    scores: {
      [host.username]: 0
    },
    players: new Map([[host.username, hostPlayer]]),
    spectators: new Map(),
    round: null,
    chat: [],
    createdAt: now,
    updatedAt: now,
    emptySince: null
  };

  roomStore.rooms.set(code, room);
  return room;
}

export function bindSocket(socketId: string, roomCode: string, username: string, isSpectator: boolean): void {
  roomStore.socketSessions.set(socketId, { roomCode, username, isSpectator });
}

export function unbindSocket(socketId: string): void {
  roomStore.socketSessions.delete(socketId);
}

export function findNextSeat(room: RoomState): number | null {
  const occupied = new Set([...room.players.values()].map((player) => player.seat));
  for (let seat = 0; seat < 4; seat += 1) {
    if (!occupied.has(seat)) {
      return seat;
    }
  }
  return null;
}

export function getOrderedPlayers(room: RoomState): PlayerState[] {
  return [...room.players.values()].sort((left, right) => left.seat - right.seat);
}

export function getPlayerBySeat(room: RoomState, seat: number): PlayerState | undefined {
  return getOrderedPlayers(room).find((player) => player.seat === seat);
}

export function touchRoom(room: RoomState): void {
  room.updatedAt = Date.now();
  room.emptySince = hasConnectedUsers(room) ? null : room.emptySince ?? Date.now();
}

export function hasConnectedUsers(room: RoomState): boolean {
  return (
    [...room.players.values()].some((player) => player.connected) ||
    [...room.spectators.values()].some((spectator) => spectator.connected)
  );
}

export function ensureHost(room: RoomState): void {
  const currentHost = room.players.get(room.hostUsername);
  if (currentHost?.connected) {
    return;
  }

  const nextConnectedPlayer = getOrderedPlayers(room).find((player) => player.connected);
  const nextAnyPlayer = getOrderedPlayers(room)[0];
  const nextHost = nextConnectedPlayer ?? nextAnyPlayer;

  if (nextHost) {
    room.hostUsername = nextHost.username;
  }
}

export function removeSocketFromRoom(socketId: string): RoomState | null {
  const session = roomStore.socketSessions.get(socketId);
  if (!session) {
    return null;
  }

  const room = roomStore.rooms.get(session.roomCode);
  if (!room) {
    unbindSocket(socketId);
    return null;
  }

  const collection: Map<string, PlayerState | SpectatorState> = session.isSpectator ? room.spectators : room.players;
  const user = collection.get(session.username);
  if (user && user.socketId === socketId) {
    user.connected = false;
    user.socketId = null;
    user.lastSeenAt = Date.now();
  }

  ensureHost(room);
  touchRoom(room);
  unbindSocket(socketId);
  return room;
}

export function deleteExpiredRooms(): string[] {
  const now = Date.now();
  const deletedCodes: string[] = [];

  for (const [code, room] of roomStore.rooms) {
    if (!hasConnectedUsers(room)) {
      room.emptySince = room.emptySince ?? now;
    }

    if (room.emptySince && now - room.emptySince > emptyRoomTtlMs) {
      roomStore.rooms.delete(code);
      deletedCodes.push(code);
    }
  }

  return deletedCodes;
}
