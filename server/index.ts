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
const corsOrigins = parseCorsOrigins(process.env.SOCKET_CORS_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL);
const socketPath = process.env.SOCKET_IO_PATH ?? process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/api/socket-io/socket.io";

void app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    path: socketPath,
    pingInterval: 10_000,
    pingTimeout: 20_000,
    cors: {
      origin: corsOrigins
    }
  });

  registerSocketHandlers(io, publicBaseUrl);

  expressApp.all("*", (request, response) => {
    void handle(request, response);
  });

  httpServer.listen(port, () => {
    console.log(`TURUP is running on ${publicBaseUrl}`);
    console.log(`Socket.IO is listening on ${socketPath}`);
  });
});

function parseCorsOrigins(value: string | undefined): string | string[] {
  if (!value) {
    return "*";
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length <= 1 ? origins[0] ?? "*" : origins;
}
