import { describe, expect, it } from 'vitest';
import { nextPlaybackCursor } from '../src/ui/playback';
import type { GameEvent } from '../src/engine/model';
import { rngFromSeed, roll } from '../src/engine/dice';

const r = (label: string): GameEvent => {
  const result = roll('1d20', rngFromSeed(1)).result;
  return { type: 'roll', label, result, actor: 'x', actorName: 'X', purpose: 'other', parts: [], finalTotal: result.total };
};
const narrate = (text: string): GameEvent => ({ type: 'narrate', text });
const scene = (): GameEvent => ({ type: 'sceneEnter', sceneId: 'x', title: 't' });
const combatStart = (): GameEvent => ({ type: 'combatStart' });
const turn = (): GameEvent => ({ type: 'turnStart', who: 'hero' });
const levelUp = (): GameEvent => ({ type: 'levelUpAvailable' });

describe('nextPlaybackCursor', () => {
  it('reveals one renderable event per tick', () => {
    const q = [r('attack'), r('save'), narrate('ow')];
    expect(nextPlaybackCursor(q, 0)).toBe(1);
    expect(nextPlaybackCursor(q, 1)).toBe(2);
    expect(nextPlaybackCursor(q, 2)).toBe(3);
  });
  it('instant events (sceneEnter/combatStart/unrendered) cost no tick', () => {
    const q = [scene(), combatStart(), r('attack'), scene()];
    expect(nextPlaybackCursor(q, 0)).toBe(4); // scene+combat free, attack tick, scene rides along
  });
  it('renderable events do not ride along', () => {
    const q = [r('attack'), levelUp()];
    expect(nextPlaybackCursor(q, 0)).toBe(1);
  });
  it('consecutive initiative rolls reveal as a single tick', () => {
    const q = [r('Initiative: A'), r('Initiative: B'), r('Initiative: C'), r('attack')];
    expect(nextPlaybackCursor(q, 0)).toBe(3);
    expect(nextPlaybackCursor(q, 3)).toBe(4);
  });
  it('turnStart is a real divider tick', () => {
    const q = [turn(), turn()];
    expect(nextPlaybackCursor(q, 0)).toBe(1);
  });
  it('clamps at the end', () => {
    const q = [scene()];
    expect(nextPlaybackCursor(q, 0)).toBe(1);
  });
});

import { displayState, playbackSettled } from '../src/ui/display';

describe('displayState', () => {
  const enemy = (hp: number) => ({ id: 'e1', hp, maxHp: 7, dead: hp === 0, fled: false } as const);
  const q = [
    { type: 'damage', target: 'e1', amount: 4, targetName: 'E1', hpLeft: 3, hpMax: 7 },
    { type: 'damage', target: 'e1', amount: 3, targetName: 'E1', hpLeft: 0, hpMax: 7 },
    { type: 'damage', target: 'hero', amount: 5, targetName: 'T', hpLeft: 0, hpMax: 13 },
    { type: 'heal', target: 'hero', amount: 2 },
  ] as never[];
  const game = {
    hero: { hp: 2, maxHp: 13, dead: false },
    combat: { enemies: [enemy(0)], beastHp: 0 },
  } as never;

  it('rewinds health by unrevealed damage and heal events', () => {
    const shown = displayState(game, q, 1); // events 1,2,3 unrevealed
    expect(shown.combat!.enemies[0]!.hp).toBe(3); // 0 + 3
    expect(shown.combat!.enemies[0]!.dead).toBe(false);
    expect(shown.hero!.hp).toBe(5); // 2 +5 -2
  });
  it('enemy stays dead-in-display only after its kill event reveals', () => {
    const shown = displayState(game, q, 2); // last two unrevealed: hero dmg + heal
    expect(shown.combat!.enemies[0]!.dead).toBe(true);
  });
  it('playbackSettled gates on cursor and pending roll', () => {
    expect(playbackSettled(q, 4, null)).toBe(true);
    expect(playbackSettled(q, 4, { type: 'roll' } as never)).toBe(false);
    expect(playbackSettled(q, 3, null)).toBe(false);
  });
});

import { firstUngatedHeroRoll, pendingRoll, tickDelay } from '../src/ui/playback';
import { explainRoll } from '../src/ui/describe';

const hr = (purpose: 'attack' | 'damage' | 'heal' | 'gold', actor = 'hero'): GameEvent => {
  const result = roll('1d20', rngFromSeed(3)).result;
  return { type: 'roll', label: purpose, result, actor, actorName: actor === 'hero' ? 'You' : 'Rat', purpose, parts: [], finalTotal: result.total };
};

describe('manual-roll gates for actions without a d20', () => {
  it('finds the first hero roll when it is not already gated', () => {
    expect(firstUngatedHeroRoll([narrate('x'), hr('damage'), hr('damage')])).toBe(1); // magic missile
    expect(firstUngatedHeroRoll([hr('heal')])).toBe(0);
    expect(firstUngatedHeroRoll([hr('attack'), hr('damage')])).toBeNull(); // attack already gated
    expect(firstUngatedHeroRoll([hr('attack', 'rat-1')])).toBeNull();
    expect(firstUngatedHeroRoll([hr('gold')])).toBeNull();
  });
  it('extra gates stop playback before that roll', () => {
    const q = [narrate('cast'), hr('damage'), narrate('ow')];
    const gates = new Set([1]);
    expect(nextPlaybackCursor(q, 0, true, gates)).toBe(1);
    expect(pendingRoll(q, 1, gates)).toBe(q[1]);
    expect(nextPlaybackCursor(q, 0, true)).toBe(1); // without a gate: one tick only, then continues
    expect(nextPlaybackCursor(q, 1, true)).toBe(2);
  });
});

describe('tickDelay', () => {
  it('gives enemy rolls and turn changes more time', () => {
    expect(tickDelay([hr('attack', 'rat-1')], 0, 350)).toBe(1050);
    expect(tickDelay([hr('damage', 'rat-1')], 0, 350)).toBe(700);
    expect(tickDelay([turn()], 0, 350)).toBe(700);
    expect(tickDelay([hr('attack')], 0, 350)).toBe(350);
    expect(tickDelay([hr('attack', 'rat-1')], 0, 0)).toBe(0);
  });
});

describe('explainRoll', () => {
  it('explains hits and enemy attacks in plain words', () => {
    const base = roll('1d20', rngFromSeed(5)).result;
    const d = base.rolls[0]!.value;
    const mk = (actor: string): Extract<GameEvent, { type: 'roll' }> => ({
      type: 'roll', label: 'a', result: { ...base, nat20: false, nat1: false }, actor, actorName: actor === 'hero' ? 'You' : 'Rat',
      purpose: 'attack', parts: [{ label: 'Strength', value: 3 }], finalTotal: d + 3, vs: { kind: 'armour', value: 12 }, targetName: 'Rat',
    });
    expect(explainRoll(mk('hero'))).toBe(`You needed 12 to hit Rat: d20 rolled ${d} + 3 bonus = ${d + 3}.`);
    expect(explainRoll(mk('rat-1'))).toMatch(/^Rat needed 12 to hit you \(your armour\)/);
  });
});
