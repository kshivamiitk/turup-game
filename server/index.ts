import express from "express";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socketHandlers";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from "../types/socket";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? `http://localhost:${port}`;

void app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    pingInterval: 10_000,
    pingTimeout: 20_000,
    cors: {
      origin: "*"
    }
  });

  registerSocketHandlers(io, publicBaseUrl);

  expressApp.all("*", (request, response) => {
    void handle(request, response);
  });

  httpServer.listen(port, () => {
    console.log(`TURUP is running on ${publicBaseUrl}`);
  });
});
