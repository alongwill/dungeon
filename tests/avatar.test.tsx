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
