import { describe, expect, it } from 'vitest';
import { nextPlaybackCursor } from '../src/ui/playback';
import type { GameEvent } from '../src/engine/model';
import { rngFromSeed, roll } from '../src/engine/dice';

const r = (label: string): GameEvent => ({ type: 'roll', label, result: roll('1d20', rngFromSeed(1)).result });
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
