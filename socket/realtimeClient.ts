type EventHandler = (payload?: any) => void;

type ClientOptions = {
  path: string;
};

type WireMessage = {
  event?: string;
  payload?: unknown;
};

export class RealtimeClientSocket {
  private webSocket: WebSocket | null = null;
  private readonly handlers = new Map<string, EventHandler[]>();
  private hasOpened = false;

  constructor(private readonly serverUrl: string | undefined, private readonly options: ClientOptions) {
    this.connect();
  }

  on(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  emit(event: string, payload?: unknown): void {
    if (this.webSocket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.webSocket.send(JSON.stringify({ event, payload }));
  }

  close(): void {
    this.webSocket?.close();
  }

  private connect(): void {
    const webSocket = new WebSocket(getWebSocketUrl(this.serverUrl, this.options.path));
    this.webSocket = webSocket;

    webSocket.addEventListener("open", () => {
      this.hasOpened = true;
      this.dispatch("connect");
    });
    webSocket.addEventListener("close", () => this.dispatch("disconnect"));
    webSocket.addEventListener("error", () => {
      if (!this.hasOpened) {
        this.dispatch("connect_error");
      }
    });
    webSocket.addEventListener("message", (message) => {
      const parsed = parseWireMessage(message.data);
      if (parsed?.event) {
        this.dispatch(parsed.event, parsed.payload);
      }
    });
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
