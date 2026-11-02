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

function Hair({ style, colour }: { style: string; colour: string }) {
  switch (style) {
    case 'bob':
      return <path d="M22 30 Q40 8 58 30 L58 40 Q56 28 48 26 Q40 22 32 26 Q24 28 22 40 Z" fill={colour} />;
    case 'long':
      return <path d="M20 30 Q40 6 60 30 L60 58 Q56 42 50 40 Q56 30 40 24 Q24 30 30 40 Q24 42 20 58 Z" fill={colour} />;
    case 'mohawk':
      return <path d="M34 26 Q40 10 46 26 L44 30 Q40 26 36 30 Z" fill={colour} />;
    case 'bald':
      return <path d="M30 24 Q40 20 50 24 L50 27 Q40 23 30 27 Z" fill={colour} />;
    default: // crop
      return <path d="M24 32 Q40 12 56 32 L54 36 Q46 24 40 25 Q30 26 26 36 Z" fill={colour} />;
  }
}

function Eyes({ style }: { style: string }) {
  const y = 46;
  switch (style) {
    case 'narrow':
      return (<g stroke="#222" stroke-width="2" stroke-linecap="round">
        <line x1="28" y1={y} x2="36" y2={y} /><line x1="44" y1={y} x2="52" y2={y} /></g>);
    case 'bright':
      return (<g fill="#222"><circle cx="32" cy={y} r="3" /><circle cx="48" cy={y} r="3" />
        <circle cx="33" cy={y - 1} r="1" fill="#fff" /><circle cx="49" cy={y - 1} r="1" fill="#fff" /></g>);
    case 'sleepy':
      return (<g stroke="#222" stroke-width="2" fill="none" stroke-linecap="round">
        <path d={`M28 ${y} q4 3 8 0`} /><path d={`M44 ${y} q4 3 8 0`} /></g>);
    case 'wide':
      return (<g><circle cx="32" cy={y} r="4" fill="#fff" stroke="#222" />
        <circle cx="48" cy={y} r="4" fill="#fff" stroke="#222" />
        <circle cx="32" cy={y} r="1.6" fill="#222" /><circle cx="48" cy={y} r="1.6" fill="#222" /></g>);
    default:
      return (<g fill="#222"><circle cx="32" cy={y} r="2.6" /><circle cx="48" cy={y} r="2.6" /></g>);
  }
}

function Mouth({ style }: { style: string }) {
  const y = 58;
  switch (style) {
    case 'grin':
      return <path d={`M30 ${y} q10 8 20 0`} stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round" />;
    case 'flat':
      return <line x1="32" y1={y} x2="48" y2={y} stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round" />;
    case 'open':
      return <ellipse cx="40" cy={y + 1} rx="5" ry="3.4" fill="#7a3b2e" />;
    case 'smirk':
      return <path d={`M32 ${y + 2} q8 2 16 -3`} stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round" />;
    default:
      return <path d={`M31 ${y} q9 6 18 0`} stroke="#7a3b2e" stroke-width="2.2" fill="none" stroke-linecap="round" />;
  }
}

function Accessory({ kind }: { kind: string }) {
  switch (kind) {
    case 'scar':
      return <path d="M48 36 L54 48" stroke="#b0715a" stroke-width="2" stroke-linecap="round" />;
    case 'freckles':
      return (<g fill="#b0715a"><circle cx="28" cy="52" r="1" /><circle cx="31" cy="54" r="1" />
        <circle cx="49" cy="52" r="1" /><circle cx="52" cy="54" r="1" /></g>);
    case 'eyepatch':
      return (<g><line x1="20" y1="40" x2="60" y2="36" stroke="#222" stroke-width="2" />
        <circle cx="32" cy="46" r="5" fill="#222" /></g>);
    case 'circlet':
      return (<g><path d="M26 34 Q40 28 54 34" stroke="#c9a227" stroke-width="2" fill="none" />
        <circle cx="40" cy="31" r="2" fill="#c9a227" /></g>);
    default:
      return null;
  }
}

// ---- creatures: stylised, seed-shaded ----

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0')}`;
};
const PALETTES: Record<string, string[]> = {
  goblin: ['#5a8c3f', '#4f7d38', '#669c47'],
  wolf: ['#7a7064', '#8a8074', '#6a625a'],
  rat: ['#8a7668', '#7a6658', '#9a8678'],
  skeleton: ['#d8d5cc', '#c8c4b8', '#e4e0d6'],
  troll: ['#5d6b4a', '#52603f', '#687a55'],
  beast: ['#a08a68', '#907a58', '#b09a78'],
};

export function Creature({ kind, seed }: { kind: string; seed: number }) {
  const palette = PALETTES[kind] ?? PALETTES.beast!;
  const base = palette[seed % palette.length]!;
  const dark = shade(base, 0.7);
  const light = shade(base, 1.25);
  switch (kind) {
    case 'goblin':
      return (<g>
        <path d="M14 34 L30 40 L24 30 Z M66 34 L50 40 L56 30 Z" fill={dark} />
        <circle cx="40" cy="46" r="20" fill={base} />
        <circle cx="33" cy="44" r="4" fill="#f4d03f" /><circle cx="47" cy="44" r="4" fill="#f4d03f" />
        <circle cx="33" cy="44" r="1.8" fill="#222" /><circle cx="47" cy="44" r="1.8" fill="#222" />
        <path d="M32 56 q8 -5 16 0" stroke={dark} stroke-width="2.4" fill="none" stroke-linecap="round" />
      </g>);
    case 'wolf':
      return (<g>
        <path d="M24 32 L32 18 L36 34 Z M56 32 L48 18 L44 34 Z" fill={dark} />
        <ellipse cx="40" cy="48" rx="20" ry="18" fill={base} />
        <circle cx="33" cy="45" r="3" fill="#1a1a1a" /><circle cx="47" cy="45" r="3" fill="#1a1a1a" />
        <ellipse cx="40" cy="55" rx="7" ry="6" fill={light} />
        <circle cx="40" cy="52" r="3" fill="#2a2018" />
        <path d="M36 58 q4 3 8 0" stroke="#2a2018" stroke-width="1.8" fill="none" stroke-linecap="round" />
      </g>);
    case 'rat':
      return (<g>
        <circle cx="26" cy="30" r="8" fill={dark} /><circle cx="54" cy="30" r="8" fill={dark} />
        <circle cx="40" cy="48" r="19" fill={base} />
        <circle cx="33" cy="46" r="3" fill="#1a1a1a" /><circle cx="47" cy="46" r="3" fill="#1a1a1a" />
        <ellipse cx="40" cy="56" rx="6" ry="5" fill={light} />
        <circle cx="40" cy="53" r="2.4" fill="#b06a78" />
        <path d="M24 54 q6 2 12 1 M44 55 q6 1 12 -1" stroke={dark} stroke-width="1.4" fill="none" />
      </g>);
    case 'skeleton':
      return (<g>
        <circle cx="40" cy="44" r="19" fill={base} />
        <ellipse cx="33" cy="42" rx="5" ry="6" fill="#2a2a26" /><ellipse cx="47" cy="42" rx="5" ry="6" fill="#2a2a26" />
        <path d="M36 52 L38 48 L40 52 L42 48 L44 52" stroke="#2a2a26" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M30 60 L50 60 M34 60 L34 56 M40 60 L40 56 M46 60 L46 56" stroke={dark} stroke-width="1.8" />
      </g>);
    case 'troll':
      return (<g>
        <circle cx="24" cy="30" r="7" fill={dark} /><circle cx="56" cy="30" r="7" fill={dark} />
        <ellipse cx="40" cy="46" rx="21" ry="19" fill={base} />
        <path d="M26 38 Q40 30 54 38" stroke={dark} stroke-width="3" fill="none" />
        <circle cx="34" cy="44" r="2.6" fill="#1a1a1a" /><circle cx="46" cy="44" r="2.6" fill="#1a1a1a" />
        <path d="M30 56 q10 6 20 0" stroke={dark} stroke-width="2.6" fill="none" stroke-linecap="round" />
        <circle cx="30" cy="60" r="2" fill={light} /><circle cx="50" cy="60" r="2" fill={light} />
      </g>);
    default: // beast fallback — paw print
      return (<g fill={base}>
        <ellipse cx="40" cy="52" rx="10" ry="8" />
        <circle cx="28" cy="38" r="4" /><circle cx="37" cy="33" r="4" />
        <circle cx="47" cy="33" r="4" /><circle cx="55" cy="38" r="4" />
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

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      class="avatar"
    >
      <circle cx="40" cy="40" r="38" fill={frameColour} />
      <circle cx="40" cy="40" r="33" fill="#e8dcc4" />
      {creature ?? (
        <g>
          <circle cx="40" cy="46" r="22" fill={skin} />
          <Hair style={hair} colour={hairColour} />
          <Eyes style={eyes} />
          <Mouth style={mouth} />
          <Accessory kind={accessory} />
        </g>
      )}
    </svg>
  );
}
