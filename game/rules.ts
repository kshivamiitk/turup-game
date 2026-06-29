import type { Card, PlayedCard, PublicTrick, Suit } from "../types/game";
import { rankValue } from "./cards";

export function getSeatOrder(startSeat: number): number[] {
  return [0, 1, 2, 3].map((offset) => (startSeat + offset) % 4);
}

export function getLegalCards(hand: Card[], currentTrick: PublicTrick | null): Card[] {
  if (!currentTrick || currentTrick.cards.length === 0 || !currentTrick.leadSuit) {
    return hand;
  }

  const followSuitCards = hand.filter((card) => card.suit === currentTrick.leadSuit);
  return followSuitCards.length > 0 ? followSuitCards : hand;
}

export function isLegalCardPlay(hand: Card[], cardId: string, currentTrick: PublicTrick | null): boolean {
  return getLegalCards(hand, currentTrick).some((card) => card.id === cardId);
}

export function determineTrickWinner(cards: PlayedCard[], trumpSuit: Suit, leadSuit: Suit): PlayedCard {
  if (cards.length !== 4) {
    throw new Error("A trick must contain exactly four cards before a winner can be chosen.");
  }

  return cards.reduce((winner, played) => {
    const winnerIsTrump = winner.card.suit === trumpSuit;
    const playedIsTrump = played.card.suit === trumpSuit;

    if (playedIsTrump && !winnerIsTrump) {
      return played;
    }

    if (playedIsTrump === winnerIsTrump) {
      const relevantSuit = playedIsTrump ? trumpSuit : leadSuit;
      if (played.card.suit === relevantSuit && winner.card.suit === relevantSuit) {
        return rankValue[played.card.rank] > rankValue[winner.card.rank] ? played : winner;
      }
    }

    if (!winnerIsTrump && !playedIsTrump && played.card.suit === leadSuit && winner.card.suit !== leadSuit) {
      return played;
    }

    return winner;
  }, cards[0]);
}

export function hasDuplicateCards(cards: Card[]): boolean {
  return new Set(cards.map((card) => card.id)).size !== cards.length;
}
