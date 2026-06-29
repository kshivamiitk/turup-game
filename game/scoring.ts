import type { RoundPlayerResult, RoundSummary, Suit } from "../types/game";

export type ScoringConfig = {
  exactBidBonus: number;
  perTrickPoint: number;
  missPenaltyPerTrick: number;
};

export type PlayerRoundInput = {
  username: string;
  seat: number;
  bid: number;
  tricksWon: number;
};

export const defaultScoringConfig: ScoringConfig = {
  exactBidBonus: 10,
  perTrickPoint: 1,
  missPenaltyPerTrick: 1
};

/**
 * Default scoring rule:
 * - A player who exactly matches their bid scores 10 bonus points plus 1 point per trick won.
 * - A player who misses their bid loses 1 point for every trick above or below the bid.
 * - Each player keeps an independent running total. There are no teams.
 */
export function calculatePlayerScore(
  bid: number,
  tricksWon: number,
  config: ScoringConfig = defaultScoringConfig
): number {
  if (bid === tricksWon) {
    return config.exactBidBonus + tricksWon * config.perTrickPoint;
  }

  return -Math.abs(bid - tricksWon) * config.missPenaltyPerTrick;
}

export function calculateRoundSummary(
  roundNumber: number,
  trumpSuit: Suit,
  players: PlayerRoundInput[],
  previousScores: Record<string, number>,
  config: ScoringConfig = defaultScoringConfig
): RoundSummary {
  const playerResults: RoundPlayerResult[] = players
    .map((player) => {
      const scoreDelta = calculatePlayerScore(player.bid, player.tricksWon, config);
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
