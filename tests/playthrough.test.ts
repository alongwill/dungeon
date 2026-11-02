import { describe, expect, it } from 'vitest';
import { step } from '../src/engine/state';
import type { GameState } from '../src/engine/model';
import type { Quest } from '../src/engine/quest/types';
import questJson from '../quests/template-cellar-rats/quest.json';
import { ctxOf, makeHero, newGame, startQuest } from './helpers';

const quest = questJson as Quest;

/** Scripted headless playthrough: talk → check → fight → loot → ending. */
describe('headless playthrough of template-cellar-rats', () => {
  it('reaches an ending', () => {
    // find a seed where the hero survives the ambush into actual combat
    let s: GameState | null = null;
    for (let seed = 1; seed < 80; seed++) {
      const c = startQuest(newGame(makeHero('fighter', 'Borin'), seed), quest).state;
      const c2 = step(step(c, { type: 'choose', index: 0 }, { quest }).state, { type: 'continue' }, { quest }).state;
      if (c2.status === 'inCombat') { s = c; break; }
    }
    expect(s).not.toBeNull();
    if (!s) throw new Error('no seed reached combat');
    let cur: GameState = s;
    const ctx = ctxOf(quest);
    const seen: string[] = [];
    const run = (a: Parameters<typeof step>[1]) => {
      const r = step(cur, a, ctx);
      cur = r.state;
      for (const e of r.events) if (e.type === 'sceneEnter') seen.push(e.sceneId);
      return r;
    };

    run({ type: 'choose', index: 0 }); // "Consider it done."
    expect(cur.quest!.pending?.kind).toBe('check'); // cellar stairs check
    run({ type: 'continue' }); // → combat
    expect(cur.status).toBe('inCombat');

    // fight until victory (or flee/defeat — all valid endings for the test)
    let guard = 0;
    while (cur.status === 'inCombat' && guard++ < 100) {
      const combat = cur.combat!;
      if (!combat.heroTurn) break;
      const target = combat.enemies.find((e) => !e.dead && !e.fled);
      if (!target) break;
      run({ type: 'attack', targetId: target.id });
      // the fighter still has a usable bonus action, so the turn may not auto-end
      if (cur.combat && !cur.combat.result && cur.combat.heroTurn) run({ type: 'endTurn' });
    }
    expect(guard).toBeLessThan(100);
    expect(['inQuest', 'questComplete', 'dead']).toContain(cur.status);

    if (cur.status === 'inQuest' && cur.quest!.pending?.kind === 'loot') {
      const goldBefore = cur.hero!.gold;
      expect(seen).toContain('spoils');
      run({ type: 'continue' });
      expect(cur.status).toBe('questComplete');
      expect(cur.hero!.completedQuests).toContain('template-cellar-rats');
      expect(cur.hero!.xp).toBeGreaterThan(0);
      void goldBefore;
    }
    expect(cur.status).toBe('questComplete');
    expect(cur.hero!.completedQuests).toContain('template-cellar-rats');
  });
});
