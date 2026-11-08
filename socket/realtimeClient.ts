type EventHandler = (payload?: any) => void;

type ClientOptions = {
  path: string;
};

type WireMessage = {
  event?: string;
  payload?: unknown;
};

const heartbeatMs = 10_000;
const maxBackoffMs = 8_000;

/**
 * WebSocket client that survives bad networks: it reconnects with backoff,
 * pings to detect dead connections (mobile networks often drop silently),
 * and reconnects right away when the tab is visible again or the device comes back online.
 */
export class RealtimeClientSocket {
  private webSocket: WebSocket | null = null;
  private readonly handlers = new Map<string, EventHandler[]>();
  private attempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private lastPongAt = 0;

  constructor(private readonly serverUrl: string | undefined, private readonly options: ClientOptions) {
    this.connect();
    this.on("pong", () => {
      this.lastPongAt = Date.now();
    });
    window.addEventListener("online", () => this.reconnectNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.checkAlive();
      }
    });
  }

  get connected(): boolean {
    return this.webSocket?.readyState === WebSocket.OPEN;
  }

  on(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  emit(event: string, payload?: unknown): boolean {
    if (!this.connected) {
      return false;
    }

    this.webSocket!.send(JSON.stringify({ event, payload }));
    return true;
  }

  private connect(): void {
    this.dispatch("connecting");
    const webSocket = new WebSocket(getWebSocketUrl(this.serverUrl, this.options.path));
    this.webSocket = webSocket;

    webSocket.addEventListener("open", () => {
      this.attempts = 0;
      this.lastPongAt = Date.now();
      this.startHeartbeat();
      this.dispatch("connect");
    });
    webSocket.addEventListener("close", () => {
      if (this.webSocket !== webSocket) {
        return;
      }
      this.stopHeartbeat();
      this.dispatch("disconnect");
      this.scheduleReconnect();
    });
    webSocket.addEventListener("message", (message) => {
      const parsed = parseWireMessage(message.data);
      if (parsed?.event) {
        this.dispatch(parsed.event, parsed.payload);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }
    const delay = Math.min(maxBackoffMs, 500 * 2 ** this.attempts) + Math.random() * 300;
    this.attempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private reconnectNow(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.attempts = 0;
    const old = this.webSocket;
    this.webSocket = null;
    this.stopHeartbeat();
    old?.close();
    this.connect();
  }

  private checkAlive(): void {
    if (!this.connected || Date.now() - this.lastPongAt > heartbeatMs * 2.5) {
      this.reconnectNow();
    } else {
      this.emit("ping");
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (Date.now() - this.lastPongAt > heartbeatMs * 2.5) {
        this.reconnectNow();
        return;
      }
      this.emit("ping");
    }, heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private dispatch(event: string, payload?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}

function getWebSocketUrl(serverUrl: string | undefined, path: string): string {
  const baseUrl =
    serverUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function parseWireMessage(rawMessage: unknown): WireMessage | null {
  try {
    return JSON.parse(String(rawMessage)) as WireMessage;
  } catch {
    return null;
  }
}
