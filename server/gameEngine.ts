import { createDeck, getCardById, shuffleDeck, sortHand } from "../game/cards";
import { calculateRoundSummary } from "../game/scoring";
import { determineTrickWinner, getLegalCards, getSeatOrder, hasDuplicateCards } from "../game/rules";
import type { PlayerState, PublicTrick, RoomState, Suit } from "../types/game";
import { suits } from "../types/game";
import { getOrderedPlayers, getPlayerBySeat, touchRoom } from "./roomStore";

const turnDurationMs = 30_000;

export type PlayCardResult = {
  cardAccepted: boolean;
  trickWon: boolean;
  roundEnded: boolean;
  matchEnded: boolean;
};

export function startRound(room: RoomState): void {
  if (!["lobby", "round_over", "match_over"].includes(room.phase)) {
    throw new Error("The game is already in progress.");
  }

  const players = getOrderedPlayers(room);
  if (players.length !== 4) {
    throw new Error("Exactly 4 players are required to start.");
  }

  if (!players.every((player) => player.connected)) {
    throw new Error("All 4 players must be connected before starting.");
  }

  if (room.phase === "lobby" && !players.every((player) => player.ready)) {
    throw new Error("All players must be ready before the match can start.");
  }

  if (room.phase === "match_over") {
    room.scores = createEmptyPlayerScores(players);
    room.roundNumber = 0;
    room.winnerUsername = null;
  }

  const nextRoundNumber = room.roundNumber + 1;
  const starterSeat = (nextRoundNumber - 1) % 4;
  const deck = shuffleDeck(createDeck());

  for (const player of players) {
    player.hand = [];
    player.bid = null;
    player.tricksWon = 0;
  }

  for (let cardIndex = 0; cardIndex < 5; cardIndex += 1) {
    for (const player of players) {
      const card = deck.shift();
      if (!card) {
        throw new Error("The deck ran out during the initial deal.");
      }
      player.hand.push(card);
    }
  }

  for (const player of players) {
    player.hand = sortHand(player.hand);
  }

  room.roundNumber = nextRoundNumber;
  room.phase = "trump_selection";
  room.locked = true;
  room.winnerUsername = null;
  room.round = {
    number: nextRoundNumber,
    deck,
    trumpSuit: null,
    trumpChooserSeat: starterSeat,
    starterSeat,
    currentTurnSeat: starterSeat,
    currentTrick: createEmptyTrick(1),
    completedTricks: [],
    bidsRevealed: false,
    turnStartedAt: Date.now(),
    turnDurationMs,
    summary: null
  };

  touchRoom(room);
}

export function chooseTrump(room: RoomState, username: string, suit: Suit): void {
  if (room.phase !== "trump_selection" || !room.round) {
    throw new Error("Trump can only be selected during the Turup declaration phase.");
  }

  if (!suits.includes(suit)) {
    throw new Error("Choose a valid trump suit.");
  }

  const player = room.players.get(username);
  if (!player || player.seat !== room.round.trumpChooserSeat) {
    throw new Error("Only the Turup declarer can choose trump.");
  }

  room.round.trumpSuit = suit;

  const players = getOrderedPlayers(room);
  for (let cardIndex = 0; cardIndex < 8; cardIndex += 1) {
    for (const target of players) {
      const card = room.round.deck.shift();
      if (!card) {
        throw new Error("The deck ran out during the final deal.");
      }
      target.hand.push(card);
    }
  }

  for (const target of players) {
    target.hand = sortHand(target.hand);
    if (target.hand.length !== 13 || hasDuplicateCards(target.hand)) {
      throw new Error("The deal produced an invalid hand.");
    }
  }

  room.phase = "bidding";
  room.round.currentTurnSeat = null;
  room.round.turnStartedAt = null;
  touchRoom(room);
}

export function submitBid(room: RoomState, username: string, bid: number): void {
  if (room.phase !== "bidding" || !room.round) {
    throw new Error("Bids can only be submitted during bidding.");
  }

  if (!Number.isInteger(bid) || bid < 0 || bid > 13) {
    throw new Error("Bid must be a whole number from 0 to 13.");
  }

  const player = room.players.get(username);
  if (!player) {
    throw new Error("Only seated players can bid.");
  }

  player.bid = bid;

  if (getOrderedPlayers(room).every((target) => target.bid !== null)) {
    room.round.bidsRevealed = true;
    room.phase = "playing";
    room.round.currentTurnSeat = room.round.starterSeat;
    room.round.currentTrick = createEmptyTrick(1);
    room.round.turnStartedAt = Date.now();
  }

  touchRoom(room);
}

export function playCard(room: RoomState, username: string, cardId: string): PlayCardResult {
  if (room.phase !== "playing" || !room.round || !room.round.trumpSuit) {
    throw new Error("Cards can only be played after bidding is complete.");
  }

  const player = room.players.get(username);
  if (!player) {
    throw new Error("Only seated players can play cards.");
  }

  if (player.seat !== room.round.currentTurnSeat) {
    throw new Error("It is not your turn.");
  }

  const card = getCardById(player.hand, cardId);
  if (!card) {
    throw new Error("You do not have that card.");
  }

  const legalCards = getLegalCards(player.hand, room.round.currentTrick);
  if (!legalCards.some((legalCard) => legalCard.id === card.id)) {
    throw new Error("You must follow the led suit if you can.");
  }

  player.hand = player.hand.filter((handCard) => handCard.id !== card.id);

  if (room.round.currentTrick.cards.length === 0) {
    room.round.currentTrick.leadSuit = card.suit;
  }

  room.round.currentTrick.cards.push({
    seat: player.seat,
    username: player.username,
    card
  });

  const result: PlayCardResult = {
    cardAccepted: true,
    trickWon: false,
    roundEnded: false,
    matchEnded: false
  };

  if (room.round.currentTrick.cards.length === 4) {
    const leadSuit = room.round.currentTrick.leadSuit;
    if (!leadSuit) {
      throw new Error("The trick has no led suit.");
    }

    const winner = determineTrickWinner(room.round.currentTrick.cards, room.round.trumpSuit, leadSuit);
    room.round.currentTrick.winnerSeat = winner.seat;
    const winnerPlayer = getPlayerBySeat(room, winner.seat);
    if (!winnerPlayer) {
      throw new Error("The trick winner is not seated.");
    }

    winnerPlayer.tricksWon += 1;
    room.round.completedTricks.push({ ...room.round.currentTrick, cards: [...room.round.currentTrick.cards] });
    result.trickWon = true;

    if (room.round.completedTricks.length === 13) {
      finishRound(room);
      result.roundEnded = true;
      result.matchEnded = room.winnerUsername !== null;
    } else {
      room.round.currentTurnSeat = winner.seat;
      room.round.currentTrick = createEmptyTrick(room.round.completedTricks.length + 1);
      room.round.turnStartedAt = Date.now();
    }
  } else {
    room.round.currentTurnSeat = getNextSeatInTrick(room.round.currentTrick, player.seat);
    room.round.turnStartedAt = Date.now();
  }

  touchRoom(room);
  return result;
}

export function resetRoomToLobby(room: RoomState): void {
  room.phase = "lobby";
  room.locked = false;
  room.roundNumber = 0;
  room.winnerUsername = null;
  room.scores = createEmptyPlayerScores(getOrderedPlayers(room));
  room.round = null;

  for (const player of room.players.values()) {
    player.ready = false;
    player.hand = [];
    player.bid = null;
    player.tricksWon = 0;
  }

  touchRoom(room);
}

function finishRound(room: RoomState): void {
  if (!room.round?.trumpSuit) {
    throw new Error("Cannot score a round without trump.");
  }

  const players = getOrderedPlayers(room);
  const summary = calculateRoundSummary(
    room.round.number,
    room.round.trumpSuit,
    players.map((player) => ({
      username: player.username,
      seat: player.seat,
      bid: player.bid ?? 0,
      tricksWon: player.tricksWon
    })),
    room.scores
  );

  room.round.summary = summary;
  for (const result of summary.playerResults) {
    room.scores[result.username] = result.totalScore;
  }

  const playersAtTarget = summary.playerResults
    .filter((player) => player.totalScore >= room.targetScore)
    .sort((left, right) => right.totalScore - left.totalScore);

  if (playersAtTarget.length > 0) {
    const [winner] = playersAtTarget;
    const hasTopScoreTie = playersAtTarget.length > 1 && playersAtTarget[0].totalScore === playersAtTarget[1].totalScore;
    if (!hasTopScoreTie) {
      room.winnerUsername = winner.username;
      room.phase = "match_over";
    } else {
      room.phase = "round_over";
    }
  } else {
    room.phase = "round_over";
  }

  room.round.currentTurnSeat = null;
  room.round.turnStartedAt = null;
}

function createEmptyPlayerScores(players: PlayerState[]): Record<string, number> {
  return Object.fromEntries(players.map((player) => [player.username, 0]));
}

function createEmptyTrick(index: number): PublicTrick {
  return {
    index,
    leadSuit: null,
    cards: [],
    winnerSeat: null
  };
}

function getNextSeatInTrick(trick: PublicTrick, currentSeat: number): number {
  const playedSeats = new Set(trick.cards.map((played) => played.seat));
  for (const seat of getSeatOrder((currentSeat + 1) % 4)) {
    if (!playedSeats.has(seat)) {
      return seat;
    }
  }
  return currentSeat;
}
