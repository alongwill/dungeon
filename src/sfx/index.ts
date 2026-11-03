import type { GameEvent } from '../engine/model';

/**
 * Procedural sound effects with the Web Audio API — no audio files, no dependencies.
 * Subscribes to nothing itself: the UI maps revealed engine events through
 * `sfxForEvent` and calls `playSfx`. Silently does nothing without Web Audio.
 */

export type SfxName =
  | 'dice' | 'hit' | 'crit' | 'miss' | 'hurt' | 'spell' | 'heal' | 'enemyDown'
  | 'victory' | 'defeat' | 'levelup' | 'coin' | 'success' | 'failure' | 'battle' | 'click';

const PHYSICAL = /slashing|piercing|bludgeoning/;

/** Pure mapping from an engine event to the sound it should make (null = silent). */
export function sfxForEvent(ev: GameEvent): SfxName | null {
  switch (ev.type) {
    case 'roll':
      if (ev.purpose === 'initiative') return null;
      if (ev.purpose === 'gold') return 'coin';
      if (ev.outcome === 'crit') return 'crit';
      if (ev.outcome === 'miss') return 'miss';
      if (ev.actor === 'hero' && (ev.purpose === 'check' || ev.purpose === 'save'))
        return ev.outcome === 'success' ? 'success' : ev.outcome === 'failure' ? 'failure' : 'dice';
      return ev.actor === 'hero' && ev.purpose === 'attack' ? 'dice' : null;
    case 'damage':
      if (ev.amount <= 0) return null;
      if (ev.target === 'hero' || ev.target === 'hero-beast') return 'hurt';
      if (ev.hpLeft === 0) return 'enemyDown';
      return ev.damageType && !PHYSICAL.test(ev.damageType) ? 'spell' : 'hit';
    case 'heal': return ev.amount > 0 ? 'heal' : null;
    case 'combatStart': return 'battle';
    case 'combatEnd': return ev.result === 'victory' ? 'victory' : ev.result === 'fled' ? 'miss' : 'defeat';
    case 'questComplete': return ev.outcome === 'victory' ? 'victory' : null;
    case 'death': return 'defeat';
    default: return null;
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let noiseBuf: AudioBuffer | null = null;

export function setSfxEnabled(on: boolean): void {
  enabled = on;
  if (!on && ctx?.state === 'running') void ctx.suspend();
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(c: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, peak = 0.3, slideTo?: number): void {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, peak, Math.min(0.02, dur / 4), dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(c: AudioContext, t: number, dur: number, filter: BiquadFilterType, freq: number, peak = 0.3, sweepTo?: number, q = 1): void {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf;
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  env(g, t, peak, 0.005, dur);
  s.connect(f).connect(g).connect(master!);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const NOTE = (n: number) => 440 * 2 ** ((n - 69) / 12);

const SOUNDS: Record<SfxName, (c: AudioContext, t: number) => void> = {
  dice: (c, t) => { for (let i = 0; i < 5; i++) noise(c, t + i * 0.045 + Math.random() * 0.02, 0.03, 'bandpass', 2400 + Math.random() * 1800, 0.35, undefined, 6); },
  hit: (c, t) => { tone(c, t, 140, 0.16, 'sine', 0.5, 45); noise(c, t, 0.08, 'lowpass', 1800, 0.35); },
  crit: (c, t) => {
    SOUNDS.hit(c, t);
    tone(c, t + 0.04, NOTE(84), 0.35, 'triangle', 0.18);
    tone(c, t + 0.1, NOTE(91), 0.45, 'triangle', 0.14);
  },
  miss: (c, t) => noise(c, t, 0.22, 'bandpass', 600, 0.22, 2600, 2),
  hurt: (c, t) => { tone(c, t, 110, 0.22, 'square', 0.14, 50); tone(c, t, 90, 0.2, 'sine', 0.45, 40); noise(c, t, 0.1, 'lowpass', 900, 0.3); },
  spell: (c, t) => { tone(c, t, 300, 0.3, 'sawtooth', 0.08, 1200); tone(c, t, 600, 0.35, 'sine', 0.2, 1800); noise(c, t, 0.3, 'highpass', 3000, 0.08); },
  heal: (c, t) => [72, 76, 79, 84].forEach((n, i) => tone(c, t + i * 0.07, NOTE(n), 0.4, 'sine', 0.16)),
  enemyDown: (c, t) => { SOUNDS.hit(c, t); tone(c, t + 0.05, 320, 0.45, 'sawtooth', 0.08, 70); },
  victory: (c, t) => {
    [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36]].forEach(([n, d]) => tone(c, t + d!, NOTE(n!), 0.25, 'square', 0.08));
    [72, 76, 79].forEach((n) => tone(c, t + 0.5, NOTE(n), 0.9, 'triangle', 0.12));
  },
  defeat: (c, t) => [[64, 0], [63, 0.3], [62, 0.6], [55, 0.9]].forEach(([n, d]) => tone(c, t + d!, NOTE(n!), 0.5, 'triangle', 0.16)),
  levelup: (c, t) => {
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(c, t + i * 0.06, NOTE(n), 0.3, 'triangle', 0.12));
    for (let i = 0; i < 6; i++) tone(c, t + 0.45 + i * 0.05, NOTE(96 + (i % 3) * 3), 0.2, 'sine', 0.06);
  },
  coin: (c, t) => { tone(c, t, NOTE(88), 0.12, 'square', 0.06); tone(c, t + 0.07, NOTE(95), 0.3, 'square', 0.06); },
  success: (c, t) => { tone(c, t, NOTE(72), 0.15, 'triangle', 0.16); tone(c, t + 0.1, NOTE(79), 0.3, 'triangle', 0.16); },
  failure: (c, t) => { tone(c, t, NOTE(62), 0.18, 'triangle', 0.16); tone(c, t + 0.14, NOTE(57), 0.35, 'triangle', 0.16); },
  battle: (c, t) => {
    tone(c, t, 70, 0.4, 'sine', 0.6, 40); noise(c, t, 0.2, 'lowpass', 400, 0.4);
    tone(c, t + 0.18, NOTE(45), 0.7, 'sawtooth', 0.07); tone(c, t + 0.18, NOTE(52), 0.7, 'sawtooth', 0.05);
  },
  click: (c, t) => noise(c, t, 0.02, 'bandpass', 3000, 0.15, undefined, 4),
};

/** Play one sound now (or after `delayMs`). Safe to call anywhere. */
export function playSfx(name: SfxName, delayMs = 0): void {
  const c = audio();
  if (!c) return;
  try { SOUNDS[name](c, c.currentTime + 0.01 + delayMs / 1000); } catch { /* audio is best-effort */ }
}

/** Sounds for a batch of newly revealed events (staggered, capped so a skip isn't a cacophony). */
export function playEvents(events: GameEvent[]): void {
  const names = events.map(sfxForEvent).filter((n): n is SfxName => n !== null);
  names.slice(0, 3).forEach((n, i) => playSfx(n, i * 90));
}
