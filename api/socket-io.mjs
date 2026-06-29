import { createServer } from "node:http";
import { createRequire } from "node:module";
import { Server } from "socket.io";

const require = createRequire(import.meta.url);
const { registerSocketHandlers } = require("../dist/server/socketHandlers.js");

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const publicBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || vercelUrl || "http://localhost:3000";
const corsOrigins = parseCorsOrigins(
  process.env.SOCKET_CORS_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || vercelUrl
);
const socketPath = process.env.SOCKET_IO_PATH || process.env.NEXT_PUBLIC_SOCKET_PATH || "/api/socket-io";

const server = createServer();
const io = new Server(server, {
  path: socketPath,
  addTrailingSlash: false,
  pingInterval: 10_000,
  pingTimeout: 20_000,
  transports: ["websocket"],
  cors: {
    origin: corsOrigins
  }
});

registerSocketHandlers(io, publicBaseUrl);

export default server;

function parseCorsOrigins(value) {
  if (!value) {
    return "*";
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length <= 1 ? origins[0] || "*" : origins;
}
