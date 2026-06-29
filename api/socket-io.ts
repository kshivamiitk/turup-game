import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerSocketHandlers } from "../server/socketHandlers";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from "../types/socket";

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const publicBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? vercelUrl ?? "http://localhost:3000";
const corsOrigins = parseCorsOrigins(
  process.env.SOCKET_CORS_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? vercelUrl
);

const server = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
  pingInterval: 10_000,
  pingTimeout: 20_000,
  transports: ["websocket"],
  cors: {
    origin: corsOrigins
  }
});

registerSocketHandlers(io, publicBaseUrl);

export default server;

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
