// Run: npx tsx game/rules.check.ts
import assert from "node:assert/strict";
import { determineTrickWinner } from "./rules";
import type { Card, PlayedCard } from "../types/game";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ id: `${suit}-${rank}`, rank, suit });
const trick = (...cards: Card[]): PlayedCard[] => cards.map((card, seat) => ({ seat, username: `p${seat}`, card }));

// You lead 5♥, seat 2 plays A♥: seat 2 wins (and so leads the next trick).
assert.equal(determineTrickWinner(trick(c("5", "hearts"), c("9", "hearts"), c("A", "hearts"), c("2", "clubs")), "spades", "hearts").seat, 2);
// A low trump beats the led suit's ace.
assert.equal(determineTrickWinner(trick(c("A", "hearts"), c("2", "spades"), c("K", "hearts"), c("Q", "hearts")), "spades", "hearts").seat, 1);
// Off-suit (non-trump) cards never win, however high.
assert.equal(determineTrickWinner(trick(c("3", "hearts"), c("A", "clubs"), c("A", "diamonds"), c("2", "hearts")), "spades", "hearts").seat, 0);
console.log("rules ok");
