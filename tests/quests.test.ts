import { describe, expect, it } from 'vitest';
import { validateQuest } from '../src/engine/quest/validate';
import questJson from '../quests/template-cellar-rats/quest.json';

const questModules = import.meta.glob('/quests/*/quest.json', { eager: true });

describe('shipped quests', () => {
  it('finds at least one quest', () => {
    expect(Object.keys(questModules).length).toBeGreaterThan(0);
  });

  it.each(Object.keys(questModules))('%s validates with zero errors', (path) => {
    const mod = questModules[path] as { default?: unknown } | unknown;
    const json = (mod as { default?: unknown }).default ?? mod;
    const v = validateQuest(json);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
    const dir = path.split('/')[2];
    expect((json as { id: string }).id).toBe(dir); // folder name = quest id
  });
});

describe('validator negative cases', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = () => JSON.parse(JSON.stringify(questJson)) as any;

  it('flags a bad goto', () => {
    const q = clone();
    q.scenes.inn.choices[0].goto = 'nowhere';
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /goto/.test(e))).toBe(true);
  });

  it('flags a bad enemy ref', () => {
    const q = clone();
    q.scenes.cellar.enemies.push({ enemy: 'dragon' });
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /enemy/.test(e))).toBe(true);
  });

  it('flags bad dice', () => {
    const q = clone();
    q.scenes.spoils.gold = '2dx+';
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /gold|dice/i.test(e))).toBe(true);
  });

  it('flags a quest with no reachable ending', () => {
    const q = clone();
    for (const s of Object.values(q.scenes) as any[]) {
      if (s.type === 'narration' || s.type === 'dialogue') {
        for (const c of s.choices) {
          if (c.goto) c.goto = 'inn';
          if (c.success) c.success.goto = 'inn';
          if (c.failure) c.failure.goto = 'inn';
        }
      } else if (s.type === 'check') {
        s.success.goto = 'inn';
        s.failure.goto = 'inn';
      } else if (s.type === 'encounter') {
        s.victory.goto = 'inn';
        if (s.flee) s.flee.goto = 'inn';
        if (s.defeat) s.defeat.goto = 'inn';
      } else if (s.type === 'loot') {
        s.next.goto = 'inn';
      }
    }
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /ending/.test(e))).toBe(true);
    expect(v.warnings.length).toBeGreaterThan(0); // unreachable scenes
  });

  it('flags unknown skill names', () => {
    const q = clone();
    q.scenes.inn.choices[1].check.skill = 'juggling';
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /skill/.test(e))).toBe(true);
  });

  it('flags an unknown speaker', () => {
    const q = clone();
    q.scenes.inn.speaker = 'ghost';
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
  });

  it('flags a canFlee encounter with no flee outcome', () => {
    const q = clone();
    delete q.scenes.cellar.flee;
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /flee/.test(e))).toBe(true);
  });

  it('flags a missing start scene', () => {
    const q = clone();
    q.start = 'nowhere';
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
  });
});
