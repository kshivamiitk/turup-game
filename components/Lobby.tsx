import { Check, Copy, Crown, LogOut, Play, Share2, UserX } from "lucide-react";
import type { RoomSnapshot } from "../types/game";
import { useTurupStore } from "../socket/useTurupStore";
import { ConnectionBadge } from "./ConnectionBadge";
import { ChatPanel } from "./ChatPanel";
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
            <h1 className="text-2xl font-black text-stone-50">TURUP</h1>
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
          <div className="table-felt grid min-h-[34rem] gap-3 rounded-lg p-3 sm:p-4 lg:grid-cols-[13rem_1fr_13rem] lg:grid-rows-[auto_1fr_auto]">
            <div className="lg:col-start-2">
              <LobbySeatCard player={room.players.find((player) => player.seat === 2)} seat={2} room={room} onKick={kickPlayer} />
            </div>
            <div className="lg:col-start-1 lg:row-start-2">
              <LobbySeatCard player={room.players.find((player) => player.seat === 1)} seat={1} room={room} onKick={kickPlayer} />
            </div>

            <div className="flex min-h-72 flex-col justify-between rounded-lg border border-brass/20 bg-[#0d1918]/75 p-4 shadow-card lg:col-start-2 lg:row-start-2">
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

              <div className="my-5 grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((seat) => {
                  const player = room.players.find((candidate) => candidate.seat === seat);
                  return (
                    <div
                      key={seat}
                      className={cn(
                        "h-16 rounded-md border text-center text-xs font-black",
                        player?.ready ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-black/25 text-stone-500"
                      )}
                    >
                      <div className="pt-3">S{seat + 1}</div>
                      <div className="mt-1">{player ? (player.ready ? "Ready" : "Wait") : "Open"}</div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
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

            <div className="lg:col-start-3 lg:row-start-2">
              <LobbySeatCard player={room.players.find((player) => player.seat === 3)} seat={3} room={room} onKick={kickPlayer} />
            </div>
            <div className="lg:col-start-2 lg:row-start-3">
              <LobbySeatCard player={room.players.find((player) => player.seat === 0)} seat={0} room={room} onKick={kickPlayer} />
            </div>
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
      <ChatPanel room={room} />
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
  return (
    <div
      className={cn(
        "min-h-32 rounded-md border p-3 shadow-card",
        player ? "border-white/10 bg-[#111013]/80" : "border-dashed border-white/20 bg-black/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-stone-500">Seat {seat + 1}</span>
        {player?.isHost ? <Crown className="h-4 w-4 text-brass" /> : null}
      </div>
      {player ? (
        <>
          <div className="mt-3 truncate text-base font-black text-stone-50">{player.displayName}</div>
          <div className="mt-1 text-xs font-bold text-stone-500">Individual player</div>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs font-black">
            <span className={player.connected ? "text-emerald-200" : "text-red-200"}>{player.connected ? "Online" : "Offline"}</span>
            <span className={player.ready ? "text-brass" : "text-stone-500"}>{player.ready ? "Ready" : "Waiting"}</span>
          </div>
          {room.me.isHost && !player.isHost ? (
            <button className="danger-button mt-3 w-full" onClick={() => onKick(player.username)}>
              <UserX className="h-4 w-4" />
              Remove
            </button>
          ) : null}
        </>
      ) : (
        <div className="mt-8 text-sm font-bold text-stone-500">Open</div>
      )}
    </div>
  );
}
