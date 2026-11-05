import type { AbilityId, ClassId, SkillId } from '../engine/quest/types';

export type CasterType = 'full' | 'half' | 'pact' | 'none';
export type ResourcePer = 'short' | 'long';

export interface ResourceDef {
  name: string;
  per: ResourcePer;
  minLevel: number;
  /** Fixed number, or 'cha-mod' (min 1), 'level', or 'level5' (5 × level, the lay-on-hands pool). */
  max: number | 'cha-mod' | 'level' | 'level5';
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  hitDie: number;
  saves: AbilityId[];
  skills: SkillId[];
  expertise: SkillId[];
  /** Ability scores sorted descending get assigned in this order. */
  abilityPriority: AbilityId[];
  caster: CasterType;
  castingAbility?: AbilityId;
  /** Unarmoured Defence: with no armour on, AC adds this ability's mod. */
  unarmouredDefence?: AbilityId;
  resources: Record<string, ResourceDef>;
  abilities: string[]; // ability ids, each with its own minLevel
  kit: { items: { item: string; qty?: number }[]; gold: number; weapon: string; armour?: string; shield?: string };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter', name: 'Fighter', role: 'Tough front-liner, steady damage',
    hitDie: 10, saves: ['STR', 'CON'],
    skills: ['athletics', 'intimidation', 'perception'], expertise: [],
    abilityPriority: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    caster: 'none',
    resources: {
      'second-wind': { name: 'Second Wind', per: 'short', minLevel: 1, max: 1 },
      'action-surge': { name: 'Action Surge', per: 'short', minLevel: 1, max: 1 },
    },
    abilities: ['second-wind', 'action-surge', 'extra-attack'],
    kit: {
      items: [
        { item: 'chain-mail' }, { item: 'shield' }, { item: 'longsword' },
        { item: 'potion-healing', qty: 2 },
      ],
      gold: 10, weapon: 'longsword', armour: 'chain-mail', shield: 'shield',
    },
  },
  rogue: {
    id: 'rogue', name: 'Rogue', role: 'Burst damage, stealth, skills',
    hitDie: 8, saves: ['DEX', 'INT'],
    skills: ['stealth', 'sleightOfHand', 'acrobatics', 'investigation', 'deception'],
    expertise: ['stealth', 'sleightOfHand'],
    abilityPriority: ['DEX', 'INT', 'CON', 'CHA', 'WIS', 'STR'],
    caster: 'none',
    resources: {},
    abilities: ['sneak-attack', 'cunning-hide', 'uncanny-dodge'],
    kit: {
      items: [
        { item: 'leather-armour' }, { item: 'shortsword' }, { item: 'shortbow' },
        { item: 'thieves-tools' }, { item: 'potion-healing' },
      ],
      gold: 15, weapon: 'shortsword', armour: 'leather-armour',
    },
  },
  paladin: {
    id: 'paladin', name: 'Paladin', role: 'Holy knight, smites and heals',
    hitDie: 10, saves: ['WIS', 'CHA'],
    skills: ['athletics', 'persuasion', 'insight'], expertise: [],
    abilityPriority: ['STR', 'CHA', 'CON', 'WIS', 'DEX', 'INT'],
    caster: 'half', castingAbility: 'CHA',
    resources: {
      'lay-on-hands': { name: 'Lay on Hands', per: 'long', minLevel: 1, max: 'level5' },
    },
    abilities: ['lay-on-hands', 'bless', 'divine-smite'],
    kit: {
      items: [
        { item: 'chain-mail' }, { item: 'shield' }, { item: 'longsword' },
        { item: 'holy-symbol' }, { item: 'potion-healing' },
      ],
      gold: 10, weapon: 'longsword', armour: 'chain-mail', shield: 'shield',
    },
  },
  bard: {
    id: 'bard', name: 'Bard', role: 'Talker, debuffs, healing',
    hitDie: 8, saves: ['DEX', 'CHA'],
    skills: ['performance', 'persuasion', 'deception', 'insight', 'history'], expertise: [],
    abilityPriority: ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
    caster: 'full', castingAbility: 'CHA',
    resources: {
      inspiration: { name: 'Bardic Inspiration', per: 'long', minLevel: 1, max: 'cha-mod' },
    },
    abilities: ['vicious-mockery', 'healing-word', 'dissonant-whispers', 'bardic-inspiration'],
    kit: {
      items: [
        { item: 'leather-armour' }, { item: 'rapier' }, { item: 'lute' },
        { item: 'potion-healing' },
      ],
      gold: 15, weapon: 'rapier', armour: 'leather-armour',
    },
  },
  druid: {
    id: 'druid', name: 'Druid', role: 'Nature caster, control, shapeshift',
    hitDie: 8, saves: ['INT', 'WIS'],
    skills: ['survival', 'medicine', 'perception', 'arcana'], expertise: [],
    abilityPriority: ['WIS', 'CON', 'DEX', 'INT', 'CHA', 'STR'],
    caster: 'full', castingAbility: 'WIS',
    resources: {
      'wild-shape': { name: 'Wild Shape', per: 'short', minLevel: 2, max: 1 },
    },
    abilities: ['produce-flame', 'cure-wounds-druid', 'entangle', 'wild-shape'],
    kit: {
      items: [
        { item: 'leather-armour' }, { item: 'wooden-shield' }, { item: 'quarterstaff' },
        { item: 'herbalism-kit' }, { item: 'potion-healing' },
      ],
      gold: 10, weapon: 'quarterstaff', armour: 'leather-armour', shield: 'wooden-shield',
    },
  },
  wizard: {
    id: 'wizard', name: 'Wizard', role: 'Glass cannon, area damage',
    hitDie: 6, saves: ['INT', 'WIS'],
    skills: ['arcana', 'history', 'investigation'], expertise: [],
    abilityPriority: ['INT', 'DEX', 'CON', 'WIS', 'CHA', 'STR'],
    caster: 'full', castingAbility: 'INT',
    resources: {
      'arcane-recovery': { name: 'Arcane Recovery', per: 'long', minLevel: 1, max: 1 },
    },
    abilities: ['fire-bolt', 'magic-missile', 'burning-hands', 'fireball'],
    kit: {
      items: [
        { item: 'robe-cloth' }, { item: 'quarterstaff' }, { item: 'spellbook' },
        { item: 'arcane-focus' }, { item: 'potion-healing', qty: 2 },
      ],
      gold: 10, weapon: 'quarterstaff', armour: 'robe-cloth',
    },
  },
  cleric: {
    id: 'cleric', name: 'Cleric', role: 'Healer, radiant damage, undead-breaker',
    hitDie: 8, saves: ['WIS', 'CHA'],
    skills: ['medicine', 'insight', 'persuasion', 'history'], expertise: [],
    abilityPriority: ['WIS', 'STR', 'CON', 'CHA', 'DEX', 'INT'],
    caster: 'full', castingAbility: 'WIS',
    resources: {
      'channel-divinity': { name: 'Channel Divinity', per: 'short', minLevel: 2, max: 1 },
    },
    abilities: ['sacred-flame', 'cure-wounds-cleric', 'guiding-bolt', 'turn-undead'],
    kit: {
      items: [
        { item: 'scale-mail' }, { item: 'shield' }, { item: 'mace' },
        { item: 'holy-symbol' }, { item: 'potion-healing' },
      ],
      gold: 10, weapon: 'mace', armour: 'scale-mail', shield: 'shield',
    },
  },
  ranger: {
    id: 'ranger', name: 'Ranger', role: 'Archer, tracker',
    hitDie: 10, saves: ['STR', 'DEX'],
    skills: ['survival', 'perception', 'stealth', 'athletics'], expertise: [],
    abilityPriority: ['DEX', 'WIS', 'CON', 'STR', 'CHA', 'INT'],
    caster: 'half', castingAbility: 'WIS',
    resources: {},
    abilities: ['hunters-mark', 'cure-wounds-ranger', 'natural-explorer', 'extra-attack-ranger'],
    kit: {
      items: [
        { item: 'leather-armour' }, { item: 'longbow' },
        { item: 'shortsword', qty: 2 }, { item: 'explorers-pack' }, { item: 'potion-healing' },
      ],
      gold: 10, weapon: 'longbow', armour: 'leather-armour',
    },
  },
  barbarian: {
    id: 'barbarian', name: 'Barbarian', role: 'Raging brute, shrugs off blows',
    hitDie: 12, saves: ['STR', 'CON'],
    skills: ['athletics', 'intimidation', 'survival', 'perception'], expertise: [],
    abilityPriority: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    caster: 'none', unarmouredDefence: 'CON',
    resources: {
      rage: { name: 'Rage', per: 'long', minLevel: 1, max: 2 },
    },
    abilities: ['rage', 'reckless-attack', 'extra-attack-barbarian'],
    kit: {
      items: [
        { item: 'greataxe' }, { item: 'explorers-pack' }, { item: 'potion-healing' },
      ],
      gold: 10, weapon: 'greataxe',
    },
  },
  monk: {
    id: 'monk', name: 'Monk', role: 'Martial artist, flurries of blows',
    hitDie: 8, saves: ['STR', 'DEX'],
    skills: ['acrobatics', 'stealth', 'insight', 'athletics'], expertise: [],
    abilityPriority: ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
    caster: 'none', unarmouredDefence: 'WIS',
    resources: {
      ki: { name: 'Ki', per: 'short', minLevel: 2, max: 'level' },
    },
    abilities: ['martial-arts', 'flurry-of-blows', 'patient-defense', 'extra-attack-monk'],
    kit: {
      items: [
        { item: 'shortsword' }, { item: 'explorers-pack' }, { item: 'potion-healing', qty: 2 },
      ],
      gold: 5, weapon: 'shortsword',
    },
  },
  sorcerer: {
    id: 'sorcerer', name: 'Sorcerer', role: 'Wild innate magic, raw power',
    hitDie: 6, saves: ['CON', 'CHA'],
    skills: ['arcana', 'deception', 'intimidation', 'persuasion'], expertise: [],
    abilityPriority: ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
    caster: 'full', castingAbility: 'CHA',
    resources: {
      'sorcery-points': { name: 'Sorcery Points', per: 'long', minLevel: 2, max: 'level' },
    },
    abilities: ['shocking-grasp', 'chaos-bolt', 'thunderwave', 'font-of-magic', 'scorching-ray'],
    kit: {
      items: [
        { item: 'robe-cloth' }, { item: 'dagger' }, { item: 'arcane-focus' },
        { item: 'potion-healing', qty: 2 },
      ],
      gold: 10, weapon: 'dagger', armour: 'robe-cloth',
    },
  },
  warlock: {
    id: 'warlock', name: 'Warlock', role: 'Pact caster, eldritch blasts and curses',
    hitDie: 8, saves: ['WIS', 'CHA'],
    skills: ['arcana', 'deception', 'intimidation', 'investigation'], expertise: [],
    abilityPriority: ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
    caster: 'pact', castingAbility: 'CHA',
    resources: {},
    abilities: ['eldritch-blast', 'hex', 'arms-of-hadar', 'dark-ones-blessing', 'agonizing-blast'],
    kit: {
      items: [
        { item: 'leather-armour' }, { item: 'dagger' }, { item: 'pact-token' },
        { item: 'potion-healing', qty: 2 },
      ],
      gold: 10, weapon: 'dagger', armour: 'leather-armour',
    },
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
