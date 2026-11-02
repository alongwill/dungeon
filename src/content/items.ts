import type { ItemDef } from '../engine/quest/types';

/** Global item catalog. Quests can add quest-local items in their own `items` map. */
export const ITEMS: Record<string, ItemDef> = {
  // weapons
  longsword: { name: 'Longsword', kind: 'weapon', damage: '1d8', damageType: 'slashing', ability: 'STR', value: 15 },
  shortsword: { name: 'Shortsword', kind: 'weapon', damage: '1d6', damageType: 'piercing', ability: 'finesse', value: 10 },
  shortbow: { name: 'Shortbow', kind: 'weapon', damage: '1d6', damageType: 'piercing', ability: 'DEX', value: 25 },
  rapier: { name: 'Rapier', kind: 'weapon', damage: '1d8', damageType: 'piercing', ability: 'finesse', value: 25 },
  quarterstaff: { name: 'Quarterstaff', kind: 'weapon', damage: '1d6', damageType: 'bludgeoning', ability: 'STR', value: 2 },
  mace: { name: 'Mace', kind: 'weapon', damage: '1d6', damageType: 'bludgeoning', ability: 'STR', value: 5 },
  longbow: { name: 'Longbow', kind: 'weapon', damage: '1d8', damageType: 'piercing', ability: 'DEX', value: 50 },
  // armour / shields
  'robe-cloth': { name: 'Robes', kind: 'armour', armour: 'light', value: 1 },
  'leather-armour': { name: 'Leather Armour', kind: 'armour', armour: 'light', value: 10 },
  'scale-mail': { name: 'Scale Mail', kind: 'armour', armour: 'medium', value: 50 },
  'chain-mail': { name: 'Chain Mail', kind: 'armour', armour: 'heavy', value: 75 },
  shield: { name: 'Shield', kind: 'shield', value: 10 },
  'wooden-shield': { name: 'Wooden Shield', kind: 'shield', value: 6 },
  // consumables
  'potion-healing': {
    name: 'Potion of Healing',
    kind: 'consumable',
    use: [{ heal: '2d4+2' }],
    value: 50,
  },
  // treasures
  'silver-locket': { name: 'Silver Locket', kind: 'treasure', value: 25 },
  'ancient-coin': { name: 'Ancient Coin', kind: 'treasure', value: 10 },
  'gem-chip': { name: 'Gem Chip', kind: 'treasure', value: 40 },
  // misc kit flavour (key items)
  'thieves-tools': { name: "Thieves' Tools", kind: 'key', value: 25 },
  'holy-symbol': { name: 'Holy Symbol', kind: 'key', value: 5 },
  lute: { name: 'Lute', kind: 'key', value: 15 },
  'herbalism-kit': { name: 'Herbalism Kit', kind: 'key', value: 5 },
  spellbook: { name: 'Spellbook', kind: 'key', value: 50 },
  'arcane-focus': { name: 'Arcane Focus', kind: 'key', value: 10 },
  'explorers-pack': { name: "Explorer's Pack", kind: 'key', value: 10 },
};
