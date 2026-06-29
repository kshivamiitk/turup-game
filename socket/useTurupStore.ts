"use client";

import { create } from "zustand";
import { RealtimeClientSocket } from "./realtimeClient";
import type { RoomSnapshot, Suit } from "../types/game";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

type ClientSocket = RealtimeClientSocket;
type ConnectionStatus = "connecting" | "connected" | "offline";

type StoredRoomSession = {
  roomCode: string;
  username: string;
  displayName: string;
  isSpectator: boolean;
};

type TurupStore = {
  socket: ClientSocket | null;
  connectionStatus: ConnectionStatus;
  isRestoringSession: boolean;
  room: RoomSnapshot | null;
  error: string | null;
  initSocket: () => void;
  clearError: () => void;
  createRoom: (username: string, displayName: string, targetScore: number) => void;
  joinRoom: (roomCode: string, username: string, displayName: string, asSpectator?: boolean) => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  setTargetScore: (targetScore: number) => void;
  startGame: () => void;
  chooseTrump: (suit: Suit) => void;
  submitBid: (bid: number) => void;
  playCard: (cardId: string) => void;
  sendChat: (message: string) => void;
  kickPlayer: (username: string) => void;
  returnToLobby: () => void;
};

const snapshotEvents: Array<keyof ServerToClientEvents> = [
  "room_updated",
  "player_joined",
  "player_left",
  "game_started",
  "trump_selected",
  "bidding_started",
  "bid_updated",
  "trick_started",
  "card_played",
  "trick_won",
  "round_ended",
  "match_ended",
  "chat_message",
  "reconnect_success"
];

const roomSessionKey = "turup.currentRoom";
const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || "/api/socket-io";

export const useTurupStore = create<TurupStore>((set, get) => ({
  socket: null,
  connectionStatus: "offline",
  isRestoringSession: false,
  room: null,
  error: null,
  initSocket: () => {
    if (get().socket) {
      return;
    }

    set({ connectionStatus: "connecting" });
    const socket: ClientSocket = new RealtimeClientSocket(socketServerUrl, { path: socketPath });

    let reconnectingFromStorage = false;

    const applySnapshot = (snapshot: RoomSnapshot) => {
      reconnectingFromStorage = false;
      storeRoomSession(snapshot);
      set({ room: snapshot, error: null, isRestoringSession: false });
    };

    socket.on("connect", () => {
      set({ connectionStatus: "connected" });
      const storedSession = getStoredRoomSession();
      if (storedSession && shouldRestoreSession(storedSession)) {
        reconnectingFromStorage = true;
        set({ isRestoringSession: true });
        socket.emit("reconnect_room", {
          roomCode: storedSession.roomCode,
          username: storedSession.username,
          displayName: storedSession.displayName,
          asSpectator: storedSession.isSpectator
        });
      }
    });
    socket.on("disconnect", () => set({ connectionStatus: "offline" }));
    socket.on("connect_error", () =>
      set({ connectionStatus: "offline", error: "Realtime server unavailable." })
    );
    socket.on("error_message", (payload) => {
      if (reconnectingFromStorage) {
        reconnectingFromStorage = false;
        clearRoomSession();
        set({ room: null, isRestoringSession: false });
      }
      set({ error: payload.message });
    });
    socket.on("room_created", (payload) => applySnapshot(payload.snapshot));
    socket.on("hand_dealt", () => undefined);

    for (const event of snapshotEvents) {
      socket.on(event, (snapshot: RoomSnapshot) => applySnapshot(snapshot));
    }

    set({ socket });
  },
  clearError: () => set({ error: null }),
  createRoom: (username, displayName, targetScore) => {
    clearRoomSession();
    get().socket?.emit("create_room", { username, displayName, targetScore });
  },
  joinRoom: (roomCode, username, displayName, asSpectator = false) => {
    clearRoomSession(false);
    get().socket?.emit("join_room", { roomCode, username, displayName, asSpectator });
  },
  leaveRoom: () => {
    get().socket?.emit("leave_room");
    clearRoomSession();
    set({ room: null, isRestoringSession: false });
  },
  setReady: (ready) => get().socket?.emit("set_ready", { ready }),
  setTargetScore: (targetScore) => get().socket?.emit("set_target_score", { targetScore }),
  startGame: () => get().socket?.emit("start_game"),
  chooseTrump: (suit) => get().socket?.emit("choose_trump", { suit }),
  submitBid: (bid) => get().socket?.emit("submit_bid", { bid }),
  playCard: (cardId) => get().socket?.emit("play_card", { cardId }),
  sendChat: (message) => get().socket?.emit("send_chat", { message }),
  kickPlayer: (username) => get().socket?.emit("kick_player", { username }),
  returnToLobby: () => get().socket?.emit("return_to_lobby")
}));

function getStoredRoomSession(): StoredRoomSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.sessionStorage.getItem(roomSessionKey);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<StoredRoomSession>;
    if (!parsed.roomCode || !parsed.username) {
      return null;
    }

    return {
      roomCode: parsed.roomCode,
      username: parsed.username,
      displayName: parsed.displayName || parsed.username,
      isSpectator: Boolean(parsed.isSpectator)
    };
  } catch {
    clearRoomSession(false);
    return null;
  }
}

function shouldRestoreSession(session: StoredRoomSession): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const url = new URL(window.location.href);
  const roomCodeFromUrl = url.searchParams.get("room");
  return !roomCodeFromUrl || roomCodeFromUrl.toUpperCase() === session.roomCode.toUpperCase();
}

function storeRoomSession(snapshot: RoomSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  const session: StoredRoomSession = {
    roomCode: snapshot.roomCode,
    username: snapshot.me.username,
    displayName: snapshot.me.displayName,
    isSpectator: snapshot.me.isSpectator
  };

  window.sessionStorage.setItem(roomSessionKey, JSON.stringify(session));
  setRoomUrl(snapshot.roomCode);
}

function clearRoomSession(clearUrl = true): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(roomSessionKey);
  if (clearUrl) {
    setRoomUrl(null);
  }
}

function setRoomUrl(roomCode: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (roomCode) {
    url.searchParams.set("room", roomCode);
  } else {
    url.searchParams.delete("room");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}
