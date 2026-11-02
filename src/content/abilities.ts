import type {
  AbilityId,
  ClassId,
  ConditionName,
  DamageType,
} from '../engine/quest/types';

export interface AbilityDef {
  id: string;
  name: string;
  classId: ClassId;
  kind: 'action' | 'bonus' | 'free' | 'passive';
  minLevel: number;
  target: 'enemy' | 'self' | 'all-enemies' | 'none';
  /** Minimum slot level required, if this ability casts from a slot. */
  slot?: number;
  /** Resource id consumed, if any (see ClassDef.resources). */
  resource?: string;
  /** Weapon/spell attack to hit before applying damage. */
  attack?: { ability: 'weapon' | AbilityId; bonus?: number };
  damage?: string;
  damageType?: DamageType;
  /** Extra dice per slot level above the minimum (upcasting). */
  upcast?: { dice?: string; bonusDice?: number };
  /** Cantrip-style scaling at a level. */
  scalesAt?: { level: number; damage: string };
  heal?: string;
  /** Ability mod added to the heal roll. */
  healAbility?: AbilityId;
  save?: { ability: AbilityId; half?: boolean };
  condition?: {
    name: ConditionName;
    rounds: number | 'combat';
    on: 'self' | 'target' | 'failed-save';
  };
  oncePerTurn?: boolean;
  /** Bespoke behaviours handled by the combat/state engines. */
  special?:
    | 'second-wind'
    | 'action-surge'
    | 'cunning-hide'
    | 'lay-on-hands'
    | 'hunters-mark'
    | 'wild-shape'
    | 'turn-undead'
    | 'inspiration'
    | 'magic-missile'
    | 'smite';
  description?: string;
}

const A = (d: AbilityDef) => d;

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(
  [
    // Fighter
    A({ id: 'second-wind', name: 'Second Wind', classId: 'fighter', kind: 'bonus', minLevel: 1, target: 'self', resource: 'second-wind', special: 'second-wind', description: 'Heal 1d10 + level.' }),
    A({ id: 'action-surge', name: 'Action Surge', classId: 'fighter', kind: 'free', minLevel: 1, target: 'self', resource: 'action-surge', special: 'action-surge', description: 'Take one extra Action this turn.' }),
    A({ id: 'extra-attack', name: 'Extra Attack', classId: 'fighter', kind: 'passive', minLevel: 5, target: 'none', description: 'The Attack action makes two attacks.' }),
    // Rogue
    A({ id: 'sneak-attack', name: 'Sneak Attack', classId: 'rogue', kind: 'passive', minLevel: 1, target: 'none', oncePerTurn: true, description: '+Nd6 damage with advantage, or in round 1 if you act first.' }),
    A({ id: 'cunning-hide', name: 'Cunning Action: Hide', classId: 'rogue', kind: 'bonus', minLevel: 1, target: 'self', special: 'cunning-hide', description: 'Stealth vs enemy passive Perception; gain hidden on success.' }),
    A({ id: 'uncanny-dodge', name: 'Uncanny Dodge', classId: 'rogue', kind: 'passive', minLevel: 5, target: 'none', description: 'Halve the first hit you take each round.' }),
    // Paladin
    A({ id: 'lay-on-hands', name: 'Lay on Hands', classId: 'paladin', kind: 'action', minLevel: 1, target: 'self', special: 'lay-on-hands', description: 'Heal from a pool of 5 × level HP.' }),
    A({ id: 'divine-smite', name: 'Divine Smite', classId: 'paladin', kind: 'free', minLevel: 1, target: 'enemy', slot: 1, damage: '2d8', damageType: 'radiant', upcast: { dice: '1d8' }, special: 'smite', description: 'On a hit, spend a slot: +2d8 radiant, +1d8 per slot above 1st, +1d8 vs undead.' }),
    A({ id: 'bless', name: 'Bless', classId: 'paladin', kind: 'action', minLevel: 1, target: 'self', slot: 1, condition: { name: 'blessed', rounds: 'combat', on: 'self' }, description: '+1d4 to attacks and saves for the combat.' }),
    // Bard
    A({ id: 'vicious-mockery', name: 'Vicious Mockery', classId: 'bard', kind: 'action', minLevel: 1, target: 'enemy', damage: '1d4', damageType: 'psychic', save: { ability: 'WIS' }, scalesAt: { level: 5, damage: '2d4' }, condition: { name: 'frightened', rounds: 1, on: 'failed-save' }, description: 'WIS save; 1d4 psychic and the target is rattled.' }),
    A({ id: 'healing-word', name: 'Healing Word', classId: 'bard', kind: 'bonus', minLevel: 1, target: 'self', slot: 1, heal: '1d4', healAbility: 'CHA', upcast: { dice: '1d4' }, description: 'Heal 1d4 + CHA.' }),
    A({ id: 'dissonant-whispers', name: 'Dissonant Whispers', classId: 'bard', kind: 'action', minLevel: 1, target: 'enemy', slot: 1, damage: '3d6', damageType: 'psychic', save: { ability: 'WIS', half: true }, condition: { name: 'frightened', rounds: 1, on: 'failed-save' }, description: 'WIS save; 3d6 psychic, half on success.' }),
    A({ id: 'bardic-inspiration', name: 'Bardic Inspiration', classId: 'bard', kind: 'bonus', minLevel: 1, target: 'self', resource: 'inspiration', special: 'inspiration', description: '+1d6 to your next attack roll or save; also usable after a failed check.' }),
    // Druid
    A({ id: 'produce-flame', name: 'Produce Flame', classId: 'druid', kind: 'action', minLevel: 1, target: 'enemy', attack: { ability: 'WIS' }, damage: '1d8', damageType: 'fire', scalesAt: { level: 5, damage: '2d8' }, description: 'Spell attack, 1d8 fire.' }),
    A({ id: 'cure-wounds-druid', name: 'Cure Wounds', classId: 'druid', kind: 'action', minLevel: 1, target: 'self', slot: 1, heal: '1d8', healAbility: 'WIS', upcast: { dice: '1d8' }, description: 'Heal 1d8 + WIS.' }),
    A({ id: 'entangle', name: 'Entangle', classId: 'druid', kind: 'action', minLevel: 1, target: 'all-enemies', slot: 1, save: { ability: 'STR' }, condition: { name: 'restrained', rounds: 2, on: 'failed-save' }, description: 'All enemies STR save or restrained 2 rounds.' }),
    A({ id: 'wild-shape', name: 'Wild Shape: Wolf', classId: 'druid', kind: 'action', minLevel: 2, target: 'self', resource: 'wild-shape', special: 'wild-shape', description: 'Beast form: 11 beast HP, Bite attack, no spellcasting.' }),
    // Wizard
    A({ id: 'fire-bolt', name: 'Fire Bolt', classId: 'wizard', kind: 'action', minLevel: 1, target: 'enemy', attack: { ability: 'INT' }, damage: '1d10', damageType: 'fire', scalesAt: { level: 5, damage: '2d10' }, description: 'Spell attack, 1d10 fire.' }),
    A({ id: 'magic-missile', name: 'Magic Missile', classId: 'wizard', kind: 'action', minLevel: 1, target: 'enemy', slot: 1, damage: '1d4+1', damageType: 'force', special: 'magic-missile', upcast: { bonusDice: 1 }, description: 'Three darts that always hit, 1d4+1 force each.' }),
    A({ id: 'burning-hands', name: 'Burning Hands', classId: 'wizard', kind: 'action', minLevel: 1, target: 'all-enemies', slot: 1, damage: '3d6', damageType: 'fire', save: { ability: 'DEX', half: true }, description: 'All enemies DEX save; 3d6 fire, half on success.' }),
    A({ id: 'fireball', name: 'Fireball', classId: 'wizard', kind: 'action', minLevel: 5, target: 'all-enemies', slot: 3, damage: '8d6', damageType: 'fire', save: { ability: 'DEX', half: true }, description: 'All enemies DEX save; 8d6 fire, half on success.' }),
    // Cleric
    A({ id: 'sacred-flame', name: 'Sacred Flame', classId: 'cleric', kind: 'action', minLevel: 1, target: 'enemy', damage: '1d8', damageType: 'radiant', save: { ability: 'DEX' }, scalesAt: { level: 5, damage: '2d8' }, description: 'DEX save or 1d8 radiant.' }),
    A({ id: 'cure-wounds-cleric', name: 'Cure Wounds', classId: 'cleric', kind: 'action', minLevel: 1, target: 'self', slot: 1, heal: '1d8', healAbility: 'WIS', upcast: { dice: '1d8' }, description: 'Heal 1d8 + WIS.' }),
    A({ id: 'guiding-bolt', name: 'Guiding Bolt', classId: 'cleric', kind: 'action', minLevel: 1, target: 'enemy', slot: 1, attack: { ability: 'WIS' }, damage: '4d6', damageType: 'radiant', description: 'Spell attack, 4d6 radiant; your next attack vs the target has advantage.' }),
    A({ id: 'turn-undead', name: 'Turn Undead', classId: 'cleric', kind: 'action', minLevel: 2, target: 'all-enemies', resource: 'channel-divinity', special: 'turn-undead', description: 'Undead WIS save or frightened and stunned 2 rounds.' }),
    // Ranger
    A({ id: 'hunters-mark', name: "Hunter's Mark", classId: 'ranger', kind: 'bonus', minLevel: 1, target: 'enemy', slot: 1, special: 'hunters-mark', condition: { name: 'marked', rounds: 'combat', on: 'target' }, description: '+1d6 damage on each of your hits vs the target.' }),
    A({ id: 'cure-wounds-ranger', name: 'Cure Wounds', classId: 'ranger', kind: 'action', minLevel: 1, target: 'self', slot: 1, heal: '1d8', healAbility: 'WIS', description: 'Heal 1d8 + WIS.' }),
    A({ id: 'natural-explorer', name: 'Natural Explorer', classId: 'ranger', kind: 'passive', minLevel: 1, target: 'none', description: 'Advantage on Survival checks. Extra Attack at L5.' }),
    A({ id: 'extra-attack-ranger', name: 'Extra Attack', classId: 'ranger', kind: 'passive', minLevel: 5, target: 'none', description: 'The Attack action makes two attacks.' }),
  ].map((a) => [a.id, a]),
);
