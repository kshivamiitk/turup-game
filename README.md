# TURUP

Fast, browser-based real-time Turup for 4 players. Live video/voice for the table, and refresh-proof sessions (see below).

## Tech Stack

- Next.js, React, TypeScript
- TailwindCSS
- Framer Motion
- Zustand
- Express custom server for local/full Node hosting
- Native WebSocket realtime transport
- WebRTC (peer-to-peer) for video/voice
- No database: state lives in server memory, snapshotted to a JSON file on the Node server

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production build:

```bash
npm run build
npm start
```

## How To Play

1. Enter a username.
2. Create a room or join with a room code.
3. Share the room code or invite link.
4. Four seated players mark ready.
5. The host starts the match.
6. The server deals 5 cards to each player.
7. The round starter chooses Turup, the trump suit.
8. The server deals the remaining cards until each player has 13.
9. Bidding goes **one player at a time**, starting with the Turup declarer and going clockwise. Each bid (1–13) is shown to everyone the moment it's placed, so later bidders can plan around it. The table also shows the running total vs. 13 tricks.
10. Players play 13 tricks, following suit when possible. On touch screens, tap a card once to lift it and again to play it.
11. The server calculates trick winners and round score.
12. Rounds continue until one player reaches the target score.

Every seated player is scored individually. There are no teams or partners.

## Scoring

Scoring lives in `game/scoring.ts` (self-check: `npx tsx game/scoring.check.ts`).

- **Made the bid** (tricks won ≥ bid): `bid × 10` + 1 per extra trick. Bid 4, won 5 → **+41**.
- **Fell short** (tricks won < bid): `−(bid × 10)`, no matter how close. Bid 4, won 3 → **−40**.
- Match winner: first player with a unique highest score at or above the target (default 300).

## Video & Voice Calling

Every seated player can join a live call from the table (desktop: right column; phone: scroll down below the hand).

- Mic and camera start **off**. Each player toggles them independently with the mic/camera buttons. Everyone sees who is muted.
- Your mic/camera choice is remembered and turned back on after a refresh.
- It runs peer-to-peer over WebRTC (a 4-way mesh). The game WebSocket only relays connection setup. Video is capped at 320×240 / 15fps / ~250 kbps per stream, so it also works on mobile data.
- If the network switches (wifi ↔ mobile data), the call reconnects by itself.
- Spectators can watch the table but are not in the call.
- **TURN server (recommended for production):** some strict mobile/corporate networks block direct peer connections. Set `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` (e.g. from Cloudflare Calls, Twilio, or Metered) so those players can still connect. Without it, only free public STUN is used.
- Camera and mic need HTTPS (or `localhost`).

## ⚠️ Refresh & Reconnect: Nothing Is Lost

**Refreshing the page, closing and reopening the tab, losing network, or the phone going to sleep never removes you from the game.** You come back to the exact latest position: same seat, same hand, same bids, same tricks, same scores.

How it works:

- Your seat is saved in the tab (`sessionStorage`), and the URL keeps `?room=CODE`. On refresh, the client reclaims your seat automatically.
- Each seat has a secret token, also kept in `localStorage`. If you close the tab, join again with the same name and room code and you get your seat back. Nobody else can take your seat by typing your name.
- All game state lives on the server, so it's sent back to you the moment you reconnect.
- The client reconnects by itself with backoff, sends a heartbeat every 10s to catch silently dead mobile connections, and reconnects straight away when the tab becomes visible or the device comes back online.
- While a player is disconnected, the others see them as "offline". **The host keeps host rights for 30s** so a refresh doesn't hand control to someone else.
- If a disconnected player's turn timer (45s) runs out, the server plays their lowest legal card so the table isn't stuck forever. Once they're back, they play normally again.
- Clicking **Leave** (the exit button) is the only thing that gives up your seat. Being kicked by the host clears it too.

**Server restarts:** with the Node server (`npm run dev` / `npm start`), every room is also saved to `.data/rooms.json` (change with `ROOMS_FILE`) about every 2 seconds and restored on boot, so even a restart or redeploy doesn't wipe a match in progress. On Vercel/serverless, state is in-memory only, so a cold start still clears rooms. Use the Node server for reliable games.

Empty rooms are deleted 30 minutes after the last person disconnects.

## Socket Events

Client to server:

- `create_room`
- `join_room`
- `reconnect_room`
- `leave_room`
- `set_ready`
- `set_target_score`
- `start_game`
- `choose_trump`
- `submit_bid`
- `play_card`
- `send_chat`
- `kick_player`
- `return_to_lobby`
- `set_media`
- `rtc_signal`
- `ping`

Server to client:

- `room_created`
- `room_updated`
- `player_joined`
- `player_left`
- `game_started`
- `hand_dealt`
- `trump_selected`
- `bidding_started`
- `bid_updated`
- `trick_started`
- `card_played`
- `trick_won`
- `round_ended`
- `match_ended`
- `error_message`
- `rtc_signal`
- `pong`
- `chat_message`
- `reconnect_success`

The server is authoritative. Clients only send intended actions and render room snapshots. The server validates turn order, legal card plays, bids, ownership, trick winners, scoring, host controls, and room capacity.

## Project Structure

- `app/` Next.js app shell and global styles
- `components/` lobby, table, cards, score, and chat UI
- `game/` pure card, rule, and scoring modules
- `app/api/socket-io/` Vercel WebSocket upgrade route
- `server/` realtime adapter, local Express server, room store, serialization, and game transitions
- `socket/` client WebSocket store
- `types/` shared TypeScript contracts
- `utils/` shared utility helpers

## Deployment

### Vercel Only

The app can be deployed as a single Vercel project:

- Next.js serves the frontend.
- `app/api/socket-io/route.ts` upgrades native WebSocket connections on Vercel.
- The browser connects to `/api/socket-io` on the same Vercel domain by default.

Vercel environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://turup-game.vercel.app
NEXT_PUBLIC_SOCKET_PATH=/api/socket-io
```

Leave `NEXT_PUBLIC_SOCKET_URL` empty for Vercel-only deployment. Set it only if you intentionally point the frontend at a different socket host.

Vercel WebSockets are served through Fluid Compute. `vercel.json` enables Fluid Compute for this project.

### Important In-Memory Limit

Rooms, reconnect state, scores, and matches still live only in server memory. A redeploy, function restart, cold start replacement, or scaled multi-instance runtime can clear rooms because this project intentionally has no database or Redis adapter.

Function duration is controlled by the Vercel plan and Fluid Compute settings for the project.

For the most reliable long-running rooms, use one persistent Node process:

```bash
npm install
npm run build
npm start
```

Set `PORT` if the hosting provider requires it. Set `APP_URL` or `NEXT_PUBLIC_APP_URL` to the deployed base URL so invite links use the public domain.
