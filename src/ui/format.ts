import type { AbilityDef } from '../content/abilities';
import type { Hero } from '../engine/model';
import { CLASSES } from '../content/classes';
import { abilityMod, abilityName, proficiencyBonus } from '../engine/rules';

/** Human-readable description of an ability with the hero's computed numbers,
 *  e.g. "Fire Bolt — spell attack +5, 1d10 fire". */
export function describeAbility(def: AbilityDef, hero: Hero): string {
  const cls = CLASSES[hero.classId];
  const prof = proficiencyBonus(hero.level);
  const parts: string[] = [];
  if (def.attack) {
    const ab = def.attack.ability === 'weapon' ? 'STR' : def.attack.ability;
    const mod = abilityMod(hero.abilities[ab]) + prof + (def.attack.bonus ?? 0);
    parts.push(`spell attack ${mod >= 0 ? '+' : ''}${mod}`);
  }
  if (def.damage) {
    const dmg = def.scalesAt && hero.level >= def.scalesAt.level ? def.scalesAt.damage : def.damage;
    parts.push(`${dmg}${def.damageType ? ` ${def.damageType}` : ''}`);
  }
  if (def.heal) {
    const mod = def.healAbility ? abilityMod(hero.abilities[def.healAbility]) : 0;
    parts.push(`heals ${def.heal}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ''}`);
  }
  if (def.save) {
    const casting = cls.castingAbility;
    const dc = casting ? 8 + prof + abilityMod(hero.abilities[casting]) : 10;
    parts.push(`${abilityName(def.save.ability)} save, difficulty ${dc}${def.save.half ? ' — half damage on success' : ''}`);
  }
  if (def.special === 'lay-on-hands') parts.push(`pool ${hero.resources['lay-on-hands'] ?? 0} health`);
  if (def.special === 'second-wind') parts.push(`heals 1d10+${hero.level}`);
  if (def.special === 'wild-shape') parts.push('11 beast health, Bite +4/2d4+2');
  if (def.special === 'magic-missile') parts.push('always hits');
  if (parts.length === 0 && def.description) return `${def.name} — ${def.description}`;
  return `${def.name} — ${parts.join(', ')}`;
}

const ORD = ['—', '1st', '2nd', '3rd', '4th', '5th'];
export const ord = (n: number) => ORD[n] ?? `${n}th`;

/** Cost label ("1st-level slot+", "Second Wind", "at will"). */
export function abilityCost(def: AbilityDef): string {
  const bits: string[] = [];
  if (def.slot !== undefined) bits.push(`${ord(def.slot)}-level slot+`);
  if (def.resource !== undefined) {
    const resDef = CLASSES[def.classId].resources[def.resource];
    bits.push(resDef?.name ?? def.resource.replace(/-/g, ' '));
  }
  return bits.length ? bits.join(', ') : 'at will';
}

/** Weapon attack line, e.g. "Longsword — attack +5, 1d8+3 slashing". */
export function describeWeapon(hero: Hero): string {
  const prof = proficiencyBonus(hero.level);
  const wid = hero.equipment.weapon;
  const w = wid ? WEAPONS[wid] : undefined;
  const str = abilityMod(hero.abilities.STR);
  const dex = abilityMod(hero.abilities.DEX);
  const mod = !w ? str : w.ability === 'STR' ? str : w.ability === 'DEX' ? dex : Math.max(str, dex);
  const name = w?.name ?? 'Unarmed strike';
  const dice = w?.damage ?? '1d4';
  const type = w?.damageType ?? 'bludgeoning';
  return `${name} — attack ${mod + prof >= 0 ? '+' : ''}${mod + prof}, ${dice}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ''} ${type}`;
}

import { ITEMS } from '../content/items';
const WEAPONS: Record<string, { name: string; damage: string; damageType: string; ability: string }> =
  Object.fromEntries(Object.entries(ITEMS).filter(([, v]) => v.kind === 'weapon').map(([k, v]) => [k, v as never]));

/** Lines for the class-details card: slots/resources + every ability (locked marked). */
export function classInfoLines(classId: import('../engine/quest/types').ClassId, hero: Hero): string[] {
  const cls = CLASSES[classId];
  const stats = deriveStatsOf(classId, hero.abilities, hero.level);
  const lines: string[] = [describeWeapon(hero)];
  lines.push(
    stats.slots.length
      ? `Spell slots: ${stats.slots.map((n, i) => `${n}× ${ord(i + 1)}-level`).join(', ')}`
      : Object.keys(cls.resources).length
        ? `Resources: ${Object.entries(cls.resources)
            .map(([id, d]) => `${d.name} ${resourceMax(classId, id, hero.abilities, hero.level)}/${d.per} rest`)
            .join(', ')}`
        : 'No spell slots',
  );
  for (const id of cls.abilities) {
    const a = ABILITIES[id]!;
    lines.push(
      a.minLevel <= hero.level ? describeAbility(a, hero) : `${a.name} (unlocks at level ${a.minLevel})`,
    );
  }
  return lines;
}

import { deriveStats as deriveStatsOf } from '../engine/character';
import { resourceMax } from '../engine/rules';
import { ABILITIES } from '../content/abilities';


/** Shared ability score rows for the abilities step, sheet and ASI picker. */
export function abilityRows(hero: Hero): { id: import('../engine/quest/types').AbilityId; name: string; score: number; mod: number }[] {
  return (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((id) => ({
    id, name: abilityName(id), score: hero.abilities[id], mod: abilityMod(hero.abilities[id]),
  }));
}

/** Pip groups for the Powers/Magic block: one group per resource, pips = resourceMax. */
export function resourcePips(hero: Hero): { id: string; name: string; left: number; max: number }[] {
  return Object.entries(hero.resources)
    .filter(([id]) => CLASSES[hero.classId].resources[id] && id !== 'lay-on-hands')
    .map(([id, n]) => ({
      id,
      name: CLASSES[hero.classId].resources[id]!.name,
      left: n,
      max: resourceMax(hero.classId, id, hero.abilities, hero.level),
    }));
}
