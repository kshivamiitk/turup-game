import type { Card, RoomSnapshot, Suit } from "./game";

export type CreateRoomPayload = {
  username: string;
  displayName?: string;
  targetScore: number;
};

export type JoinRoomPayload = {
  roomCode: string;
  username: string;
  displayName?: string;
  asSpectator?: boolean;
};

export type SetReadyPayload = {
  ready: boolean;
};

export type SetTargetScorePayload = {
  targetScore: number;
};

export type ChooseTrumpPayload = {
  suit: Suit;
};

export type SubmitBidPayload = {
  bid: number;
};

export type PlayCardPayload = {
  cardId: string;
};

export type SendChatPayload = {
  message: string;
};

export type KickPlayerPayload = {
  username: string;
};

export type ServerErrorPayload = {
  message: string;
};

export type RoomCreatedPayload = {
  roomCode: string;
  snapshot: RoomSnapshot;
};

export type ClientToServerEvents = {
  create_room: (payload: CreateRoomPayload) => void;
  join_room: (payload: JoinRoomPayload) => void;
  reconnect_room: (payload: JoinRoomPayload) => void;
  leave_room: () => void;
  set_ready: (payload: SetReadyPayload) => void;
  set_target_score: (payload: SetTargetScorePayload) => void;
  start_game: () => void;
  choose_trump: (payload: ChooseTrumpPayload) => void;
  submit_bid: (payload: SubmitBidPayload) => void;
  play_card: (payload: PlayCardPayload) => void;
  send_chat: (payload: SendChatPayload) => void;
  kick_player: (payload: KickPlayerPayload) => void;
  return_to_lobby: () => void;
};

export type ServerToClientEvents = {
  room_created: (payload: RoomCreatedPayload) => void;
  room_updated: (snapshot: RoomSnapshot) => void;
  player_joined: (snapshot: RoomSnapshot) => void;
  player_left: (snapshot: RoomSnapshot) => void;
  game_started: (snapshot: RoomSnapshot) => void;
  hand_dealt: (cards: Card[]) => void;
  trump_selected: (snapshot: RoomSnapshot) => void;
  bidding_started: (snapshot: RoomSnapshot) => void;
  bid_updated: (snapshot: RoomSnapshot) => void;
  trick_started: (snapshot: RoomSnapshot) => void;
  card_played: (snapshot: RoomSnapshot) => void;
  trick_won: (snapshot: RoomSnapshot) => void;
  round_ended: (snapshot: RoomSnapshot) => void;
  match_ended: (snapshot: RoomSnapshot) => void;
  error_message: (payload: ServerErrorPayload) => void;
  chat_message: (snapshot: RoomSnapshot) => void;
  reconnect_success: (snapshot: RoomSnapshot) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomCode?: string;
  username?: string;
  isSpectator?: boolean;
};
