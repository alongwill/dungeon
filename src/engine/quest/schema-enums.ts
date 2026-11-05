import type { Backdrop, ConditionName, DamageType, ItemKind } from './types';

/** Built-in procedural scene backdrops (drawn by src/ui/art/SceneArt.tsx). */
export const BACKDROPS: Backdrop[] = [
  'village', 'road', 'marsh', 'forest', 'ruins', 'crypt', 'camp', 'cave', 'inn', 'cellar', 'throne',
];

export const DAMAGE_TYPES: DamageType[] = [
  'slashing', 'piercing', 'bludgeoning', 'fire', 'radiant', 'psychic',
  'force', 'poison', 'cold', 'necrotic', 'lightning', 'thunder', 'acid',
];

export const CONDITION_NAMES: ConditionName[] = [
  'hidden', 'restrained', 'frightened', 'poisoned', 'blessed',
  'marked', 'dodging', 'stunned', 'wildshape', 'inspired',
  'raging', 'reckless', 'hexed',
];

export const ITEM_KINDS: ItemKind[] = [
  'weapon', 'armour', 'shield', 'consumable', 'treasure', 'key',
];
