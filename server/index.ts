import express from "express";
import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";
import { createRealtimeHub } from "./realtimeHub";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? `http://localhost:${port}`;
const socketPath = process.env.SOCKET_IO_PATH ?? process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/api/socket-io";

void app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const webSocketServer = new WebSocketServer({ noServer: true });
  const realtimeHub = createRealtimeHub(publicBaseUrl);

  webSocketServer.on("connection", (webSocket) => {
    realtimeHub.connect(webSocket);
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", publicBaseUrl).pathname;
    if (pathname !== socketPath) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  expressApp.all("*", (request, response) => {
    void handle(request, response);
  });

  httpServer.listen(port, () => {
    console.log(`TURUP is running on ${publicBaseUrl}`);
    console.log(`Realtime WebSocket is listening on ${socketPath}`);
  });
});
