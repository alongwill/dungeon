import { useEffect, useRef } from 'preact/hooks';
import { DieChip, EventCard } from './describe';
import { ActorAvatar } from './actors';
import { nextRealEvent } from './playback';
import type { GameEvent } from '../engine/model';

/** Index after which the "current scene" started (last sceneEnter/combatStart). */
function boundary(queue: GameEvent[], back: number): number {
  for (let i = queue.length - 1; i >= 0; i--) {
    const t = queue[i]!.type;
    if (t === 'sceneEnter' || t === 'combatStart') {
      if (back === 0) return i;
      back--;
    }
  }
  return -1;
}

/** Events to show: everything since the scene before the current one, minus
 *  the boundary markers themselves. Covers end-of-combat/outcome text. */
export function feedEvents(queue: GameEvent[], playback: number): GameEvent[] {
  const cur = boundary(queue, 0);
  const prev = cur <= 0 ? -1 : boundary(queue.slice(0, cur), 0);
  return queue
    .slice(prev + 1, Math.min(playback, queue.length))
    .filter((e) => e.type !== 'sceneEnter' && e.type !== 'combatStart');
}

export function describeEvent(e: GameEvent): { text: string; cls: string } | null {
  switch (e.type) {
    case 'roll': {
      const crit = e.result.nat20 ? ' crit' : e.result.nat1 ? ' fumble' : '';
      return { text: e.label, cls: `roll${crit}` };
    }
    case 'narrate': {
      const cls = /miss|fail/i.test(e.text) ? 'miss' : /hit!|success|defeated|saved/i.test(e.text) ? 'hit' : '';
      return { text: e.text, cls };
    }
    case 'damage': {
      const who = e.target === 'hero' ? 'You take' : e.target === 'hero-beast' ? 'Beast form absorbs' : `${e.target} takes`;
      return { text: `${who} ${e.amount} damage.`, cls: e.amount ? 'damage' : '' };
    }
    case 'heal': return { text: `${e.target === 'hero' ? 'You heal' : `${e.target} heals`} ${e.amount}.`, cls: 'hit' };
    case 'condition': return { text: `${e.target === 'hero' ? 'You are' : `${e.target} is`} ${e.on ? '' : 'no longer '}${e.condition}.`, cls: 'dim' };
    case 'turnStart': return { text: `— ${e.who === 'hero' ? 'Your' : e.who} turn —`, cls: 'divider' };
    case 'combatEnd': return { text: `Combat over: ${e.result}`, cls: 'divider' };
    case 'levelUpAvailable': return { text: 'Level up available!', cls: 'hit' };
    case 'questComplete': return { text: 'Quest complete!', cls: 'hit' };
    case 'death': return { text: 'You fall…', cls: 'miss' };
    case 'error': return { text: e.message, cls: 'miss' };
    default: return null;
  }
}

/** Placeholder shown while an enemy's dice are tumbling (before the result is revealed). */
function RollingCard({ ev }: { ev: Extract<GameEvent, { type: 'roll' }> }) {
  const what = ev.purpose === 'attack' ? ` to hit you${ev.source ? ` with ${ev.source}` : ''}`
    : ev.purpose === 'save' ? ' to resist' : ev.purpose === 'damage' ? ' for damage' : '';
  return (
    <div class="roll-card side-enemy rolling" aria-hidden="true">
      <span class="rc-who"><ActorAvatar actor={ev.actor} size={30} /></span>
      <div class="rc-body">
        <p class="rc-header">{ev.actorName} rolls{what}…</p>
        <p class="rc-line"><span class="tumbling-die"><DieChip sides={ev.result.rolls[0]?.sides ?? 20} value="?" kept /></span></p>
      </div>
    </div>
  );
}

export function EventFeed({ queue, playback }: { queue: GameEvent[]; playback: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = feedEvents(queue, playback);
  const next = playback < queue.length ? nextRealEvent(queue, playback) : null;
  const rolling = next?.type === 'roll' && next.actor !== 'hero' && next.purpose !== 'initiative' ? next : null;
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [items.length, !!rolling]);
  if (!items.length && !rolling) return null;
  return (
    <div class="feed" ref={ref} aria-label="event feed">
      {items.map((e, i) => <EventCard key={i} ev={e} />)}
      {rolling && <RollingCard ev={rolling} />}
    </div>
  );
}
