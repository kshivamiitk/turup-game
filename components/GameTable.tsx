import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, LogOut, Play, RotateCcw, Swords, Target, Timer, Trophy } from "lucide-react";
import type { PublicPlayer, RoomSnapshot, Suit } from "../types/game";
import { suits } from "../types/game";
import { suitName, suitSymbol } from "../game/cards";
import { useTurupStore } from "../socket/useTurupStore";
import { CardView } from "./CardView";
import { CallPanel, MediaControls } from "./CallPanel";
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
  const clockOffsetMs = useTurupStore((state) => state.clockOffsetMs);
  const [bid, setBid] = useState(room.ownBid ?? 1);
  const seconds = useTurnCountdown(room.turnStartedAt, room.turnDurationMs, clockOffsetMs);
  const mePlayer = room.players.find((player) => player.username === room.me.username);
  const currentPlayer = room.players.find((player) => player.seat === room.currentTurnSeat);
  const legalCardIds = useMemo(() => new Set(room.legalCardIds), [room.legalCardIds]);
  const isMyTurn = Boolean(mePlayer && room.currentTurnSeat === mePlayer.seat && room.phase === "playing");
  const seatLayout = getSeatLayout(mePlayer?.seat ?? null);

  useEffect(() => {
    setBid(room.ownBid ?? 1);
  }, [room.ownBid]);

  function onSubmitBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitBid(bid);
  }

  async function copyRoomCode() {
    await navigator.clipboard?.writeText(room.roomCode);
  }

  return (
    <div className="grid flex-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="surface-panel flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="brand-title text-2xl">TURUP</h1>
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
            <StatusPill icon={<Swords className="h-3.5 w-3.5" />} label={`Round ${room.roundNumber || 1}`} />
            <StatusPill icon={<Timer className="h-3.5 w-3.5" />} label={room.currentTurnSeat === null ? "--" : `${seconds}s`} urgent={room.currentTurnSeat !== null && seconds <= 10} />
            <ConnectionBadge status={connectionStatus} />
            {!room.me.isSpectator ? <MediaControls className="lg:hidden" /> : null}
            <button className="danger-button !h-10 !w-10 !px-0" onClick={leaveRoom} aria-label="Leave room">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Phones: seat cards already show points, so the standings strip is hidden to save space. */}
        <div className="hidden border-b border-white/10 p-2.5 sm:block">
          <Scoreboard room={room} />
        </div>

        <div className="flex flex-col p-2.5 sm:p-3">
          <div className="table-felt grid grid-cols-2 items-center gap-2 rounded-[2rem] p-3 sm:p-5 md:grid-cols-[12.5rem_minmax(0,1fr)_12.5rem] md:grid-rows-[auto_1fr_auto]">
            <div className="col-span-2 mx-auto w-full max-w-xs md:col-span-1 md:col-start-2">
              <SeatPanel player={findSeat(room, seatLayout.top)} room={room} />
            </div>
            <div className="md:col-start-1 md:row-start-2">
              <SeatPanel player={findSeat(room, seatLayout.left)} room={room} />
            </div>

            <div className="col-span-2 row-start-3 flex flex-col gap-2 md:col-span-1 md:col-start-2 md:row-start-2">
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

            <div className="md:col-start-3 md:row-start-2">
              <SeatPanel player={findSeat(room, seatLayout.right)} room={room} />
            </div>
            {/* Your own stats live in the hand bar below; spectators see the bottom seat here. */}
            {!mePlayer ? (
              <div className="col-span-2 mx-auto w-full max-w-xs md:col-span-1 md:col-start-2 md:row-start-3">
                <SeatPanel player={findSeat(room, seatLayout.bottom)} room={room} />
              </div>
            ) : null}
          </div>

          {room.hand.length > 0 || room.me.isSpectator ? (
          <section className={cn("sticky bottom-0 z-10 mt-2.5 rounded-2xl border bg-[#111013]/95 p-2.5 backdrop-blur transition", isMyTurn ? "border-brass/60 shadow-[0_0_40px_rgba(213,170,78,0.18)]" : "border-white/10")}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              {mePlayer ? (
                <div className="flex min-w-0 items-center gap-2">
                  <div className="seat-avatar seat-avatar-me !h-8 !w-8 text-sm">{mePlayer.displayName.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-stone-100">
                      You · <span className="text-brass">{mePlayer.totalScore} pts</span>
                    </div>
                    <div className="flex gap-1 text-[11px] font-black">
                      <span className="seat-chip">Bid {room.ownBid ?? "–"}</span>
                      <span className="seat-chip">Won {mePlayer.tricksWon}</span>
                      {room.phase === "playing" && room.ownBid !== null ? (
                        <span className={cn("seat-chip", mePlayer.tricksWon >= room.ownBid && "!bg-emerald-400/20 !text-emerald-200")}>
                          {mePlayer.tricksWon >= room.ownBid ? "Made ✓" : `${room.ownBid - mePlayer.tricksWon} to go`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-black text-stone-100">Spectator view</div>
              )}
              <div className={cn("rounded-md px-3 py-1.5 text-xs font-black", isMyTurn ? "animate-pulse bg-brass text-ink" : "bg-white/[0.07] text-stone-400")}>
                {isMyTurn ? "Your turn" : currentPlayer ? `${currentPlayer.displayName}'s turn` : phaseLabel(room.phase)}
              </div>
            </div>
            {room.me.isSpectator ? (
              <div className="rounded-md border border-dashed border-white/10 py-8 text-center text-sm font-bold text-stone-500">Watching as spectator</div>
            ) : (
              <motion.div className="scrollbar-thin hand-fan flex min-h-[7.8rem] gap-2 overflow-x-auto pb-1 pt-2" layout>
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
          ) : null}
        </div>
      </section>

      <aside className="scrollbar-thin grid content-start gap-3 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto">
        <CallPanel room={room} />
        <TrickHistory room={room} />
        <ChatPanel room={room} />
      </aside>
    </div>
  );
}

function TrickCenter({ room, currentPlayer }: { room: RoomSnapshot; currentPlayer: PublicPlayer | undefined }) {
  const lastCompleted = room.trickHistory.at(-1) ?? null;
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const seenIndex = useRef(lastCompleted?.index ?? 0);

  // The server clears the trick as soon as the 4th card lands; hold the finished trick on screen briefly.
  useEffect(() => {
    if (!lastCompleted || lastCompleted.index <= seenIndex.current) {
      return;
    }
    seenIndex.current = lastCompleted.index;
    setRevealIndex(lastCompleted.index);
    const timer = window.setTimeout(() => setRevealIndex(null), 1800);
    return () => window.clearTimeout(timer);
  }, [lastCompleted]);

  const revealing = revealIndex !== null && lastCompleted?.index === revealIndex;
  const trick = revealing ? lastCompleted : room.currentTrick;
  const layout = getSeatLayout(room.me.seat);
  const position = (seat: number) =>
    seat === layout.bottom ? "trick-s" : seat === layout.top ? "trick-n" : seat === layout.left ? "trick-w" : "trick-e";
  const winnerName = revealing && lastCompleted?.winnerSeat != null ? displayNameForSeat(room, lastCompleted.winnerSeat) : null;

  return (
    <div className="relative flex min-h-[13rem] flex-1 items-center justify-center sm:min-h-[15rem]">
      <div className="absolute left-0 top-0 rounded-md border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-black text-stone-400">
        Trick {trick?.index ?? room.trickHistory.length + 1}/13
      </div>
      {room.trumpSuit ? (
        <div className="absolute right-0 top-0 flex items-center gap-1 rounded-md border border-brass/30 bg-brass/10 px-2.5 py-1 text-xs font-black text-brass">
          Turup <span className={cn("text-base leading-none", isRed(room.trumpSuit) ? "text-ember" : "text-stone-100")}>{suitSymbol[room.trumpSuit]}</span>
        </div>
      ) : null}

      <div className="trick-stage">
        <div className="trick-emblem">
          {room.trumpSuit ? <span className={isRed(room.trumpSuit) ? "text-ember/60" : "text-stone-200/40"}>{suitSymbol[room.trumpSuit]}</span> : "T"}
        </div>
        <AnimatePresence>
          {trick?.cards.map((played) => {
            const won = revealing && played.seat === trick.winnerSeat;
            return (
              <motion.div
                key={`${trick.index}-${played.card.id}`}
                className={cn("trick-slot", position(played.seat), won && "z-10")}
                initial={{ opacity: 0, scale: 0.6, y: played.seat === layout.bottom ? 60 : played.seat === layout.top ? -60 : 0 }}
                animate={{ opacity: 1, scale: won ? 1.12 : 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
              >
                <div className={cn("rounded-md", won && "ring-4 ring-brass shadow-[0_0_30px_rgba(213,170,78,0.6)]")}>
                  <CardView card={played.card} trumpSuit={room.trumpSuit} compact />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {winnerName ? (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-brass px-4 py-1.5 text-sm font-black text-ink shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            {winnerName} takes it
          </motion.div>
        ) : !trick?.cards.length ? (
          <motion.div className="absolute bottom-0 text-sm font-black text-stone-300" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {room.phase === "playing" && currentPlayer ? `${currentPlayer.displayName} leads` : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
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
    const submitted = room.ownBid !== null;
    return (
      <form className="grid gap-3 rounded-xl border border-white/10 bg-[#111013]/90 p-3" onSubmit={onSubmitBid}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-black text-stone-100">How many tricks will you take?</div>
          <div className="text-xs font-bold text-stone-400">
            Make it: <span className="text-emerald-300">+{bid * 10}</span> (+1 per extra) · Miss: <span className="text-red-300">−{bid * 10}</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]" role="radiogroup" aria-label="Bid">
          {Array.from({ length: 13 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={bid === value}
              className={cn("bid-chip", bid === value && "bid-chip-active")}
              onClick={() => setBid(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <button className="primary-button" type="submit">
          <Target className="h-4 w-4" />
          {submitted ? `Change bid (locked in: ${room.ownBid})` : `Lock in ${bid}`}
        </button>
      </form>
    );
  }

  if (room.phase === "round_over" || room.phase === "match_over") {
    const matchOver = room.phase === "match_over";
    return (
      <motion.div
        className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-3 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        // Let the last trick's "takes it" reveal play first.
        transition={{ delay: 1.6 }}
      >
        <motion.div
          className="surface-panel w-full max-w-lg p-4 sm:p-5"
          role="dialog"
          aria-label={matchOver ? "Match result" : "Round result"}
          initial={{ y: 30, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ delay: 1.6, type: "spring", stiffness: 260, damping: 22 }}
        >
          {matchOver ? (
            <div className="mb-1 flex items-center gap-2 text-2xl font-black text-brass">
              <Trophy className="h-6 w-6" />
              {winnerName(room)} wins the match!
            </div>
          ) : (
            <div className="mb-1 text-xl font-black text-stone-50">Round {room.roundNumber} complete</div>
          )}
          <div className="mb-3 text-xs font-bold text-stone-500">First to {room.targetScore} wins</div>
          <RoundSummary room={room} />
          {room.me.isHost ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="primary-button" onClick={startGame} autoFocus>
                <Play className="h-4 w-4" />
                {matchOver ? "Play again" : "Next round"}
              </button>
              <button className="secondary-button" onClick={returnToLobby}>
                <RotateCcw className="h-4 w-4" />
                Lobby
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-md bg-white/[0.05] py-2.5 text-center text-sm font-bold text-stone-400">
              Waiting for the host to deal the next round…
            </div>
          )}
        </motion.div>
      </motion.div>
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
      <table className="w-full text-left text-sm">
        <thead className="text-xs font-black uppercase tracking-wide text-stone-500">
          <tr>
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3">Bid</th>
            <th className="py-2 pr-3">Tricks</th>
            <th className="hidden py-2 pr-3 sm:table-cell">Result</th>
            <th className="py-2 pr-3 text-right">Round</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {room.roundSummary.playerResults.map((result) => (
            <tr key={result.username} className="border-t border-white/10">
              <td className="py-2 pr-3 font-bold">{displayNameForSeat(room, result.seat)}</td>
              <td className="py-2 pr-3">{result.bid}</td>
              <td className="py-2 pr-3">{result.tricksWon}</td>
              <td className="hidden py-2 pr-3 text-xs font-bold text-stone-400 sm:table-cell">
                {result.tricksWon >= result.bid
                  ? result.tricksWon > result.bid
                    ? `Made +${result.tricksWon - result.bid} extra`
                    : "Made it"
                  : `Short by ${result.bid - result.tricksWon}`}
              </td>
              <td className={cn("py-2 pr-3 text-right font-black tabular-nums", result.scoreDelta >= 0 ? "text-emerald-300" : "text-red-300")}>
                {result.scoreDelta >= 0 ? `+${result.scoreDelta}` : result.scoreDelta}
              </td>
              <td className="py-2 text-right font-black tabular-nums text-brass">{result.totalScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeatPanel({ player, room }: { player: PublicPlayer | undefined; room: RoomSnapshot }) {
  if (!player) {
    return <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-3 text-center text-sm font-bold text-stone-500">Open seat</div>;
  }

  const active = player.seat === room.currentTurnSeat || (room.phase === "trump_selection" && player.seat === room.trumpChooserSeat);
  const need = player.bid !== null && room.phase === "playing" ? player.bid - player.tricksWon : null;
  const isMe = player.username === room.me.username;

  return (
    <div className={cn("seat-card", active && "seat-active", !player.connected && "opacity-60")}>
      <div className="flex items-center gap-2.5">
        <div className={cn("seat-avatar", isMe && "seat-avatar-me")}>
          {player.displayName.slice(0, 1).toUpperCase()}
          <span className={cn("seat-dot", player.connected ? "bg-emerald-400" : "bg-ember")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-stone-50">{isMe ? `${player.displayName} (you)` : player.displayName}</span>
            {player.isHost ? <span className="text-[10px] text-brass">★</span> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] font-black">
            <span className="seat-chip">Bid {player.bidSubmitted ? player.bid ?? "✓" : "–"}</span>
            <span className="seat-chip">Won {player.tricksWon}</span>
            {!player.connected ? <span className="seat-chip !bg-ember/25 !text-red-100">offline</span> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black leading-none text-brass">{player.totalScore}</div>
          <div className="text-[10px] font-bold text-stone-500">pts</div>
        </div>
      </div>
      {need !== null ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all", need <= 0 ? "bg-emerald-400" : "bg-brass")}
              style={{ width: `${Math.min(100, (player.tricksWon / Math.max(1, player.bid ?? 1)) * 100)}%` }}
            />
          </div>
          <span className={cn("text-[11px] font-black", need > 0 ? "text-stone-300" : "text-emerald-300")}>
            {need > 0 ? `${need} to go` : need === 0 ? "Made ✓" : `+${-need}`}
          </span>
        </div>
      ) : null}
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

function StatusPill({ icon, label, urgent = false }: { icon: ReactNode; label: string; urgent?: boolean }) {
  return (
    <span className={cn("status-chip", urgent && "border-ember/60 bg-ember/15 text-red-100")}>
      {icon}
      {label}
    </span>
  );
}

function useTurnCountdown(startedAt: number | null, durationMs: number, clockOffsetMs: number): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    function update() {
      if (!startedAt) {
        setSeconds(0);
        return;
      }
      setSeconds(Math.max(0, Math.ceil((startedAt + durationMs - (Date.now() + clockOffsetMs)) / 1000)));
    }

    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [clockOffsetMs, durationMs, startedAt]);

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
