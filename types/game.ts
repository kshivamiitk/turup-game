export const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
export const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

export type Suit = (typeof suits)[number];
export type Rank = (typeof ranks)[number];

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type RoomPhase = "lobby" | "trump_selection" | "bidding" | "playing" | "round_over" | "match_over";

export type PublicPlayer = {
  username: string;
  displayName: string;
  seat: number;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  tricksWon: number;
  bid: number | null;
  bidSubmitted: boolean;
  cardsRemaining: number;
  roundScore: number;
  totalScore: number;
};

export type PublicSpectator = {
  username: string;
  displayName: string;
  connected: boolean;
};

export type PlayedCard = {
  seat: number;
  username: string;
  card: Card;
};

export type PublicTrick = {
  index: number;
  leadSuit: Suit | null;
  cards: PlayedCard[];
  winnerSeat: number | null;
};

export type PlayerScore = {
  username: string;
  displayName: string;
  seat: number;
  roundScore: number;
  totalScore: number;
};

export type RoundPlayerResult = {
  username: string;
  seat: number;
  bid: number;
  tricksWon: number;
  scoreDelta: number;
  totalScore: number;
};

export type RoundSummary = {
  roundNumber: number;
  trumpSuit: Suit;
  playerResults: RoundPlayerResult[];
};

export type ChatMessage = {
  id: string;
  username: string;
  displayName: string;
  message: string;
  createdAt: number;
};

export type RoomSnapshot = {
  roomCode: string;
  inviteUrl: string;
  phase: RoomPhase;
  locked: boolean;
  targetScore: number;
  roundNumber: number;
  hostUsername: string;
  me: {
    username: string;
    displayName: string;
    seat: number | null;
    isHost: boolean;
    isSpectator: boolean;
  };
  players: PublicPlayer[];
  spectators: PublicSpectator[];
  playerScores: PlayerScore[];
  trumpSuit: Suit | null;
  trumpChooserSeat: number | null;
  currentTurnSeat: number | null;
  currentTrick: PublicTrick | null;
  trickHistory: PublicTrick[];
  hand: Card[];
  legalCardIds: string[];
  ownBid: number | null;
  bidsRevealed: boolean;
  chat: ChatMessage[];
  statusMessage: string;
  turnStartedAt: number | null;
  turnDurationMs: number;
  roundSummary: RoundSummary | null;
  winnerUsername: string | null;
};

export type PlayerState = {
  username: string;
  displayName: string;
  seat: number;
  socketId: string | null;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
  hand: Card[];
  bid: number | null;
  tricksWon: number;
};

export type SpectatorState = {
  username: string;
  displayName: string;
  socketId: string | null;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
};

export type RoundState = {
  number: number;
  deck: Card[];
  trumpSuit: Suit | null;
  trumpChooserSeat: number;
  starterSeat: number;
  currentTurnSeat: number | null;
  currentTrick: PublicTrick;
  completedTricks: PublicTrick[];
  bidsRevealed: boolean;
  turnStartedAt: number | null;
  turnDurationMs: number;
  summary: RoundSummary | null;
};

export type RoomState = {
  code: string;
  hostUsername: string;
  phase: RoomPhase;
  locked: boolean;
  targetScore: number;
  roundNumber: number;
  winnerUsername: string | null;
  scores: Record<string, number>;
  players: Map<string, PlayerState>;
  spectators: Map<string, SpectatorState>;
  round: RoundState | null;
  chat: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  emptySince: number | null;
};
