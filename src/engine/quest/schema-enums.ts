import type { ConditionName, DamageType, ItemKind } from './types';

export const DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'fire', 'radiant', 'psychic',
  'force', 'poison', 'cold', 'necrotic',
];

export const CONDITION_NAMES: ConditionName[] = [
  'hidden', 'restrained', 'frightened', 'poisoned', 'blessed',
  'marked', 'dodging', 'stunned', 'wildshape', 'inspired',
];

export const ITEM_KINDS: ItemKind[] = [
  'weapon', 'armour', 'shield', 'consumable', 'treasure', 'key',
];
