import { Trophy } from "lucide-react";
import type { RoomSnapshot } from "../types/game";
import { cn } from "../utils/classNames";

type ScoreboardProps = {
  room: RoomSnapshot;
};

export function Scoreboard({ room }: ScoreboardProps) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Player standings">
      {room.playerScores.map((player, index) => {
        const isWinner = room.winnerUsername === player.username;
        const progress = Math.min(100, Math.max(0, (player.totalScore / room.targetScore) * 100));

        return (
          <div
            key={player.username}
            className={cn(
              "rounded-md border bg-[#111013]/75 p-2.5",
              isWinner ? "border-brass shadow-card" : index === 0 ? "border-emerald-300/25" : "border-white/10"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wide text-stone-500">Seat {player.seat + 1}</div>
                <div className="mt-0.5 truncate text-sm font-black text-stone-100">{player.displayName}</div>
              </div>
              <div className="flex items-center gap-1 text-xl font-black text-brass">
                {isWinner ? <Trophy className="h-4 w-4" /> : null}
                {player.totalScore}
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brass" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold text-stone-400">
              <span>{player.roundScore >= 0 ? `+${player.roundScore}` : player.roundScore} round</span>
              <span>/{room.targetScore}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
