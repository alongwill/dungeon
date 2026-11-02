import { createHero, assignByPriority, STANDARD_ARRAY } from '../src/engine/character';
import { initialState, step } from '../src/engine/state';
import type { GameState, Hero, StepCtx } from '../src/engine/model';
import type { ClassId, Quest } from '../src/engine/quest/types';

export function makeHero(classId: ClassId = 'fighter', name = 'Test'): Hero {
  return createHero({
    classId,
    name,
    abilities: assignByPriority(STANDARD_ARRAY, classId),
    avatar: { seed: 1 },
  });
}

export function newGame(hero: Hero, seed = 42): GameState {
  return step(initialState(), { type: 'newGame', hero, seed }, { quest: null }).state;
}

export function startQuest(state: GameState, quest: Quest): { state: GameState; events: ReturnType<typeof step>['events'] } {
  return step(state, { type: 'startQuest' }, { quest });
}

export const ctxOf = (quest: Quest | null): StepCtx => ({ quest });

/** Minimal single-encounter quest for combat tests. */
export function combatQuest(enemyPatch: Partial<import('../src/engine/quest/types').EnemyDef> = {}, scenePatch: Record<string, unknown> = {}): Quest {
  return {
    schemaVersion: 1,
    id: 'test-combat',
    version: '1.0.0',
    title: 'Test Combat',
    summary: '',
    start: 'fight',
    enemies: {
      gobbo: {
        name: 'Gobbo', ac: 5, hp: '1d2', dex: 10, passivePerception: 8, xp: 50,
        actions: [{ name: 'Poke', attack: 0, damage: '1d2', type: 'piercing' }],
        ...enemyPatch,
      },
    },
    scenes: {
      fight: {
        type: 'encounter', title: 'Fight', text: 'fight!',
        enemies: [{ enemy: 'gobbo' }],
        victory: { goto: 'win' },
        flee: { goto: 'away' },
        ...scenePatch,
      },
      win: { type: 'ending', outcome: 'victory', title: 'Win', text: 'won', xp: 10 },
      away: { type: 'ending', outcome: 'neutral', title: 'Away', text: 'fled' },
    },
  };
}
