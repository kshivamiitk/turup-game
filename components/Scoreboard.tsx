import { Trophy } from "lucide-react";
import type { RoomSnapshot } from "../types/game";
import { cn } from "../utils/classNames";

type ScoreboardProps = {
  room: RoomSnapshot;
};

export function Scoreboard({ room }: ScoreboardProps) {
  return (
    <section className="grid grid-cols-2 gap-2 xl:grid-cols-4" aria-label="Player standings">
      {room.playerScores.map((player, index) => {
        const isWinner = room.winnerUsername === player.username;
        const isMe = player.username === room.me.username;
        const progress = Math.min(100, Math.max(0, (player.totalScore / room.targetScore) * 100));

        return (
          <div
            key={player.username}
            className={cn(
              "rounded-xl border bg-[#111013]/75 px-2.5 py-2",
              isWinner ? "border-brass shadow-card" : isMe ? "border-brass/40" : "border-white/10"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn("rank-badge", index === 0 && player.totalScore > 0 && "rank-badge-lead")}>{index + 1}</span>
                <span className="truncate text-sm font-black text-stone-100">{player.displayName}</span>
              </div>
              <div className="flex items-center gap-1 text-lg font-black tabular-nums text-brass">
                {isWinner ? <Trophy className="h-4 w-4" /> : null}
                {player.totalScore}
              </div>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-brass/70 to-brass transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-stone-500">
              <span className={player.roundScore > 0 ? "text-emerald-300" : player.roundScore < 0 ? "text-red-300" : ""}>
                {player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore} last round
              </span>
              <span>/ {room.targetScore}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
