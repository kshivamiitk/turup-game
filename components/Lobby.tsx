import { Check, Copy, Crown, LogOut, Play, Share2, UserX } from "lucide-react";
import type { RoomSnapshot } from "../types/game";
import { useTurupStore } from "../socket/useTurupStore";
import { ConnectionBadge } from "./ConnectionBadge";
import { ChatPanel } from "./ChatPanel";
import { CallPanel } from "./CallPanel";
import { cn } from "../utils/classNames";

type LobbyProps = {
  room: RoomSnapshot;
};

export function Lobby({ room }: LobbyProps) {
  const connectionStatus = useTurupStore((state) => state.connectionStatus);
  const leaveRoom = useTurupStore((state) => state.leaveRoom);
  const setReady = useTurupStore((state) => state.setReady);
  const setTargetScore = useTurupStore((state) => state.setTargetScore);
  const startGame = useTurupStore((state) => state.startGame);
  const kickPlayer = useTurupStore((state) => state.kickPlayer);
  const me = room.players.find((player) => player.username === room.me.username);
  const allReady = room.players.length === 4 && room.players.every((player) => player.ready && player.connected);

  async function copyInvite() {
    await navigator.clipboard?.writeText(room.inviteUrl);
  }

  async function shareRoom() {
    if (navigator.share) {
      await navigator.share({ title: "TURUP", text: `Join room ${room.roomCode}`, url: room.inviteUrl });
    } else {
      await copyInvite();
    }
  }

  return (
    <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="surface-panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="brand-title text-2xl">TURUP</h1>
            <span className="rounded-md border border-brass/25 bg-brass/10 px-3 py-1.5 font-mono text-sm font-black tracking-widest text-brass">
              {room.roomCode}
            </span>
            <span className="text-sm font-bold text-stone-400">{room.players.length}/4 seated</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge status={connectionStatus} />
            <button className="icon-button" onClick={copyInvite} aria-label="Copy invite link">
              <Copy className="h-4 w-4" />
            </button>
            <button className="icon-button" onClick={shareRoom} aria-label="Share room">
              <Share2 className="h-4 w-4" />
            </button>
            <button className="danger-button !h-10 !w-10 !px-0" onClick={leaveRoom} aria-label="Leave room">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-5">
          <div className="table-felt grid grid-cols-2 gap-2 rounded-[2rem] p-3 sm:gap-3 sm:p-4 md:min-h-[34rem] md:grid-cols-[11rem_1fr_11rem] md:grid-rows-[auto_1fr_auto] lg:grid-cols-[13rem_1fr_13rem]">
            <div className="md:col-start-2 md:row-start-1">
              <LobbySeatCard player={room.players.find((player) => player.seat === 2)} seat={2} room={room} onKick={kickPlayer} />
            </div>
            <div className="md:col-start-1 md:row-start-2">
              <LobbySeatCard player={room.players.find((player) => player.seat === 1)} seat={1} room={room} onKick={kickPlayer} />
            </div>

            <div className="col-span-2 row-start-3 flex flex-col justify-between rounded-2xl border border-brass/20 bg-[#0d1918]/75 p-3 shadow-card sm:p-4 md:col-span-1 md:col-start-2 md:row-start-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="subtle-panel p-3">
                  <label className="field-label" htmlFor="lobbyTargetScore">
                    Target score
                  </label>
                  <input
                    id="lobbyTargetScore"
                    type="number"
                    min={1}
                    max={1000}
                    className="field-input"
                    value={room.targetScore}
                    disabled={!room.me.isHost}
                    onChange={(event) => setTargetScore(Number(event.target.value))}
                  />
                </div>
                <div className="subtle-panel p-3">
                  <div className="field-label">Ready status</div>
                  <div className="text-2xl font-black text-stone-50">
                    {room.players.filter((player) => player.ready && player.connected).length}/4
                  </div>
                  <div className="mt-1 text-xs font-bold text-stone-500">Connected and ready</div>
                </div>
              </div>

              <RulesCard />

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {!room.me.isSpectator ? (
                  <button className={me?.ready ? "secondary-button" : "success-button"} onClick={() => setReady(!me?.ready)}>
                    <Check className="h-4 w-4" />
                    {me?.ready ? "Unready" : "Ready"}
                  </button>
                ) : null}
                {room.me.isHost ? (
                  <button className="primary-button" disabled={!allReady} onClick={startGame}>
                    <Play className="h-4 w-4" />
                    Start match
                  </button>
                ) : null}
              </div>
            </div>

            <div className="md:col-start-3 md:row-start-2">
              <LobbySeatCard player={room.players.find((player) => player.seat === 3)} seat={3} room={room} onKick={kickPlayer} />
            </div>
            <div className="row-start-1 md:col-start-2 md:row-start-3">
              <LobbySeatCard player={room.players.find((player) => player.seat === 0)} seat={0} room={room} onKick={kickPlayer} />
            </div>
            {!allReady && room.me.isHost ? (
              <div className="col-span-2 text-center text-xs font-bold text-stone-300/80 md:col-span-3">
                Share the room code — the match starts once all 4 seats are ready.
              </div>
            ) : null}
          </div>

          {room.spectators.length > 0 ? (
            <div className="mt-4 subtle-panel p-3">
              <div className="text-xs font-black uppercase tracking-wide text-stone-500">Spectators</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {room.spectators.map((spectator) => (
                  <span key={spectator.username} className="rounded-md bg-white/[0.07] px-2 py-1 text-sm font-bold text-stone-300">
                    {spectator.displayName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <aside className="grid content-start gap-4">
        <CallPanel room={room} />
        <ChatPanel room={room} />
      </aside>
    </div>
  );
}

function RulesCard() {
  return (
    <div className="mt-3 rounded-xl border border-brass/20 bg-black/25 p-3 text-xs font-bold leading-relaxed text-stone-300">
      <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-brass">Scoring</div>
      Bid 1–13 tricks. Make it and score <span className="text-emerald-300">bid × 10</span>, plus 1 for each extra trick (bid 4,
      take 5 → +41). Fall short by even one and lose <span className="text-red-300">bid × 10</span> (bid 4, take 3 → −40).
    </div>
  );
}

function LobbySeatCard({
  player,
  seat,
  room,
  onKick
}: {
  player: RoomSnapshot["players"][number] | undefined;
  seat: number;
  room: RoomSnapshot;
  onKick: (username: string) => void;
}) {
  const isMe = player?.username === room.me.username;
  return (
    <div className={cn("seat-card min-h-[5.5rem]", !player && "!border-dashed !bg-black/20", player?.ready && "!border-emerald-400/40")}>
      {player ? (
        <>
          <div className="flex items-center gap-2.5">
            <div className={cn("seat-avatar", isMe && "seat-avatar-me")}>
              {player.displayName.slice(0, 1).toUpperCase()}
              <span className={cn("seat-dot", player.connected ? "bg-emerald-400" : "bg-ember")} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-black text-stone-50">{isMe ? `${player.displayName} (you)` : player.displayName}</span>
                {player.isHost ? <Crown className="h-3.5 w-3.5 shrink-0 text-brass" aria-label="Host" /> : null}
              </div>
              <div className={cn("text-xs font-black", player.ready ? "text-emerald-300" : "text-stone-500")}>
                {!player.connected ? "Offline" : player.ready ? "✓ Ready" : "Not ready"}
              </div>
            </div>
          </div>
          {room.me.isHost && !player.isHost ? (
            <button className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-200/70 hover:text-red-200" onClick={() => onKick(player.username)}>
              <UserX className="h-3.5 w-3.5" />
              Remove
            </button>
          ) : null}
        </>
      ) : (
        <div className="grid h-full place-items-center py-3 text-center">
          <div className="text-[11px] font-black uppercase tracking-wide text-stone-500">Seat {seat + 1}</div>
          <div className="text-sm font-bold text-stone-400">Waiting for player…</div>
        </div>
      )}
    </div>
  );
}
