import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, LogOut, Play, RotateCcw, Swords, Timer, Trophy } from "lucide-react";
import type { PublicPlayer, RoomSnapshot, Suit } from "../types/game";
import { suits } from "../types/game";
import { suitName, suitSymbol } from "../game/cards";
import { useTurupStore } from "../socket/useTurupStore";
import { CardView } from "./CardView";
import { ChatPanel } from "./ChatPanel";
import { ConnectionBadge } from "./ConnectionBadge";
import { Scoreboard } from "./Scoreboard";
import { cn } from "../utils/classNames";

type GameTableProps = {
  room: RoomSnapshot;
};

export function GameTable({ room }: GameTableProps) {
  const connectionStatus = useTurupStore((state) => state.connectionStatus);
  const leaveRoom = useTurupStore((state) => state.leaveRoom);
  const chooseTrump = useTurupStore((state) => state.chooseTrump);
  const submitBid = useTurupStore((state) => state.submitBid);
  const playCard = useTurupStore((state) => state.playCard);
  const startGame = useTurupStore((state) => state.startGame);
  const returnToLobby = useTurupStore((state) => state.returnToLobby);
  const [bid, setBid] = useState(room.ownBid ?? 0);
  const seconds = useTurnCountdown(room.turnStartedAt, room.turnDurationMs);
  const mePlayer = room.players.find((player) => player.username === room.me.username);
  const currentPlayer = room.players.find((player) => player.seat === room.currentTurnSeat);
  const legalCardIds = useMemo(() => new Set(room.legalCardIds), [room.legalCardIds]);
  const isMyTurn = Boolean(mePlayer && room.currentTurnSeat === mePlayer.seat && room.phase === "playing");
  const seatLayout = getSeatLayout(mePlayer?.seat ?? null);

  useEffect(() => {
    setBid(room.ownBid ?? 0);
  }, [room.ownBid]);

  function onSubmitBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitBid(bid);
  }

  async function copyRoomCode() {
    await navigator.clipboard?.writeText(room.roomCode);
  }

  return (
    <div className="grid flex-1 gap-3 xl:h-[calc(100vh-1.5rem)] xl:max-h-[calc(100vh-1.5rem)] xl:flex-none xl:grid-cols-[minmax(0,1fr)_20rem] xl:overflow-hidden">
      <section className="surface-panel flex min-h-0 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-stone-50">TURUP</h1>
              <span className="rounded-md border border-brass/25 bg-brass/10 px-2.5 py-1 font-mono text-sm font-black tracking-widest text-brass">
                {room.roomCode}
              </span>
              <button className="icon-button !h-8 !w-8" onClick={copyRoomCode} aria-label="Copy room code">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 truncate text-sm font-bold text-stone-400">{room.statusMessage}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill icon={<Swords className="h-3.5 w-3.5" />} label={room.trumpSuit ? suitName[room.trumpSuit] : "Turup"} />
            <StatusPill icon={<Timer className="h-3.5 w-3.5" />} label={room.currentTurnSeat === null ? "--" : `${seconds}s`} />
            <ConnectionBadge status={connectionStatus} />
            <button className="danger-button !h-10 !w-10 !px-0" onClick={leaveRoom} aria-label="Leave room">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid gap-2 border-b border-white/10 p-2.5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <Scoreboard room={room} />
          <div className="subtle-panel grid grid-cols-3 gap-2 p-2.5 text-center">
            <MiniStat label="Round" value={room.roundNumber || 1} />
            <MiniStat label="Phase" value={phaseLabel(room.phase)} />
            <MiniStat label="Turn" value={currentPlayer?.displayName ?? "--"} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3">
          <div className="table-felt grid min-h-0 flex-1 gap-2 rounded-lg p-2.5 sm:p-3 lg:grid-cols-[10.5rem_minmax(0,1fr)_10.5rem] lg:grid-rows-[auto_1fr_auto]">
            <div className="lg:col-start-2">
              <SeatPanel player={findSeat(room, seatLayout.top)} room={room} />
            </div>
            <div className="lg:col-start-1 lg:row-start-2">
              <SeatPanel player={findSeat(room, seatLayout.left)} room={room} />
            </div>

            <div className="flex min-h-[16rem] flex-col rounded-lg border border-brass/20 bg-[#0d1918]/75 p-2.5 shadow-card lg:col-start-2 lg:row-start-2">
              <TrickCenter room={room} currentPlayer={currentPlayer} />
              <ActionPanel
                room={room}
                bid={bid}
                setBid={setBid}
                onSubmitBid={onSubmitBid}
                chooseTrump={chooseTrump}
                startGame={startGame}
                returnToLobby={returnToLobby}
              />
            </div>

            <div className="lg:col-start-3 lg:row-start-2">
              <SeatPanel player={findSeat(room, seatLayout.right)} room={room} />
            </div>
            <div className="lg:col-start-2 lg:row-start-3">
              <SeatPanel player={findSeat(room, seatLayout.bottom)} room={room} primary />
            </div>
          </div>

          <section className="mt-2.5 rounded-lg border border-white/10 bg-[#111013]/90 p-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-stone-100">Hand</div>
                <div className="text-xs font-bold text-stone-500">{room.me.isSpectator ? "Spectator view" : `${room.hand.length} cards`}</div>
              </div>
              <div className={cn("rounded-md px-3 py-1.5 text-xs font-black", isMyTurn ? "bg-brass text-ink" : "bg-white/[0.07] text-stone-400")}>
                {isMyTurn ? "Your turn" : currentPlayer ? `${currentPlayer.displayName}'s turn` : phaseLabel(room.phase)}
              </div>
            </div>
            {room.me.isSpectator ? (
              <div className="rounded-md border border-dashed border-white/10 py-8 text-center text-sm font-bold text-stone-500">Watching as spectator</div>
            ) : (
              <motion.div className="scrollbar-thin flex min-h-[7.8rem] gap-2 overflow-x-auto pb-1" layout>
                {room.hand.map((card) => {
                  const playable = legalCardIds.has(card.id);
                  const canPlayNow = room.phase === "playing";
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      trumpSuit={room.trumpSuit}
                      playable={canPlayNow && isMyTurn && playable}
                      disabled={canPlayNow && (!isMyTurn || !playable)}
                      onClick={canPlayNow ? playCard : undefined}
                    />
                  );
                })}
              </motion.div>
            )}
          </section>
        </div>
      </section>

      <aside className="grid min-h-0 gap-3 xl:grid-rows-[auto_1fr] xl:overflow-hidden">
        <TrickHistory room={room} />
        <ChatPanel room={room} />
      </aside>
    </div>
  );
}

function TrickCenter({ room, currentPlayer }: { room: RoomSnapshot; currentPlayer: PublicPlayer | undefined }) {
  return (
    <div className="relative flex flex-1 items-center justify-center">
      <div className="absolute left-0 top-0 rounded-md border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-black text-stone-400">
        Trick {room.currentTrick?.index ?? room.trickHistory.length + 1}
      </div>
      <AnimatePresence mode="popLayout">
        {room.currentTrick && room.currentTrick.cards.length > 0 ? (
          <motion.div className="grid grid-cols-2 gap-3 sm:grid-cols-4" layout>
            {room.currentTrick.cards.map((played) => (
              <motion.div
                key={`${played.username}-${played.card.id}`}
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, scale: 0.86, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.86 }}
              >
                <CardView card={played.card} trumpSuit={room.trumpSuit} compact />
                <span className="max-w-24 truncate rounded-md bg-black/30 px-2 py-1 text-xs font-bold text-stone-300">
                  {displayNameForSeat(room, played.seat)}
                </span>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-20 w-28 place-items-center rounded-md border border-dashed border-brass/40 bg-black/20 text-3xl text-brass">
              {room.trumpSuit ? suitSymbol[room.trumpSuit] : "T"}
            </div>
            <div className="text-sm font-black text-stone-300">{currentPlayer ? `${currentPlayer.displayName} leads` : "Waiting"}</div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionPanel({
  room,
  bid,
  setBid,
  onSubmitBid,
  chooseTrump,
  startGame,
  returnToLobby
}: {
  room: RoomSnapshot;
  bid: number;
  setBid: (bid: number) => void;
  onSubmitBid: (event: FormEvent<HTMLFormElement>) => void;
  chooseTrump: (suit: Suit) => void;
  startGame: () => void;
  returnToLobby: () => void;
}) {
  const mePlayer = room.players.find((player) => player.username === room.me.username);
  const isTrumpChooser = mePlayer?.seat === room.trumpChooserSeat && room.phase === "trump_selection";

  if (isTrumpChooser) {
    return (
      <div className="rounded-md border border-brass/25 bg-[#111013]/90 p-3">
        <div className="mb-3 text-sm font-black text-stone-100">Choose Turup</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {suits.map((suit) => (
            <button key={suit} className="secondary-button !h-12 !px-3" onClick={() => chooseTrump(suit)}>
              <span className={cn("text-xl", suit === "hearts" || suit === "diamonds" ? "text-ember" : "text-stone-100")}>{suitSymbol[suit]}</span>
              {suitName[suit]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (room.phase === "bidding" && !room.me.isSpectator) {
    return (
      <form className="grid gap-3 rounded-md border border-white/10 bg-[#111013]/90 p-3 sm:grid-cols-[1fr_auto]" onSubmit={onSubmitBid}>
        <label className="grid gap-2 text-sm font-black text-stone-100">
          Bid
          <input className="field-input" type="number" min={0} max={13} value={bid} onChange={(event) => setBid(Number(event.target.value))} />
        </label>
        <button className="primary-button self-end" type="submit">
          Submit bid
        </button>
      </form>
    );
  }

  if (room.phase === "round_over" || room.phase === "match_over") {
    return (
      <div className="rounded-md border border-white/10 bg-[#111013]/90 p-3">
        {room.phase === "match_over" ? (
          <div className="mb-3 flex items-center gap-2 text-lg font-black text-brass">
            <Trophy className="h-5 w-5" />
            {winnerName(room)} wins
          </div>
        ) : null}
        <RoundSummary room={room} />
        {room.me.isHost ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="primary-button" onClick={startGame}>
              <Play className="h-4 w-4" />
              {room.phase === "match_over" ? "Play again" : "Next round"}
            </button>
            <button className="secondary-button" onClick={returnToLobby}>
              <RotateCcw className="h-4 w-4" />
              Lobby
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function RoundSummary({ room }: { room: RoomSnapshot }) {
  if (!room.roundSummary) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-96 text-left text-sm">
        <thead className="text-xs font-black uppercase tracking-wide text-stone-500">
          <tr>
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3">Bid</th>
            <th className="py-2 pr-3">Tricks</th>
            <th className="py-2 pr-3">Score</th>
          </tr>
        </thead>
        <tbody>
          {room.roundSummary.playerResults.map((result) => (
            <tr key={result.username} className="border-t border-white/10">
              <td className="py-2 pr-3 font-bold">{result.username}</td>
              <td className="py-2 pr-3">{result.bid}</td>
              <td className="py-2 pr-3">{result.tricksWon}</td>
              <td className={cn("py-2 pr-3 font-black", result.scoreDelta >= 0 ? "text-emerald-200" : "text-red-200")}>
                {result.scoreDelta >= 0 ? `+${result.scoreDelta}` : result.scoreDelta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeatPanel({ player, room, primary = false }: { player: PublicPlayer | undefined; room: RoomSnapshot; primary?: boolean }) {
  if (!player) {
    return <div className="rounded-md border border-dashed border-white/20 bg-black/20 p-3 text-center text-sm font-bold text-stone-500">Open seat</div>;
  }

  const active = player.seat === room.currentTurnSeat || player.seat === room.trumpChooserSeat;

  return (
    <div
      className={cn(
        "rounded-md border p-3 shadow-card",
        active ? "border-brass bg-brass/10" : "border-white/10 bg-[#111013]/80",
        primary ? "min-h-20" : "min-h-28"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-black text-stone-50">{player.displayName}</div>
          <div className="text-xs font-bold text-stone-500">Seat {player.seat + 1} | Score {player.totalScore}</div>
        </div>
        <span className={cn("h-2.5 w-2.5 rounded-full", player.connected ? "bg-emerald-300" : "bg-ember")} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <MiniStat label="Bid" value={player.bidSubmitted ? player.bid ?? "Set" : "--"} />
        <MiniStat label="Won" value={player.tricksWon} />
        <MiniStat label="Left" value={player.cardsRemaining} />
      </div>
    </div>
  );
}

function TrickHistory({ room }: { room: RoomSnapshot }) {
  return (
    <aside className="surface-panel overflow-hidden p-3">
      <div className="mb-3 text-sm font-black text-stone-100">Tricks</div>
      <div className="scrollbar-thin flex max-h-56 flex-col gap-2 overflow-y-auto">
        {room.trickHistory.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-sm font-bold text-stone-500">No completed tricks</div>
        ) : (
          [...room.trickHistory].reverse().map((trick) => (
            <div key={trick.index} className="rounded-md border border-white/10 bg-white/[0.055] p-2">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-stone-400">
                <span>Trick {trick.index}</span>
                <span className="truncate">{trick.winnerSeat === null ? "" : `${displayNameForSeat(room, trick.winnerSeat)} won`}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {trick.cards.map((played) => (
                  <span key={`${trick.index}-${played.card.id}`} className="rounded bg-black/30 px-2 py-1 text-xs font-black">
                    {suitSymbol[played.card.suit]} {played.card.rank}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function StatusPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="status-chip">
      {icon}
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-md bg-white/[0.065] px-2 py-1">
      <span className="block truncate text-[10px] font-black uppercase tracking-wide text-stone-500">{label}</span>
      <span className="block truncate font-black text-stone-100">{value}</span>
    </span>
  );
}

function useTurnCountdown(startedAt: number | null, durationMs: number): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    function update() {
      if (!startedAt) {
        setSeconds(0);
        return;
      }
      setSeconds(Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000)));
    }

    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [durationMs, startedAt]);

  return seconds;
}

function getSeatLayout(meSeat: number | null): { top: number; left: number; right: number; bottom: number } {
  if (meSeat === null) {
    return { top: 2, left: 1, right: 3, bottom: 0 };
  }

  return {
    top: (meSeat + 2) % 4,
    left: (meSeat + 1) % 4,
    right: (meSeat + 3) % 4,
    bottom: meSeat
  };
}

function findSeat(room: RoomSnapshot, seat: number): PublicPlayer | undefined {
  return room.players.find((player) => player.seat === seat);
}

function displayNameForSeat(room: RoomSnapshot, seat: number): string {
  return room.players.find((player) => player.seat === seat)?.displayName ?? `Seat ${seat + 1}`;
}

function winnerName(room: RoomSnapshot): string {
  return room.players.find((player) => player.username === room.winnerUsername)?.displayName ?? "Winner";
}

function phaseLabel(phase: RoomSnapshot["phase"]): string {
  switch (phase) {
    case "trump_selection":
      return "Turup";
    case "round_over":
      return "Round";
    case "match_over":
      return "Final";
    default:
      return phase[0].toUpperCase() + phase.slice(1);
  }
}
