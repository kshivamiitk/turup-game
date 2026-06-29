import type { Server, Socket } from "socket.io";
import { startRound, chooseTrump, playCard, resetRoomToLobby, submitBid } from "./gameEngine";
import {
  bindSocket,
  createRoom,
  deleteExpiredRooms,
  ensureHost,
  findNextSeat,
  getOrderedPlayers,
  removeSocketFromRoom,
  roomStore,
  touchRoom,
  unbindSocket
} from "./roomStore";
import { createRoomSnapshot } from "./serializer";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from "../types/socket";
import type { ChatMessage, PlayerState, RoomState, SpectatorState } from "../types/game";
import { cleanDisplayText, normalizeRoomCode, normalizeUsername } from "../utils/text";

type TurupServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TurupSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type SnapshotEvent =
  | "room_updated"
  | "player_joined"
  | "player_left"
  | "game_started"
  | "trump_selected"
  | "bidding_started"
  | "bid_updated"
  | "trick_started"
  | "card_played"
  | "trick_won"
  | "round_ended"
  | "match_ended"
  | "chat_message"
  | "reconnect_success";

export function registerSocketHandlers(io: TurupServer, publicBaseUrl: string): void {
  io.on("connection", (socket) => {
    socket.on("create_room", (payload) => {
      runAction(socket, () => {
        leaveCurrentRoom(socket, io, publicBaseUrl, false);

        const username = requireUsername(payload.username);
        const displayName = getDisplayName(payload.displayName, username);
        const targetScore = requireTargetScore(payload.targetScore);
        const now = Date.now();
        const room = createRoom(
          {
            username,
            displayName,
            socketId: socket.id,
            connected: true,
            joinedAt: now,
            lastSeenAt: now
          },
          targetScore
        );

        bind(socket, room.code, username, false);
        socket.join(room.code);

        socket.emit("room_created", {
          roomCode: room.code,
          snapshot: createRoomSnapshot(room, username, false, publicBaseUrl)
        });
      });
    });

    socket.on("join_room", (payload) => {
      runAction(socket, () => joinRoom(socket, io, publicBaseUrl, payload.roomCode, payload.username, payload.displayName, Boolean(payload.asSpectator)));
    });

    socket.on("reconnect_room", (payload) => {
      runAction(socket, () => joinRoom(socket, io, publicBaseUrl, payload.roomCode, payload.username, payload.displayName, Boolean(payload.asSpectator), true));
    });

    socket.on("leave_room", () => {
      runAction(socket, () => leaveCurrentRoom(socket, io, publicBaseUrl, true));
    });

    socket.on("set_ready", (payload) => {
      runAction(socket, () => {
        const { room, player } = requirePlayerSession(socket);
        if (room.phase !== "lobby") {
          throw new Error("Ready can only be changed in the lobby.");
        }

        player.ready = Boolean(payload.ready);
        touchRoom(room);
        emitRoomSnapshots(io, room, publicBaseUrl);
      });
    });

    socket.on("set_target_score", (payload) => {
      runAction(socket, () => {
        const { room, session } = requireSession(socket);
        requireHost(room, session.username);
        if (room.phase !== "lobby") {
          throw new Error("Target score can only be changed before the match starts.");
        }

        room.targetScore = requireTargetScore(payload.targetScore);
        touchRoom(room);
        emitRoomSnapshots(io, room, publicBaseUrl);
      });
    });

    socket.on("start_game", () => {
      runAction(socket, () => {
        const { room, session } = requireSession(socket);
        requireHost(room, session.username);
        startRound(room);
        emitHands(io, room);
        emitRoomSnapshots(io, room, publicBaseUrl, "game_started");
      });
    });

    socket.on("choose_trump", (payload) => {
      runAction(socket, () => {
        const { room, player } = requirePlayerSession(socket);
        chooseTrump(room, player.username, payload.suit);
        emitRoomSnapshots(io, room, publicBaseUrl, "trump_selected");
        emitRoomSnapshots(io, room, publicBaseUrl, "bidding_started");
      });
    });

    socket.on("submit_bid", (payload) => {
      runAction(socket, () => {
        const { room, player } = requirePlayerSession(socket);
        submitBid(room, player.username, payload.bid);
        emitRoomSnapshots(io, room, publicBaseUrl, room.phase === "playing" ? "trick_started" : "bid_updated");
      });
    });

    socket.on("play_card", (payload) => {
      runAction(socket, () => {
        const { room, player } = requirePlayerSession(socket);
        const result = playCard(room, player.username, payload.cardId);
        const event: SnapshotEvent = result.matchEnded
          ? "match_ended"
          : result.roundEnded
            ? "round_ended"
            : result.trickWon
              ? "trick_won"
              : "card_played";
        emitRoomSnapshots(io, room, publicBaseUrl, event);
      });
    });

    socket.on("send_chat", (payload) => {
      runAction(socket, () => {
        const { room, session } = requireSession(socket);
        const member = session.isSpectator ? room.spectators.get(session.username) : room.players.get(session.username);
        const message = cleanDisplayText(payload.message, 240);
        if (!message) {
          throw new Error("Message cannot be empty.");
        }

        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          username: session.username,
          displayName: member?.displayName ?? session.username,
          message,
          createdAt: Date.now()
        };
        room.chat.push(chatMessage);
        room.chat = room.chat.slice(-30);
        touchRoom(room);
        emitRoomSnapshots(io, room, publicBaseUrl, "chat_message");
      });
    });

    socket.on("kick_player", (payload) => {
      runAction(socket, () => {
        const { room, session } = requireSession(socket);
        requireHost(room, session.username);
        if (room.phase !== "lobby") {
          throw new Error("Players can only be kicked before the match starts.");
        }

        const targetUsername = normalizeUsername(payload.username);
        if (targetUsername === session.username) {
          throw new Error("The host cannot kick themselves.");
        }

        const target = room.players.get(targetUsername);
        if (!target) {
          throw new Error("That player is not in this room.");
        }

        if (target.socketId) {
          const targetSocket = io.sockets.sockets.get(target.socketId);
          targetSocket?.emit("error_message", { message: "You were removed from the room." });
          targetSocket?.leave(room.code);
          unbindSocket(target.socketId);
          targetSocket?.data && clearSocketData(targetSocket as TurupSocket);
        }

        room.players.delete(targetUsername);
        delete room.scores[targetUsername];
        ensureHost(room);
        touchRoom(room);
        emitRoomSnapshots(io, room, publicBaseUrl, "player_left");
      });
    });

    socket.on("return_to_lobby", () => {
      runAction(socket, () => {
        const { room, session } = requireSession(socket);
        requireHost(room, session.username);
        resetRoomToLobby(room);
        emitRoomSnapshots(io, room, publicBaseUrl);
      });
    });

    socket.on("disconnect", () => {
      const room = removeSocketFromRoom(socket.id);
      if (room) {
        emitRoomSnapshots(io, room, publicBaseUrl);
      }
    });
  });

  setInterval(() => {
    deleteExpiredRooms();
  }, 60_000).unref();
}

function joinRoom(
  socket: TurupSocket,
  io: TurupServer,
  publicBaseUrl: string,
  rawRoomCode: string,
  rawUsername: string,
  rawDisplayName: string | undefined,
  asSpectator: boolean,
  replaceConnectedSession = false
): void {
  leaveCurrentRoom(socket, io, publicBaseUrl, false);

  const roomCode = normalizeRoomCode(rawRoomCode);
  const room = roomStore.rooms.get(roomCode);
  if (!room) {
    throw new Error("Room code not found.");
  }

  const username = requireUsername(rawUsername);
  const displayName = getDisplayName(rawDisplayName, username);
  const now = Date.now();

  if (room.players.has(username)) {
    const player = room.players.get(username);
    if (!player) {
      throw new Error("Player could not be found.");
    }

    if (player.connected && !replaceConnectedSession) {
      throw new Error("That username is already connected in this room.");
    }

    replaceExistingSocket(io, room, player.socketId);
    player.connected = true;
    player.socketId = socket.id;
    player.displayName = displayName;
    player.lastSeenAt = now;
    bind(socket, room.code, username, false);
    socket.join(room.code);
    touchRoom(room);
    socket.emit("reconnect_success", createRoomSnapshot(room, username, false, publicBaseUrl));
    emitRoomSnapshots(io, room, publicBaseUrl);
    return;
  }

  if (room.spectators.has(username)) {
    const spectator = room.spectators.get(username);
    if (!spectator) {
      throw new Error("Spectator could not be found.");
    }

    if (spectator.connected && !replaceConnectedSession) {
      throw new Error("That username is already connected in this room.");
    }

    replaceExistingSocket(io, room, spectator.socketId);
    spectator.connected = true;
    spectator.socketId = socket.id;
    spectator.displayName = displayName;
    spectator.lastSeenAt = now;
    bind(socket, room.code, username, true);
    socket.join(room.code);
    touchRoom(room);
    socket.emit("reconnect_success", createRoomSnapshot(room, username, true, publicBaseUrl));
    emitRoomSnapshots(io, room, publicBaseUrl);
    return;
  }

  if (asSpectator) {
    const spectator: SpectatorState = {
      username,
      displayName,
      socketId: socket.id,
      connected: true,
      joinedAt: now,
      lastSeenAt: now
    };
    room.spectators.set(username, spectator);
    bind(socket, room.code, username, true);
    socket.join(room.code);
    touchRoom(room);
    emitRoomSnapshots(io, room, publicBaseUrl, "player_joined");
    return;
  }

  if (room.locked || room.phase !== "lobby") {
    throw new Error("This room is already in progress. Join as a spectator instead.");
  }

  const seat = findNextSeat(room);
  if (seat === null) {
    throw new Error("This room is full. Join as a spectator instead.");
  }

  const player: PlayerState = {
    username,
    displayName,
    seat,
    socketId: socket.id,
    ready: false,
    connected: true,
    joinedAt: now,
    lastSeenAt: now,
    hand: [],
    bid: null,
    tricksWon: 0
  };

  room.players.set(username, player);
  room.scores[username] = room.scores[username] ?? 0;
  bind(socket, room.code, username, false);
  socket.join(room.code);
  touchRoom(room);
  emitRoomSnapshots(io, room, publicBaseUrl, "player_joined");
}

function leaveCurrentRoom(socket: TurupSocket, io: TurupServer, publicBaseUrl: string, explicit: boolean): void {
  const session = roomStore.socketSessions.get(socket.id);
  if (!session) {
    clearSocketData(socket);
    return;
  }

  const room = roomStore.rooms.get(session.roomCode);
  unbindSocket(socket.id);
  socket.leave(session.roomCode);
  clearSocketData(socket);

  if (!room) {
    return;
  }

  if (session.isSpectator) {
    room.spectators.delete(session.username);
  } else {
    const player = room.players.get(session.username);
    if (player && room.phase !== "lobby" && room.phase !== "match_over") {
      player.connected = false;
      player.socketId = null;
      player.lastSeenAt = Date.now();
    } else {
      room.players.delete(session.username);
      delete room.scores[session.username];
    }
  }

  if (room.players.size === 0) {
    roomStore.rooms.delete(room.code);
    return;
  }

  ensureHost(room);
  touchRoom(room);
  emitRoomSnapshots(io, room, publicBaseUrl, "player_left");
}

function bind(socket: TurupSocket, roomCode: string, username: string, isSpectator: boolean): void {
  bindSocket(socket.id, roomCode, username, isSpectator);
  socket.data.roomCode = roomCode;
  socket.data.username = username;
  socket.data.isSpectator = isSpectator;
}

function replaceExistingSocket(io: TurupServer, room: RoomState, socketId: string | null): void {
  if (!socketId) {
    return;
  }

  const existingSocket = io.sockets.sockets.get(socketId) as TurupSocket | undefined;
  existingSocket?.leave(room.code);
  if (existingSocket) {
    clearSocketData(existingSocket);
  }
  unbindSocket(socketId);
}

function clearSocketData(socket: TurupSocket): void {
  delete socket.data.roomCode;
  delete socket.data.username;
  delete socket.data.isSpectator;
}

function emitRoomSnapshots(
  io: TurupServer,
  room: RoomState,
  publicBaseUrl: string,
  event: SnapshotEvent = "room_updated"
): void {
  for (const player of room.players.values()) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit(event, createRoomSnapshot(room, player.username, false, publicBaseUrl));
    }
  }

  for (const spectator of room.spectators.values()) {
    if (spectator.connected && spectator.socketId) {
      io.to(spectator.socketId).emit(event, createRoomSnapshot(room, spectator.username, true, publicBaseUrl));
    }
  }
}

function emitHands(io: TurupServer, room: RoomState): void {
  for (const player of getOrderedPlayers(room)) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit("hand_dealt", player.hand);
    }
  }
}

function requireSession(socket: TurupSocket): {
  room: RoomState;
  session: { roomCode: string; username: string; isSpectator: boolean };
} {
  const session = roomStore.socketSessions.get(socket.id);
  if (!session) {
    throw new Error("Join a room first.");
  }

  const room = roomStore.rooms.get(session.roomCode);
  if (!room) {
    throw new Error("That room no longer exists.");
  }

  return { room, session };
}

function requirePlayerSession(socket: TurupSocket): { room: RoomState; player: PlayerState } {
  const { room, session } = requireSession(socket);
  if (session.isSpectator) {
    throw new Error("Spectators cannot take game actions.");
  }

  const player = room.players.get(session.username);
  if (!player) {
    throw new Error("Player could not be found.");
  }

  return { room, player };
}

function requireHost(room: RoomState, username: string): void {
  if (room.hostUsername !== username) {
    throw new Error("Only the host can do that.");
  }
}

function requireUsername(value: string): string {
  const username = normalizeUsername(value);
  if (!username) {
    throw new Error("Enter a username.");
  }
  return username;
}

function getDisplayName(value: string | undefined, fallback: string): string {
  return cleanDisplayText(value ?? "", 28) || fallback;
}

function requireTargetScore(value: number): number {
  const targetScore = Number(value);
  if (!Number.isInteger(targetScore) || targetScore < 1 || targetScore > 1000) {
    throw new Error("Target score must be a whole number from 1 to 1000.");
  }
  return targetScore;
}

function runAction(socket: TurupSocket, action: () => void): void {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    socket.emit("error_message", { message });
  }
}
