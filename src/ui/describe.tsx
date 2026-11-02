import type { GameEvent } from '../engine/model';
import { keptSum } from '../engine/rolls';
import { AbilityLabel } from './abilityInfo';
import type { AbilityId } from '../engine/quest/types';
import type { JSX } from 'preact';

/** Real die silhouettes: d4 triangle, d6 rounded square, d8 diamond,
 *  d10 kite, d12 pentagon, d20 hexagon w/ facet lines. */
function DieShape({ sides }: { sides: number }): JSX.Element {
  const common = { width: 34, height: 34, viewBox: '0 0 34 34', 'aria-hidden': true,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 } as const;
  const face = { fill: 'var(--panel, #14161b)', stroke: 'none' } as const;
  switch (sides) {
    case 4:  return <svg {...common}><polygon points="17,1 33,32 1,32"/><circle cx="17" cy="22" r="8.5" {...face}/></svg>;
    case 6:  return <svg {...common}><rect x="2" y="2" width="30" height="30" rx="5"/><rect x="6" y="6" width="22" height="22" rx="3" {...face}/></svg>;
    case 8:  return <svg {...common}><polygon points="17,1 33,17 17,33 1,17"/><polyline points="17,1 17,33"/><circle cx="17" cy="17" r="10" {...face}/></svg>;
    case 10: return <svg {...common}><polygon points="17,1 31,15 17,33 3,15"/><polyline points="3,15 31,15"/><circle cx="17" cy="17" r="10" {...face}/></svg>;
    case 12: return <svg {...common}><polygon points="17,1 33,12.5 27,32 7,32 1,12.5"/><circle cx="17" cy="18" r="10.5" {...face}/></svg>;
    case 20: return <svg {...common}><polygon points="17,1 32,9 32,25 17,33 2,25 2,9"/><polyline points="2,9 17,17 32,9"/><polyline points="17,17 17,33"/><polyline points="2,25 17,17 32,25"/><circle cx="17" cy="17" r="10.5" {...face}/></svg>;
    default: return <svg {...common}><circle cx="17" cy="17" r="15"/><circle cx="17" cy="17" r="10.5" {...face}/></svg>;
  }
}

/** One die chip: silhouette + large value + caption. */
export function DieChip({ sides, value, kept, note, nat }: {
  sides: number; value: number; kept: boolean; note?: string; nat?: 'nat20' | 'nat1';
}) {
  return (
    <span class={`die-chip d${sides} ${kept ? '' : 'dropped'} ${nat ?? ''}`}
      title={note ?? (kept ? undefined : 'dropped die')}>
      <span class="die-svg"><DieShape sides={sides} /><b>{value}</b></span>
      <i>d{sides}</i>
    </span>
  );
}

const VS_NAMES = { armour: 'armour', difficulty: 'difficulty' };

const ABILITY_IDS = new Set(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
const nameToId = (name: string): AbilityId | null => {
  const map: Record<string, AbilityId> = {
    Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON',
    Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA',
  };
  return map[name] ?? null;
};

/** Icon-bearing source label for save/check cards (uses the leading ability word). */
function SourceLabel({ source }: { source: string }): JSX.Element {
  const first = source.split(' ')[0]!;
  const id = ABILITY_IDS.has(first) ? first as AbilityId : nameToId(first);
  if (id) return <AbilityLabel id={id} />;
  return <>{source}</>;
}

export function RollCard({ ev }: { ev: Extract<GameEvent, { type: 'roll' }> }) {
  const dice = ev.result.rolls;
  const parts = ev.parts ?? [];
  const total = ev.finalTotal ?? keptSum(ev.result) + parts.reduce((a, p) => a + p.value, 0);
  const header =
    ev.purpose === 'attack' ? `${ev.actorName} attacks ${ev.targetName ?? 'a target'}${ev.source ? ` with ${ev.source}` : ''}`
    : ev.purpose === 'save' ? `${ev.actor === 'hero' ? 'You make' : `${ev.actorName} makes`} a ${ev.source ?? 'save'}`
    : ev.purpose === 'check' ? `${ev.actor === 'hero' ? 'You' : ev.actorName}: ${ev.source ?? ev.label}`
    : ev.purpose === 'initiative' ? `Initiative: ${ev.actorName}`
    : ev.purpose === 'damage' ? `${ev.source ?? 'Damage'} damage`
    : ev.purpose === 'heal' ? `${ev.actorName}: ${ev.source ?? 'healing'}`
    : ev.source ?? ev.label;
  const outcomeTxt =
    ev.outcome === 'crit' ? 'Critical hit!' : ev.outcome === 'hit' ? 'Hit!' :
    ev.outcome === 'miss' ? 'Miss' : ev.outcome === 'success' ? 'Success' :
    ev.outcome === 'failure' ? 'Failed' : null;
  return (
    <div class={`roll-card ${ev.outcome ?? ''}`}>
      <p class="rc-header">
        {(ev.purpose === 'save' || ev.purpose === 'check') && ev.source
          ? ev.purpose === 'save' ? (
            <>{ev.actor === 'hero' ? 'You make a ' : `${ev.actorName} makes a `}
              {(() => { const id = nameToId(parts[0]?.label ?? '') as AbilityId | null; return id ? <AbilityLabel id={id} /> : <>{parts[0]?.label ?? 'save'}</>; })()}
              {' '}save{ev.actor !== 'hero' && !/save/i.test(ev.source) ? '' : ''} against {ev.source}</>
          ) : (
            <>{ev.actor === 'hero' ? 'You: ' : `${ev.actorName}: `}<SourceLabel source={ev.source} /></>
          )
          : header}
      </p>
      <p class="rc-line">
        {dice.map((d, i) => (
          <DieChip key={i} sides={d.sides} value={d.value} kept={d.kept}
            nat={d.sides === 20 && ev.result.nat20 && d.kept ? 'nat20' : d.sides === 20 && ev.result.nat1 && d.kept ? 'nat1' : undefined}
            note={d.kept ? undefined : dice.length > 1 && d.value === Math.max(...dice.map((x) => x.value)) ? 'disadvantage: lower die kept' : 'advantage: higher die kept'} />
        ))}
        {parts.map((p, i) => <span key={`p${i}`}> {p.value >= 0 ? '+' : '−'} {Math.abs(p.value)} {p.label}</span>)}
        <b> = {total}</b>
        {ev.vs && <> vs {VS_NAMES[ev.vs.kind]} {ev.vs.value}</>}
        {outcomeTxt && <b class={`rc-outcome ${ev.outcome}`}> → {outcomeTxt}</b>}
      </p>
    </div>
  );
}

const COMBAT_END_TEXT: Record<string, string> = {
  victory: 'The battle is won.', fled: 'You escaped.',
  defeat: 'You were overwhelmed…', death: 'You have fallen.',
};

/** Plain-sentence version for the log drawer and aria-live. */
export function describeEventText(ev: GameEvent): string | null {
  if (ev.type === 'roll') {
    const dice = ev.result.rolls.map((d) => d.value).join(', ');
    const parts = ev.parts?.map((p) => `${p.value >= 0 ? '+' : ''}${p.value} ${p.label}`).join(' ') ?? '';
    const vs = ev.vs ? ` vs ${VS_NAMES[ev.vs.kind]} ${ev.vs.value}` : '';
    const out = ev.outcome ? ` — ${ev.outcome === 'crit' ? 'Critical hit!' : ev.outcome}` : '';
    return `${ev.label}: rolled ${dice}${parts ? ' ' + parts : ''} = ${ev.finalTotal}${vs}${out}`;
  }
  if (ev.type === 'narrate') return ev.text;
  if (ev.type === 'damage') return `${ev.targetName ?? ev.target} takes ${ev.amount} ${ev.damageType ?? ''} damage${ev.hpLeft !== undefined ? ` (${ev.hpLeft}/${ev.hpMax} health left)` : ''}.`;
  if (ev.type === 'heal') return `${ev.target === 'hero' ? 'You heal' : `${ev.target} heals`} ${ev.amount}.`;
  if (ev.type === 'condition') return `${ev.target === 'hero' ? 'You are' : `${ev.target} is`} ${ev.on ? '' : 'no longer '}${ev.condition}.`;
  if (ev.type === 'turnStart') return `— ${ev.who === 'hero' ? 'Your' : ev.who} turn —`;
  if (ev.type === 'combatEnd') return COMBAT_END_TEXT[ev.result] ?? 'Combat over.';
  if (ev.type === 'sceneEnter') return `Now entering: ${ev.title}`;
  if (ev.type === 'combatStart') return 'Combat begins';
  if (ev.type === 'levelUpAvailable') return 'Level up available!';
  if (ev.type === 'questComplete') return 'Quest complete!';
  if (ev.type === 'death') return null;
  if (ev.type === 'error') return ev.message;
  return null;
}

export function EventCard({ ev }: { ev: GameEvent }): JSX.Element | null {
  if (ev.type === 'roll') return <RollCard ev={ev} />;
  if (ev.type === 'combatEnd')
    return <p class={`feed-line divider combat-end-${ev.result}`}>{COMBAT_END_TEXT[ev.result]}</p>;
  const text = describeEventText(ev);
  if (!text) return null;
  const cls =
    ev.type === 'damage' ? 'damage' : ev.type === 'narrate' && /miss|fail/i.test(text) ? 'miss'
    : /hit|success|defeated|saved/i.test(text) ? 'hit'
    : ev.type === 'turnStart' ? 'divider' : '';
  return <p class={`feed-line ${cls}`}>{text}</p>;
}
