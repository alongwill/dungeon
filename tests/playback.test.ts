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
