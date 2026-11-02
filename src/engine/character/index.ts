import { roll, type RollResult } from '../dice/roll';
import type { Rng } from '../dice/rng';
import {
  abilityMod,
  computeAC,
  hpGainPerLevel,
  proficiencyBonus,
  resourceMax,
  slotsFor,
} from '../rules';
import { ABILITIES, type AbilityDef } from '../../content/abilities';
import { CLASSES } from '../../content/classes';
import { ITEMS } from '../../content/items';
import type { AbilityId, AvatarSpec, ClassId } from '../quest/types';
import type { Hero } from '../model';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Six 4d6dl1 rolls. */
export function rollAbilityScores(rng: Rng): { rolls: RollResult[]; rng: Rng } {
  const rolls: RollResult[] = [];
  let r = rng;
  for (let i = 0; i < 6; i++) {
    const { result, rng: next } = roll('4d6dl1', r);
    rolls.push(result);
    r = next;
  }
  return { rolls, rng: r };
}

/** Sort values descending, assign to the class's priority order. */
export function assignByPriority(
  values: number[],
  classId: ClassId,
): Record<AbilityId, number> {
  const sorted = [...values].sort((a, b) => b - a);
  const out = {} as Record<AbilityId, number>;
  CLASSES[classId].abilityPriority.forEach((ab, i) => {
    out[ab] = sorted[i]!;
  });
  return out;
}

export function swapAbilities(
  abilities: Record<AbilityId, number>,
  a: AbilityId,
  b: AbilityId,
): Record<AbilityId, number> {
  return { ...abilities, [a]: abilities[b], [b]: abilities[a] };
}

export interface DerivedStats {
  maxHp: number;
  ac: number;
  slots: number[];
  saveDC: number;
  attackBonus: number;
  abilitiesUnlocked: AbilityDef[];
}

export function deriveStats(
  classId: ClassId,
  abilities: Record<AbilityId, number>,
  level: number,
): DerivedStats {
  const cls = CLASSES[classId];
  const con = abilityMod(abilities.CON);
  // solo-hero rule: level-1 HP is doubled hit die + CON so a lone hero survives a fight
  const maxHp = 2 * cls.hitDie + con + hpGainPerLevel(cls.hitDie, con) * (level - 1);
  const prof = proficiencyBonus(level);
  const ac = computeAC(
    cls.kit.armour ? armourKindOf(cls.kit.armour) : undefined,
    !!cls.kit.shield,
    abilityMod(abilities.DEX),
  );
  const casting = cls.castingAbility;
  const saveDC = casting ? 8 + prof + abilityMod(abilities[casting]) : 0;
  const attackBonus = prof + Math.max(
    abilityMod(abilities.STR),
    abilityMod(abilities.DEX),
  );
  const abilitiesUnlocked = cls.abilities
    .map((id) => ABILITIES[id]!)
    .filter((a) => a.minLevel <= level);
  return { maxHp, ac, slots: slotsFor(classId, level), saveDC, attackBonus, abilitiesUnlocked };
}

function armourKindOf(itemId: string): 'light' | 'medium' | 'heavy' | undefined {
  const def = ITEMS[itemId];
  return def?.kind === 'armour' ? def.armour : undefined;
}

export interface CreateHeroOpts {
  classId: ClassId;
  name: string;
  abilities: Record<AbilityId, number>;
  avatar: AvatarSpec;
}

export function createHero(opts: CreateHeroOpts): Hero {
  const cls = CLASSES[opts.classId];
  const stats = deriveStats(opts.classId, opts.abilities, 1);
  const resources: Record<string, number> = {};
  for (const [id, def] of Object.entries(cls.resources)) {
    if (def.minLevel <= 1) resources[id] = resourceMax(opts.classId, id, opts.abilities, 1);
  }
  const inventory = cls.kit.items.map((k) => ({ item: k.item, qty: k.qty ?? 1 }));
  return {
    name: opts.name,
    classId: opts.classId,
    avatar: opts.avatar,
    abilities: { ...opts.abilities },
    level: 1,
    xp: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    hitDiceUsed: 0,
    gold: cls.kit.gold,
    inventory,
    equipment: {
      weapon: cls.kit.weapon,
      ...(cls.kit.armour ? { armour: cls.kit.armour } : {}),
      ...(cls.kit.shield ? { shield: cls.kit.shield } : {}),
    },
    slotsUsed: stats.slots.map(() => 0),
    resources,
    conditions: [],
    completedQuests: [],
    pendingLevelUps: 0,
    shortRestsSinceLong: 0,
    dead: false,
  };
}
