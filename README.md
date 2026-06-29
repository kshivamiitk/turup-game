# TURUP

Fast, browser-based real-time Turup for 4 players. Rooms, players, hands, bids, scores, chat, and reconnect state live only in server memory.

## Tech Stack

- Next.js, React, TypeScript
- TailwindCSS
- Framer Motion
- Zustand
- Express custom server
- Socket.IO
- No database, ORM, Redis, file storage, auth provider, or persistence layer

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
9. Each player submits a bid from 0 to 13.
10. Players play 13 tricks, following suit when possible.
11. The server calculates trick winners and round score.
12. Rounds continue until one player reaches the target score.

Every seated player is scored individually. There are no teams or partners.

## Default Scoring

Scoring is isolated in `game/scoring.ts`.

Default rule:

- Exact bid: `10 + tricksWon`
- Missed bid: `-abs(bid - tricksWon)`
- Match winner: first player with a unique highest score at or above the target

This is intentionally easy to replace for local Turup variants.

## In-Memory Design

The server stores all state in `Map` objects in `server/roomStore.ts`.

Nothing is saved permanently. A restart clears every room and match. Empty rooms are deleted after a short in-memory timeout. Reconnect works only while the same server process still has the room in memory.

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
- `chat_message`
- `reconnect_success`

The server is authoritative. Clients only send intended actions and render room snapshots. The server validates turn order, legal card plays, bids, ownership, trick winners, scoring, host controls, and room capacity.

## Project Structure

- `app/` Next.js app shell and global styles
- `components/` lobby, table, cards, score, and chat UI
- `game/` pure card, rule, and scoring modules
- `server/` Express, Socket.IO, room store, serialization, and game transitions
- `socket/` client Socket.IO store
- `types/` shared TypeScript contracts
- `utils/` shared utility helpers

## Deployment

This app needs a persistent Node process for Socket.IO and in-memory rooms.

Vercel can serve the Next.js frontend, but Vercel serverless functions do not run this custom Express + Socket.IO server as a long-lived process. If you deploy only to Vercel, the page can load while the realtime connection stays offline.

Recommended options:

- Deploy the whole app to a Node host that supports WebSockets, such as Render, Railway, Fly.io, DigitalOcean App Platform, or a VPS.
- Or deploy the frontend to Vercel and deploy this same app/server to a Node host for Socket.IO, then point Vercel at that socket backend.

Required build/start commands:

```bash
npm install
npm run build
npm start
```

Set `PORT` if the hosting provider requires it. Set `APP_URL` or `NEXT_PUBLIC_APP_URL` to the deployed base URL so invite links use the public domain.

Use a single Node process per active room set. Because there is no shared database or Redis adapter, rooms are not shared across multiple server instances.

### Vercel Frontend + Separate Socket Server

On the Node backend host:

```bash
NEXT_PUBLIC_APP_URL=https://turup-game.vercel.app
SOCKET_CORS_ORIGIN=https://turup-game.vercel.app
npm run build
npm start
```

On Vercel:

```bash
NEXT_PUBLIC_SOCKET_URL=https://your-node-backend.example.com
NEXT_PUBLIC_APP_URL=https://turup-game.vercel.app
```

Redeploy Vercel after setting `NEXT_PUBLIC_SOCKET_URL`; public Next.js env vars are baked into the client bundle at build time.
