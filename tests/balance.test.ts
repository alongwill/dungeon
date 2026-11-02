import { describe, expect, it } from 'vitest';
import { startCombat } from '../src/engine/combat';
import { createHero, assignByPriority, STANDARD_ARRAY, deriveStats } from '../src/engine/character';
import { step } from '../src/engine/state';
import { initialState } from '../src/engine/state';
import { resourceMax, XP_THRESHOLDS } from '../src/engine/rules';
import { ABILITIES } from '../src/content/abilities';
import { CLASSES, CLASS_IDS } from '../src/content/classes';
import type { ClassId, EncounterScene, Quest } from '../src/engine/quest/types';
import type { GameState, Hero } from '../src/engine/model';
import hollowmere from '../quests/hollowmere-bell/quest.json';
import cellar from '../quests/template-cellar-rats/quest.json';

const HOLLOW = hollowmere as unknown as Quest;
const CELLAR = cellar as unknown as Quest;

function heroAtLevel(classId: ClassId, level: number): Hero {
  const h = createHero({
    classId, name: 'Sim',
    abilities: assignByPriority(STANDARD_ARRAY, classId),
    avatar: { seed: 1 },
  });
  // level up through the engine's own rules for accuracy
  h.xp = XP_THRESHOLDS[level] ?? 0;
  h.pendingLevelUps = level - 1;
  let s = step(initialState(), { type: 'newGame', hero: h, seed: 1 }, { quest: null }).state;
  while (s.hero!.pendingLevelUps > 0) {
    const next = s.hero!.level + 1;
    s = step(s, { type: 'levelUp', ...(next === 4 ? { asi: { STR: 2 } } : {}) }, { quest: null }).state;
  }
  const hero = s.hero!;
  // fresh for the fight
  hero.hp = hero.maxHp;
  hero.slotsUsed = hero.slotsUsed.map(() => 0);
  const cls = CLASSES[classId];
  for (const [id, def] of Object.entries(cls.resources)) {
    if (def.minLevel <= hero.level) hero.resources[id] = resourceMax(classId, id, hero.abilities, hero.level);
  }
  return hero;
}

/** Greedy policy: heal under 35%, else best damage option, else attack. */
function heroAction(s: GameState, _quest: Quest): Parameters<typeof step>[1] | null {
  const c = s.combat!;
  const hero = s.hero!;
  const combat = c;
  const ht = c.heroTurn;
  if (!ht) return null;
  const actionOpen = !ht.actionUsed || ht.extraAction;
  const alive = c.enemies.filter((e) => !e.dead && !e.fled);
  if (!alive.length) return null;
  const tgt = alive.reduce((a, b) => (a.hp < b.hp ? a : b)).id;

  if (actionOpen && hero.hp / hero.maxHp < 0.35) {
    // heal options
    const potion = hero.inventory.find((i) => i.item === 'potion-healing');
    if (potion) return { type: 'useItem', itemId: 'potion-healing' };
    const healAbilities = CLASSES[hero.classId].abilities
      .map((id) => ABILITIES[id]!)
      .filter((a) => a.minLevel <= hero.level && (a.heal || a.special === 'lay-on-hands' || a.special === 'second-wind'));
    for (const a of healAbilities) {
      if (a.kind === 'action' || (a.kind === 'bonus' && !ht.bonusUsed)) {
        if (a.slot !== undefined) {
          const max = deriveStats(hero.classId, hero.abilities, hero.level).slots;
          for (let l = max.length; l >= (a.slot ?? 1); l--) {
            if ((hero.slotsUsed[l - 1] ?? 0) < (max[l - 1] ?? 0))
              return { type: 'useAbility', abilityId: a.id, slotLevel: l };
          }
          continue;
        }
        if (a.resource && (hero.resources[a.resource] ?? 0) <= 0) continue;
        return { type: 'useAbility', abilityId: a.id, ...(a.special === 'lay-on-hands' ? { amount: hero.maxHp - hero.hp } : {}) };
      }
    }
  }

  // rogue: hide first each turn so attacks carry advantage + Sneak Attack
  if (hero.classId === 'rogue' && actionOpen && !ht.bonusUsed &&
      !hero.conditions.some((x) => x.name === 'hidden'))
    return { type: 'useAbility', abilityId: 'cunning-hide' };

  if (actionOpen) {
    // best affordable damaging action ability (prefer slots > cantrip > weapon)
    const cls = CLASSES[hero.classId];
    const dmgAbilities = cls.abilities
      .map((id) => ABILITIES[id]!)
      .filter((a) => a.minLevel <= hero.level && a.kind === 'action' && (a.damage || a.special === 'magic-missile'));
    // spend slots first (highest slot level available), then attack-roll cantrips;
    // save-based cantrips are usually worse than a weapon swing — fall through.
    const slotted = dmgAbilities.filter((a) => a.slot !== undefined)
      .sort((x, y) => y.slot! - x.slot! ||
        (alive.length > 1 ? Number(y.target === 'all-enemies') - Number(x.target === 'all-enemies') : 0));
    const max = deriveStats(hero.classId, hero.abilities, hero.level).slots;
    for (const a of slotted) {
      if ((hero.slotsUsed[a.slot! - 1] ?? 0) < (max[a.slot! - 1] ?? 0))
        return { type: 'useAbility', abilityId: a.id, targetId: tgt, slotLevel: a.slot };
    }
    const cantrip = dmgAbilities.find((a) => a.slot === undefined && a.attack);
    if (cantrip) return { type: 'useAbility', abilityId: cantrip.id, targetId: tgt };
    // paladin: smite on the boss fight when a slot is free
    const smite = hero.classId === 'paladin' && hero.slotsUsed.some((u, i) => u < (deriveStats(hero.classId, hero.abilities, hero.level).slots[i] ?? 0))
      ? hero.slotsUsed.findIndex((u, i) => u < (deriveStats(hero.classId, hero.abilities, hero.level).slots[i] ?? 0)) + 1
      : undefined;
    return { type: 'attack', targetId: tgt, ...(smite ? { smiteSlot: smite } : {}) };
  }

  // free: Action Surge for a second attack
  if (hero.classId === 'fighter' && ht.actionUsed && !ht.extraAction && (hero.resources['action-surge'] ?? 0) > 0)
    return { type: 'useAbility', abilityId: 'action-surge' };
  // druid: Wild Shape (action, L2+) — the beast HP pool is the class's defence
  if (hero.classId === 'druid' && actionOpen && hero.level >= 2 && (combat.beastHp ?? 0) <= 0 &&
      (hero.resources['wild-shape'] ?? 0) > 0 && hero.hp / hero.maxHp < 0.9)
    return { type: 'useAbility', abilityId: 'wild-shape' };
  // bonus actions
  if (!ht.bonusUsed) {
    if (hero.classId === 'ranger' && !c.enemies.some((e) => e.conditions.some((x) => x.name === 'marked')) &&
        (hero.slotsUsed[0] ?? 0) < 1)
      return { type: 'useAbility', abilityId: 'hunters-mark', targetId: tgt, slotLevel: 1 };
    if (hero.classId === 'bard' && (hero.resources['inspiration'] ?? 0) > 0)
      return { type: 'useAbility', abilityId: 'bardic-inspiration' };
  }
  return { type: 'endTurn' };
}

function simulate(_quest: Quest, sceneId: string, classId: ClassId, level: number, seed: number): 'victory' | 'defeat' | 'death' | 'fled' | 'stuck' {
  const scene = _quest.scenes[sceneId] as EncounterScene;
  let s = step(initialState(), { type: 'newGame', hero: heroAtLevel(classId, level), seed }, { quest: null }).state;
  s.quest = { questId: _quest.id, questVersion: _quest.version, sceneId, flags: {}, visited: [sceneId], pending: null };
  const events: never[] = [];
  startCombat(s, _quest, scene, events as never);
  let guard = 0;
  let res: 'victory' | 'defeat' | 'death' | 'fled' | undefined;
  while (s.combat && !s.combat.result && guard++ < 60) {
    const a = heroAction(s, _quest);
    if (!a) break;
    const r = step(s, a, { quest: _quest });
    s = r.state;
    res = r.state.combat?.result ?? res;
    const end = r.events.find((e) => e.type === 'combatEnd');
    if (end?.type === 'combatEnd') res = end.result;
  }
  return res ?? 'stuck';
}

const RUNS = 200;

interface Case { quest: Quest; sceneId: string; label: string; level: number; minWin: number; maxAvg: number }
const CASES: Case[] = [
  { quest: CELLAR, sceneId: 'cellar', label: 'template: rats', level: 1, minWin: 0.55, maxAvg: 0.90 },
  { quest: HOLLOW, sceneId: 'wolf-fight', label: 'wolves', level: 1, minWin: 0.70, maxAvg: 0.95 },
  { quest: HOLLOW, sceneId: 'lookout-fight', label: 'goblin lookout', level: 2, minWin: 0.70, maxAvg: 0.95 },
  { quest: HOLLOW, sceneId: 'crypt-fight', label: 'crypt skeletons', level: 2, minWin: 0.70, maxAvg: 0.95 },
  { quest: HOLLOW, sceneId: 'bog-lurker-scene', label: 'bog lurker', level: 2, minWin: 0.70, maxAvg: 0.95 },
  { quest: HOLLOW, sceneId: 'boss-fight', label: 'Mire King boss', level: 3, minWin: 0.45, maxAvg: 0.85 },
];

const results: Record<string, Record<string, number>> = {};

describe('balance', () => {
  for (const c of CASES) {
    it(`${c.label}: each class wins ≥ ${Math.round(c.minWin * 100)}%`, () => {
      results[c.label] = {};
      for (const cls of CLASS_IDS) {
        let wins = 0;
        for (let i = 0; i < RUNS; i++) {
          if (simulate(c.quest, c.sceneId, cls, c.level, i * 7919 + 13) === 'victory') wins++;
        }
        results[c.label]![cls] = wins / RUNS;
        console.log(`${c.label} ${cls} ${(wins/RUNS*100).toFixed(0)}%`);
        expect(wins / RUNS, `${cls} @ ${c.label} = ${(wins / RUNS * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(c.minWin);
      }
      console.log(c.label, results[c.label]);
    });
  }
});

import { parseExpr } from '../src/engine/dice';
import type { EnemyDef } from '../src/engine/quest/types';

const avgDice = (expr: string | number): number => {
  if (typeof expr === 'number') return expr;
  const p = parseExpr(expr);
  return p.terms.reduce(
    (a, t) => a + (t.kind === 'dice' ? t.count * ((t.sides + 1) / 2) : t.sign * t.value),
    0,
  );
};

describe('enemy stat floors', () => {
  const quests = [CELLAR, HOLLOW];
  const floors = new Map<string, number>([
    ['rat-king', 15],
    ['mire-troll', 20],
    ['grubnak-mire-king', 28],
  ]);
  it('average HP ≥ floor, attack ≥ +3, average damage ≥ 3', () => {
    for (const q of quests) {
      for (const [id, def] of Object.entries(q.enemies ?? {}) as [string, EnemyDef][]) {
        const floor = floors.get(id) ?? 7;
        expect(avgDice(def.hp), `${id} hp ${def.hp}`).toBeGreaterThanOrEqual(floor);
        for (const a of def.actions) {
          if (a.attack !== undefined) expect(a.attack, `${id}/${a.name}`).toBeGreaterThanOrEqual(3);
          if (a.damage !== undefined) expect(avgDice(a.damage), `${id}/${a.name} dmg`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
