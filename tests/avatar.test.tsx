import { describe, expect, it } from 'vitest';
import { randomAvatar, suggestAvatars } from '../src/avatar/generate';
import { rngFromSeed } from '../src/engine/dice';
import {
  ACCESSORIES, EYES, HAIR_COLOURS, HAIR_STYLES, MOUTHS, SKINS,
} from '../src/avatar/parts';

describe('avatars', () => {
  it('is deterministic for a seed', () => {
    const a = suggestAvatars('fighter', rngFromSeed(7), 6);
    const b = suggestAvatars('fighter', rngFromSeed(7), 6);
    expect(a.specs).toEqual(b.specs);
  });

  it('suggests n specs with every field in range', () => {
    const { specs } = suggestAvatars('rogue', rngFromSeed(42), 6);
    expect(specs).toHaveLength(6);
    for (const s of specs) {
      expect(s.frame).toBe('rogue');
      expect(Object.keys(SKINS)).toContain(s.skin);
      expect(HAIR_STYLES).toContain(s.hair);
      expect(Object.keys(HAIR_COLOURS)).toContain(s.hairColour);
      expect(EYES).toContain(s.eyes);
      expect(MOUTHS).toContain(s.mouth);
      expect(ACCESSORIES).toContain(s.accessory);
      expect(Number.isInteger(s.seed)).toBe(true);
    }
  });

  it('different seeds give different specs', () => {
    const a = randomAvatar('wizard', rngFromSeed(1)).spec;
    const b = randomAvatar('wizard', rngFromSeed(2)).spec;
    expect(a).not.toEqual(b);
  });
});

describe('creature avatars', () => {
  it('every creature kind and fallback produce an svg vnode', async () => {
    const { Avatar } = await import('../src/avatar/Avatar');
    for (const creature of ['goblin', 'wolf', 'rat', 'skeleton', 'troll', 'beast', 'unknown-thing']) {
      const vnode = Avatar({ spec: { seed: 3, frame: 'enemy', creature }, size: 64, label: creature });
      expect(vnode.type).toBe('svg');
      expect(vnode.props['aria-label']).toBe(creature);
    }
  });
  it('seed produces palette variation', async () => {
    const { Creature } = await import('../src/avatar/Avatar');
    const flat = (v: unknown): string => JSON.stringify(v);
    const a = flat(Creature({ kind: 'wolf', seed: 0 }));
    const b = flat(Creature({ kind: 'wolf', seed: 1 }));
    expect(a).not.toBe(b);
  });
});

// abilityRows feeds the abilities step, sheet and ASI picker
import { describe as d2, expect as e2, it as it2 } from 'vitest';
import { abilityRows } from '../src/ui/format';
import { createHero } from '../src/engine/character';

d2('abilityRows', () => {
  it2('returns all six abilities with full names and correct modifiers', () => {
    const hero = createHero({ classId: 'wizard', name: 'T', abilities: { STR: 8, DEX: 14, CON: 12, INT: 15, WIS: 13, CHA: 10 }, avatar: { seed: 1 } });
    const rows = abilityRows(hero);
    e2(rows).toHaveLength(6);
    e2(rows[0]).toEqual({ id: 'STR', name: 'Strength', score: 8, mod: -1 });
    e2(rows[3]!.name).toBe('Intelligence');
    e2(rows[3]!.mod).toBe(2);
  });
});

import { resourcePips } from '../src/ui/format';
import { assignByPriority, STANDARD_ARRAY } from '../src/engine/character';
import { resourceMax } from '../src/engine/rules';
import { CLASS_IDS } from '../src/content/classes';
import { XP_THRESHOLDS } from '../src/engine/rules';

d2('resourcePips', () => {
  it2('pip count equals resourceMax for every class at levels 1 and 5', () => {
    for (const classId of CLASS_IDS) {
      for (const level of [1, 5]) {
        const hero = createHero({ classId, name: 'T', abilities: assignByPriority(STANDARD_ARRAY, classId), avatar: { seed: 1 } });
        hero.level = level;
        hero.xp = XP_THRESHOLDS[level] ?? 0;
        // refresh resources like a long rest would
        for (const id of Object.keys(hero.resources))
          hero.resources[id] = resourceMax(classId, id, hero.abilities, level);
        for (const g of resourcePips(hero)) {
          e2(g.max).toBe(resourceMax(classId, g.id, hero.abilities, level));
          e2(g.max).toBeGreaterThan(0);
          e2(g.id).not.toBe('lay-on-hands');
        }
      }
    }
  });
});
