import { memo } from "react";
import { motion } from "framer-motion";
import type { Card, Suit } from "../types/game";
import { suitName } from "../game/cards";
import { CardFace } from "./CardFace";
import { cn } from "../utils/classNames";

type CardViewProps = {
  card: Card;
  trumpSuit: Suit | null;
  playable?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Fill the parent's size (used by the hand, which sizes cards to fit the screen). */
  fluid?: boolean;
  onClick?: (cardId: string) => void;
};

function CardViewBase({ card, trumpSuit, playable = false, disabled = false, compact = false, fluid = false, onClick }: CardViewProps) {
  const isTrump = trumpSuit === card.suit;
  const asButton = Boolean(onClick);

  const className = cn(
    "playing-card relative shrink-0 select-none",
    fluid ? "h-full w-full" : compact ? "h-[4.6rem] w-[3.3rem] sm:h-[5.6rem] sm:w-16" : "h-32 w-[5.7rem]",
    isTrump && "playing-card-trump",
    playable && !disabled && "playing-card-playable",
    disabled && "playing-card-dim"
  );

  const content = (
    <>
      <CardFace card={card} compact={compact} />
      {isTrump ? <span className="trump-tag">T</span> : null}
    </>
  );

  if (!asButton) {
    return (
      <div className={className} role="img" aria-label={`${card.rank} of ${suitName[card.suit]}${isTrump ? ", trump" : ""}`}>
        {content}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      className={className}
      onClick={() => onClick?.(card.id)}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      aria-label={`Play ${card.rank} of ${suitName[card.suit]}${isTrump ? ", trump" : ""}`}
    >
      {content}
    </motion.button>
  );
}

export const CardView = memo(CardViewBase);
