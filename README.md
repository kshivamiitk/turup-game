# TURUP

Fast, browser-based real-time Turup for 4 players. Rooms, players, hands, bids, scores, chat, and reconnect state live only in server memory.

## Tech Stack

- Next.js, React, TypeScript
- TailwindCSS
- Framer Motion
- Zustand
- Express custom server for local/full Node hosting
- Vercel Node server capture for Vercel hosting
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
- `server.cjs` Vercel Node server entry point
- `server/` Socket.IO handlers, local Express server, room store, serialization, and game transitions
- `socket/` client Socket.IO store
- `types/` shared TypeScript contracts
- `utils/` shared utility helpers

## Deployment

### Vercel Only

The app can be deployed as a single Vercel project:

- Next.js serves the frontend.
- `server.cjs` starts the compiled custom Next + Socket.IO server.
- The browser connects to `/api/socket-io` on the same Vercel domain by default.

Vercel environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://turup-game.vercel.app
NEXT_PUBLIC_SOCKET_PATH=/api/socket-io
SOCKET_CORS_ORIGIN=https://turup-game.vercel.app
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
