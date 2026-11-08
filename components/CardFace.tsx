import type { Card, Rank, Suit } from "../types/game";

/**
 * Full card face as one SVG (viewBox 100x140), so it scales crisply from tiny trick cards to big hand cards.
 * Number cards use the standard pip layout; J/Q/K get a drawn court figure with a crown, a tiara, or a cap.
 */

const RED = "#c8262c";
const BLACK = "#16171b";

const suitPath: Record<Suit, string> = {
  hearts: "M0 9C-6-2-13-4-13-10c0-4.5 3.5-7 6.8-7C-3.6-17-1.2-14.6 0-12.4 1.2-14.6 3.6-17 6.2-17 9.5-17 13-14.5 13-10 13-4 6-2 0 9z",
  diamonds: "M0-13 10 0 0 13-10 0z",
  spades: "M0-14C5-7 12-4 12 2c0 4-3 6.4-6.2 6.4-2.2 0-3.8-1.2-4.6-2.6L3 12H-3l1.8-6.2C-2 7.2-3.6 8.4-5.8 8.4-9 8.4-12 6-12 2c0-6 7-9 12-16z",
  clubs:
    "M0-14a5.6 5.6 0 0 1 5.6 5.6c0 1.6-.6 3-1.6 4 .7-.3 1.5-.4 2.3-.4a5.6 5.6 0 1 1-4.8 8.5L3 12H-3l1.5-8.3A5.6 5.6 0 1 1-6.3-4.8c.8 0 1.6.1 2.3.4-1-1-1.6-2.4-1.6-4A5.6 5.6 0 0 1 0-14z"
};

function Pip({ suit, x, y, size = 1, flip = false, fill }: { suit: Suit; x: number; y: number; size?: number; flip?: boolean; fill: string }) {
  return <path d={suitPath[suit]} fill={fill} transform={`translate(${x} ${y}) scale(${size}) ${flip ? "rotate(180)" : ""}`} />;
}

// Pip positions on a 100x140 card: columns 36/50/64, rows 34..106 (clear of the corner indices).
const L = 36;
const C = 50;
const R = 64;
const pipLayout: Partial<Record<Rank, Array<[number, number]>>> = {
  "2": [[C, 34], [C, 106]],
  "3": [[C, 34], [C, 70], [C, 106]],
  "4": [[L, 34], [R, 34], [L, 106], [R, 106]],
  "5": [[L, 34], [R, 34], [C, 70], [L, 106], [R, 106]],
  "6": [[L, 34], [R, 34], [L, 70], [R, 70], [L, 106], [R, 106]],
  "7": [[L, 34], [R, 34], [C, 52], [L, 70], [R, 70], [L, 106], [R, 106]],
  "8": [[L, 34], [R, 34], [C, 52], [L, 70], [R, 70], [C, 88], [L, 106], [R, 106]],
  "9": [[L, 34], [R, 34], [L, 58], [R, 58], [C, 70], [L, 82], [R, 82], [L, 106], [R, 106]],
  "10": [[L, 34], [R, 34], [C, 46], [L, 58], [R, 58], [L, 82], [R, 82], [C, 94], [L, 106], [R, 106]]
};

export function CardFace({ card, compact = false }: { card: Card; compact?: boolean }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const ink = red ? RED : BLACK;
  const isCourt = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const id = `${card.suit}-${card.rank}`;

  return (
    <svg viewBox="0 0 100 140" className="block h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`paper-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#f3ecdc" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" rx="9" fill={`url(#paper-${id})`} />

      {/* Corner indices: big and bold so the rank reads even when cards overlap. */}
      <Corner rank={card.rank} suit={card.suit} ink={ink} compact={compact} />
      <g transform="rotate(180 50 70)">
        <Corner rank={card.rank} suit={card.suit} ink={ink} compact={compact} />
      </g>

      {card.rank === "A" ? (
        <Pip suit={card.suit} x={50} y={70} size={card.suit === "spades" ? 2.6 : 2.2} fill={ink} />
      ) : isCourt ? (
        <Court rank={card.rank as "J" | "Q" | "K"} suit={card.suit} ink={ink} red={red} id={id} />
      ) : compact ? (
        <Pip suit={card.suit} x={50} y={74} size={1.9} fill={ink} />
      ) : (
        pipLayout[card.rank]?.map(([x, y], index) => <Pip key={index} suit={card.suit} x={x} y={y} size={0.72} flip={y > 70} fill={ink} />)
      )}
    </svg>
  );
}

function Corner({ rank, suit, ink, compact }: { rank: Rank; suit: Suit; ink: string; compact: boolean }) {
  const size = compact ? 30 : 24;
  return (
    <g>
      <text
        x={rank === "10" ? 15 : 13}
        y={compact ? 30 : 25}
        textAnchor="middle"
        fontSize={rank === "10" ? size * 0.82 : size}
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={ink}
        letterSpacing={rank === "10" ? -2 : 0}
      >
        {rank}
      </text>
      <Pip suit={suit} x={13} y={compact ? 44 : 37} size={compact ? 0.62 : 0.5} fill={ink} />
    </g>
  );
}

/**
 * Court figure inside a framed panel, mirrored top/bottom like a real card.
 * K: crown + beard. Q: tiara + long hair. J: feathered cap + short hair.
 */
function Court({ rank, suit, ink, red, id }: { rank: "J" | "Q" | "K"; suit: Suit; ink: string; red: boolean; id: string }) {
  const robe = red ? "#b8282e" : "#25407a";
  const robeAlt = red ? "#e8b23a" : "#d2a341";
  const gold = "#e2b13c";
  const skin = "#f6d7b5";
  const hair = rank === "K" ? "#8a8f98" : rank === "Q" ? "#d49a2a" : "#6b3f1d";

  const half = (
    <g>
      {/* robe */}
      <path d="M26 70 C28 58 36 52 50 52 C64 52 72 58 74 70 Z" fill={robe} />
      <path d="M44 52 L50 70 L56 52 Z" fill={robeAlt} />
      <path d="M26 70 C28 58 36 52 50 52 C64 52 72 58 74 70" fill="none" stroke={ink} strokeWidth="1" />
      {/* collar trim */}
      <path d="M38 55 Q50 62 62 55" fill="none" stroke={gold} strokeWidth="2.2" />
      {/* hair behind head */}
      {rank === "Q" ? <path d="M38 34 C36 44 37 52 40 56 L60 56 C63 52 64 44 62 34 Z" fill={hair} /> : null}
      {/* face */}
      <ellipse cx="50" cy="38" rx="10" ry="11.5" fill={skin} stroke={ink} strokeWidth="0.8" />
      {rank === "J" ? <path d="M40 34 Q41 28 50 28 Q59 28 60 34 Q58 31 50 31 Q42 31 40 34Z" fill={hair} /> : null}
      {rank === "Q" ? <path d="M40 36 Q40 27 50 27 Q60 27 60 36 Q56 30 50 30 Q44 30 40 36Z" fill={hair} /> : null}
      {/* eyes, nose, mouth */}
      <circle cx="46" cy="37" r="1.1" fill={BLACK} />
      <circle cx="54" cy="37" r="1.1" fill={BLACK} />
      <path d="M50 38 L49 42 L51 42" fill="none" stroke="#b07a55" strokeWidth="0.7" />
      <path d={rank === "Q" ? "M47 45 Q50 47 53 45" : "M47.5 45 Q50 46 52.5 45"} fill="none" stroke={rank === "Q" ? "#c43a3a" : "#8a4a3a"} strokeWidth="1" />
      {rank === "K" ? (
        <>
          {/* beard + moustache */}
          <path d="M40 41 Q41 53 50 55 Q59 53 60 41 Q57 47 50 47 Q43 47 40 41Z" fill={hair} />
          <path d="M45 44 Q50 42 55 44" fill="none" stroke="#6f737c" strokeWidth="1.4" />
        </>
      ) : null}
      {/* headwear */}
      {rank === "K" ? (
        <g>
          <path d="M39 29 L39 18 L44 24 L50 15 L56 24 L61 18 L61 29 Z" fill={gold} stroke={ink} strokeWidth="0.8" />
          <circle cx="50" cy="15" r="1.6" fill={robe} />
          <circle cx="39" cy="18" r="1.2" fill={robe} />
          <circle cx="61" cy="18" r="1.2" fill={robe} />
          <rect x="39" y="26" width="22" height="3" fill={robeAlt} stroke={ink} strokeWidth="0.5" />
        </g>
      ) : rank === "Q" ? (
        <g>
          <path d="M41 28 Q50 20 59 28 L57 30 Q50 25 43 30 Z" fill={gold} stroke={ink} strokeWidth="0.7" />
          <circle cx="50" cy="22.5" r="1.8" fill={robe} />
          <circle cx="45" cy="25" r="1" fill="#fff" />
          <circle cx="55" cy="25" r="1" fill="#fff" />
        </g>
      ) : (
        <g>
          <path d="M38 30 Q39 21 50 21 Q61 21 62 30 Z" fill={robe} stroke={ink} strokeWidth="0.8" />
          <rect x="38" y="28" width="24" height="3" rx="1" fill={gold} />
          <path d="M60 24 Q70 14 72 22 Q66 20 61 27Z" fill={robeAlt} stroke={ink} strokeWidth="0.6" />
        </g>
      )}
      {/* held item: K sceptre, Q flower, J halberd */}
      {rank === "K" ? (
        <g>
          <line x1="68" y1="70" x2="68" y2="44" stroke={gold} strokeWidth="2" />
          <circle cx="68" cy="42" r="2.6" fill={gold} stroke={ink} strokeWidth="0.6" />
        </g>
      ) : rank === "Q" ? (
        <g>
          <line x1="32" y1="70" x2="33" y2="50" stroke="#3f7a3a" strokeWidth="1.4" />
          <circle cx="33" cy="48" r="3" fill={red ? "#e0485a" : "#e6c13b"} stroke={ink} strokeWidth="0.5" />
        </g>
      ) : (
        <g>
          <line x1="31" y1="70" x2="31" y2="38" stroke="#7a5532" strokeWidth="1.6" />
          <path d="M31 33 L35 40 L31 38 L27 40 Z" fill="#c9ccd2" stroke={ink} strokeWidth="0.5" />
        </g>
      )}
      {/* suit badge on the chest */}
      <Pip suit={suit} x={50} y={63} size={0.38} fill={red ? "#fff" : gold} />
    </g>
  );

  return (
    <g>
      <clipPath id={`court-${id}`}>
        <rect x="22" y="12" width="56" height="116" rx="4" />
      </clipPath>
      <rect x="22" y="12" width="56" height="116" rx="4" fill="#fbf3df" />
      <g clipPath={`url(#court-${id})`}>
        {half}
        <g transform="rotate(180 50 70)">{half}</g>
        <line x1="22" y1="70" x2="78" y2="70" stroke={ink} strokeWidth="0.6" opacity="0.5" />
      </g>
      <rect x="22" y="12" width="56" height="116" rx="4" fill="none" stroke={ink} strokeWidth="1.1" />
      {/* Big rank letter watermark so K/Q/J are unmistakable at a glance */}
      <text x="73" y="24" textAnchor="end" fontSize="10" fontWeight="900" fontFamily="Georgia, serif" fill={ink} opacity="0.85">
        {rank}
      </text>
    </g>
  );
}
