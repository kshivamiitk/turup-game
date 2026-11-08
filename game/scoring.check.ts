// Run: npx tsx game/scoring.check.ts
import assert from "node:assert/strict";
import { calculatePlayerScore } from "./scoring";

assert.equal(calculatePlayerScore(4, 5), 41);
assert.equal(calculatePlayerScore(4, 4), 40);
assert.equal(calculatePlayerScore(4, 13), 49);
assert.equal(calculatePlayerScore(4, 3), -40);
assert.equal(calculatePlayerScore(4, 0), -40);
assert.equal(calculatePlayerScore(1, 1), 10);
console.log("scoring ok");
