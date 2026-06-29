import { randomUUID } from "node:crypto";
import { registerSocketHandlers } from "./socketHandlers";

type MessageHandler = (payload: unknown) => void;
type CloseHandler = () => void;

type WebSocketLike = {
  readyState?: number;
  send: (data: string) => void;
  close?: () => void;
  on?: (event: "message" | "close" | "error", handler: (...args: any[]) => void) => void;
  addEventListener?: (event: "message" | "close" | "error", handler: (...args: any[]) => void) => void;
};

type WireMessage = {
  event?: string;
  payload?: unknown;
};

export function createRealtimeHub(publicBaseUrl: string): RealtimeIo {
  const io = new RealtimeIo();
  registerSocketHandlers(io as any, publicBaseUrl);
  return io;
}

class RealtimeIo {
  private connectionHandler: ((socket: RealtimeSocket) => void) | null = null;
  private readonly sockets = new Map<string, RealtimeSocket>();
  private readonly rooms = new Map<string, Set<string>>();

  on(event: "connection", handler: (socket: RealtimeSocket) => void): void {
    if (event === "connection") {
      this.connectionHandler = handler;
    }
  }

  connect(webSocket: WebSocketLike): void {
    const socket = new RealtimeSocket(this, webSocket);
    this.sockets.set(socket.id, socket);
    this.connectionHandler?.(socket);
    socket.attach();
  }

  to(target: string): { emit: (event: string, payload?: unknown) => void } {
    return {
      emit: (event, payload) => {
        const socket = this.sockets.get(target);
        if (socket) {
          socket.emit(event, payload);
          return;
        }

        for (const socketId of this.rooms.get(target) ?? []) {
          this.sockets.get(socketId)?.emit(event, payload);
        }
      }
    };
  }

  join(socket: RealtimeSocket, roomCode: string): void {
    const room = this.rooms.get(roomCode) ?? new Set<string>();
    room.add(socket.id);
    this.rooms.set(roomCode, room);
  }

  leave(socket: RealtimeSocket, roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    room.delete(socket.id);
    if (room.size === 0) {
      this.rooms.delete(roomCode);
    }
  }

  remove(socket: RealtimeSocket): void {
    for (const roomCode of [...this.rooms.keys()]) {
      this.leave(socket, roomCode);
    }
    this.sockets.delete(socket.id);
  }
}

class RealtimeSocket {
  readonly id = randomUUID();
  readonly data: Record<string, unknown> = {};
  private readonly handlers = new Map<string, MessageHandler[]>();
  private readonly closeHandlers: CloseHandler[] = [];
  private pendingMessages: WireMessage[] = [];
  private disconnected = false;

  constructor(private readonly io: RealtimeIo, private readonly webSocket: WebSocketLike) {}

  attach(): void {
    addSocketListener(this.webSocket, "message", (message) => this.handleMessage(message));
    addSocketListener(this.webSocket, "close", () => this.disconnect());
    addSocketListener(this.webSocket, "error", () => this.disconnect());
  }

  on(event: string, handler: MessageHandler | CloseHandler): void {
    if (event === "disconnect") {
      this.closeHandlers.push(handler as CloseHandler);
      return;
    }

    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler as MessageHandler);
    this.handlers.set(event, handlers);
    this.flushPendingMessages(event);
  }

  emit(event: string, payload?: unknown): void {
    if (this.webSocket.readyState !== undefined && this.webSocket.readyState !== 1) {
      return;
    }

    this.webSocket.send(JSON.stringify({ event, payload }));
  }

  join(roomCode: string): void {
    this.io.join(this, roomCode);
  }

  leave(roomCode: string): void {
    this.io.leave(this, roomCode);
  }

  disconnect(): void {
    if (this.disconnected) {
      return;
    }

    this.disconnected = true;
    this.io.remove(this);
    for (const handler of this.closeHandlers) {
      handler();
    }
  }

  private handleMessage(rawMessage: unknown): void {
    const message = parseWireMessage(rawMessage);
    if (!message?.event) {
      return;
    }

    const handlers = this.handlers.get(message.event) ?? [];
    if (handlers.length === 0) {
      this.pendingMessages.push(message);
      return;
    }

    for (const handler of handlers) {
      handler(message.payload);
    }
  }

  private flushPendingMessages(event: string): void {
    const readyMessages = this.pendingMessages.filter((message) => message.event === event);
    this.pendingMessages = this.pendingMessages.filter((message) => message.event !== event);

    for (const message of readyMessages) {
      this.handleMessage(JSON.stringify(message));
    }
  }
}

function addSocketListener(
  webSocket: WebSocketLike,
  event: "message" | "close" | "error",
  handler: (...args: any[]) => void
): void {
  if (webSocket.on) {
    webSocket.on(event, handler);
    return;
  }

  webSocket.addEventListener?.(event, handler);
}

function parseWireMessage(rawMessage: unknown): WireMessage | null {
  const data =
    typeof rawMessage === "object" && rawMessage !== null && "data" in rawMessage
      ? (rawMessage as MessageEvent).data
      : rawMessage;
  const text = toMessageText(data);

  try {
    return JSON.parse(text) as WireMessage;
  } catch {
    return null;
  }
}

function toMessageText(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }

  return String(data);
}
