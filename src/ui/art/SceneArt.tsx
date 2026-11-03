import type { JSX } from 'preact';
import type { Backdrop, Scene } from '../../engine/quest/types';

/**
 * Procedural, dependency-free scene illustrations. Every backdrop is a layered SVG
 * (sky → far → mid → near → atmosphere) with a few CSS-animated details (mist, fire,
 * fireflies, stars). Layout is deterministic per backdrop so re-renders never jitter.
 * Animations are pure CSS and switch off with `.still` or prefers-reduced-motion.
 */

const W = 800;
const H = 300;

const mk = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

type P = { x: number; y: number };

function hillPath(seed: number, baseY: number, amp: number, step = 80): string {
  const r = mk(seed);
  const pts: P[] = [];
  for (let x = -step; x <= W + step; x += step) pts.push({ x, y: baseY - r() * amp });
  let d = `M${-step},${H} L${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    d += ` Q${a.x},${a.y} ${(a.x + b.x) / 2},${(a.y + b.y) / 2}`;
  }
  return `${d} L${W + step},${pts[pts.length - 1]!.y} L${W + step},${H} Z`;
}

function Pine({ x, y, h, fill }: { x: number; y: number; h: number; fill: string }) {
  const w = h * 0.36;
  return (
    <g fill={fill}>
      <rect x={x - h * 0.03} y={y - h * 0.12} width={h * 0.06} height={h * 0.14} />
      <path d={`M${x},${y - h} L${x + w * 0.5},${y - h * 0.62} L${x + w * 0.28},${y - h * 0.62} L${x + w * 0.78},${y - h * 0.3}
        L${x + w * 0.45},${y - h * 0.3} L${x + w},${y - h * 0.08} L${x - w},${y - h * 0.08} L${x - w * 0.45},${y - h * 0.3}
        L${x - w * 0.78},${y - h * 0.3} L${x - w * 0.28},${y - h * 0.62} L${x - w * 0.5},${y - h * 0.62} Z`} />
    </g>
  );
}

function PineRow({ seed, y, n, h, fill, jitter = 18 }: { seed: number; y: number; n: number; h: number; fill: string; jitter?: number }) {
  const r = mk(seed);
  return <g>{Array.from({ length: n }, (_, i) => {
    const x = (i + 0.5) * (W / n) + (r() - 0.5) * jitter * 2;
    return <Pine key={i} x={x} y={y + r() * 8} h={h * (0.75 + r() * 0.5)} fill={fill} />;
  })}</g>;
}

function RoundTree({ x, y, s, leaf, trunk }: { x: number; y: number; s: number; leaf: string; trunk: string }) {
  return (
    <g>
      <path d={`M${x - 4 * s},${y} L${x - 2 * s},${y - 34 * s} L${x - 12 * s},${y - 48 * s} M${x - 2 * s},${y - 34 * s} L${x + 3 * s},${y - 52 * s} M${x + 2 * s},${y - 30 * s} L${x + 14 * s},${y - 44 * s}`}
        stroke={trunk} stroke-width={4 * s} fill="none" stroke-linecap="round" />
      <rect x={x - 4 * s} y={y - 34 * s} width={8 * s} height={34 * s} fill={trunk} />
      <g fill={leaf}>
        <circle cx={x} cy={y - 62 * s} r={26 * s} />
        <circle cx={x - 24 * s} cy={y - 50 * s} r={20 * s} />
        <circle cx={x + 24 * s} cy={y - 52 * s} r={21 * s} />
        <circle cx={x - 10 * s} cy={y - 80 * s} r={18 * s} />
        <circle cx={x + 14 * s} cy={y - 78 * s} r={17 * s} />
      </g>
      <g fill="#fff" opacity="0.07">
        <circle cx={x - 8 * s} cy={y - 74 * s} r={12 * s} />
        <circle cx={x - 26 * s} cy={y - 56 * s} r={9 * s} />
      </g>
    </g>
  );
}

function DeadTree({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <path fill="none" stroke={fill} stroke-linecap="round" stroke-width={5 * s}
      d={`M${x},${y} C${x - 2 * s},${y - 30 * s} ${x + 4 * s},${y - 50 * s} ${x},${y - 80 * s}
        M${x},${y - 40 * s} C${x - 14 * s},${y - 50 * s} ${x - 22 * s},${y - 58 * s} ${x - 30 * s},${y - 74 * s}
        M${x + 1 * s},${y - 56 * s} C${x + 12 * s},${y - 62 * s} ${x + 18 * s},${y - 72 * s} ${x + 26 * s},${y - 90 * s}
        M${x - 18 * s},${y - 56 * s} L${x - 26 * s},${y - 54 * s} M${x + 14 * s},${y - 68 * s} L${x + 24 * s},${y - 66 * s}`} />
  );
}

function Reeds({ seed, x0, x1, y, fill }: { seed: number; x0: number; x1: number; y: number; fill: string }) {
  const r = mk(seed);
  const out: JSX.Element[] = [];
  for (let x = x0; x < x1; x += 5 + r() * 7) {
    const h = 20 + r() * 34, bend = (r() - 0.5) * 14;
    out.push(<path key={`r${x}`} d={`M${x},${y} Q${x + bend * 0.3},${y - h * 0.6} ${x + bend},${y - h}`} stroke={fill} stroke-width={1.6} fill="none" />);
    if (r() < 0.22) out.push(<ellipse key={`c${x}`} cx={x + bend * 0.85} cy={y - h + 5} rx={2.2} ry={6} fill="#4a3220" />);
  }
  return <g>{out}</g>;
}

function Stars({ seed, n, maxY }: { seed: number; n: number; maxY: number }) {
  const r = mk(seed);
  return <g fill="#fff">{Array.from({ length: n }, (_, i) => (
    <circle key={i} class="art-twinkle" cx={r() * W} cy={r() * maxY} r={0.5 + r() * 1.2}
      style={{ animationDelay: `${(r() * 4).toFixed(2)}s`, opacity: 0.4 + r() * 0.6 }} />
  ))}</g>;
}

function Mist({ y, colour, opacity = 0.35, n = 5, seed = 1 }: { y: number; colour: string; opacity?: number; n?: number; seed?: number }) {
  const r = mk(seed);
  return (
    <g filter="url(#art-blur)" opacity={opacity}>
      {Array.from({ length: n }, (_, i) => (
        <ellipse key={i} class="art-mist" cx={(i / n) * W + r() * 120} cy={y + (r() - 0.5) * 20}
          rx={140 + r() * 120} ry={14 + r() * 14} fill={colour}
          style={{ animationDuration: `${18 + r() * 20}s`, animationDelay: `${-r() * 20}s` }} />
      ))}
    </g>
  );
}

function Fireflies({ seed, n, y0, y1, colour = '#e6f27a' }: { seed: number; n: number; y0: number; y1: number; colour?: string }) {
  const r = mk(seed);
  return <g>{Array.from({ length: n }, (_, i) => (
    <circle key={i} class="art-firefly" cx={r() * W} cy={y0 + r() * (y1 - y0)} r={1.6 + r()}
      fill={colour} filter="url(#art-glow)"
      style={{ animationDelay: `${(-r() * 6).toFixed(2)}s`, animationDuration: `${4 + r() * 5}s` }} />
  ))}</g>;
}

function Flame({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 10 * s} r={46 * s} fill="url(#art-warm)" class="art-glow" />
      <g class="art-flame" style={{ transformOrigin: `${x}px ${y}px` }}>
        <path d={`M${x},${y} C${x - 10 * s},${y - 4 * s} ${x - 9 * s},${y - 16 * s} ${x - 3 * s},${y - 22 * s} C${x - 2 * s},${y - 14 * s} ${x + 2 * s},${y - 16 * s} ${x},${y - 28 * s} C${x + 9 * s},${y - 18 * s} ${x + 11 * s},${y - 6 * s} ${x},${y} Z`} fill="#ff8a2a" />
        <path d={`M${x},${y} C${x - 5 * s},${y - 3 * s} ${x - 4 * s},${y - 10 * s} ${x},${y - 16 * s} C${x + 4 * s},${y - 10 * s} ${x + 5 * s},${y - 3 * s} ${x},${y} Z`} fill="#ffe27a" />
      </g>
    </g>
  );
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 4},${y} L${x + 4},${y} L${x + 2},${y + 26} L${x - 2},${y + 26} Z`} fill="#3a2614" />
      <rect x={x - 6} y={y - 2} width={12} height={5} rx={1} fill="#57442c" />
      <Flame x={x} y={y - 1} s={0.8} />
    </g>
  );
}

function Sparks({ x, y, n = 8 }: { x: number; y: number; n?: number }) {
  const r = mk(x);
  return <g fill="#ffcf6a">{Array.from({ length: n }, (_, i) => (
    <circle key={i} class="art-spark" cx={x + (r() - 0.5) * 20} cy={y} r={1.2 + r()}
      style={{ animationDelay: `${(-r() * 3).toFixed(2)}s`, animationDuration: `${2 + r() * 2}s` }} />
  ))}</g>;
}

function Smoke({ x, y }: { x: number; y: number }) {
  return <g fill="#d8d0c8" filter="url(#art-blur-s)">{[0, 1, 2].map((i) => (
    <circle key={i} class="art-smoke" cx={x} cy={y} r={6} style={{ animationDelay: `${-i * 1.6}s` }} />
  ))}</g>;
}

function Cottage({ x, y, w, h, roof, wall, lit = true, chimney = false }: {
  x: number; y: number; w: number; h: number; roof: string; wall: string; lit?: boolean; chimney?: boolean;
}) {
  return (
    <g>
      {chimney && <rect x={x + w * 0.62} y={y - h - h * 0.55} width={w * 0.1} height={h * 0.5} fill="#4a3a32" />}
      {chimney && <Smoke x={x + w * 0.67} y={y - h - h * 0.6} />}
      <rect x={x} y={y - h} width={w} height={h} fill={wall} />
      <rect x={x} y={y - h} width={w * 0.12} height={h} fill="#000" opacity="0.12" />
      <path d={`M${x - w * 0.1},${y - h} L${x + w / 2},${y - h - h * 0.75} L${x + w * 1.1},${y - h} Z`} fill={roof} />
      <path d={`M${x + w / 2},${y - h - h * 0.75} L${x + w * 1.1},${y - h} L${x + w * 0.8},${y - h} Z`} fill="#000" opacity="0.18" />
      <rect x={x + w * 0.15} y={y - h * 0.55} width={w * 0.2} height={h * 0.55} fill="#3a2618" />
      <rect x={x + w * 0.55} y={y - h * 0.7} width={w * 0.25} height={h * 0.3} fill={lit ? '#ffcf6a' : '#2a2a30'} class={lit ? 'art-window' : ''} />
      <path d={`M${x + w * 0.675},${y - h * 0.7} v${h * 0.3} M${x + w * 0.55},${y - h * 0.55} h${w * 0.25}`} stroke="#3a2618" stroke-width="1.5" />
      {lit && <circle cx={x + w * 0.675} cy={y - h * 0.55} r={w * 0.4} fill="url(#art-warm)" opacity="0.35" />}
    </g>
  );
}

function Moon({ x, y, r, colour = '#f4ecd0' }: { x: number; y: number; r: number; colour?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 3} fill={colour} opacity="0.06" />
      <circle cx={x} cy={y} r={r * 1.7} fill={colour} opacity="0.08" />
      <circle cx={x} cy={y} r={r} fill={colour} />
      <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.18} fill="#000" opacity="0.06" />
      <circle cx={x + r * 0.35} cy={y + r * 0.3} r={r * 0.12} fill="#000" opacity="0.06" />
    </g>
  );
}

const Sky = ({ id, stops }: { id: string; stops: [number, string][] }) => (
  <>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, c]) => <stop key={o} offset={o} stop-color={c} />)}
    </linearGradient></defs>
    <rect width={W} height={H} fill={`url(#${id})`} />
  </>
);

function Arch({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) {
  return <path d={`M${x},${y} L${x},${y - h + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y - h + w / 2} L${x + w},${y} Z`} fill={fill} />;
}

function Barrel({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <path d={`M${x - 16 * s},${y} Q${x - 21 * s},${y - 22 * s} ${x - 16 * s},${y - 44 * s} L${x + 16 * s},${y - 44 * s} Q${x + 21 * s},${y - 22 * s} ${x + 16 * s},${y} Z`} fill="#6a4426" />
      <path d={`M${x - 18 * s},${y - 10 * s} H${x + 18 * s} M${x - 18 * s},${y - 34 * s} H${x + 18 * s}`} stroke="#2e2218" stroke-width={3 * s} />
      <path d={`M${x - 6 * s},${y} V${y - 44 * s} M${x + 6 * s},${y} V${y - 44 * s}`} stroke="#000" stroke-width={1} opacity="0.2" />
      <path d={`M${x - 16 * s},${y - 44 * s} Q${x - 21 * s},${y - 22 * s} ${x - 16 * s},${y}`} stroke="#fff" stroke-width={2 * s} opacity="0.08" fill="none" />
    </g>
  );
}

function Crystal({ x, y, s, colour }: { x: number; y: number; s: number; colour: string }) {
  return (
    <g class="art-pulse" style={{ animationDelay: `${(x % 7) / 3}s` }}>
      <circle cx={x} cy={y - 14 * s} r={30 * s} fill={colour} opacity="0.12" filter="url(#art-blur-s)" />
      <path d={`M${x},${y - 34 * s} L${x + 7 * s},${y - 12 * s} L${x + 3 * s},${y} L${x - 4 * s},${y} L${x - 7 * s},${y - 14 * s} Z`} fill={colour} opacity="0.9" />
      <path d={`M${x},${y - 34 * s} L${x + 7 * s},${y - 12 * s} L${x + 3 * s},${y} L${x},${y - 14 * s} Z`} fill="#fff" opacity="0.25" />
      <path d={`M${x + 9 * s},${y - 20 * s} L${x + 13 * s},${y - 6 * s} L${x + 10 * s},${y} L${x + 6 * s},${y} L${x + 5 * s},${y - 8 * s} Z`} fill={colour} opacity="0.75" />
    </g>
  );
}

// ---------------------------------------------------------------- backdrops

function Village() {
  return (
    <g>
      <Sky id="art-sky-village" stops={[[0, '#4b4470'], [0.45, '#c9817a'], [0.75, '#f2c38e'], [1, '#f7ddb0']]} />
      <circle cx={620} cy={196} r={38} fill="#fff1c8" opacity="0.85" />
      <circle cx={620} cy={196} r={90} fill="#ffe6a8" opacity="0.18" />
      <g fill="#fff" opacity="0.25">
        <ellipse cx={180} cy={70} rx={70} ry={10} /><ellipse cx={230} cy={62} rx={40} ry={9} />
        <ellipse cx={520} cy={100} rx={60} ry={7} />
      </g>
      <path d={hillPath(3, 200, 40, 120)} fill="#8c7a8c" />
      <path d={hillPath(8, 222, 30, 90)} fill="#6a7356" />
      <PineRow seed={4} y={222} n={14} h={34} fill="#4e5a40" jitter={20} />
      <Cottage x={110} y={238} w={60} h={36} roof="#6a3a2a" wall="#c8b08a" chimney />
      <Cottage x={210} y={232} w={48} h={30} roof="#5a3a32" wall="#b8a07a" />
      <Cottage x={300} y={240} w={70} h={40} roof="#7a4a2e" wall="#d0b890" chimney />
      <Cottage x={470} y={236} w={52} h={32} roof="#5e3628" wall="#c0a882" />
      <g>
        <rect x={392} y={206} width={22} height={34} fill="#7a6a5a" />
        <path d="M388,206 L403,190 L418,206 Z" fill="#5a3a2a" />
        <circle cx={403} cy={216} r={5} fill="none" stroke="#c8c0b0" stroke-width="1.5" opacity="0.6" />
      </g>
      <path d={hillPath(12, 262, 14, 140)} fill="#3f4a30" />
      <RoundTree x={680} y={275} s={1.25} leaf="#3d4a2c" trunk="#3a2a1c" />
      <Mist y={250} colour="#e8e0f0" opacity={0.45} n={6} seed={2} />
      <g fill="#2e3622">
        <path d="M0,300 L0,272 Q120,262 260,276 T540,272 T800,268 L800,300 Z" />
      </g>
    </g>
  );
}

function Road() {
  return (
    <g>
      <Sky id="art-sky-road" stops={[[0, '#6b8fb0'], [0.6, '#c8d4c8'], [1, '#efe0b8']]} />
      <g fill="#fff" opacity="0.7">
        <ellipse cx={150} cy={60} rx={60} ry={14} /><ellipse cx={190} cy={52} rx={40} ry={16} /><ellipse cx={115} cy={66} rx={30} ry={10} />
        <ellipse cx={560} cy={84} rx={70} ry={12} /><ellipse cx={600} cy={76} rx={36} ry={14} />
      </g>
      <path d={hillPath(21, 190, 36, 130)} fill="#8aa08a" />
      <path d={hillPath(22, 214, 26, 100)} fill="#6a8a58" />
      <PineRow seed={23} y={214} n={9} h={30} fill="#4a6640" jitter={40} />
      <path d={hillPath(24, 240, 16, 160)} fill="#55743f" />
      <path d="M380,210 C400,230 330,250 300,300 L520,300 C460,252 420,232 400,210 Z" fill="#c8b088" />
      <path d="M392,212 C405,232 370,256 360,300" stroke="#a89068" stroke-width="2" fill="none" opacity="0.6" />
      <g stroke="#5a4028" stroke-width="3">
        {[560, 600, 640, 680, 720, 760].map((x, i) => <line key={x} x1={x} y1={254 + i * 4} x2={x} y2={232 + i * 4} />)}
        <path d="M560,240 L760,260 M560,248 L760,268" stroke-width="2" />
      </g>
      <g>
        <rect x={250} y={226} width={5} height={40} fill="#5a4028" />
        <path d="M232,230 L272,232 L278,238 L272,244 L232,242 Z" fill="#8a6a44" />
      </g>
      <RoundTree x={90} y={280} s={1.1} leaf="#3e5a30" trunk="#3a2a1c" />
      <path d="M0,300 L0,278 Q200,268 300,290 L300,300 Z M520,300 Q620,272 800,276 L800,300 Z" fill="#3f5a2e" />
    </g>
  );
}

function Marsh() {
  return (
    <g>
      <Sky id="art-sky-marsh" stops={[[0, '#2e3a3c'], [0.5, '#6a7a72'], [1, '#a4aea0']]} />
      <circle cx={210} cy={110} r={26} fill="#e8e8d0" opacity="0.35" />
      <path d={hillPath(31, 190, 22, 140)} fill="#4e5c56" />
      <PineRow seed={32} y={196} n={18} h={24} fill="#3e4a46" jitter={14} />
      <Mist y={196} colour="#c8d0c4" opacity={0.5} n={6} seed={33} />
      <defs><linearGradient id="art-water-marsh" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6a7a70" /><stop offset="1" stop-color="#2e3a36" />
      </linearGradient></defs>
      <rect y={206} width={W} height={94} fill="url(#art-water-marsh)" />
      <g stroke="#c8d0c4" opacity="0.25" stroke-width="1.5">
        <line x1={60} y1={222} x2={160} y2={222} /><line x1={420} y1={232} x2={560} y2={232} />
        <line x1={250} y1={250} x2={330} y2={250} /><line x1={620} y1={262} x2={740} y2={262} />
      </g>
      <DeadTree x={130} y={232} s={1.3} fill="#232c28" />
      <DeadTree x={610} y={226} s={1.0} fill="#2a3430" />
      <g opacity="0.25" transform="translate(0,464) scale(1,-1)"><DeadTree x={130} y={232} s={1.3} fill="#232c28" /></g>
      <path d="M0,300 L0,250 Q60,238 140,250 Q200,262 240,300 Z" fill="#2e3826" />
      <path d="M560,300 Q620,248 700,252 Q760,254 800,246 L800,300 Z" fill="#2e3826" />
      <Reeds seed={34} x0={0} x1={230} y={262} fill="#5a6a3a" />
      <Reeds seed={35} x0={580} x1={800} y={264} fill="#5a6a3a" />
      <Mist y={240} colour="#d8e0d4" opacity={0.42} n={7} seed={36} />
      <Fireflies seed={37} n={14} y0={150} y1={270} />
    </g>
  );
}

function Forest() {
  return (
    <g>
      <Sky id="art-sky-forest" stops={[[0, '#0c1424'], [0.6, '#1e3040'], [1, '#2e4448']]} />
      <Stars seed={41} n={50} maxY={130} />
      <Moon x={600} y={70} r={22} />
      <g opacity="0.07" fill="#e8f0ff">
        <path d="M600,70 L470,300 L560,300 Z" /><path d="M600,70 L640,300 L700,300 Z" />
      </g>
      <PineRow seed={42} y={210} n={22} h={90} fill="#1a2a30" jitter={16} />
      <PineRow seed={43} y={246} n={14} h={130} fill="#122024" jitter={24} />
      <path d={hillPath(44, 262, 12, 120)} fill="#0e1a16" />
      <Mist y={250} colour="#8aa0b0" opacity={0.25} n={5} seed={45} />
      <PineRow seed={46} y={310} n={6} h={220} fill="#080f0e" jitter={50} />
      <Fireflies seed={47} n={20} y0={140} y1={280} />
    </g>
  );
}

function Ruins() {
  return (
    <g>
      <Sky id="art-sky-ruins" stops={[[0, '#40465a'], [0.55, '#7e8490'], [1, '#b0b2a8']]} />
      <g fill="#d8dce0" opacity="0.25">
        <ellipse cx={200} cy={60} rx={160} ry={18} /><ellipse cx={560} cy={44} rx={190} ry={16} /><ellipse cx={420} cy={96} rx={120} ry={10} />
      </g>
      <path d={hillPath(51, 210, 18, 160)} fill="#5c6460" />
      <g>
        <path d="M300,240 L300,120 L360,70 L420,120 L420,240 Z" fill="#6e6a62" />
        <path d="M360,70 L420,120 L420,240 L388,240 L388,126 Z" fill="#000" opacity="0.15" />
        <Arch x={340} y={200} w={40} h={80} fill="#2a2a30" />
        <Arch x={344} y={198} w={32} h={72} fill="url(#art-cold)" />
        <path d="M360,126 V198 M344,160 H376" stroke="#3a3a3e" stroke-width="3" />
        <path d="M420,240 L420,150 L470,150 L470,172 L480,172 L480,200 L500,206 L500,240 Z" fill="#625e56" />
        <path d="M440,170 h14 v22 h-14 z" fill="#2a2a30" />
        <path d="M250,240 L250,176 L262,168 L272,178 L280,172 L282,240 Z" fill="#5a564e" />
        <path d="M352,58 h16 M360,48 v24" stroke="#5a564e" stroke-width="5" />
        <g fill="#3e5a30" opacity="0.85">
          <path d="M300,170 q-6,20 4,40 q-10,10 -2,30 h-4 q-8,-24 2,-70 z" />
          <path d="M420,130 q8,14 -2,30 q10,8 0,26 h3 q12,-20 2,-56 z" />
        </g>
      </g>
      <defs><linearGradient id="art-water-ruins" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7a8484" /><stop offset="1" stop-color="#3a4444" />
      </linearGradient></defs>
      <rect y={236} width={W} height={64} fill="url(#art-water-ruins)" />
      <g opacity="0.22" transform="translate(0,476) scale(1,-1)">
        <path d="M300,240 L300,120 L360,70 L420,120 L420,240 Z" fill="#6e6a62" />
      </g>
      <g stroke="#e0e4e0" opacity="0.25" stroke-width="1.5">
        <line x1={100} y1={252} x2={220} y2={252} /><line x1={460} y1={262} x2={620} y2={262} /><line x1={280} y1={280} x2={380} y2={280} />
      </g>
      <Reeds seed={52} x0={0} x1={180} y={262} fill="#4e5e3a" />
      <Reeds seed={53} x0={620} x1={800} y={262} fill="#4e5e3a" />
      <g fill="#1a1a1a">
        <path d="M150,90 l8,-4 l8,4 l-8,-1 z" /><path d="M180,104 l6,-3 l6,3 l-6,-1 z" /><path d="M640,80 l7,-4 l7,4 l-7,-1 z" />
      </g>
      <Mist y={244} colour="#d0d8d8" opacity={0.4} n={6} seed={54} />
    </g>
  );
}

function Crypt() {
  return (
    <g>
      <rect width={W} height={H} fill="#141614" />
      <defs>
        <pattern id="art-bricks-crypt" width="40" height="20" patternUnits="userSpaceOnUse">
          <rect width="40" height="20" fill="#2a2c28" />
          <path d="M0,0 H40 M0,10 H40 M10,0 V10 M30,10 V20" stroke="#1a1c1a" stroke-width="1.5" />
        </pattern>
      </defs>
      <rect width={W} height={240} fill="url(#art-bricks-crypt)" />
      <circle cx={400} cy={170} r={220} fill="url(#art-eerie)" />
      {[60, 240, 420, 600].map((x) => (
        <g key={x}>
          <Arch x={x + 30} y={240} w={110} h={170} fill="#0c0e0c" />
          <Arch x={x + 44} y={240} w={82} h={150} fill="#080a08" />
        </g>
      ))}
      {[40, 220, 400, 580, 760].map((x) => (
        <g key={x}>
          <rect x={x - 14} y={40} width={28} height={200} fill="#3a3c36" />
          <rect x={x - 14} y={40} width={8} height={200} fill="#fff" opacity="0.05" />
          <rect x={x - 20} y={32} width={40} height={12} fill="#4a4c44" />
          <rect x={x - 20} y={232} width={40} height={10} fill="#4a4c44" />
        </g>
      ))}
      <rect y={0} width={W} height={34} fill="#22241f" />
      <defs><linearGradient id="art-floor-crypt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2e302a" /><stop offset="1" stop-color="#121410" />
      </linearGradient></defs>
      <rect y={240} width={W} height={60} fill="url(#art-floor-crypt)" />
      <g>
        <path d="M320,262 L480,262 L470,236 L330,236 Z" fill="#4a4a44" />
        <rect x={326} y={262} width={148} height={20} fill="#3a3a34" />
        <path d="M340,236 L460,236 L452,226 L348,226 Z" fill="#5a5a52" />
        <path d="M380,232 h40" stroke="#2a2a26" stroke-width="2" />
      </g>
      <g fill="#d8d4c8" opacity="0.7">
        <ellipse cx={180} cy={282} rx={12} ry={3} /><circle cx={196} cy={278} r={5} />
        <ellipse cx={620} cy={286} rx={14} ry={3} transform="rotate(12 620 286)" /><circle cx={600} cy={280} r={5} />
      </g>
      {[300, 500].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={214} width={6} height={14} fill="#e8e0c8" />
          <Flame x={x} y={214} s={0.45} />
        </g>
      ))}
      <Mist y={276} colour="#8ac08a" opacity={0.18} n={5} seed={61} />
      <Fireflies seed={62} n={8} y0={80} y1={230} colour="#9ae08a" />
    </g>
  );
}

function Camp() {
  return (
    <g>
      <Sky id="art-sky-camp" stops={[[0, '#120e22'], [0.6, '#2e2236'], [1, '#4a3238']]} />
      <Stars seed={71} n={60} maxY={150} />
      <Moon x={140} y={60} r={14} colour="#f0e0c0" />
      <PineRow seed={72} y={200} n={20} h={70} fill="#1a1620" jitter={18} />
      <g fill="#3a2a22">
        {Array.from({ length: 34 }, (_, i) => {
          const x = i * 24 + 4, h = 34 + ((i * 37) % 13);
          return <path key={i} d={`M${x},222 L${x},${222 - h} L${x + 7},${222 - h - 10} L${x + 14},${222 - h} L${x + 14},222 Z`} />;
        })}
      </g>
      <rect y={214} width={W} height={4} fill="#2a1e18" />
      <rect y={220} width={W} height={80} fill="#2a2220" />
      <g>
        <path d="M120,262 L190,180 L260,262 Z" fill="#6a5434" />
        <path d="M190,180 L260,262 L214,262 Z" fill="#000" opacity="0.25" />
        <path d="M176,262 L190,226 L204,262 Z" fill="#1a120c" />
        <rect x={150} y={226} width={16} height={12} fill="#7a3a2a" transform="rotate(-8 158 232)" />
        <path d="M560,266 L640,170 L720,266 Z" fill="#5a4a30" />
        <path d="M640,170 L720,266 L670,266 Z" fill="#000" opacity="0.25" />
        <path d="M624,266 L640,222 L656,266 Z" fill="#1a120c" />
        <path d="M640,170 L636,150 M640,170 L648,152" stroke="#3a2a1c" stroke-width="3" />
        <path d="M642,152 l14,4 l-14,6 z" fill="#8a2a22" />
      </g>
      <circle cx={400} cy={250} r={190} fill="url(#art-warm)" opacity="0.6" class="art-glow" />
      <g>
        <path d="M370,272 L430,262 M372,262 L428,274" stroke="#3a2416" stroke-width="7" stroke-linecap="round" />
        <g fill="#5a5a58">
          {[-34, -22, -8, 8, 22, 34].map((dx) => <ellipse key={dx} cx={400 + dx} cy={276 - Math.abs(dx) * 0.05} rx={8} ry={5} />)}
        </g>
        <Flame x={400} y={268} s={1.6} />
        <Sparks x={400} y={232} n={12} />
      </g>
      <Smoke x={400} y={200} />
      <path d="M0,300 L0,284 Q200,276 400,288 T800,282 L800,300 Z" fill="#1a1412" />
    </g>
  );
}

function Cave() {
  return (
    <g>
      <rect width={W} height={H} fill="#100e14" />
      <circle cx={400} cy={160} r={240} fill="#2a2440" opacity="0.6" />
      <path d={`M0,0 H${W} V40 Q700,60 640,30 Q580,80 520,40 Q470,70 420,36 Q360,72 300,34 Q240,64 180,30 Q120,70 60,40 Q30,60 0,50 Z`} fill="#1e1a24" />
      <g fill="#262030">
        {[40, 110, 190, 260, 350, 450, 520, 610, 700, 770].map((x, i) => (
          <path key={x} d={`M${x - 12},30 L${x},${70 + (i * 23) % 50} L${x + 12},30 Z`} />
        ))}
      </g>
      <path d="M0,0 L0,300 L120,300 Q90,220 130,160 Q90,100 140,40 Q80,30 60,0 Z" fill="#1a1620" />
      <path d={`M${W},0 L${W},300 L680,300 Q720,220 670,160 Q720,90 660,40 Q730,30 740,0 Z`} fill="#1a1620" />
      <path d="M100,300 Q300,250 400,262 Q520,250 700,300 Z" fill="#221c2a" />
      <ellipse cx={420} cy={276} rx={120} ry={12} fill="#3a5a7a" opacity="0.45" />
      <ellipse cx={420} cy={276} rx={90} ry={6} fill="#8ac0e0" opacity="0.15" />
      <Crystal x={160} y={250} s={1.4} colour="#8a6ae0" />
      <Crystal x={630} y={256} s={1.2} colour="#5ac0e0" />
      <Crystal x={560} y={270} s={0.7} colour="#8a6ae0" />
      <Crystal x={250} y={272} s={0.8} colour="#5ac0e0" />
      <g fill="#c88ae0" opacity="0.8">
        <ellipse cx={330} cy={268} rx={9} ry={4} /><rect x={329} y={268} width={2} height={7} />
        <ellipse cx={346} cy={272} rx={6} ry={3} /><rect x={345} y={272} width={2} height={5} />
      </g>
      <Fireflies seed={81} n={10} y0={90} y1={250} colour="#b8a0ff" />
    </g>
  );
}

function Inn() {
  return (
    <g>
      <rect width={W} height={H} fill="#3a2416" />
      <g stroke="#2a180c" stroke-width="2">
        {Array.from({ length: 21 }, (_, i) => <line key={i} x1={i * 40} y1={0} x2={i * 40} y2={230} />)}
      </g>
      <rect y={0} width={W} height={26} fill="#24140a" />
      {[120, 400, 680].map((x) => <rect key={x} x={x - 10} y={0} width={20} height={230} fill="#2a180c" />)}
      <rect y={226} width={W} height={74} fill="#4a2e1a" />
      <g stroke="#2e1c0e" stroke-width="1.5">
        {[244, 264, 286].map((y) => <line key={y} x1={0} y1={y} x2={W} y2={y} />)}
      </g>
      <g>
        <rect x={520} y={60} width={70} height={84} fill="#1a2a4a" />
        <circle cx={570} cy={80} r={8} fill="#e8e0c0" opacity="0.8" />
        <path d="M555,60 V144 M520,102 H590" stroke="#2a180c" stroke-width="5" />
        <rect x={514} y={56} width={82} height={92} fill="none" stroke="#24140a" stroke-width="7" />
      </g>
      <g>
        <path d="M190,230 L190,100 L330,100 L330,230 Z" fill="#5a5048" />
        <path d="M206,230 L206,160 A54,40 0 0 1 314,160 L314,230 Z" fill="#140a06" />
        <rect x={180} y={92} width={160} height={14} fill="#3a2a1c" />
        <Flame x={242} y={226} s={1.3} />
        <Flame x={274} y={228} s={1.0} />
        <Sparks x={258} y={196} n={6} />
        <circle cx={260} cy={200} r={160} fill="url(#art-warm)" opacity="0.5" class="art-glow" />
      </g>
      <Barrel x={60} y={270} s={1.3} />
      <Barrel x={110} y={276} s={1.1} />
      <g>
        <rect x={420} y={236} width={200} height={10} fill="#5a3a20" />
        <rect x={436} y={246} width={8} height={40} fill="#3a2414" />
        <rect x={596} y={246} width={8} height={40} fill="#3a2414" />
        <g fill="#a08060"><rect x={470} y={218} width={16} height={18} rx={2} /><rect x={540} y={220} width={14} height={16} rx={2} /></g>
        <g fill="#f0e8d0"><ellipse cx={478} cy={218} rx={8} ry={3} /><ellipse cx={547} cy={220} rx={7} ry={3} /></g>
        <ellipse cx={510} cy={234} rx={14} ry={3} fill="#c8c0b0" />
      </g>
      {[120, 680].map((x) => (
        <g key={x}>
          <line x1={x} y1={26} x2={x} y2={64} stroke="#1a0e06" stroke-width="2" />
          <rect x={x - 8} y={64} width={16} height={20} rx={3} fill="#2a1a0c" />
          <rect x={x - 5} y={67} width={10} height={14} fill="#ffcf6a" class="art-window" />
          <circle cx={x} cy={74} r={70} fill="url(#art-warm)" opacity="0.45" />
        </g>
      ))}
    </g>
  );
}

function Cellar() {
  return (
    <g>
      <defs>
        <pattern id="art-bricks-cellar" width="48" height="24" patternUnits="userSpaceOnUse">
          <rect width="48" height="24" fill="#3e2e24" />
          <path d="M0,0 H48 M0,12 H48 M12,0 V12 M36,12 V24" stroke="#24180f" stroke-width="2" />
          <rect x="14" y="2" width="20" height="8" fill="#fff" opacity="0.03" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#art-bricks-cellar)" />
      <rect y={236} width={W} height={64} fill="#24180f" />
      <g fill="#2e2016">
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={0} y={110 + i * 22} width={150 - i * 20} height={22} />
        ))}
      </g>
      <g stroke="#1a100a" stroke-width="2">
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={0} y1={110 + i * 22} x2={150 - i * 20} y2={110 + i * 22} />)}
      </g>
      <circle cx={430} cy={130} r={240} fill="url(#art-warm)" opacity="0.4" class="art-glow" />
      <g>
        <line x1={430} y1={0} x2={430} y2={92} stroke="#1a100a" stroke-width="2" />
        <rect x={420} y={92} width={20} height={26} rx={3} fill="#2a1a0c" />
        <rect x={424} y={96} width={12} height={18} fill="#ffcf6a" class="art-window" />
      </g>
      <Barrel x={560} y={282} s={1.5} />
      <Barrel x={630} y={286} s={1.3} />
      <Barrel x={596} y={218} s={1.2} />
      <g>
        <rect x={680} y={226} width={70} height={60} fill="#5a3e22" />
        <path d="M680,226 L750,286 M750,226 L680,286" stroke="#3a2614" stroke-width="5" />
        <rect x={680} y={226} width={70} height={60} fill="none" stroke="#3a2614" stroke-width="5" />
      </g>
      <g stroke="#c8c0b0" stroke-width="0.8" opacity="0.35" fill="none">
        <path d="M800,0 L720,0 Q760,40 800,70 Z M800,0 L740,30 M800,0 L770,50 M745,12 Q770,20 790,40" />
        <path d="M150,0 L210,0 Q180,30 150,48 M150,0 L190,22" />
      </g>
      {[[260, 268], [300, 274], [700, 296]].map(([x, y]) => (
        <g key={x} class="art-blink" style={{ animationDelay: `${x! / 100}s` }}>
          <circle cx={x} cy={y} r={2} fill="#f04a3a" /><circle cx={x! + 7} cy={y} r={2} fill="#f04a3a" />
        </g>
      ))}
      <Mist y={290} colour="#8a7a6a" opacity={0.2} n={4} seed={101} />
    </g>
  );
}

function Throne() {
  return (
    <g>
      <rect width={W} height={H} fill="#22201a" />
      <g fill="#2e2a20">
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={i * 100} y={0} width={60} height={240} />)}
      </g>
      <g stroke="#1a1610" stroke-width="3">
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1={0} y1={i * 22} x2={W} y2={i * 22} opacity="0.4" />)}
      </g>
      <circle cx={400} cy={150} r={260} fill="url(#art-warm)" opacity="0.3" />
      {[200, 600].map((x, i) => (
        <g key={x}>
          <rect x={x - 30} y={20} width={60} height={4} fill="#3a2a1a" />
          <path d={`M${x - 26},24 L${x + 26},24 L${x + 26},140 L${x + 12},128 L${x},146 L${x - 12},126 L${x - 26},138 Z`} fill={i ? '#6a2a22' : '#3a5a2a'} />
          <circle cx={x} cy={70} r={12} fill="none" stroke="#c9a227" stroke-width="3" opacity="0.7" />
        </g>
      ))}
      <Torch x={110} y={130} />
      <Torch x={690} y={130} />
      <rect y={236} width={W} height={64} fill="#3a3024" />
      <path d="M260,250 L540,250 L560,276 L240,276 Z" fill="#4a3e2e" />
      <path d="M290,236 L510,236 L540,250 L260,250 Z" fill="#5a4a36" />
      <g>
        <path d="M350,236 L350,120 Q350,100 370,96 L430,96 Q450,100 450,120 L450,236 Z" fill="#3a2a1a" />
        <path d="M340,236 L340,170 L460,170 L460,236 Z" fill="#4a3622" />
        <path d="M356,102 L344,70 L360,88 L366,60 L376,92 M444,102 L456,70 L440,88 L434,60 L424,92" stroke="#c8b898" stroke-width="5" fill="none" stroke-linecap="round" />
        <rect x={360} y={176} width={80} height={14} fill="#6a2a22" />
      </g>
      <g>
        {[[250, 236], [270, 240], [530, 238], [548, 242], [262, 230]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={6} fill="#c9a227" />
        ))}
        {[[256, 228], [540, 232]].map(([x, y], i) => (
          <path key={i} class="art-twinkle" d={`M${x},${y! - 6} L${x! + 1.5},${y! - 1.5} L${x! + 6},${y} L${x! + 1.5},${y! + 1.5} L${x},${y! + 6} L${x! - 1.5},${y! + 1.5} L${x! - 6},${y} L${x! - 1.5},${y! - 1.5} Z`} fill="#fff8d0" />
        ))}
      </g>
      <Mist y={286} colour="#6a5a40" opacity={0.25} n={4} seed={111} />
    </g>
  );
}

const BACKDROP_VIEWS: Record<Backdrop, () => JSX.Element> = {
  village: Village, road: Road, marsh: Marsh, forest: Forest, ruins: Ruins, crypt: Crypt,
  camp: Camp, cave: Cave, inn: Inn, cellar: Cellar, throne: Throne,
};

const RULES: [Backdrop, RegExp][] = [
  ['throne', /throne|court|mire king|\bking'?s\b/],
  ['crypt', /crypt|tomb|catacomb|ossuary|sarcophag|skeleton/],
  ['cellar', /cellar|basement/],
  ['inn', /\binn\b|tavern|tankard|alehouse/],
  ['camp', /\bcamp|tents?\b|campfire|lookout|bridge guard/],
  ['cave', /\bcaves?\b|cavern|grotto|burrow|\blair\b|\bmine\b|tunnel/],
  ['ruins', /chapel|ruin|shrine|altar|temple|tower|moon-ward|carving/],
  ['marsh', /marsh|\bbog\b|swamp|reed|\bmire\b|causeway|hummock|\bfen\b|lurker/],
  ['forest', /forest|\bwoods?\b|grove|glade|thicket|gloom/],
  ['village', /village|\bgreen\b|well\b|smith|stall|elder|shop|market|square|hollowmere/],
];

/** Pick a backdrop: explicit field, then keywords in id/title, then in text. */
export function inferBackdrop(scene: Pick<Scene, 'title' | 'text' | 'backdrop'>, sceneId = ''): Backdrop {
  if (scene.backdrop) return scene.backdrop;
  const head = `${sceneId} ${scene.title}`.toLowerCase();
  const body = scene.text.toLowerCase();
  for (const src of [head, body]) for (const [b, re] of RULES) if (re.test(src)) return b;
  return 'road';
}

export function SceneArt({ backdrop, still = false, class: cls = '' }: { backdrop: Backdrop; still?: boolean; class?: string }) {
  const View = BACKDROP_VIEWS[backdrop] ?? Road;
  return (
    <div class={`scene-art ${still ? 'still' : ''} ${cls}`} aria-hidden="true" data-backdrop={backdrop}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <defs>
          <filter id="art-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
          <filter id="art-blur-s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
          <filter id="art-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="art-warm"><stop offset="0" stop-color="#ffb04a" stop-opacity="0.55" /><stop offset="1" stop-color="#ff7a2a" stop-opacity="0" /></radialGradient>
          <radialGradient id="art-eerie"><stop offset="0" stop-color="#6ae08a" stop-opacity="0.22" /><stop offset="1" stop-color="#2a6a3a" stop-opacity="0" /></radialGradient>
          <linearGradient id="art-cold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8d8f0" stop-opacity="0.5" /><stop offset="1" stop-color="#4a5a7a" stop-opacity="0.2" /></linearGradient>
          <radialGradient id="art-vignette" cx="50%" cy="45%" r="75%"><stop offset="0.55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity="0.65" /></radialGradient>
        </defs>
        <View />
        <rect width={W} height={H} fill="url(#art-vignette)" />
      </svg>
    </div>
  );
}
