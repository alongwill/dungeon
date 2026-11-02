import { describe, expect, it } from 'vitest';
import {
  abilityMod,
  computeAC,
  FULL_CASTER_SLOTS,
  HALF_CASTER_SLOTS,
  hpGainPerLevel,
  proficiencyBonus,
  SKILL_ABILITY,
} from '../src/engine/rules';
import {
  assignByPriority,
  createHero,
  deriveStats,
  rollAbilityScores,
  STANDARD_ARRAY,
  swapAbilities,
} from '../src/engine/character';
import { rngFromSeed } from '../src/engine/dice';
import { CLASSES, CLASS_IDS } from '../src/content/classes';
import { ABILITIES } from '../src/content/abilities';
import { ITEMS } from '../src/content/items';

describe('rules', () => {
  it('ability modifiers', () => {
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(20)).toBe(5);
    expect(abilityMod(3)).toBe(-4);
  });

  it('proficiency by level', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(4)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
  });

  it('skill→ability map has 15 skills', () => {
    expect(Object.keys(SKILL_ABILITY)).toHaveLength(15);
    expect(SKILL_ABILITY.athletics).toBe('STR');
    expect(SKILL_ABILITY.persuasion).toBe('CHA');
  });

  it('AC from equipment', () => {
    expect(computeAC(undefined, false, 2)).toBe(12);
    expect(computeAC('light', false, 3)).toBe(14);
    expect(computeAC('medium', false, 4)).toBe(16); // dex capped +2
    expect(computeAC('heavy', false, 5)).toBe(16);
    expect(computeAC('heavy', true, 0)).toBe(18);
  });

  it('slot tables', () => {
    expect(FULL_CASTER_SLOTS[1]).toEqual([2]);
    expect(FULL_CASTER_SLOTS[5]).toEqual([4, 3, 2]);
    expect(HALF_CASTER_SLOTS[1]).toEqual([1]);
    expect(HALF_CASTER_SLOTS[5]).toEqual([4, 2]);
  });
});

describe('classes data', () => {
  it('has all 8 classes', () => {
    expect(CLASS_IDS).toHaveLength(8);
  });
  it.each(CLASS_IDS)('%s: kit items exist, abilities resolve', (id) => {
    const cls = CLASSES[id];
    for (const k of cls.kit.items) expect(ITEMS[k.item], `${id} kit ${k.item}`).toBeDefined();
    for (const a of cls.abilities) expect(ABILITIES[a], `${id} ability ${a}`).toBeDefined();
    expect(cls.abilityPriority).toHaveLength(6);
  });
});

describe('character creation', () => {
  it('rolls six 4d6dl1 scores', () => {
    const { rolls } = rollAbilityScores(rngFromSeed(1));
    expect(rolls).toHaveLength(6);
    for (const r of rolls) {
      expect(r.rolls).toHaveLength(4);
      expect(r.rolls.filter((d) => d.kept)).toHaveLength(3);
      expect(r.total).toBeGreaterThanOrEqual(3);
      expect(r.total).toBeLessThanOrEqual(18);
    }
  });

  it('assignByPriority puts best score on primary ability', () => {
    const ab = assignByPriority(STANDARD_ARRAY, 'wizard');
    expect(ab.INT).toBe(15);
    expect(ab.DEX).toBe(14);
    const f = assignByPriority(STANDARD_ARRAY, 'fighter');
    expect(f.STR).toBe(15);
    expect(f.CON).toBe(14);
  });

  it('swapAbilities swaps two scores', () => {
    const ab = assignByPriority(STANDARD_ARRAY, 'wizard');
    const sw = swapAbilities(ab, 'INT', 'STR');
    expect(sw.INT).toBe(ab.STR);
    expect(sw.STR).toBe(ab.INT);
  });

  it('deriveStats: fighter L1', () => {
    const ab = assignByPriority(STANDARD_ARRAY, 'fighter');
    const d = deriveStats('fighter', ab, 1);
    expect(d.maxHp).toBe(20 + 2); // solo-hero rule: 2×hitDie + CON mod (14 → +2)
    expect(d.ac).toBe(18); // chain mail + shield
    expect(d.slots).toEqual([]);
  });

  it('deriveStats: wizard slots scale with level', () => {
    const ab = assignByPriority(STANDARD_ARRAY, 'wizard');
    expect(deriveStats('wizard', ab, 1).slots).toEqual([2]);
    expect(deriveStats('wizard', ab, 5).slots).toEqual([4, 3, 2]);
    expect(deriveStats('wizard', ab, 5).saveDC).toBe(8 + 3 + abilityMod(15));
  });

  it('hp gain per level is fixed', () => {
    expect(hpGainPerLevel(10, 2)).toBe(8); // 10/2+1+2
    expect(hpGainPerLevel(6, -2)).toBe(2);
    expect(hpGainPerLevel(6, -5)).toBe(1); // min 1
  });

  it('createHero equips the starting kit', () => {
    const h = createHero({
      classId: 'paladin',
      name: 'Aldric',
      abilities: assignByPriority(STANDARD_ARRAY, 'paladin'),
      avatar: { seed: 9 },
    });
    expect(h.equipment.weapon).toBe('longsword');
    expect(h.equipment.armour).toBe('chain-mail');
    expect(h.equipment.shield).toBe('shield');
    expect(h.slotsUsed).toEqual([0]); // half caster, 1 slot at L1
    expect(h.resources['lay-on-hands']).toBe(5);
    expect(h.gold).toBe(10);
  });
});

describe('format helpers', () => {
  it('describeWeapon computes attack and damage from the equipped weapon', async () => {
    const { describeWeapon } = await import('../src/ui/format');
    const h = createHero({ classId: 'fighter', name: 'T', abilities: assignByPriority(STANDARD_ARRAY, 'fighter'), avatar: { seed: 1 } });
    expect(describeWeapon(h)).toBe('Longsword — attack +4, 1d8+2 slashing');
  });
  it('classInfoLines lists weapon, resources and all abilities with locks', async () => {
    const { classInfoLines } = await import('../src/ui/format');
    const h = createHero({ classId: 'fighter', name: 'T', abilities: assignByPriority(STANDARD_ARRAY, 'fighter'), avatar: { seed: 1 } });
    const lines = classInfoLines('fighter', h);
    expect(lines[0]).toMatch(/Longsword — attack/);
    expect(lines.some((l) => /Resources: Second Wind 1\/short rest/.test(l))).toBe(true);
    expect(lines.some((l) => /Extra Attack \(unlocks at level 5\)/.test(l))).toBe(true);
    const w = createHero({ classId: 'wizard', name: 'T', abilities: assignByPriority(STANDARD_ARRAY, 'wizard'), avatar: { seed: 1 } });
    expect(classInfoLines('wizard', w).some((l) => /Spell slots: 2× 1st-level/.test(l))).toBe(true);
  });
});
