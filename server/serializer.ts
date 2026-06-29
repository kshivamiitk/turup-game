import { getLegalCards } from "../game/rules";
import type { PlayerScore, PublicPlayer, RoomSnapshot, RoomState } from "../types/game";
import { getOrderedPlayers } from "./roomStore";

export function createRoomSnapshot(
  room: RoomState,
  username: string,
  isSpectator: boolean,
  publicBaseUrl: string
): RoomSnapshot {
  const requester = isSpectator ? room.spectators.get(username) : room.players.get(username);
  const player = !isSpectator ? room.players.get(username) : undefined;
  const round = room.round;
  const bidsRevealed = Boolean(round?.bidsRevealed || room.phase === "round_over" || room.phase === "match_over");

  const players: PublicPlayer[] = getOrderedPlayers(room).map((target) => ({
    username: target.username,
    displayName: target.displayName,
    seat: target.seat,
    ready: target.ready,
    connected: target.connected,
    isHost: target.username === room.hostUsername,
    tricksWon: target.tricksWon,
    bid: bidsRevealed ? target.bid : null,
    bidSubmitted: target.bid !== null,
    cardsRemaining: target.hand.length,
    roundScore: round?.summary?.playerResults.find((result) => result.username === target.username)?.scoreDelta ?? 0,
    totalScore: room.scores[target.username] ?? 0
  }));

  const playerScores: PlayerScore[] = players
    .map((target) => ({
      username: target.username,
      displayName: target.displayName,
      seat: target.seat,
      roundScore: target.roundScore,
      totalScore: target.totalScore
    }))
    .sort((left, right) => right.totalScore - left.totalScore || left.seat - right.seat);

  const legalCards =
    player && room.phase === "playing" && round?.currentTurnSeat === player.seat
      ? getLegalCards(player.hand, round.currentTrick).map((card) => card.id)
      : [];

  return {
    roomCode: room.code,
    inviteUrl: `${publicBaseUrl}/?room=${room.code}`,
    phase: room.phase,
    locked: room.locked,
    targetScore: room.targetScore,
    roundNumber: room.roundNumber,
    hostUsername: room.hostUsername,
    me: {
      username,
      displayName: requester?.displayName ?? username,
      seat: player?.seat ?? null,
      isHost: username === room.hostUsername,
      isSpectator,
    },
    players,
    spectators: [...room.spectators.values()]
      .sort((left, right) => left.joinedAt - right.joinedAt)
      .map((spectator) => ({
        username: spectator.username,
        displayName: spectator.displayName,
        connected: spectator.connected
      })),
    playerScores,
    trumpSuit: round?.trumpSuit ?? null,
    trumpChooserSeat: round?.trumpChooserSeat ?? null,
    currentTurnSeat: round?.currentTurnSeat ?? null,
    currentTrick: round?.currentTrick ?? null,
    trickHistory: round?.completedTricks.slice(-8) ?? [],
    hand: player ? player.hand : [],
    legalCardIds: legalCards,
    ownBid: player?.bid ?? null,
    bidsRevealed,
    chat: room.chat.slice(-30),
    statusMessage: getStatusMessage(room),
    turnStartedAt: round?.turnStartedAt ?? null,
    turnDurationMs: round?.turnDurationMs ?? 30_000,
    roundSummary: round?.summary ?? null,
    winnerUsername: room.winnerUsername
  };
}

function getStatusMessage(room: RoomState): string {
  switch (room.phase) {
    case "lobby":
      return "Waiting for 4 ready players.";
    case "trump_selection": {
      const chooser = getOrderedPlayers(room).find((player) => player.seat === room.round?.trumpChooserSeat);
      return `${chooser?.displayName ?? "The declarer"} is choosing Turup.`;
    }
    case "bidding":
      return "Players are submitting bids.";
    case "playing": {
      const turnPlayer = getOrderedPlayers(room).find((player) => player.seat === room.round?.currentTurnSeat);
      return `${turnPlayer?.displayName ?? "A player"} is on turn.`;
    }
    case "round_over":
      return "Round complete.";
    case "match_over":
      return "Match complete.";
    default:
      return "";
  }
}
