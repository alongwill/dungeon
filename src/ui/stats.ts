import type { GameEvent } from '../engine/model';

export interface QuestStats {
  foes: number;
  crits: number;
  dealt: number;
  taken: number;
  healed: number;
  checksPassed: number;
  checksTotal: number;
  battles: number;
}

/** Tally the events of the most recent quest (everything after the previous questComplete). */
export function questStats(events: GameEvent[]): QuestStats {
  let start = 0;
  const last = events.map((e) => e.type).lastIndexOf('questComplete');
  for (let i = last - 1; i >= 0; i--) if (events[i]!.type === 'questComplete') { start = i + 1; break; }
  const st: QuestStats = { foes: 0, crits: 0, dealt: 0, taken: 0, healed: 0, checksPassed: 0, checksTotal: 0, battles: 0 };
  for (const e of events.slice(start)) {
    if (e.type === 'damage') {
      if (e.target === 'hero' || e.target === 'hero-beast') st.taken += e.amount;
      else { st.dealt += e.amount; if (e.hpLeft === 0 && e.amount > 0) st.foes++; }
    } else if (e.type === 'heal') st.healed += e.amount;
    else if (e.type === 'combatStart') st.battles++;
    else if (e.type === 'roll' && e.actor === 'hero') {
      if (e.outcome === 'crit') st.crits++;
      if (e.purpose === 'check') { st.checksTotal++; if (e.outcome === 'success') st.checksPassed++; }
    }
  }
  return st;
}

/** Fun little honours for the ending screen. */
export function medals(st: QuestStats): { icon: string; name: string }[] {
  const out: { icon: string; name: string }[] = [];
  if (st.battles === 0) out.push({ icon: '☮', name: 'Silver Tongue — no battles fought' });
  if (st.foes >= 6) out.push({ icon: '⚔', name: 'Monster Slayer' });
  if (st.crits >= 2) out.push({ icon: '★', name: 'Lucky Blade' });
  if (st.battles > 0 && st.taken === 0) out.push({ icon: '⛨', name: 'Untouched' });
  if (st.checksTotal >= 3 && st.checksPassed === st.checksTotal) out.push({ icon: '✓', name: 'Flawless Wits' });
  if (st.healed >= 30) out.push({ icon: '✚', name: 'Hard to Kill' });
  return out;
}
