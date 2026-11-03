import type { JSX } from 'preact';
import type { AvatarSpec, ClassId } from '../engine/quest/types';
import {
  ACCESSORIES,
  EYES,
  FRAME_COLOURS,
  HAIR_COLOURS,
  HAIR_STYLES,
  MOUTHS,
  SKINS,
} from './parts';

const key = <T extends string>(list: readonly T[], k: string | undefined, fallback: T): T =>
  (list as readonly string[]).includes(k ?? '') ? (k as T) : fallback;

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
};

function HairBack({ style, colour }: { style: string; colour: string }) {
  if (style === 'long') return <path d="M18 40 Q16 20 40 18 Q64 20 62 40 L64 66 Q56 62 54 50 L26 50 Q24 62 16 66 Z" fill={shade(colour, 0.8)} />;
  if (style === 'bob') return <path d="M19 42 Q18 20 40 19 Q62 20 61 42 L60 52 Q56 50 54 44 L26 44 Q24 50 20 52 Z" fill={shade(colour, 0.8)} />;
  return null;
}

function Hair({ style, colour }: { style: string; colour: string }) {
  const hi = shade(colour, 1.35);
  switch (style) {
    case 'bob':
      return (<g>
        <path d="M20 40 Q20 18 40 18 Q60 18 60 40 Q56 30 46 27 Q40 31 34 27 Q24 30 20 40 Z" fill={colour} />
        <path d="M28 24 Q36 20 44 22" stroke={hi} stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />
      </g>);
    case 'long':
      return (<g>
        <path d="M19 42 Q18 16 40 16 Q62 16 61 42 Q58 30 50 26 Q44 30 40 26 Q34 31 28 27 Q22 32 19 42 Z" fill={colour} />
        <path d="M27 22 Q36 18 46 20" stroke={hi} stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />
      </g>);
    case 'mohawk':
      return (<g>
        <path d="M35 30 Q33 16 38 8 Q40 14 42 8 Q47 16 45 30 Q40 27 35 30 Z" fill={colour} />
        <path d="M38 12 L39 26" stroke={hi} stroke-width="1.5" opacity="0.6" />
        <path d="M24 38 Q24 30 30 28 M56 38 Q56 30 50 28" stroke={shade(colour, 0.9)} stroke-width="1.5" fill="none" opacity="0.5" />
      </g>);
    case 'bald':
      return (<g>
        <ellipse cx="34" cy="26" rx="6" ry="3" fill="#fff" opacity="0.22" />
        <path d="M21 42 Q20 36 23 34 M59 42 Q60 36 57 34" stroke={colour} stroke-width="3" fill="none" stroke-linecap="round" />
      </g>);
    default: // crop
      return (<g>
        <path d="M21 38 Q20 18 40 18 Q60 18 59 38 Q56 28 48 26 L46 29 L42 26 L38 29 L34 26 Q24 28 21 38 Z" fill={colour} />
        <path d="M30 22 Q38 19 46 21" stroke={hi} stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6" />
      </g>);
  }
}

function Eyes({ style }: { style: string }) {
  const y = 41;
  const brow = (dy: number, tilt: number) => (
    <g stroke="#3a2a20" stroke-width="2" stroke-linecap="round" opacity="0.85">
      <line x1="28" y1={y - 7 + dy + tilt} x2="36" y2={y - 8 + dy} />
      <line x1="44" y1={y - 8 + dy} x2="52" y2={y - 7 + dy + tilt} />
    </g>
  );
  switch (style) {
    case 'narrow':
      return (<g>{brow(1, 1.5)}<g stroke="#222" stroke-width="2.2" stroke-linecap="round">
        <line x1="28" y1={y} x2="36" y2={y} /><line x1="44" y1={y} x2="52" y2={y} /></g></g>);
    case 'bright':
      return (<g>{brow(-1, 0)}<g fill="#222"><circle cx="32" cy={y} r="3.2" /><circle cx="48" cy={y} r="3.2" />
        <circle cx="33.2" cy={y - 1.2} r="1.2" fill="#fff" /><circle cx="49.2" cy={y - 1.2} r="1.2" fill="#fff" /></g></g>);
    case 'sleepy':
      return (<g>{brow(0, -1)}<g stroke="#222" stroke-width="2" fill="none" stroke-linecap="round">
        <path d={`M28 ${y} q4 3 8 0`} /><path d={`M44 ${y} q4 3 8 0`} /></g></g>);
    case 'wide':
      return (<g>{brow(-2, 0)}<circle cx="32" cy={y} r="4.2" fill="#fff" stroke="#222" />
        <circle cx="48" cy={y} r="4.2" fill="#fff" stroke="#222" />
        <circle cx="32.5" cy={y} r="1.9" fill="#222" /><circle cx="48.5" cy={y} r="1.9" fill="#222" /></g>);
    default:
      return (<g>{brow(0, 0)}<g fill="#222"><circle cx="32" cy={y} r="2.7" /><circle cx="48" cy={y} r="2.7" />
        <circle cx="32.8" cy={y - 0.9} r="0.9" fill="#fff" /><circle cx="48.8" cy={y - 0.9} r="0.9" fill="#fff" /></g></g>);
  }
}

function Mouth({ style }: { style: string }) {
  const y = 53;
  switch (style) {
    case 'grin':
      return <path d={`M31 ${y} q9 8 18 0 z`} fill="#7a3b2e" stroke="#7a3b2e" stroke-width="1.5" stroke-linejoin="round" />;
    case 'flat':
      return <line x1="34" y1={y + 1} x2="46" y2={y + 1} stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round" />;
    case 'open':
      return <ellipse cx="40" cy={y + 1} rx="4.5" ry="3.4" fill="#5a2a22" />;
    case 'smirk':
      return <path d={`M33 ${y + 2} q8 2 14 -3`} stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round" />;
    default:
      return <path d={`M33 ${y} q7 5 14 0`} stroke="#7a3b2e" stroke-width="2.2" fill="none" stroke-linecap="round" />;
  }
}

function Accessory({ kind }: { kind: string }) {
  switch (kind) {
    case 'scar':
      return <path d="M49 32 L54 46 M50 36 L53 35 M51 40 L54 39" stroke="#a0604a" stroke-width="1.6" stroke-linecap="round" />;
    case 'freckles':
      return (<g fill="#b0715a" opacity="0.8"><circle cx="28" cy="47" r="1" /><circle cx="31" cy="49" r="1" /><circle cx="27" cy="50" r="0.8" />
        <circle cx="49" cy="47" r="1" /><circle cx="52" cy="49" r="1" /><circle cx="53" cy="46" r="0.8" /></g>);
    case 'eyepatch':
      return (<g><path d="M20 34 L60 30" stroke="#1a1a1a" stroke-width="2" />
        <path d="M26 38 Q32 35 38 38 L37 44 Q32 47 27 44 Z" fill="#1a1a1a" /></g>);
    case 'circlet':
      return (<g><path d="M22 31 Q40 25 58 31" stroke="#c9a227" stroke-width="2.4" fill="none" />
        <path d="M40 24 l3 4 l-3 4 l-3 -4 z" fill="#5ac0e0" stroke="#c9a227" stroke-width="1" /></g>);
    default:
      return null;
  }
}

/** Shoulders and outfit; class frames get a recognisable silhouette. */
function Garb({ frame, colour }: { frame: string; colour: string }) {
  const dark = shade(colour, 0.65), light = shade(colour, 1.3);
  const body = <path d="M8 84 Q10 64 28 61 L52 61 Q70 64 72 84 Z" fill={colour} />;
  switch (frame) {
    case 'fighter':
    case 'paladin': {
      const metal = frame === 'paladin' ? '#d8d0b8' : '#9aa0a8';
      return (<g>{body}
        <path d="M8 84 Q8 66 22 62 Q30 66 28 76 Z M72 84 Q72 66 58 62 Q50 66 52 76 Z" fill={metal} />
        <path d="M14 70 Q20 66 26 68 M66 70 Q60 66 54 68" stroke={shade(metal, 0.7)} stroke-width="1.5" fill="none" />
        <path d="M32 61 L40 70 L48 61" fill={shade(metal, 0.85)} />
        {frame === 'paladin' && <path d="M40 70 V82 M35 75 H45" stroke="#c9a227" stroke-width="2.5" />}
      </g>);
    }
    case 'rogue':
    case 'ranger':
      return (<g>
        <path d="M14 84 Q12 50 18 34 Q24 14 40 13 Q56 14 62 34 Q68 50 66 84 Z" fill={dark} />
        <path d="M40 13 Q56 14 62 34 Q68 50 66 84 L58 84 Q60 50 54 32 Q48 20 40 19 Z" fill="#000" opacity="0.15" />
        {body}
        <path d="M30 61 Q40 70 50 61" fill={light} opacity="0.5" />
        {frame === 'ranger' && <path d="M20 84 L56 61" stroke="#6a4a2a" stroke-width="3" />}
      </g>);
    case 'wizard':
      return (<g>{body}
        <path d="M28 61 L40 78 L52 61" fill={light} />
        <path d="M30 61 L40 75 L50 61" fill={dark} />
        <circle cx="40" cy="70" r="2.4" fill="#f3d27a" />
      </g>);
    case 'cleric':
      return (<g>{body}
        <path d="M26 62 Q40 72 54 62" stroke="#f3e8d0" stroke-width="4" fill="none" />
        <circle cx="40" cy="74" r="4" fill="#f3d27a" stroke="#8a6a14" stroke-width="1" />
      </g>);
    case 'druid':
      return (<g>{body}
        {[22, 30, 38, 46, 54].map((x, i) => <path key={x} d={`M${x} ${62 + (i % 2) * 2} q4 -6 8 0 q-4 6 -8 0 z`} fill={i % 2 ? '#7ab04a' : '#5a9038'} />)}
      </g>);
    case 'bard':
      return (<g>{body}
        <path d="M30 61 Q40 68 50 61 L48 66 Q40 72 32 66 Z" fill="#f3e8d0" />
        <path d="M34 66 L40 80 L46 66" fill={light} />
      </g>);
    default:
      return (<g>{body}<path d="M32 61 Q40 67 48 61" stroke={dark} stroke-width="2" fill="none" /></g>);
  }
}

// ---- creatures: stylised, seed-shaded ----

const PALETTES: Record<string, string[]> = {
  goblin: ['#5a8c3f', '#4f7d38', '#6a9c47'],
  wolf: ['#7a7064', '#8a8074', '#5e5852'],
  rat: ['#8a7668', '#7a6658', '#9a8678'],
  skeleton: ['#d8d5cc', '#c8c4b8', '#e4e0d6'],
  troll: ['#5d6b4a', '#52603f', '#687a55'],
  spider: ['#3a3040', '#2e2a36', '#4a3a3a'],
  wisp: ['#7ad0f0', '#9af0c0', '#b8a0ff'],
  bandit: ['#5a4a3a', '#4a3a40', '#3e4a3a'],
  bat: ['#4a3a4a', '#3a3040', '#5a4a4a'],
  slime: ['#6ac04a', '#4ab0a0', '#a06ad0'],
  ghost: ['#d8e4f0', '#c8d8e8', '#e0e0f8'],
  beast: ['#a08a68', '#907a58', '#b09a78'],
};

export const CREATURE_KINDS = Object.keys(PALETTES);

export function Creature({ kind, seed }: { kind: string; seed: number }) {
  const palette = PALETTES[kind] ?? PALETTES.beast!;
  const base = palette[Math.abs(seed) % palette.length]!;
  const dark = shade(base, 0.7);
  const light = shade(base, 1.25);
  const eyeGlow = (cx: number, cy: number, r: number, c: string) => (
    <g><circle cx={cx} cy={cy} r={r * 2.2} fill={c} opacity="0.25" /><circle cx={cx} cy={cy} r={r} fill={c} /></g>
  );
  switch (kind) {
    case 'goblin':
      return (<g>
        <path d="M10 84 Q14 66 30 63 L50 63 Q66 66 70 84 Z" fill="#6a4a2a" />
        <path d="M22 70 L30 63 L28 76 Z M58 70 L50 63 L52 76 Z" fill="#4a3220" />
        <path d="M8 34 L28 42 L22 30 Z M72 34 L52 42 L58 30 Z" fill={base} />
        <path d="M12 34 L26 40 L22 32 Z M68 34 L54 40 L58 32 Z" fill={shade(base, 0.85)} opacity="0.8" />
        <ellipse cx="40" cy="44" rx="19" ry="20" fill={base} />
        <ellipse cx="34" cy="34" rx="8" ry="4" fill="#fff" opacity="0.1" />
        <path d="M26 36 L36 39 M54 36 L44 39" stroke={dark} stroke-width="2.4" stroke-linecap="round" />
        <ellipse cx="32" cy="42" rx="4.5" ry="3.5" fill="#f4d03f" /><ellipse cx="48" cy="42" rx="4.5" ry="3.5" fill="#f4d03f" />
        <ellipse cx="32" cy="42" rx="1.2" ry="3" fill="#222" /><ellipse cx="48" cy="42" rx="1.2" ry="3" fill="#222" />
        <path d="M37 46 Q40 52 43 46" fill={dark} />
        <path d="M29 54 Q40 61 51 54 Q40 57 29 54 Z" fill="#3a1a14" />
        <path d="M33 55 l2 3 l1 -3 M45 55 l-1 3 l-2 -3" fill="#f0e8d0" />
      </g>);
    case 'wolf':
      return (<g>
        <path d="M8 84 Q12 62 40 60 Q68 62 72 84 Z" fill={dark} />
        <path d="M20 34 L26 12 L36 30 Z M60 34 L54 12 L44 30 Z" fill={base} />
        <path d="M23 30 L27 18 L33 29 Z M57 30 L53 18 L47 29 Z" fill="#c89a8a" opacity="0.6" />
        <path d="M18 44 Q18 26 40 25 Q62 26 62 44 Q62 56 52 62 L28 62 Q18 56 18 44 Z" fill={base} />
        <path d="M18 50 L12 56 L22 56 Z M62 50 L68 56 L58 56 Z" fill={base} />
        <path d="M30 46 Q40 44 50 46 L46 64 Q40 68 34 64 Z" fill={light} />
        <path d="M27 38 L36 41 M53 38 L44 41" stroke={shade(base, 0.5)} stroke-width="2" stroke-linecap="round" />
        {eyeGlow(32, 42, 2.6, '#f0c040')}{eyeGlow(48, 42, 2.6, '#f0c040')}
        <circle cx="32" cy="42" r="1.1" fill="#111" /><circle cx="48" cy="42" r="1.1" fill="#111" />
        <ellipse cx="40" cy="53" rx="4.5" ry="3.2" fill="#1a1410" />
        <path d="M35 60 Q40 63 45 60" stroke="#1a1410" stroke-width="1.6" fill="none" />
        <path d="M36 60 l1 3 l1 -3 M42 60 l1 3 l1 -3" fill="#f0e8d0" />
      </g>);
    case 'rat':
      return (<g>
        <path d="M12 84 Q16 64 40 62 Q64 64 68 84 Z" fill={dark} />
        <circle cx="22" cy="28" r="10" fill={dark} /><circle cx="58" cy="28" r="10" fill={dark} />
        <circle cx="22" cy="28" r="6" fill="#d8909a" /><circle cx="58" cy="28" r="6" fill="#d8909a" />
        <path d="M20 44 Q20 26 40 26 Q60 26 60 44 Q58 58 40 66 Q22 58 20 44 Z" fill={base} />
        <path d="M30 50 Q40 46 50 50 L44 64 Q40 66 36 64 Z" fill={light} />
        {eyeGlow(31, 42, 2.8, '#c03030')}{eyeGlow(49, 42, 2.8, '#c03030')}
        <circle cx="31.8" cy="41.2" r="0.9" fill="#fff" /><circle cx="49.8" cy="41.2" r="0.9" fill="#fff" />
        <ellipse cx="40" cy="58" rx="3" ry="2.2" fill="#b06a78" />
        <rect x="38" y="61" width="4" height="4" fill="#f0e8c8" stroke="#a09070" stroke-width="0.5" />
        <path d="M18 54 L34 57 M18 60 L34 59 M62 54 L46 57 M62 60 L46 59" stroke={shade(base, 0.5)} stroke-width="1" />
      </g>);
    case 'skeleton':
      return (<g>
        <path d="M14 84 L18 70 Q40 64 62 70 L66 84 Z" fill="#2a2a26" />
        <path d="M24 74 Q40 70 56 74 M26 80 Q40 76 54 80" stroke={base} stroke-width="2.4" fill="none" />
        <path d="M37 62 L37 70 M43 62 L43 70" stroke={base} stroke-width="3" />
        <path d="M20 40 Q20 18 40 18 Q60 18 60 40 Q60 48 54 52 L52 58 L28 58 L26 52 Q20 48 20 40 Z" fill={base} />
        <path d="M40 18 Q60 18 60 40 Q60 48 54 52 L52 58 L46 58 Q54 40 48 22 Z" fill="#000" opacity="0.08" />
        <path d="M28 58 L52 58 L50 64 Q40 67 30 64 Z" fill={dark} />
        <path d="M32 58 V63 M36 58 V64 M40 58 V65 M44 58 V64 M48 58 V63" stroke="#2a2a26" stroke-width="1.2" />
        <path d="M25 37 Q32 33 37 38 Q36 46 30 46 Q25 44 25 37 Z M55 37 Q48 33 43 38 Q44 46 50 46 Q55 44 55 37 Z" fill="#1a1a18" />
        {eyeGlow(31, 41, 1.6, '#7aff8a')}{eyeGlow(49, 41, 1.6, '#7aff8a')}
        <path d="M40 46 L37 53 L43 53 Z" fill="#1a1a18" />
        <path d="M48 24 L52 30 L50 34" stroke={dark} stroke-width="1" fill="none" />
      </g>);
    case 'troll':
      return (<g>
        <path d="M4 84 Q6 58 40 56 Q74 58 76 84 Z" fill={dark} />
        <path d="M18 84 Q20 70 30 66 M62 84 Q60 70 50 66" stroke={shade(base, 0.55)} stroke-width="2" fill="none" />
        <circle cx="18" cy="34" r="8" fill={dark} /><circle cx="62" cy="34" r="8" fill={dark} />
        <path d="M16 42 Q14 18 40 17 Q66 18 64 42 Q64 60 52 64 L28 64 Q16 60 16 42 Z" fill={base} />
        <path d="M22 22 Q30 12 40 18 Q50 12 58 22 Q50 18 40 22 Q30 18 22 22 Z" fill="#3e5a2a" />
        <path d="M24 36 Q32 32 38 37 M56 36 Q48 32 42 37" stroke={shade(base, 0.5)} stroke-width="3.2" fill="none" stroke-linecap="round" />
        <circle cx="32" cy="41" r="2.3" fill="#e0c040" /><circle cx="48" cy="41" r="2.3" fill="#e0c040" />
        <circle cx="32" cy="41" r="1" fill="#111" /><circle cx="48" cy="41" r="1" fill="#111" />
        <path d="M35 44 Q40 52 45 44 Q44 50 40 51 Q36 50 35 44 Z" fill={dark} />
        <path d="M27 56 Q40 52 53 56 Q40 62 27 56 Z" fill="#2a1a14" />
        <path d="M30 57 L32 48 L35 56 Z M50 57 L48 48 L45 56 Z" fill="#f0e8c8" />
        <circle cx="24" cy="48" r="1.6" fill={light} /><circle cx="56" cy="30" r="1.3" fill={light} /><circle cx="52" cy="50" r="1.4" fill={light} />
      </g>);
    case 'spider':
      return (<g>
        <g stroke={dark} stroke-width="3.2" fill="none" stroke-linecap="round">
          <path d="M30 46 Q14 30 8 44 M30 50 Q12 46 8 62 M32 54 Q18 60 14 76 M34 56 Q28 68 26 80" />
          <path d="M50 46 Q66 30 72 44 M50 50 Q68 46 72 62 M48 54 Q62 60 66 76 M46 56 Q52 68 54 80" />
        </g>
        <ellipse cx="40" cy="66" rx="18" ry="14" fill={dark} />
        <path d="M34 60 L40 66 L46 60 M34 72 L40 66 L46 72" stroke="#c03030" stroke-width="2" fill="none" opacity="0.8" />
        <circle cx="40" cy="44" r="15" fill={base} />
        <ellipse cx="36" cy="37" rx="6" ry="3" fill="#fff" opacity="0.12" />
        {eyeGlow(35, 42, 2.4, '#ff3a3a')}{eyeGlow(45, 42, 2.4, '#ff3a3a')}
        {eyeGlow(31, 37, 1.4, '#ff3a3a')}{eyeGlow(49, 37, 1.4, '#ff3a3a')}
        <circle cx="37" cy="35" r="1.1" fill="#ff6a5a" /><circle cx="43" cy="35" r="1.1" fill="#ff6a5a" />
        <path d="M36 53 Q34 58 37 60 M44 53 Q46 58 43 60" stroke="#e8e0c8" stroke-width="2.2" fill="none" stroke-linecap="round" />
      </g>);
    case 'wisp':
      return (<g>
        <circle cx="40" cy="44" r="30" fill={base} opacity="0.12" />
        <circle cx="40" cy="44" r="22" fill={base} opacity="0.2" />
        <path d="M40 72 Q22 66 24 46 Q26 30 40 16 Q38 28 46 30 Q58 36 56 52 Q54 68 40 72 Z" fill={base} opacity="0.85" />
        <path d="M40 66 Q30 62 31 48 Q32 38 40 30 Q40 38 46 40 Q52 46 50 54 Q48 64 40 66 Z" fill={light} />
        <path d="M40 60 Q35 57 36 50 Q38 44 40 42 Q44 46 45 50 Q45 57 40 60 Z" fill="#fff" opacity="0.8" />
        <ellipse cx="35" cy="50" rx="2" ry="3.2" fill="#1a2a3a" /><ellipse cx="45" cy="50" rx="2" ry="3.2" fill="#1a2a3a" />
      </g>);
    case 'bandit':
      return (<g>
        <path d="M8 84 Q10 62 40 60 Q70 62 72 84 Z" fill={dark} />
        <path d="M22 84 L52 60" stroke="#3a2614" stroke-width="3" />
        <path d="M16 70 Q14 40 20 30 Q28 14 40 14 Q52 14 60 30 Q66 40 64 70 Q52 60 40 60 Q28 60 16 70 Z" fill={base} />
        <ellipse cx="40" cy="44" rx="16" ry="18" fill="#c8946a" />
        <path d="M24 34 Q40 22 56 34 Q48 30 40 30 Q32 30 24 34 Z" fill={shade(base, 0.8)} />
        <path d="M27 38 L36 40 M53 38 L44 40" stroke="#2a1a10" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="32" cy="43" r="2.4" fill="#1a1a1a" /><circle cx="48" cy="43" r="2.4" fill="#1a1a1a" />
        <path d="M23 47 Q40 44 57 47 L56 58 Q40 66 24 58 Z" fill="#7a2a22" />
        <path d="M24 52 Q40 50 56 52" stroke="#5a1a14" stroke-width="1.2" fill="none" />
        <path d="M56 50 L64 56 L60 58 Z" fill="#7a2a22" />
      </g>);
    case 'bat':
      return (<g>
        <path d="M40 46 Q26 30 4 34 Q12 40 10 48 Q18 46 20 54 Q26 50 30 56 Z" fill={dark} />
        <path d="M40 46 Q54 30 76 34 Q68 40 70 48 Q62 46 60 54 Q54 50 50 56 Z" fill={dark} />
        <path d="M8 36 L30 50 M20 40 L32 52 M72 36 L50 50 M60 40 L48 52" stroke={shade(base, 0.5)} stroke-width="1" />
        <path d="M28 30 L30 14 L38 28 Z M52 30 L50 14 L42 28 Z" fill={base} />
        <path d="M30 27 L31 19 L35 27 Z M50 27 L49 19 L45 27 Z" fill="#c88a9a" />
        <ellipse cx="40" cy="46" rx="14" ry="16" fill={base} />
        {eyeGlow(34, 42, 2.6, '#ff5a3a')}{eyeGlow(46, 42, 2.6, '#ff5a3a')}
        <path d="M37 49 L40 51 L43 49" stroke={dark} stroke-width="1.5" fill="none" />
        <path d="M35 54 Q40 58 45 54" stroke="#1a1010" stroke-width="1.5" fill="none" />
        <path d="M36 55 l1.2 4 l1.2 -3.6 M41.6 55.4 l1.2 3.6 l1.2 -4" fill="#f0e8d0" />
      </g>);
    case 'slime':
      return (<g>
        <ellipse cx="40" cy="74" rx="28" ry="5" fill="#000" opacity="0.25" />
        <path d="M12 72 Q10 52 22 40 Q30 24 40 24 Q50 24 58 40 Q70 52 68 72 Q60 76 52 72 Q50 78 44 74 Q34 78 30 72 Q20 76 12 72 Z" fill={base} opacity="0.92" />
        <path d="M18 64 Q18 50 26 42" stroke={light} stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7" />
        <ellipse cx="30" cy="36" rx="5" ry="3" fill="#fff" opacity="0.6" transform="rotate(-30 30 36)" />
        <circle cx="33" cy="50" r="4.5" fill="#fff" /><circle cx="49" cy="50" r="4.5" fill="#fff" />
        <circle cx="34" cy="51" r="2.4" fill="#1a1a1a" /><circle cx="50" cy="51" r="2.4" fill="#1a1a1a" />
        <path d="M36 60 Q41 64 46 60" stroke={dark} stroke-width="2" fill="none" stroke-linecap="round" />
        <circle cx="54" cy="66" r="2.2" fill={dark} opacity="0.5" /><circle cx="26" cy="58" r="1.6" fill={dark} opacity="0.5" />
      </g>);
    case 'ghost':
      return (<g>
        <circle cx="40" cy="44" r="30" fill="#c8e0ff" opacity="0.12" />
        <path d="M18 76 L18 42 Q18 18 40 18 Q62 18 62 42 L62 76 Q57 70 52 76 Q47 70 42 76 Q37 70 32 76 Q27 70 23 76 Q20 72 18 76 Z" fill={base} opacity="0.88" />
        <path d="M40 18 Q62 18 62 42 L62 76 Q57 70 52 76 Q58 50 50 26 Z" fill="#6a7aa0" opacity="0.2" />
        <ellipse cx="32" cy="42" rx="4.5" ry="6.5" fill="#1a2030" /><ellipse cx="48" cy="42" rx="4.5" ry="6.5" fill="#1a2030" />
        <circle cx="32" cy="44" r="1.4" fill="#9ad0ff" /><circle cx="48" cy="44" r="1.4" fill="#9ad0ff" />
        <ellipse cx="40" cy="57" rx="5" ry="6" fill="#1a2030" />
      </g>);
    default: // beast fallback — paw print
      return (<g fill={base}>
        <ellipse cx="40" cy="52" rx="11" ry="9" />
        <ellipse cx="27" cy="38" rx="4.5" ry="5.5" /><ellipse cx="36" cy="31" rx="4.5" ry="5.5" />
        <ellipse cx="46" cy="31" rx="4.5" ry="5.5" /><ellipse cx="55" cy="38" rx="4.5" ry="5.5" />
        <ellipse cx="38" cy="48" rx="5" ry="3" fill="#fff" opacity="0.15" />
      </g>);
  }
}

export function Avatar({
  spec,
  size = 64,
  label = 'avatar',
}: {
  spec: AvatarSpec;
  size?: number;
  label?: string;
}): JSX.Element {
  const frame = (spec.frame ?? 'npc') as ClassId | 'npc' | 'enemy';
  const frameColour = FRAME_COLOURS[frame] ?? FRAME_COLOURS.npc;
  const skin = SKINS[(spec.skin ?? 'peach') as keyof typeof SKINS] ?? SKINS.peach;
  const hairColour = HAIR_COLOURS[(spec.hairColour ?? 'brown') as keyof typeof HAIR_COLOURS] ?? HAIR_COLOURS.brown;
  const hair = key(HAIR_STYLES, spec.hair, 'crop');
  const eyes = key(EYES, spec.eyes, 'round');
  const mouth = key(MOUTHS, spec.mouth, 'smile');
  const accessory = key(ACCESSORIES, spec.accessory, 'none');
  const creature = spec.creature ? <Creature kind={spec.creature} seed={spec.seed} /> : null;
  const garbColour = frame === 'npc' ? '#7a6248' : frame === 'enemy' ? '#5a2e2e' : frameColour;
  // ids depend only on `frame`, so duplicate ids across avatars always hold identical defs
  const ring = `av-ring-${frame}`, bg = `av-bg-${frame}`;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      class="avatar"
    >
      <defs>
        <linearGradient id={ring} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={shade(frameColour, 1.45)} />
          <stop offset="0.5" stop-color={frameColour} />
          <stop offset="1" stop-color={shade(frameColour, 0.55)} />
        </linearGradient>
        <radialGradient id={bg} cx="50%" cy="35%" r="75%">
          <stop offset="0" stop-color={frame === 'enemy' ? '#5a3a34' : '#f2e6cc'} />
          <stop offset="1" stop-color={frame === 'enemy' ? '#1e1210' : shade(frameColour, 0.6)} />
        </radialGradient>
        <clipPath id="av-clip"><circle cx="40" cy="40" r="33" /></clipPath>
      </defs>
      <circle cx="40" cy="40" r="39" fill={`url(#${ring})`} />
      <circle cx="40" cy="40" r="34.5" fill="#120f0c" opacity="0.5" />
      <circle cx="40" cy="40" r="33" fill={`url(#${bg})`} />
      <g clip-path="url(#av-clip)">
        {creature ?? (
          <g>
            <HairBack style={hair} colour={hairColour} />
            <rect x="34" y="54" width="12" height="10" fill={shade(skin, 0.85)} />
            <Garb frame={frame} colour={garbColour} />
            <ellipse cx="19.5" cy="42" rx="3.2" ry="4.6" fill={shade(skin, 0.92)} />
            <ellipse cx="60.5" cy="42" rx="3.2" ry="4.6" fill={shade(skin, 0.92)} />
            <ellipse cx="40" cy="40" rx="20" ry="21" fill={skin} />
            <path d="M52 24 Q62 36 56 54 Q50 60 42 61 Q56 48 52 24 Z" fill="#000" opacity="0.07" />
            <circle cx="28" cy="49" r="3.4" fill="#e07a6a" opacity="0.22" />
            <circle cx="52" cy="49" r="3.4" fill="#e07a6a" opacity="0.22" />
            <path d="M40 43 Q38 48 40 49 Q42 49 42 48" stroke={shade(skin, 0.7)} stroke-width="1.4" fill="none" stroke-linecap="round" />
            <Hair style={hair} colour={hairColour} />
            <Eyes style={eyes} />
            <Mouth style={mouth} />
            <Accessory kind={accessory} />
          </g>
        )}
      </g>
      <circle cx="40" cy="40" r="33" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1.5" />
      <path d="M14 26 A30 30 0 0 1 40 8" stroke="#fff" stroke-opacity="0.35" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>
  );
}
