import { describe, expect, it } from 'vitest';
import { sfxForEvent } from '../src/sfx';
import { medals, questStats } from '../src/ui/stats';
import { inferBackdrop } from '../src/ui/art/SceneArt';
import { BACKDROPS } from '../src/engine/quest/schema-enums';
import { validateQuest } from '../src/engine/quest/validate';
import { DEFAULT_SETTINGS, loadSettings, MemoryAdapter } from '../src/persistence';
import { CREATURE_KINDS } from '../src/avatar/Avatar';
import type { GameEvent } from '../src/engine/model';
import cellar from '../quests/template-cellar-rats/quest.json';

const roll = (over: Partial<Extract<GameEvent, { type: 'roll' }>>): GameEvent => ({
  type: 'roll', label: 'x', actor: 'hero', actorName: 'Hero', purpose: 'attack', parts: [], finalTotal: 10,
  result: { expr: '1d20', rolls: [], total: 10, modifier: 0, nat20: false, nat1: false } as never, ...over,
});

describe('sfxForEvent', () => {
  it('maps combat events to sounds', () => {
    expect(sfxForEvent(roll({ outcome: 'crit' }))).toBe('crit');
    expect(sfxForEvent(roll({ outcome: 'miss' }))).toBe('miss');
    expect(sfxForEvent(roll({ outcome: 'hit' }))).toBe('dice');
    expect(sfxForEvent(roll({ actor: 'gob', outcome: 'hit' }))).toBeNull();
    expect(sfxForEvent(roll({ purpose: 'initiative' }))).toBeNull();
    expect(sfxForEvent(roll({ purpose: 'check', outcome: 'success' }))).toBe('success');
    expect(sfxForEvent({ type: 'damage', target: 'hero', amount: 3 })).toBe('hurt');
    expect(sfxForEvent({ type: 'damage', target: 'rat-1', amount: 3, hpLeft: 2, damageType: 'slashing' })).toBe('hit');
    expect(sfxForEvent({ type: 'damage', target: 'rat-1', amount: 3, hpLeft: 2, damageType: 'fire' })).toBe('spell');
    expect(sfxForEvent({ type: 'damage', target: 'rat-1', amount: 3, hpLeft: 0 })).toBe('enemyDown');
    expect(sfxForEvent({ type: 'damage', target: 'rat-1', amount: 0 })).toBeNull();
    expect(sfxForEvent({ type: 'combatEnd', result: 'victory' })).toBe('victory');
    expect(sfxForEvent({ type: 'narrate', text: 'hi' })).toBeNull();
  });
});

describe('questStats', () => {
  it('only counts events after the previous quest completed', () => {
    const evs: GameEvent[] = [
      { type: 'damage', target: 'old', amount: 99, hpLeft: 0 },
      { type: 'questComplete', outcome: 'victory', xp: 1 },
      { type: 'combatStart' },
      roll({ outcome: 'crit' }),
      { type: 'damage', target: 'rat-1', amount: 7, hpLeft: 0 },
      { type: 'damage', target: 'rat-2', amount: 4, hpLeft: 3 },
      { type: 'damage', target: 'hero', amount: 5 },
      { type: 'heal', target: 'hero', amount: 6 },
      roll({ purpose: 'check', outcome: 'success' }),
      roll({ purpose: 'check', outcome: 'failure' }),
      { type: 'questComplete', outcome: 'victory', xp: 1 },
    ];
    expect(questStats(evs)).toEqual({
      foes: 1, crits: 1, dealt: 11, taken: 5, healed: 6, checksPassed: 1, checksTotal: 2, battles: 1,
    });
  });
  it('awards medals', () => {
    const names = medals({ foes: 0, crits: 0, dealt: 0, taken: 0, healed: 0, checksPassed: 3, checksTotal: 3, battles: 0 }).map((m) => m.name);
    expect(names.some((n) => n.startsWith('Silver Tongue'))).toBe(true);
    expect(names).toContain('Flawless Wits');
  });
});

describe('backdrops', () => {
  it('uses an explicit backdrop, else keywords, else road', () => {
    expect(inferBackdrop({ title: 'x', text: 'y', backdrop: 'cave' })).toBe('cave');
    expect(inferBackdrop({ title: 'The flooded crypt', text: '' })).toBe('crypt');
    expect(inferBackdrop({ title: 'Somewhere', text: 'Reeds and mud of the marsh.' })).toBe('marsh');
    expect(inferBackdrop({ title: 'Somewhere', text: 'Nothing to see.' })).toBe('road');
    for (const b of BACKDROPS) expect(inferBackdrop({ title: '', text: '', backdrop: b })).toBe(b);
  });
  it('validator rejects unknown backdrops', () => {
    const q = structuredClone(cellar) as { scenes: Record<string, Record<string, unknown>> };
    q.scenes.inn!.backdrop = 'moon';
    const v = validateQuest(q);
    expect(v.ok).toBe(false);
    expect(v.errors.join()).toMatch(/unknown backdrop "moon"/);
  });
});

describe('settings', () => {
  it('sound defaults on and older saved settings gain it', () => {
    expect(DEFAULT_SETTINGS.sound).toBe(true);
    const a = new MemoryAdapter();
    a.set('dungeon:settings', JSON.stringify({ animations: false, rollPlaybackMs: 150, autoRoll: true }));
    expect(loadSettings(a)).toEqual({ animations: false, rollPlaybackMs: 150, autoRoll: true, sound: true });
  });
});

describe('creature kinds', () => {
  it('includes the new kinds and each renders an svg group', async () => {
    const { Creature } = await import('../src/avatar/Avatar');
    for (const k of ['spider', 'wisp', 'bandit', 'bat', 'slime', 'ghost']) {
      expect(CREATURE_KINDS).toContain(k);
      expect(Creature({ kind: k, seed: 1 }).type).toBe('g');
    }
  });
});
