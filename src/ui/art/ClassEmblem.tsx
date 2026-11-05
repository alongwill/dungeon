import type { JSX } from 'preact';
import { FRAME_COLOURS } from '../../avatar/parts';
import type { ClassId } from '../../engine/quest/types';

const ICONS: Record<ClassId, JSX.Element> = {
  fighter: (
    <g>
      <path d="M32 10 L36 14 L36 40 L28 40 L28 14 Z" fill="#e8e4dc" />
      <path d="M32 10 L36 14 L36 40 L32 40 Z" fill="#b8b4ac" />
      <rect x="22" y="40" width="20" height="4" rx="1" fill="#c9a227" />
      <rect x="30" y="44" width="4" height="9" fill="#5a3a22" />
      <circle cx="32" cy="55" r="2.5" fill="#c9a227" />
    </g>
  ),
  rogue: (
    <g>
      <path d="M22 44 L40 16 L44 18 L28 46 Z" fill="#d8dce4" />
      <path d="M40 16 L44 18 L30 42 Z" fill="#a8acb4" />
      <path d="M20 42 L30 48" stroke="#c9a227" stroke-width="3" stroke-linecap="round" />
      <path d="M22 46 L16 54" stroke="#3a2a1c" stroke-width="4" stroke-linecap="round" />
      <path d="M44 40 q6 -2 8 4 q-6 0 -8 -4 z" fill="#2a2a34" opacity="0.6" />
    </g>
  ),
  paladin: (
    <g>
      <path d="M32 10 L50 16 L50 30 C50 42 42 50 32 54 C22 50 14 42 14 30 L14 16 Z" fill="#e8dcc0" />
      <path d="M32 10 L50 16 L50 30 C50 42 42 50 32 54 Z" fill="#c8bca0" />
      <path d="M32 18 V46 M22 28 H42" stroke="#c9a227" stroke-width="5" stroke-linecap="round" />
    </g>
  ),
  bard: (
    <g>
      <ellipse cx="27" cy="40" rx="11" ry="12" fill="#a8743a" />
      <ellipse cx="27" cy="40" rx="11" ry="12" fill="none" stroke="#5a3a1c" stroke-width="1.5" />
      <circle cx="27" cy="38" r="3.5" fill="#3a2410" />
      <path d="M33 32 L48 12" stroke="#5a3a1c" stroke-width="4" stroke-linecap="round" />
      <path d="M46 10 L52 14 L48 18 Z" fill="#5a3a1c" />
      <path d="M24 46 L46 14 M27 46 L48 15" stroke="#e8dcc0" stroke-width="0.8" />
      <path d="M48 32 q4 -6 0 -10 M52 34 q6 -9 0 -16" stroke="#e8dcc0" stroke-width="1.6" fill="none" stroke-linecap="round" />
    </g>
  ),
  druid: (
    <g>
      <path d="M32 54 C14 44 14 22 32 10 C50 22 50 44 32 54 Z" fill="#7ab04a" />
      <path d="M32 54 C50 44 50 22 32 10 Z" fill="#5a9038" />
      <path d="M32 54 V16 M32 26 L24 20 M32 34 L22 28 M32 42 L24 38 M32 30 L40 24 M32 38 L42 32" stroke="#2e4a1c" stroke-width="1.8" fill="none" stroke-linecap="round" />
    </g>
  ),
  wizard: (
    <g>
      <path d="M14 48 Q32 42 50 48 L46 52 Q32 48 18 52 Z" fill="#3a4a8c" />
      <path d="M20 48 L34 10 L44 48 Z" fill="#4a5aac" />
      <path d="M34 10 L44 48 L36 48 Z" fill="#000" opacity="0.2" />
      <path d="M34 10 Q42 8 46 14" stroke="#4a5aac" stroke-width="4" fill="none" stroke-linecap="round" />
      <path d="M30 26 l1.5 4 l4 0.5 l-3 2.5 l1 4 l-3.5 -2.2 l-3.5 2.2 l1 -4 l-3 -2.5 l4 -0.5 z" fill="#f3d27a" />
      <circle cx="38" cy="40" r="1.6" fill="#f3d27a" />
    </g>
  ),
  cleric: (
    <g>
      <g stroke="#f3d27a" stroke-width="2.5" stroke-linecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="32" y1="32" x2={32 + Math.cos((a * Math.PI) / 180) * 22} y2={32 + Math.sin((a * Math.PI) / 180) * 22} />
        ))}
      </g>
      <circle cx="32" cy="32" r="12" fill="#f3d27a" />
      <circle cx="32" cy="32" r="8" fill="#fff4c8" />
    </g>
  ),
  ranger: (
    <g>
      <path d="M22 10 Q46 32 22 54" stroke="#7a5a32" stroke-width="4" fill="none" stroke-linecap="round" />
      <path d="M22 10 L22 54" stroke="#e8dcc0" stroke-width="1" />
      <path d="M14 32 L50 32" stroke="#c8b898" stroke-width="2" />
      <path d="M50 32 L44 28 L44 36 Z" fill="#d8dce4" />
      <path d="M14 32 L10 28 M14 32 L10 36 M17 32 L13 28 M17 32 L13 36" stroke="#4a7a3a" stroke-width="2" stroke-linecap="round" />
    </g>
  ),
  barbarian: (
    <g>
      <path d="M31 10 L35 10 L35 56 L31 56 Z" fill="#6a4426" />
      <path d="M35 14 C48 12 54 22 52 34 C46 30 40 28 35 30 Z" fill="#d8dce4" />
      <path d="M31 14 C18 12 12 22 14 34 C20 30 26 28 31 30 Z" fill="#b8bcc4" />
      <path d="M52 34 C46 30 40 28 35 30 L35 27 C40 25 46 27 51 30 Z" fill="#8a8e96" />
      <path d="M30 44 H36 M30 48 H36" stroke="#c9a227" stroke-width="1.5" />
    </g>
  ),
  monk: (
    <g>
      <path d="M22 50 Q20 34 26 26 Q30 20 36 22 Q44 22 44 30 L44 44 Q44 52 36 52 L28 52 Q22 52 22 50 Z" fill="#e8c8a0" />
      <path d="M26 26 Q30 20 36 22 M30 24 V34 M36 23 V34 M42 26 V36" stroke="#a8784a" stroke-width="1.5" fill="none" />
      <path d="M22 50 L44 50" stroke="#c07a2a" stroke-width="4" stroke-linecap="round" />
      <path d="M48 18 q4 4 0 8 M52 14 q6 8 0 16" stroke="#f3d27a" stroke-width="1.6" fill="none" stroke-linecap="round" />
    </g>
  ),
  sorcerer: (
    <g>
      <path d="M32 8 C40 20 48 26 46 40 C44 50 38 54 32 54 C26 54 20 50 18 40 C16 28 26 24 28 14 C30 22 34 24 32 8 Z" fill="#e8503a" />
      <path d="M32 24 C36 32 42 36 40 44 C38 50 26 50 24 44 C22 38 28 34 32 24 Z" fill="#f3a03a" />
      <path d="M32 36 C34 40 36 42 35 46 C34 49 30 49 29 46 C28 43 31 40 32 36 Z" fill="#fff4c8" />
    </g>
  ),
  warlock: (
    <g>
      <path d="M12 32 Q32 12 52 32 Q32 52 12 32 Z" fill="#2a1a3a" stroke="#a87ad8" stroke-width="2" />
      <circle cx="32" cy="32" r="9" fill="#7ac04a" />
      <ellipse cx="32" cy="32" rx="2.5" ry="8" fill="#12160c" />
      <path d="M20 16 L24 22 M44 16 L40 22 M32 10 V16" stroke="#a87ad8" stroke-width="2" stroke-linecap="round" />
    </g>
  ),
};

export function ClassEmblem({ classId, size = 44 }: { classId: ClassId; size?: number }) {
  const c = FRAME_COLOURS[classId];
  return (
    <svg class="emblem" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={`emb-${classId}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color={c} stop-opacity="0.95" />
          <stop offset="1" stop-color="#120f0c" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#emb-${classId})`} stroke={c} stroke-width="2" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-opacity="0.12" />
      {ICONS[classId]}
    </svg>
  );
}
