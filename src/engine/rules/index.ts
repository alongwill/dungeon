import type { AbilityId, ClassId, SkillId } from '../quest/types';
import { CLASSES } from '../../content/classes';

export const ABILITY_IDS: AbilityId[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const SKILL_ABILITY: Record<SkillId, AbilityId> = {
  athletics: 'STR',
  acrobatics: 'DEX',
  stealth: 'DEX',
  sleightOfHand: 'DEX',
  arcana: 'INT',
  history: 'INT',
  investigation: 'INT',
  insight: 'WIS',
  medicine: 'WIS',
  perception: 'WIS',
  survival: 'WIS',
  deception: 'CHA',
  intimidation: 'CHA',
  performance: 'CHA',
  persuasion: 'CHA',
};

export const SKILL_IDS = Object.keys(SKILL_ABILITY) as SkillId[];

export const DC_TIERS = { easy: 10, medium: 13, hard: 16, veryHard: 19 } as const;

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return level >= 5 ? 3 : 2;
}

/** XP needed to *reach* the next level (index = current level). Level 5 is max. */
export const XP_THRESHOLDS: Record<number, number> = { 2: 300, 3: 900, 4: 2700, 5: 6500 };
export const MAX_LEVEL = 5;

export function canLevelUp(level: number, xp: number): boolean {
  const next = XP_THRESHOLDS[level + 1];
  return next !== undefined && xp >= next;
}

/** Spell slot tables: [level][slotLevel-1] = slot count. */
export const FULL_CASTER_SLOTS: number[][] = [
  [], // level 0 unused
  [2], [3], [4, 2], [4, 3], [4, 3, 2],
];
export const HALF_CASTER_SLOTS: number[][] = [
  [],
  [1], [2], [3], [3], [4, 2],
];

/** Armour Class from equipment. armour: none|light|medium|heavy. */
export function computeAC(
  armour: 'light' | 'medium' | 'heavy' | undefined,
  shield: boolean,
  dexMod: number,
): number {
  let ac: number;
  switch (armour) {
    case 'light': ac = 11 + dexMod; break;
    case 'medium': ac = 14 + Math.min(dexMod, 2); break;
    case 'heavy': ac = 16; break;
    default: ac = 10 + dexMod;
  }
  return ac + (shield ? 2 : 0);
}

/** Fixed HP gain per level: hitDie/2 + 1 + CON mod, min 1. */
export function hpGainPerLevel(hitDie: number, conMod: number): number {
  return Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
}

export const MAX_SHORT_RESTS = 2;

/** Spell slots for a class at a level (index 0 = 1st-level slots). */
export function slotsFor(classId: ClassId, level: number): number[] {
  const cls = CLASSES[classId];
  const table = cls.caster === 'full' ? FULL_CASTER_SLOTS : cls.caster === 'half' ? HALF_CASTER_SLOTS : null;
  return [...(table?.[level] ?? [])];
}

/** Max uses/pool for a class resource at a level. */
export function resourceMax(
  classId: ClassId,
  resourceId: string,
  abilities: Record<AbilityId, number>,
  level: number,
): number {
  const def = CLASSES[classId].resources[resourceId];
  if (!def) return 0;
  if (def.max === 'cha-mod') return Math.max(1, abilityMod(abilities.CHA));
  if (def.max === 'level5') return 5 * level;
  return def.max;
}

export const ABILITY_NAMES: Record<AbilityId, string> = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

export const SKILL_NAMES: Record<string, string> = {
  athletics: 'Athletics', acrobatics: 'Acrobatics', sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth', arcana: 'Arcana', history: 'History', investigation: 'Investigation',
  nature: 'Nature', religion: 'Religion', animalHandling: 'Animal Handling',
  insight: 'Insight', medicine: 'Medicine', perception: 'Perception',
  survival: 'Survival', deception: 'Deception', intimidation: 'Intimidation',
  performance: 'Performance', persuasion: 'Persuasion',
};

export const abilityName = (id: AbilityId): string => ABILITY_NAMES[id];
export const skillName = (id: string): string => SKILL_NAMES[id] ?? id;
