import { experimental_upgradeWebSocket } from "@vercel/functions";
import { createRealtimeHub } from "../../../server/realtimeHub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const publicBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? vercelUrl ?? "http://localhost:3000";
const realtimeHub = createRealtimeHub(publicBaseUrl);

export function GET() {
  return experimental_upgradeWebSocket((webSocket) => {
    realtimeHub.connect(webSocket);
  });
}
