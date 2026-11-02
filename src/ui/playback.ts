import type { GameEvent } from '../engine/model';
import { describeEvent } from './EventFeed';

const isInitiative = (e: GameEvent) => e.type === 'roll' && /^Initiative:/.test(e.label);

/** Events that render nothing or mark a boundary — revealed without a tick. */
const isInstant = (e: GameEvent) =>
  e.type === 'sceneEnter' || e.type === 'combatStart' || describeEvent(e) === null;

/** Next playback cursor: reveal instant events for free, then one tick's worth.
 *  Consecutive initiative rolls count as a single tick. */
export function isGatedRoll(e: GameEvent): boolean {
  return e.type === 'roll' && e.actor === 'hero' &&
    (e.purpose === 'attack' || e.purpose === 'save' || e.purpose === 'check' || e.purpose === 'initiative');
}

export function nextPlaybackCursor(queue: GameEvent[], cursor: number, manualRolls = false): number {
  const n = queue.length;
  let i = cursor;
  while (i < n && isInstant(queue[i]!)) i++;
  if (i >= n) return n;
  if (manualRolls && isGatedRoll(queue[i]!)) return i; // stop BEFORE the gated roll
  if (manualRolls) {
    // initiative rolls all reveal together; stop before a gated roll inside the group
    if (isInitiative(queue[i]!)) {
      while (i < n && isInitiative(queue[i]!) && !(manualRolls && isGatedRoll(queue[i]!))) i++;
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
export function pendingRoll(queue: GameEvent[], cursor: number): GameEvent | null {
  let i = cursor;
  while (i < queue.length && isInstant(queue[i]!)) i++;
  return i < queue.length && isGatedRoll(queue[i]!) ? queue[i]! : null;
}
