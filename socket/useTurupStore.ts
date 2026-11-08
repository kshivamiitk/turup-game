"use client";

import { create } from "zustand";
import { RealtimeClientSocket } from "./realtimeClient";
import { attachCallSocket, syncCall } from "./useCallStore";
import type { RoomSnapshot, Suit } from "../types/game";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

type ClientSocket = RealtimeClientSocket;
type ConnectionStatus = "connecting" | "connected" | "offline";

type StoredRoomSession = {
  roomCode: string;
  username: string;
  displayName: string;
  isSpectator: boolean;
  token: string;
};

type TurupStore = {
  socket: ClientSocket | null;
  connectionStatus: ConnectionStatus;
  isRestoringSession: boolean;
  room: RoomSnapshot | null;
  clockOffsetMs: number;
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
  clockOffsetMs: 0,
  error: null,
  initSocket: () => {
    if (get().socket) {
      return;
    }

    set({ connectionStatus: "connecting" });
    const socket: ClientSocket = new RealtimeClientSocket(socketServerUrl, { path: socketPath });
    attachCallSocket(socket);

    let reconnectingFromStorage = false;

    const applySnapshot = (snapshot: RoomSnapshot) => {
      reconnectingFromStorage = false;
      storeRoomSession(snapshot);
      set({ room: snapshot, error: null, isRestoringSession: false, clockOffsetMs: snapshot.serverNow - Date.now() });
      syncCall(snapshot);
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
          asSpectator: storedSession.isSpectator,
          token: storedSession.token
        });
      }
    });
    socket.on("connecting", () => set({ connectionStatus: "connecting" }));
    socket.on("disconnect", () => set({ connectionStatus: "offline" }));
    socket.on("error_message", (payload) => {
      if (reconnectingFromStorage || payload.message === "You were removed from the room.") {
        reconnectingFromStorage = false;
        clearRoomSession();
        set({ room: null, isRestoringSession: false });
        syncCall(null);
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
    send("create_room", { username, displayName, targetScore });
  },
  joinRoom: (roomCode, username, displayName, asSpectator = false) => {
    clearRoomSession(false);
    send("join_room", { roomCode, username, displayName, asSpectator, token: getSavedToken(roomCode, username) });
  },
  leaveRoom: () => {
    get().socket?.emit("leave_room");
    clearRoomSession();
    set({ room: null, isRestoringSession: false });
    syncCall(null);
  },
  setReady: (ready) => send("set_ready", { ready }),
  setTargetScore: (targetScore) => send("set_target_score", { targetScore }),
  startGame: () => send("start_game"),
  chooseTrump: (suit) => send("choose_trump", { suit }),
  submitBid: (bid) => send("submit_bid", { bid }),
  playCard: (cardId) => send("play_card", { cardId }),
  sendChat: (message) => send("send_chat", { message }),
  kickPlayer: (username) => send("kick_player", { username }),
  returnToLobby: () => send("return_to_lobby")
}));

function send(event: string, payload?: unknown): void {
  if (!useTurupStore.getState().socket?.emit(event, payload)) {
    useTurupStore.setState({ error: "You're offline. Reconnecting… try again in a moment." });
  }
}

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
    if (!parsed.roomCode || !parsed.username || !parsed.token) {
      return null;
    }

    return {
      roomCode: parsed.roomCode,
      username: parsed.username,
      displayName: parsed.displayName || parsed.username,
      isSpectator: Boolean(parsed.isSpectator),
      token: parsed.token
    };
  } catch {
    clearRoomSession(false);
    return null;
  }
}

/*
 * Per-tab session (sessionStorage) drives auto-restore on refresh, so several tabs can hold different seats.
 * Seat tokens are also kept in localStorage so closing the tab and joining again with the same name reclaims the seat.
 */
const tokenVaultKey = "turup.seatTokens";

function readTokenVault(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(tokenVaultKey) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveToken(roomCode: string, username: string, token: string): void {
  try {
    const vault = readTokenVault();
    vault[`${roomCode.toUpperCase()}:${username}`] = token;
    // Keep only the most recent 20 seats.
    const entries = Object.entries(vault).slice(-20);
    window.localStorage.setItem(tokenVaultKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage blocked: rejoin after closing the tab won't work, refresh still does.
  }
}

function getSavedToken(roomCode: string, username: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return readTokenVault()[`${roomCode.trim().toUpperCase()}:${username.trim()}`];
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
    isSpectator: snapshot.me.isSpectator,
    token: snapshot.me.token
  };

  window.sessionStorage.setItem(roomSessionKey, JSON.stringify(session));
  saveToken(snapshot.roomCode, session.username, session.token);
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
