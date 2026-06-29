import { memo } from "react";
import { motion } from "framer-motion";
import type { Card, Suit } from "../types/game";
import { suitName, suitSymbol } from "../game/cards";
import { cn } from "../utils/classNames";

type CardViewProps = {
  card: Card;
  trumpSuit: Suit | null;
  playable?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick?: (cardId: string) => void;
};

function CardViewBase({ card, trumpSuit, playable = false, disabled = false, compact = false, onClick }: CardViewProps) {
  const redSuit = card.suit === "hearts" || card.suit === "diamonds";
  const isTrump = trumpSuit === card.suit;
  const asButton = Boolean(onClick);

  const className = cn(
    "relative shrink-0 select-none overflow-hidden rounded-md border bg-[#fffaf0] shadow-card transition",
    "before:absolute before:inset-1 before:rounded before:border before:border-black/10",
    compact ? "h-20 w-14 p-2" : "h-[7.25rem] w-20 p-2.5 sm:h-32 sm:w-24",
    redSuit ? "text-ember" : "text-[#111317]",
    isTrump ? "border-brass ring-2 ring-brass/70" : "border-stone-300",
    playable && !disabled ? "cursor-pointer hover:-translate-y-2 hover:shadow-table" : "",
    disabled ? "cursor-not-allowed opacity-35 grayscale" : ""
  );

  const content = (
    <div className="relative z-10 flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("font-black leading-none", compact ? "text-base" : "text-lg")}>{card.rank}</span>
        {isTrump ? <span className="rounded bg-brass px-1 text-[10px] font-black leading-4 text-ink">T</span> : null}
      </div>
      <span className={cn("self-center leading-none drop-shadow-sm", compact ? "text-3xl" : "text-5xl")}>{suitSymbol[card.suit]}</span>
      <div className="flex rotate-180 items-start justify-between gap-2">
        <span className={cn("font-black leading-none", compact ? "text-base" : "text-lg")}>{card.rank}</span>
        <span className={cn("leading-none", compact ? "text-base" : "text-lg")}>{suitSymbol[card.suit]}</span>
      </div>
    </div>
  );

  if (!asButton) {
    return (
      <motion.div className={className} layout aria-label={`${card.rank} of ${suitName[card.suit]}`}>
        {content}
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      className={className}
      onClick={() => onClick?.(card.id)}
      disabled={disabled}
      layout
      whileTap={disabled ? undefined : { scale: 0.96 }}
      aria-label={`Play ${card.rank} of ${suitName[card.suit]}`}
    >
      {content}
    </motion.button>
  );
}

export const CardView = memo(CardViewBase);
