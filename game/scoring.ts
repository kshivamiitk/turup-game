import type { RoundPlayerResult, RoundSummary, Suit } from "../types/game";

export type PlayerRoundInput = {
  username: string;
  seat: number;
  bid: number;
  tricksWon: number;
};

/**
 * Scoring rule:
 * - Made the bid (tricksWon >= bid): bid x 10, plus 1 per extra trick. Bid 4, won 5 -> 41.
 * - Fell short (tricksWon < bid): lose bid x 10. Bid 4, won 3 -> -40.
 * - Each player keeps an independent running total. There are no teams.
 */
export function calculatePlayerScore(bid: number, tricksWon: number): number {
  return tricksWon >= bid ? bid * 10 + (tricksWon - bid) : -bid * 10;
}

export function calculateRoundSummary(
  roundNumber: number,
  trumpSuit: Suit,
  players: PlayerRoundInput[],
  previousScores: Record<string, number>
): RoundSummary {
  const playerResults: RoundPlayerResult[] = players
    .map((player) => {
      const scoreDelta = calculatePlayerScore(player.bid, player.tricksWon);
      return {
        username: player.username,
        seat: player.seat,
        bid: player.bid,
        tricksWon: player.tricksWon,
        scoreDelta,
        totalScore: (previousScores[player.username] ?? 0) + scoreDelta
      };
    })
    .sort((left, right) => left.seat - right.seat);

  return {
    roundNumber,
    trumpSuit,
    playerResults
  };
}
