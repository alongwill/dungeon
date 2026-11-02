import { describe, expect, it } from 'vitest';
import { step } from '../src/engine/state';
import { validateQuest } from '../src/engine/quest/validate';
import { evalCondition, interpolate } from '../src/engine/quest/eval';
import type { Quest } from '../src/engine/quest/types';
import questJson from '../quests/template-cellar-rats/quest.json';
import { ctxOf, makeHero, newGame, startQuest } from './helpers';

const quest = questJson as Quest;

describe('template quest validity', () => {
  it('validates cleanly', () => {
    const v = validateQuest(questJson);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });
});

describe('conditions and interpolation', () => {
  it('evaluates flag/item/gold/class/level conditions', () => {
    const s = newGame(makeHero('rogue'), 1);
    s.quest = { questId: 'q', questVersion: '1', sceneId: 'x', flags: { n: 3 }, visited: [], startGold: 0, startXp: 0, pending: null };
    s.hero!.gold = 30;
    expect(evalCondition({ flag: 'n', gte: 2 }, s, null)).toBe(true);
    expect(evalCondition({ flag: 'n', eq: 3 }, s, null)).toBe(true);
    expect(evalCondition({ flag: 'missing' }, s, null)).toBe(false);
    expect(evalCondition({ hasItem: 'potion-healing' }, s, null)).toBe(true);
    expect(evalCondition({ hasItem: 'longbow' }, s, null)).toBe(false);
    expect(evalCondition({ class: ['rogue', 'bard'] }, s, null)).toBe(true);
    expect(evalCondition({ class: ['wizard'] }, s, null)).toBe(false);
    expect(evalCondition({ gold: { gte: 20 } }, s, null)).toBe(true);
    expect(evalCondition({ level: { gte: 2 } }, s, null)).toBe(false);
    expect(evalCondition({ all: [{ class: ['rogue'] }, { gold: { gte: 20 } }] }, s, null)).toBe(true);
    expect(evalCondition({ not: { level: { gte: 2 } } }, s, null)).toBe(true);
    expect(evalCondition({ any: [{ level: { gte: 2 } }, { gold: { gte: 20 } }] }, s, null)).toBe(true);
  });

  it('interpolates hero and flags', () => {
    const s = newGame(makeHero('fighter', 'Borin'), 1);
    s.quest = { questId: 'q', questVersion: '1', sceneId: 'x', flags: { reward: 60 }, visited: [], startGold: 0, startXp: 0, pending: null };
    expect(interpolate('{{hero.name}} the Fighter gets {{flag.reward}} gp', s, null))
      .toBe('Borin the Fighter gets 60 gp');
  });
});

describe('quest runner', () => {
  const start = (seed = 7) => startQuest(newGame(makeHero('fighter'), seed), quest);

  it('startQuest enters the start scene', () => {
    const { state, events } = start();
    expect(state.status).toBe('inQuest');
    expect(state.quest!.sceneId).toBe('inn');
    expect(events.some((e) => e.type === 'sceneEnter' && e.sceneId === 'inn')).toBe(true);
  });

  it('a check choice stores a pending check; continue applies the outcome', () => {
    const { state } = start();
    const r = step(state, { type: 'choose', index: 1 }, ctxOf(quest)); // persuasion check
    expect(r.state.quest!.pending?.kind).toBe('check');
    expect(r.events.some((e) => e.type === 'roll')).toBe(true);
    const r2 = step(r.state, { type: 'continue' }, ctxOf(quest));
    // the persuasion outcome routes to 'cellar-stairs', itself a check scene
    expect(r2.state.quest!.sceneId).toBe('cellar-stairs');
    expect(r2.state.quest!.pending?.kind).toBe('check');
  });

  it('requires blocks unmet choices', () => {
    const q2: Quest = {
      ...quest,
      scenes: {
        ...quest.scenes,
        inn: {
          type: 'dialogue', title: 'T', text: 't', speaker: 'marta',
          choices: [{ text: 'Need 999 gold', requires: { gold: { gte: 999 } }, goto: 'inn' }],
        },
      },
    };
    const { state } = startQuest(newGame(makeHero('fighter'), 1), q2);
    const r = step(state, { type: 'choose', index: 0 }, ctxOf(q2));
    expect(r.events.some((e) => e.type === 'error')).toBe(true);
  });

  it('a plain choice moves to the next scene', () => {
    const { state } = start();
    const r = step(state, { type: 'choose', index: 0 }, ctxOf(quest));
    expect(r.state.quest!.sceneId).toBe('cellar-stairs');
  });

  it('the forced check scene sets pending with success/failure outcome', () => {
    // find a seed where the hero survives the ambush long enough to be in combat
    for (let seed = 1; seed < 50; seed++) {
      const { state } = start(seed);
      const r = step(state, { type: 'choose', index: 0 }, ctxOf(quest));
      expect(r.state.quest!.pending?.kind).toBe('check'); // cellar-stairs is a check scene
      const r2 = step(r.state, { type: 'continue' }, ctxOf(quest));
      expect(r2.state.quest!.sceneId).toBe('cellar');
      if (r2.state.status === 'inCombat') return;
    }
    throw new Error('no seed reached combat');
  });

  it('bardic inspiration can salvage a failed check', () => {
    const bard = makeHero('bard');
    // find a seed where the persuasion check fails
    let s0: ReturnType<typeof startQuest> | null = null;
    let failedSeed = -1;
    for (let seed = 1; seed < 300; seed++) {
      const r = startQuest(newGame(bard, seed), quest);
      const r2 = step(r.state, { type: 'choose', index: 1 }, ctxOf(quest));
      if (r2.state.quest!.pending?.kind === 'check' && !r2.state.quest!.pending.success) {
        s0 = { state: r2.state, events: r2.events };
        failedSeed = seed;
        break;
      }
    }
    expect(s0, `no failing seed found (tried ${failedSeed})`).not.toBeNull();
    const usesBefore = s0!.state.hero!.resources['inspiration']!;
    const r = step(s0!.state, { type: 'useInspiration' }, ctxOf(quest));
    expect(r.events.some((e) => e.type === 'roll' && /Inspiration/.test(e.label))).toBe(true);
    expect(r.state.hero!.resources['inspiration']).toBe(usesBefore - 1);
    const pend = r.state.quest!.pending;
    expect(pend?.kind === 'check' && pend.inspired).toBe(true);
    if (pend?.kind === 'check') {
      expect(pend.inspirationBonus).toBeGreaterThan(0);
      // the original roll is untouched — formatRoll stays consistent with its dice
      expect(pend.roll.total).toBe(pend.roll.rolls.filter((d) => d.kept).reduce((n, d) => n + d.value, 0) + pend.roll.modifier);
    }
  });


describe('step purity', () => {
  it('never mutates the input state', () => {
    const { state } = start(7);
    const deepFreeze = (o: unknown) => {
      if (o && typeof o === 'object') {
        for (const v of Object.values(o)) deepFreeze(v);
        Object.freeze(o);
      }
    };
    deepFreeze(state);
    const r = step(state, { type: 'choose', index: 0 }, ctxOf(quest));
    expect(r.state).not.toBe(state);
    expect(r.state.quest!.sceneId).toBe('cellar-stairs');
    expect(state.quest!.sceneId).toBe('inn');
  });
});
});

describe('check modifiers', () => {
  const mkQuest = (check: object): Quest => ({
    schemaVersion: 1, id: 'tq', version: '1', title: 'T', summary: '', start: 'c',
    scenes: {
      c: { type: 'check', title: 'C', text: 't', check: check as never,
        success: { goto: 'e' }, failure: { goto: 'e' } },
      e: { type: 'ending', outcome: 'neutral', title: 'E', text: 'e' },
    },
  });
  const lastRoll = (evs: ReturnType<typeof step>['events']) => {
    const r = [...evs].reverse().find((e) => e.type === 'roll');
    return r?.type === 'roll' ? r.result : undefined;
  };

  it('rangers get advantage on Survival checks (Natural Explorer)', () => {
    const q = mkQuest({ skill: 'survival', dc: 15 });
    const { state } = startQuest(newGame(makeHero('ranger'), 3), q);
    const roll = lastRoll(state === undefined ? [] : []);
    void roll;
    const pend = state.quest!.pending;
    expect(pend?.kind === 'check' && pend.roll.rolls.length === 2).toBe(true); // 2d20kh1
  });

  it('poisoned imposes disadvantage on checks', () => {
    const q = mkQuest({ skill: 'athletics', dc: 15 });
    const hero = makeHero('fighter');
    const s0 = newGame(hero, 3);
    s0.hero!.conditions.push({ name: 'poisoned', rounds: 5 });
    const { state } = startQuest(s0, q);
    const pend = state.quest!.pending;
    expect(pend?.kind === 'check' && pend.roll.rolls.length === 2).toBe(true); // 2d20kl1
  });

  it('advantageIf and a source of disadvantage cancel', () => {
    const q = mkQuest({ skill: 'survival', dc: 15, disadvantageIf: { flag: 'x' } });
    q.flags = { x: true }; // flag set before the check rolls at scene entry
    const hero = makeHero('ranger'); // natural explorer → advantage
    const s0 = newGame(hero, 3);
    const r = startQuest(s0, q);
    const pend = r.state.quest!.pending;
    expect(pend?.kind === 'check' && pend.roll.rolls.length === 1).toBe(true); // cancelled → 1d20
  });
});

describe('out-of-combat actions', () => {
  it('useItem works outside combat', () => {
    const s0 = newGame(makeHero('fighter'), 5);
    s0.hero!.hp = 3;
    const r = step(s0, { type: 'useItem', itemId: 'potion-healing' }, ctxOf(null));
    expect(r.events.some((e) => e.type === 'heal')).toBe(true);
    expect(r.state.hero!.inventory.find((i) => i.item === 'potion-healing')?.qty).toBe(1);
    expect(r.state.hero!.hp).toBeGreaterThan(3);
  });

  it('healing abilities work outside combat and pay costs', () => {
    const s0 = newGame(makeHero('paladin'), 5);
    s0.hero!.hp = 5;
    const r = step(s0, { type: 'useAbility', abilityId: 'lay-on-hands', amount: 4 }, ctxOf(null));
    expect(r.state.hero!.hp).toBe(9);
    expect(r.state.hero!.resources['lay-on-hands']).toBe(1);
    const r2 = step(s0, { type: 'useAbility', abilityId: 'bless' }, ctxOf(null));
    expect(r2.events.some((e) => e.type === 'error')).toBe(true);
  });

  it('a damage effect that drops the hero to 0 HP outside combat kills them', () => {
    const q: Quest = {
      schemaVersion: 1, id: 'tq', version: '1', title: 'T', summary: '', start: 'n',
      scenes: {
        n: { type: 'narration', title: 'N', text: 't', choices: [
          { text: 'boom', goto: 'n', effects: [{ damage: '40d6', type: 'fire' }] },
        ] },
        e: { type: 'ending', outcome: 'defeat', title: 'E', text: 'e' },
      },
    };
    const s0 = startQuest(newGame(makeHero('fighter'), 5), q).state;
    const r = step(s0, { type: 'choose', index: 0 }, ctxOf(q));
    expect(r.state.status).toBe('dead');
    expect(r.state.hero!.dead).toBe(true);
    expect(r.events.some((e) => e.type === 'death')).toBe(true);
  });
});
