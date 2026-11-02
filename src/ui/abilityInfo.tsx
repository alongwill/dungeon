import type { JSX } from 'preact';
import type { AbilityId } from '../engine/quest/types';
import { abilityName } from '../engine/rules';

export const ABILITY_INFO: Record<AbilityId, { name: string; meaning: string }> = {
  STR: { name: 'Strength', meaning: 'power: melee hits, lifting, Athletics' },
  DEX: { name: 'Dexterity', meaning: 'agility: aim, dodging, stealth, initiative' },
  CON: { name: 'Constitution', meaning: 'toughness: health and endurance' },
  INT: { name: 'Intelligence', meaning: 'knowledge: arcane magic, investigation' },
  WIS: { name: 'Wisdom', meaning: 'insight: divine/nature magic, perception' },
  CHA: { name: 'Charisma', meaning: 'presence: persuasion, bardic and holy magic' },
};

function Icon({ id }: { id: AbilityId }): JSX.Element {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  switch (id) {
    case 'STR': return <svg {...common}><path d="M8 13v-4a2 2 0 0 1 4 0v1m0-2a2 2 0 0 1 4 0v2m0-1a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-1a2 2 0 0 1 4 0z"/></svg>; // fist
    case 'DEX': return <svg {...common}><path d="M20 4c-7 0-13 5-15 12l-2 4 4-2c7-2 12-8 13-14zM8 16l4 4"/></svg>; // feather
    case 'CON': return <svg {...common}><path d="M4 20l6-14 4 8 3-5 3 11zM10 6l-2 4"/></svg>; // mountain
    case 'INT': return <svg {...common}><path d="M4 6a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2zm16 0a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z"/></svg>; // open book
    case 'WIS': return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>; // eye
    case 'CHA': return <svg {...common}><path d="M12 3l2.5 5.5L20 10l-5.5 1.5L12 17l-2.5-5.5L4 10l5.5-1.5z"/></svg>; // star
  }
}

/** Icon + full name; meaning in tooltip and sr-only. */
export function AbilityLabel({ id, short }: { id: AbilityId | string; short?: boolean }): JSX.Element {
  const info = ABILITY_INFO[id as AbilityId];
  const name = info?.name ?? abilityName(id as AbilityId);
  return (
    <span class="ability-label" title={info?.meaning}>
      {info && <Icon id={id as AbilityId} />}
      <span>{short ? id : name}</span>
      {info && <span class="sr-live">{info.meaning}</span>}
    </span>
  );
}
