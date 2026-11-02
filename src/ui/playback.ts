import type { GameEvent } from '../engine/model';
import { describeEvent } from './EventFeed';

const isInitiative = (e: GameEvent) => e.type === 'roll' && /^Initiative:/.test(e.label);

/** Events that render nothing or mark a boundary — revealed without a tick. */
const isInstant = (e: GameEvent) =>
  e.type === 'sceneEnter' || e.type === 'combatStart' || describeEvent(e) === null;

/** Next playback cursor: reveal instant events for free, then one tick's worth.
 *  Consecutive initiative rolls count as a single tick. */
export function nextPlaybackCursor(queue: GameEvent[], cursor: number): number {
  const n = queue.length;
  let i = cursor;
  while (i < n && isInstant(queue[i]!)) i++;
  if (i >= n) return n;
  // one tick: the next real event
  if (isInitiative(queue[i]!)) {
    while (i < n && isInitiative(queue[i]!)) i++;
  } else {
    i++;
  }
  // trailing instant events ride along with the tick
  while (i < n && isInstant(queue[i]!)) i++;
  return i;
}
