import express from "express";
import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";
import { createRealtimeHub } from "./realtimeHub";
import { enableRoomPersistence } from "./roomStore";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();
// Next only auto-attaches its own "upgrade" listener when it can see the http server; that listener
// also grabs our game socket and kills it. We never hand it the server, and route its HMR socket ourselves.
const handleNextUpgrade = app.getUpgradeHandler();
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? `http://localhost:${port}`;
const socketPath = process.env.SOCKET_IO_PATH ?? process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/api/socket-io";

enableRoomPersistence(process.env.ROOMS_FILE ?? ".data/rooms.json");

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
      if (pathname.startsWith("/_next/")) {
        void handleNextUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  expressApp.all("*", (request, response) => {
    // Hide the http server from Next (see handleNextUpgrade above).
    const nodeSocket = request.socket as typeof request.socket & { server?: unknown };
    const server = nodeSocket.server;
    nodeSocket.server = undefined;
    void handle(request, response).finally(() => {
      nodeSocket.server = server;
    });
  });

  httpServer.listen(port, () => {
    console.log(`TURUP is running on ${publicBaseUrl}`);
    console.log(`Realtime WebSocket is listening on ${socketPath}`);
  });
});
