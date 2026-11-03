import type { GameEvent } from '../engine/model';
import { describeEvent } from './EventFeed';

const isInitiative = (e: GameEvent) => e.type === 'roll' && /^Initiative:/.test(e.label);

/** Events that render nothing or mark a boundary — revealed without a tick. */
const isInstant = (e: GameEvent) =>
  e.type === 'sceneEnter' || e.type === 'combatStart' || describeEvent(e) === null;

/** Hero d20 rolls always wait for a manual Roll click (when manual rolling is on). */
export function isGatedRoll(e: GameEvent): boolean {
  return e.type === 'roll' && e.actor === 'hero' &&
    (e.purpose === 'attack' || e.purpose === 'save' || e.purpose === 'check' || e.purpose === 'initiative');
}

/** Extra gate indices: the first hero roll of an action that has no d20 (spells that
 *  always hit, heals, save-based spells), so every action the player takes starts with a Roll. */
export type Gates = ReadonlySet<number>;
const gated = (q: GameEvent[], i: number, extra?: Gates) => isGatedRoll(q[i]!) || !!extra?.has(i);

/** Index of the first hero roll in a newly dispatched batch that needs an extra gate, if any. */
export function firstUngatedHeroRoll(events: GameEvent[]): number | null {
  const i = events.findIndex((e) => e.type === 'roll' && e.actor === 'hero' && e.purpose !== 'gold');
  return i >= 0 && !isGatedRoll(events[i]!) ? i : null;
}

/** Next playback cursor: reveal instant events for free, then one tick's worth.
 *  Consecutive initiative rolls count as a single tick. */
export function nextPlaybackCursor(queue: GameEvent[], cursor: number, manualRolls = false, extra?: Gates): number {
  const n = queue.length;
  let i = cursor;
  while (i < n && isInstant(queue[i]!)) i++;
  if (i >= n) return n;
  if (manualRolls && gated(queue, i, extra)) return i; // stop BEFORE the gated roll
  if (manualRolls) {
    // initiative rolls all reveal together; stop before a gated roll inside the group
    if (isInitiative(queue[i]!)) {
      while (i < n && isInitiative(queue[i]!) && !gated(queue, i, extra)) i++;
      return i;
    }
  }
  // one tick: the next real event
  if (isInitiative(queue[i]!)) {
    while (i < n && isInitiative(queue[i]!)) i++;
  } else {
    i++;
  }
  // trailing instant events ride along with the tick (but never past a gate)
  while (i < n && isInstant(queue[i]!)) i++;
  return i;
}

/** The next gated roll awaiting a manual reveal, if any. */
export function pendingRoll(queue: GameEvent[], cursor: number, extra?: Gates): GameEvent | null {
  let i = cursor;
  while (i < queue.length && isInstant(queue[i]!)) i++;
  return i < queue.length && gated(queue, i, extra) ? queue[i]! : null;
}

/** The next event playback will reveal (skipping instant ones). */
export function nextRealEvent(queue: GameEvent[], cursor: number): GameEvent | null {
  let i = cursor;
  while (i < queue.length && isInstant(queue[i]!)) i++;
  return queue[i] ?? null;
}

/** How long to wait before revealing the next event. Enemy actions get extra time so
 *  their dice can visibly "roll" and the player can follow whose turn it is. */
export function tickDelay(queue: GameEvent[], cursor: number, baseMs: number): number {
  const next = nextRealEvent(queue, cursor);
  if (!next || baseMs <= 0) return baseMs;
  const prev = queue[cursor - 1];
  const enemyRoll = (e: GameEvent | undefined) => e?.type === 'roll' && e.actor !== 'hero' && e.purpose !== 'initiative';
  if (enemyRoll(next)) return next.type === 'roll' && next.purpose === 'damage' ? Math.max(baseMs * 2, 700) : Math.max(baseMs * 3, 1000);
  if (next.type === 'turnStart') return Math.max(baseMs * 2, 650);
  if (enemyRoll(prev)) return Math.max(baseMs * 2, 700); // let the enemy's result sink in
  return baseMs;
}
