import type { GameEvent } from '../engine/model';
import { keptSum } from '../engine/rolls';
import { AbilityLabel } from './abilityInfo';
import type { AbilityId } from '../engine/quest/types';
import type { JSX } from 'preact';
import { ActorAvatar, explainPart } from './actors';

/** "Your turn" / "The Rat King's turn" with the combatant's portrait. */
export function TurnBanner({ who, actor }: { who: string; actor?: string }) {
  const hero = who === 'hero';
  return (
    <div class={`turn-banner ${hero ? 'hero' : 'enemy'}`}>
      {(actor || hero) && <ActorAvatar actor={actor ?? 'hero'} size={34} />}
      <span>{hero ? 'Your turn' : `${who}'s turn`}</span>
    </div>
  );
}

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
  sides: number; value: number | string; kept: boolean; note?: string; nat?: 'nat20' | 'nat1';
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
  const explain = explainRoll(ev);
  return (
    <div class={`roll-card ${ev.outcome ?? ''} ${ev.actor === 'hero' ? 'side-hero' : 'side-enemy'}`}>
      <span class="rc-who"><ActorAvatar actor={ev.actor} size={30} /></span>
      <div class="rc-body">
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
        {parts.map((p, i) => (
          <span key={`p${i}`}> {p.value >= 0 ? '+' : '−'} {Math.abs(p.value)}{' '}
            <abbr class="term" title={explainPart(p.label)} tabIndex={0}>{p.label}</abbr></span>
        ))}
        <b> = {total}</b>
        {ev.vs && <> vs <abbr class="term" title={VS_HELP[ev.vs.kind]} tabIndex={0}>{VS_NAMES[ev.vs.kind]}</abbr> {ev.vs.value}</>}
        {outcomeTxt && <b class={`rc-outcome ${ev.outcome}`}> → {outcomeTxt}</b>}
      </p>
      {explain && <p class="rc-explain">{explain}</p>}
      </div>
    </div>
  );
}

const VS_HELP = {
  armour: 'Armour Class: how hard the target is to hit. The attack total must reach this number.',
  difficulty: 'Difficulty: the total needed to succeed.',
};

/** One plain-English sentence saying what the roll meant. */
export function explainRoll(ev: Extract<GameEvent, { type: 'roll' }>): string | null {
  const d20 = ev.result.rolls.find((d) => d.sides === 20 && d.kept)?.value;
  const bonus = ev.finalTotal - (d20 ?? 0);
  const b = bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)} bonus` : '';
  const advantage = ev.result.rolls.filter((d) => d.sides === 20).length > 1
    ? (ev.result.rolls.find((d) => d.sides === 20 && !d.kept)!.value < d20! ? ' (rolled twice, kept the higher)' : ' (rolled twice, kept the lower)') : '';
  const you = ev.actor === 'hero';
  if (ev.purpose === 'attack' && ev.vs && d20 !== undefined) {
    if (ev.result.nat20) return `A natural 20 always hits — and it's a critical: the damage dice are doubled!`;
    if (ev.result.nat1) return 'A natural 1 always misses.';
    return you
      ? `You needed ${ev.vs.value} to hit ${ev.targetName ?? 'it'}: d20 rolled ${d20}${advantage}${b} = ${ev.finalTotal}.`
      : `${ev.actorName} needed ${ev.vs.value} to hit you (your armour): d20 rolled ${d20}${advantage}${b} = ${ev.finalTotal}.`;
  }
  if ((ev.purpose === 'save' || ev.purpose === 'check') && ev.vs && d20 !== undefined) {
    const ok = ev.outcome === 'success';
    return you
      ? `You needed ${ev.vs.value}: d20 rolled ${d20}${advantage}${b} = ${ev.finalTotal}. ${ok ? 'Made it!' : 'Not enough.'}`
      : `${ev.actorName} needed ${ev.vs.value} to resist: rolled ${ev.finalTotal}. ${ok ? 'It resists.' : 'It fails to resist!'}`;
  }
  if (ev.purpose === 'initiative') return null;
  return null;
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
  if (ev.type === 'turnStart') return <TurnBanner who={ev.who} actor={ev.actor} />;
  const text = describeEventText(ev);
  if (!text) return null;
  const cls =
    ev.type === 'damage' ? 'damage' : ev.type === 'narrate' && /miss|fail/i.test(text) ? 'miss'
    : /hit|success|defeated|saved/i.test(text) ? 'hit' : '';
  return <p class={`feed-line ${cls}`}>{text}</p>;
}
