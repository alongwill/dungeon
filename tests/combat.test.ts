import { describe, expect, it } from 'vitest';
import { step } from '../src/engine/state';
import type { Action, GameEvent, GameState } from '../src/engine/model';
import type { Quest } from '../src/engine/quest/types';
import { combatQuest, ctxOf, makeHero, newGame, startQuest } from './helpers';
import { deriveStats } from '../src/engine/character';
import { slotsFor } from '../src/engine/rules';

function enterCombat(
  hero = makeHero('fighter'),
  quest: Quest = combatQuest(),
  seed = 42,
): { state: GameState; events: GameEvent[] } {
  const s0 = newGame(hero, seed);
  return startQuest(s0, quest);
}

function act(state: GameState, action: Action, quest: Quest) {
  return step(state, action, ctxOf(quest));
}

/** Find a seed (≤ limit) for which fn returns true on the combat-start state. */
function findSeed(fn: (state: GameState, events: GameEvent[]) => boolean, quest: Quest, hero = makeHero('fighter'), limit = 400): number {
  for (let seed = 1; seed < limit; seed++) {
    const { state, events } = enterCombat(hero, quest, seed);
    if (fn(state, events)) return seed;
  }
  throw new Error('no seed found');
}

describe('combat basics', () => {
  const q = combatQuest();

  it('starts combat, rolls initiative, begins a turn', () => {
    const { state, events } = enterCombat();
    expect(state.status).toBe('inCombat');
    expect(events.some((e) => e.type === 'combatStart')).toBe(true);
    expect(events.some((e) => e.type === 'roll' && e.label.startsWith('Initiative'))).toBe(true);
    expect(state.combat!.enemies).toHaveLength(1);
  });

  it('attack hits low-AC target, kills it, victory awards XP and ends combat', () => {
    const seed = findSeed(
      (s) => s.combat!.heroTurn !== null,
      q,
    );
    const { state } = enterCombat(makeHero('fighter'), q, seed);
    const r = act(state, { type: 'attack', targetId: 'gobbo-1' }, q);
    expect(r.events.some((e) => e.type === 'combatEnd' && e.result === 'victory')).toBe(true);
    expect(r.state.combat).not.toBeNull(); // battle stays on screen until 'continue'
    expect(r.state.combat!.result).toBe('victory');
    const r2 = act(r.state, { type: 'continue' }, q);
    expect(r2.state.hero!.xp).toBe(60); // 50 enemy xp + 10 ending xp
    expect(r2.state.status).toBe('questComplete');
    expect(r2.state.combat).toBeNull();
  });

  it('attack misses vs very high AC and the enemy phase follows', () => {
    const tough = combatQuest({ ac: 60 });
    // wizard has no bonus actions, so the action auto-ends the turn
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r = step(s, { type: 'attack', targetId: 'gobbo-1' }, ctxOf(tough));
      return r.events.some((e) => e.type === 'roll' && e.purpose === 'attack' && e.outcome === 'miss');
    }, tough, makeHero('wizard'), 2000);
    const { state } = enterCombat(makeHero('wizard'), tough, seed);
    const r = act(state, { type: 'attack', targetId: 'gobbo-1' }, tough);
    expect(r.events.some((e) => e.type === 'roll' && e.purpose === 'attack' && e.outcome === 'miss')).toBe(true);
    expect(r.events.some((e) => e.type === 'turnStart' && e.who === 'Gobbo')).toBe(true);
    expect(r.state.combat).not.toBeNull();
  });

  it('critical hits happen (nat20) and double damage dice', () => {
    const tanky = combatQuest({ hp: '40d6' });
    const seed = findSeed((s, ev) => {
      if (s.combat!.heroTurn === null) return false;
      void ev;
      const r = step(s, { type: 'attack', targetId: 'gobbo-1' }, ctxOf(tanky));
      return r.events.some((e) => e.type === 'roll' && e.result.nat20);
    }, tanky);
    const { state } = enterCombat(makeHero('fighter'), tanky, seed);
    const r = act(state, { type: 'attack', targetId: 'gobbo-1' }, tanky);
    const dmgRoll = r.events.find((e) => e.type === 'roll' && /critical/i.test(e.label));
    expect(dmgRoll).toBeDefined();
    if (dmgRoll?.type === 'roll') {
      expect(dmgRoll.result.rolls.length).toBe(2); // 1d8 → 2d8
    }
  });

  it('resist halves damage, vulnerable doubles, immune negates', () => {
    for (const [mod] of [['resist'], ['vulnerable'], ['immune']] as const) {
      const qq = combatQuest({ hp: '40d6', [mod]: ['bludgeoning'] });
      // find a seed where the attack lands (a Damage roll happened)
      const seed = findSeed((s) => {
        if (s.combat!.heroTurn === null) return false;
        const r = step(s, { type: 'attack', targetId: 'gobbo-1' }, ctxOf(qq));
        return r.events.some((e) => e.type === 'roll' && e.label === 'Damage');
      }, qq, makeHero('wizard'), 2000);
      const { state } = enterCombat(makeHero('wizard'), qq, seed);
      const r = act(state, { type: 'attack', targetId: 'gobbo-1' }, qq);
      const dmgRoll = r.events.find((e) => e.type === 'roll' && e.label === 'Damage');
      const dmgEv = r.events.find((e) => e.type === 'damage' && e.damageType === 'bludgeoning');
      if (dmgRoll?.type === 'roll' && dmgEv?.type === 'damage') {
        const raw = dmgRoll.finalTotal;
        if (mod === 'resist') expect(dmgEv.amount).toBe(Math.floor(raw / 2));
        if (mod === 'vulnerable') expect(dmgEv.amount).toBe(raw * 2);
        if (mod === 'immune') expect(dmgEv.amount).toBe(0);
      }
    }
  });
});

describe('class abilities in combat', () => {
  it('Sneak Attack fires on a hidden attack', () => {
    const q = combatQuest({ hp: '40d6' });
    const rogue = makeHero('rogue');
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r1 = step(s, { type: 'useAbility', abilityId: 'cunning-hide' }, ctxOf(q));
      if (!r1.state.combat) return false;
      const r2 = step(r1.state, { type: 'attack', targetId: 'gobbo-1' }, ctxOf(q));
      return r2.events.some((e) => e.type === 'roll' && e.label === 'Sneak Attack');
    }, q, rogue, 2000);
    const { state } = enterCombat(makeHero('rogue'), q, seed);
    const r1 = act(state, { type: 'useAbility', abilityId: 'cunning-hide' }, q);
    expect(r1.state.hero!.conditions.some((c) => c.name === 'hidden')).toBe(true);
    const r2 = act(r1.state, { type: 'attack', targetId: 'gobbo-1' }, q);
    expect(r2.events.some((e) => e.type === 'roll' && e.label === 'Sneak Attack')).toBe(true);
  });

  it('Divine Smite consumes a slot and adds radiant damage', () => {
    const q = combatQuest({ hp: '40d6' });
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r = step(s, { type: 'attack', targetId: 'gobbo-1', smiteSlot: 1 }, ctxOf(q));
      return r.events.some((e) => e.type === 'roll' && e.label === 'Divine Smite');
    }, q, makeHero('paladin'), 2000);
    const { state } = enterCombat(makeHero('paladin'), q, seed);
    const r = act(state, { type: 'attack', targetId: 'gobbo-1', smiteSlot: 1 }, q);
    expect(r.events.some((e) => e.type === 'roll' && e.label === 'Divine Smite')).toBe(true);
    expect(r.events.some((e) => e.type === 'damage' && e.damageType === 'radiant')).toBe(true);
    expect(r.state.hero!.slotsUsed[0]).toBe(1);
  });

  it('spell slots are consumed and refused when empty', () => {
    const q = combatQuest({ hp: '40d6' });
    const pally = makeHero('paladin'); // 1 slot at L1
    const seed = findSeed((s) => s.combat!.heroTurn !== null, q, pally);
    const { state } = enterCombat(makeHero('paladin'), q, seed);
    const r1 = act(state, { type: 'useAbility', abilityId: 'bless' }, q);
    expect(r1.events.some((e) => e.type === 'error')).toBe(false);
    expect(r1.state.hero!.slotsUsed[0]).toBe(1);
    // bless is an action → turn auto-ends (no bonus actions), enemy acts, new hero turn
    const r2 = act(r1.state, { type: 'useAbility', abilityId: 'bless' }, q);
    expect(r2.events.some((e) => e.type === 'error' && /slot/i.test(e.message))).toBe(true);
  });

  it('Second Wind heals and uses the bonus action', () => {
    const q = combatQuest({ hp: '40d6', attack: 30, damage: '4d6' } as never);
    const fighter = makeHero('fighter');
    const seed = findSeed((s) => s.combat!.heroTurn !== null, q, fighter);
    const { state } = enterCombat(fighter, q, seed);
    const r = act(state, { type: 'useAbility', abilityId: 'second-wind' }, q);
    expect(r.events.some((e) => e.type === 'roll' && e.label === 'Second Wind')).toBe(true);
    expect(r.state.hero!.resources['second-wind']).toBe(0);
  });

  it('Wild Shape grants beast HP and replaces attacks with Bite', () => {
    const q = combatQuest({ hp: '40d6' });
    const druid = makeHero('druid');
    druid.level = 2;
    druid.resources['wild-shape'] = 1;
    const seed = findSeed((s) => s.combat!.heroTurn !== null, q, druid);
    const { state } = enterCombat(druid, q, seed);
    const r1 = act(state, { type: 'useAbility', abilityId: 'wild-shape' }, q);
    expect(r1.state.hero!.conditions.some((c) => c.name === 'wildshape')).toBe(true);
    expect(r1.state.combat!.beastHp).toBeGreaterThan(0);
    expect(r1.state.combat!.beastHp).toBeLessThanOrEqual(11); // enemies may have bitten some off
    const r2 = act(r1.state, { type: 'attack', targetId: 'gobbo-1' }, q);
    expect(r2.events.some((e) => e.type === 'roll' && /Bite/.test(e.label))).toBe(true);
    // no spellcasting while shaped
    const r3 = act(r2.state.combat ? r2.state : r1.state, { type: 'useAbility', abilityId: 'entangle' }, q);
    expect(r3.events.some((e) => e.type === 'error' && /wild/.test(e.message))).toBe(true);
  });

  it('Turn Undead frightens and stuns undead', () => {
    const q = combatQuest({ hp: '40d6', undead: true });
    const cleric = makeHero('cleric');
    cleric.level = 2;
    cleric.resources['channel-divinity'] = 1;
    const seed = findSeed((s) => s.combat!.heroTurn !== null, q, cleric);
    const { state } = enterCombat(cleric, q, seed);
    const r = act(state, { type: 'useAbility', abilityId: 'turn-undead' }, q);
    const enemy = r.state.combat!.enemies[0]!;
    expect(enemy.conditions.some((c) => c.name === 'frightened')).toBe(true);
    expect(enemy.conditions.some((c) => c.name === 'stunned')).toBe(true);
    expect(r.state.hero!.resources['channel-divinity']).toBe(0);
  });

  it("Hunter's Mark adds 1d6 on hits vs the target", () => {
    const q = combatQuest({ hp: '40d6' });
    const ranger = makeHero('ranger');
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r1 = step(s, { type: 'useAbility', abilityId: 'hunters-mark', targetId: 'gobbo-1' }, ctxOf(q));
      const r2 = step(r1.state, { type: 'attack', targetId: 'gobbo-1' }, ctxOf(q));
      return r2.events.some((e) => e.type === 'roll' && e.label === "Hunter's Mark");
    }, q, ranger, 2000);
    const { state } = enterCombat(ranger, q, seed);
    const r1 = act(state, { type: 'useAbility', abilityId: 'hunters-mark', targetId: 'gobbo-1' }, q);
    expect(r1.state.combat!.enemies[0]!.conditions.some((c) => c.name === 'marked')).toBe(true);
    const r2 = act(r1.state, { type: 'attack', targetId: 'gobbo-1' }, q);
    expect(r2.events.some((e) => e.type === 'roll' && e.label === "Hunter's Mark")).toBe(true);
  });
});

describe('new classes', () => {
  const tough = () => combatQuest({ hp: '40d6' });
  const heroTurn = (q: Quest, hero: ReturnType<typeof makeHero>) =>
    enterCombat(hero, q, findSeed((s) => s.combat!.heroTurn !== null, q, hero)).state;

  it('Barbarian: Unarmoured Defence adds CON to AC; Rage adds +2 damage and halves weapon damage', () => {
    const q = combatQuest({ hp: '40d6', ac: 1, actions: [{ name: 'Club', attack: 30, damage: '2d2+6', type: 'bludgeoning' }] });
    const barb = makeHero('barbarian');
    // standard array: DEX 13 (+1), CON 14 (+2) → 10 + 1 + 2
    expect(deriveStats('barbarian', barb.abilities, 1).ac).toBe(13);
    const state = heroTurn(q, barb);
    const r1 = act(state, { type: 'useAbility', abilityId: 'rage' }, q);
    expect(r1.state.hero!.conditions.some((c) => c.name === 'raging')).toBe(true);
    expect(r1.state.hero!.resources['rage']).toBe(1);
    const r2 = act(r1.state, { type: 'attack', targetId: 'gobbo-1' }, q);
    const dmg = r2.events.find((e) => e.type === 'roll' && e.purpose === 'damage' && e.source === 'Greataxe');
    expect(dmg?.type === 'roll' && dmg.parts.some((p) => p.label === 'Rage' && p.value === 2)).toBe(true);
    const hits = r2.events.filter((e) => e.type === 'damage' && e.target === 'hero');
    expect(hits.length).toBeGreaterThan(0);
    // every blow lands at half its rolled damage
    const enemyRolls = r2.events.filter((e) => e.type === 'roll' && e.actor === 'gobbo-1' && e.purpose === 'damage');
    hits.forEach((h, i) => {
      const roll = enemyRolls[i];
      if (h.type === 'damage' && roll?.type === 'roll') expect(h.amount).toBe(Math.floor(roll.finalTotal / 2));
    });
  });

  it('Barbarian: Reckless Attack gives advantage, and enemies get advantage back', () => {
    const q = combatQuest({ hp: '40d6', actions: [{ name: 'Poke', attack: 0, damage: '1d2', type: 'piercing' }] });
    const state = heroTurn(q, makeHero('barbarian'));
    const r1 = act(state, { type: 'useAbility', abilityId: 'reckless-attack' }, q);
    expect(r1.state.combat!.heroTurn).not.toBeNull(); // free: turn continues
    const r2 = act(r1.state, { type: 'attack', targetId: 'gobbo-1' }, q);
    const heroAtk = r2.events.find((e) => e.type === 'roll' && e.actor === 'hero' && e.purpose === 'attack');
    expect(heroAtk?.type === 'roll' && heroAtk.result.rolls.length).toBe(2);
    const r3 = act(r2.state, { type: 'endTurn' }, q);
    const enemyAtk = r3.events.find((e) => e.type === 'roll' && e.actor === 'gobbo-1' && e.purpose === 'attack');
    expect(enemyAtk?.type === 'roll' && enemyAtk.result.rolls.length).toBe(2);
    // reckless ends when the hero's next turn starts
    expect(r3.state.hero!.conditions.some((c) => c.name === 'reckless')).toBe(false);
  });

  it('Monk: Martial Arts needs the Attack action first; Flurry spends ki for two strikes', () => {
    const q = tough();
    const monk = makeHero('monk');
    monk.level = 2;
    monk.resources['ki'] = 2;
    // standard array: DEX 15 (+2), WIS 14 (+2) → 10 + 2 + 2
    expect(deriveStats('monk', monk.abilities, 1).ac).toBe(14);
    const state = heroTurn(q, monk);
    const early = act(state, { type: 'useAbility', abilityId: 'martial-arts', targetId: 'gobbo-1' }, q);
    expect(early.events.some((e) => e.type === 'error' && /Attack action first/.test(e.message))).toBe(true);
    const r1 = act(state, { type: 'attack', targetId: 'gobbo-1' }, q);
    expect(r1.state.combat!.heroTurn).not.toBeNull(); // bonus still open
    const r2 = act(r1.state, { type: 'useAbility', abilityId: 'flurry-of-blows', targetId: 'gobbo-1' }, q);
    const strikes = r2.events.filter((e) => e.type === 'roll' && e.purpose === 'attack' && e.source === 'Unarmed strike');
    expect(strikes).toHaveLength(2);
    expect(r2.state.hero!.resources['ki']).toBe(1);
  });

  it('Sorcerer: Font of Magic turns 2 sorcery points into a spent 1st-level slot', () => {
    const q = tough();
    const sorc = makeHero('sorcerer');
    sorc.level = 2;
    sorc.slotsUsed = [1];
    sorc.resources['sorcery-points'] = 2;
    const r = act(heroTurn(q, sorc), { type: 'useAbility', abilityId: 'font-of-magic' }, q);
    expect(r.state.hero!.slotsUsed[0]).toBe(0);
    expect(r.state.hero!.resources['sorcery-points']).toBe(0);
  });

  it('Sorcerer: Scorching Ray fires three rays from a 2nd-level slot', () => {
    const q = tough();
    const sorc = makeHero('sorcerer');
    sorc.level = 3;
    sorc.slotsUsed = [0, 0];
    const r = act(heroTurn(q, sorc), { type: 'useAbility', abilityId: 'scorching-ray', targetId: 'gobbo-1', slotLevel: 2 }, q);
    expect(r.events.filter((e) => e.type === 'roll' && e.purpose === 'attack' && /Scorching Ray/.test(e.source ?? ''))).toHaveLength(3);
    expect(r.state.hero!.slotsUsed[1]).toBe(1);
  });

  it('Warlock: pact slots are all one level and return on a short rest; Hex adds 1d6 necrotic', () => {
    expect(slotsFor('warlock', 1)).toEqual([1]);
    expect(slotsFor('warlock', 3)).toEqual([0, 2]);
    expect(slotsFor('warlock', 5)).toEqual([0, 0, 2]);
    const q = tough();
    const wl = makeHero('warlock');
    wl.level = 3;
    wl.slotsUsed = [0, 0];
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r1 = step(s, { type: 'useAbility', abilityId: 'hex', targetId: 'gobbo-1' }, ctxOf(q));
      const r2 = step(r1.state, { type: 'useAbility', abilityId: 'eldritch-blast', targetId: 'gobbo-1' }, ctxOf(q));
      return r2.events.some((e) => e.type === 'roll' && e.label === 'Hex');
    }, q, wl, 2000);
    const { state } = enterCombat(wl, q, seed);
    const r1 = act(state, { type: 'useAbility', abilityId: 'hex', targetId: 'gobbo-1' }, q);
    // Hex casts from the only slot level a level-3 warlock has: 2nd
    expect(r1.state.hero!.slotsUsed).toEqual([0, 1]);
    const r2 = act(r1.state, { type: 'useAbility', abilityId: 'eldritch-blast', targetId: 'gobbo-1' }, q);
    expect(r2.events.some((e) => e.type === 'roll' && e.label === 'Hex')).toBe(true);
    // Agonizing Blast (L2) adds CHA to the blast damage
    const blast = r2.events.find((e) => e.type === 'roll' && e.purpose === 'damage' && e.source === 'Eldritch Blast');
    expect(blast?.type === 'roll' && blast.parts.some((p) => p.label === 'Agonizing Blast')).toBe(true);

    const rested = step(newGame({ ...wl, slotsUsed: [0, 2] }), { type: 'rest', kind: 'short' }, ctxOf(null));
    expect(rested.state.hero!.slotsUsed).toEqual([0, 0]);
  });

  it("Warlock: Dark One's Blessing heals on a kill", () => {
    const q = combatQuest({ ac: 1 });
    const wl = makeHero('warlock');
    wl.hp = 5;
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r = step(s, { type: 'useAbility', abilityId: 'eldritch-blast', targetId: 'gobbo-1' }, ctxOf(q));
      return r.events.some((e) => e.type === 'combatEnd' && e.result === 'victory');
    }, q, wl);
    const { state } = enterCombat(wl, q, seed);
    const hpBefore = state.hero!.hp;
    const r = act(state, { type: 'useAbility', abilityId: 'eldritch-blast', targetId: 'gobbo-1' }, q);
    expect(r.events.some((e) => e.type === 'heal')).toBe(true);
    expect(r.state.hero!.hp).toBeGreaterThan(hpBefore);
  });
});

describe('enemy AI, morale, phases', () => {
  it('enemies flee below morale threshold', () => {
    const q = combatQuest({ hp: '4d6', morale: { fleeBelowHpPct: 95 }, xp: 30 });
    const seed = findSeed((s) => s.combat!.heroTurn !== null, q);
    const { state } = enterCombat(makeHero('fighter'), q, seed);
    // wound it first (fighter keeps a usable bonus action, so end the turn explicitly)
    const r1 = act(state, { type: 'attack', targetId: 'gobbo-1' }, q);
    if (!r1.state.combat) return; // one-shot kill — morale path covered by victory
    const r2 = act(r1.state, { type: 'endTurn' }, q);
    const enemy = r2.state.combat?.enemies[0];
    const fledOrWon = enemy?.fled || r2.events.some((e) => e.type === 'combatEnd' && e.result === 'victory');
    expect(fledOrWon).toBe(true);
  });

  it('boss phases fire once at HP thresholds and add actions', () => {
    const q = combatQuest({
      hp: '40d6',
      phases: [{ belowHpPct: 99, text: 'Phase two!', addActions: [{ name: 'Slam', attack: 10, damage: '1d4', type: 'bludgeoning' }] }],
    });
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r = step(s, { type: 'attack', targetId: 'gobbo-1' }, ctxOf(q));
      return r.events.some((e) => e.type === 'narrate' && e.text === 'Phase two!');
    }, q, makeHero('fighter'), 2000);
    const { state } = enterCombat(makeHero('fighter'), q, seed);
    const r = act(state, { type: 'attack', targetId: 'gobbo-1' }, q);
    expect(r.events.some((e) => e.type === 'narrate' && e.text === 'Phase two!')).toBe(true);
    expect(r.state.combat!.enemies[0]!.actions.some((a) => a.name === 'Slam')).toBe(true);
  });
});

describe('flee and defeat', () => {
  it('successful flee ends combat and follows the flee outcome', () => {
    const q = combatQuest({ hp: '40d6' });
    const seed = findSeed((s) => {
      if (s.combat!.heroTurn === null) return false;
      const r = step(s, { type: 'flee' }, ctxOf(q));
      return r.events.some((e) => e.type === 'combatEnd' && e.result === 'fled');
    }, q, makeHero('rogue'), 2000); // rogue has best DEX
    const { state } = enterCombat(makeHero('rogue'), q, seed);
    const r = act(state, { type: 'flee' }, q);
    expect(r.events.some((e) => e.type === 'combatEnd' && e.result === 'fled')).toBe(true);
    const rc = act(r.state, { type: 'continue' }, q);
    expect(rc.state.status).toBe('questComplete'); // flee → 'away' ending
  });

  it('flee is refused when canFlee is false', () => {
    const q = combatQuest({ hp: '40d6' }, { canFlee: false });
    const seed = findSeed((s) => s.combat!.heroTurn !== null, q);
    const { state } = enterCombat(makeHero('fighter'), q, seed);
    const r = act(state, { type: 'flee' }, q);
    expect(r.events.some((e) => e.type === 'error' && /flee/i.test(e.message))).toBe(true);
  });

  it('defeat outcome wakes the hero at 1 HP instead of death', () => {
    const q = combatQuest(
      { hp: '60d6', actions: [{ name: 'Crush', attack: 30, damage: '20d6', type: 'bludgeoning' }] },
      { defeat: { goto: 'away', text: 'You wake up.' } },
    );
    const { state } = enterCombat(makeHero('fighter'), q, 42);
    const r = act(state, { type: 'endTurn' }, q);
    expect(r.state.combat!.result).toBe('defeat');
    const rc = act(r.state, { type: 'continue' }, q);
    expect(rc.state.hero!.hp).toBe(1);
    expect(r.state.hero!.dead).toBe(false);
    expect(r.events.some((e) => e.type === 'combatEnd' && e.result === 'defeat')).toBe(true);
  });

  it('no defeat outcome means the hero dies', () => {
    const q = combatQuest({
      hp: '60d6',
      actions: [{ name: 'Crush', attack: 30, damage: '20d6', type: 'bludgeoning' }],
    });
    const { state } = enterCombat(makeHero('fighter'), q, 42);
    const r = act(state, { type: 'endTurn' }, q);
    expect(r.state.status).toBe('dead');
    expect(r.state.hero!.dead).toBe(true);
    expect(r.events.some((e) => e.type === 'death')).toBe(true);
  });
});

describe('turn order and condition timing', () => {
  const q = combatQuest();

  it('builds a full initiative order and adds initiative roll events', () => {
    const { state, events } = enterCombat(makeHero('fighter'), q);
    const order = state.combat!.order;
    expect(order).toContain('hero');
    expect(order).toContain('gobbo-1');
    expect(order).toHaveLength(2);
    expect(events.filter((e) => e.type === 'roll' && e.label.startsWith('Initiative'))).toHaveLength(2);
  });

  it("surprise 'enemies' makes the hero skip their round-1 turn", () => {
    const qq = combatQuest({ hp: '60d6' }, { surprise: 'enemies' });
    const { state, events } = enterCombat(makeHero('fighter'), qq, 7);
    expect(events.some((e) => e.type === 'narrate' && /off guard/.test(e.text))).toBe(true);
    // every enemy turnStart comes before the hero's first turnStart
    const enemyIdx = events.findIndex((e) => e.type === 'turnStart' && e.who !== 'hero');
    const heroIdx = events.findIndex((e) => e.type === 'turnStart' && e.who === 'hero');
    expect(enemyIdx).toBeGreaterThanOrEqual(0);
    expect(heroIdx).toBeGreaterThan(enemyIdx);
    expect(state.combat!.heroTurn).not.toBeNull();
    expect(state.combat!.round).toBeGreaterThanOrEqual(1);
  });

  it('a 1-round frightened still gives the enemy disadvantage on its attack', () => {
    const qq = combatQuest({ hp: '60d6', actions: [{ name: 'Bite', attack: 2, damage: '1d4', type: 'piercing' }] });
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq);
    const { state } = enterCombat(makeHero('wizard'), qq, seed);
    const s2 = structuredClone(state);
    s2.combat!.enemies[0]!.conditions.push({ name: 'frightened', rounds: 1 });
    const r = act(s2, { type: 'endTurn' }, qq);
    const atk = r.events.find((e) => e.type === 'roll' && /Bite/.test(e.label));
    expect(atk?.type === 'roll' && atk.result.rolls.length === 2).toBe(true); // 2d20kl1
    // and the condition expired at the end of that turn
    expect(r.state.combat!.enemies[0]!.conditions.some((c) => c.name === 'frightened')).toBe(false);
  });

  it('a 2-round stun skips exactly two enemy turns', () => {
    const qq = combatQuest({ hp: '60d6' });
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq);
    const { state } = enterCombat(makeHero('wizard'), qq, seed);
    const s2 = structuredClone(state);
    s2.combat!.enemies[0]!.conditions.push({ name: 'stunned', rounds: 2 });
    const stuns = (evs: GameEvent[]) =>
      evs.filter((e) => e.type === 'narrate' && /stunned/.test(e.text)).length;
    const r1 = act(s2, { type: 'endTurn' }, qq);
    expect(stuns(r1.events)).toBe(1);
    const r2 = act(r1.state, { type: 'endTurn' }, qq);
    expect(stuns(r2.events)).toBe(1);
    const r3 = act(r2.state, { type: 'endTurn' }, qq);
    expect(stuns(r3.events)).toBe(0);
    expect(r3.state.combat!.enemies[0]!.conditions.some((c) => c.name === 'stunned')).toBe(false);
  });

  it('dodging gives enemies disadvantage until the next hero turn', () => {
    const qq = combatQuest({ hp: '60d6', actions: [{ name: 'Bite', attack: 2, damage: '1d4', type: 'piercing' }] });
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq);
    const { state } = enterCombat(makeHero('wizard'), qq, seed);
    const r = act(state, { type: 'dodge' }, qq); // wizard: no bonus actions → turn auto-ends
    const atk = r.events.find((e) => e.type === 'roll' && /Bite/.test(e.label));
    expect(atk?.type === 'roll' && atk.result.rolls.length === 2).toBe(true);
    // cleared at the start of the next hero turn
    expect(r.state.hero!.conditions.some((c) => c.name === 'dodging')).toBe(false);
  });
});

describe('save breakdowns and spell attacks', () => {
  it('enemy saves roll with their modifier in the expression and narrate the result', () => {
    const qq = combatQuest({ hp: '40d6', undead: true, saves: { WIS: 4 } });
    const cleric = makeHero('cleric');
    cleric.level = 2;
    cleric.resources['channel-divinity'] = 1;
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq, cleric);
    const { state } = enterCombat(cleric, qq, seed);
    const r = act(state, { type: 'useAbility', abilityId: 'turn-undead' }, qq);
    const saveRoll = r.events.find((e) => e.type === 'roll' && /Wisdom save/.test(e.label));
    expect(saveRoll?.type === 'roll' && saveRoll.parts.some((p) => p.label === 'Wisdom' && p.value === 4)).toBe(true);
    expect(saveRoll?.type === 'roll' && saveRoll.vs?.kind).toBe('difficulty');
  });

  it('hero saves include class proficiency in the roll expression', () => {
    // cleric is WIS-proficient; gobbo's save action forces a WIS save
    const qq = combatQuest({ hp: '60d6', actions: [{ name: 'Shriek', save: { ability: 'WIS', dc: 13, half: true }, damage: '1d6', type: 'psychic' }] });
    const cleric = makeHero('cleric'); // WIS 14, prof +2 → +4
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq, cleric);
    const { state } = enterCombat(cleric, qq, seed);
    const r = act(state, { type: 'endTurn' }, qq);
    const saveRoll = r.events.find((e) => e.type === 'roll' && /Wisdom save/.test(e.label));
    expect(saveRoll?.type === 'roll' && saveRoll.parts.some((p) => p.label === 'proficiency')).toBe(true);
    expect(saveRoll?.type === 'roll' && saveRoll.vs?.value).toBe(13);
  });

  it('spell attacks use advantage from hidden and narrate the total', () => {
    const qq = combatQuest({ hp: '40d6', ac: 14 });
    const druid = makeHero('druid');
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq, druid);
    const { state } = enterCombat(druid, qq, seed);
    const s2 = structuredClone(state);
    s2.hero!.conditions.push({ name: 'hidden', rounds: 'combat' });
    const r = act(s2, { type: 'useAbility', abilityId: 'produce-flame', targetId: 'gobbo-1' }, qq);
    const atk = r.events.find((e) => e.type === 'roll' && e.purpose === 'attack' && /Produce Flame/.test(e.source ?? e.label));
    expect(atk?.type === 'roll' && atk.result.rolls.length === 2).toBe(true); // advantage
    expect(r.state.hero!.conditions.some((c) => c.name === 'hidden')).toBe(false); // consumed
    expect(r.events.some((e) => e.type === 'roll' && e.purpose === 'attack' && e.outcome !== undefined)).toBe(true);
  });

  it('Divine Smite cannot be used as a standalone ability', () => {
    const qq = combatQuest({ hp: '40d6' });
    const seed = findSeed((s) => s.combat!.heroTurn !== null, qq, makeHero('paladin'));
    const { state } = enterCombat(makeHero('paladin'), qq, seed);
    const r = act(state, { type: 'useAbility', abilityId: 'divine-smite' }, qq);
    expect(r.events.some((e) => e.type === 'error' && e.message === 'choose Smite when attacking')).toBe(true);
  });
});

it('Action Surge after the action is spent does not end the turn', () => {
  const qq = combatQuest({ hp: '40d6' });
  const seed = findSeed((s) => s.combat!.heroTurn !== null, qq, makeHero('fighter'));
  const { state } = enterCombat(makeHero('fighter'), qq, seed);
  const r1 = act(state, { type: 'attack', targetId: 'gobbo-1' }, qq);
  // action spent; Second Wind keeps a bonus option open so the turn may persist,
  // but the important bit is the surge grants a fresh action either way
  if (!r1.state.combat) return; // target died — surge moot
  const r2 = act(r1.state, { type: 'useAbility', abilityId: 'action-surge' }, qq);
  expect(r2.state.combat!.heroTurn?.extraAction ?? true).toBe(true);
  expect(r2.state.combat!.heroTurn).not.toBeNull(); // turn did NOT end
  const r3 = act(r2.state, { type: 'attack', targetId: 'gobbo-1' }, qq);
  expect(r3.events.some((e) => e.type === 'error' && /action/i.test(e.message))).toBe(false);
});

describe('roll event invariant', () => {
  const keptSum = (r: { rolls: { value: number; kept: boolean }[] }) =>
    r.rolls.reduce((a, d) => a + (d.kept ? d.value : 0), 0);
  it('finalTotal === keptDiceSum + parts for many seeded combats across classes', () => {
    const qq = combatQuest();
    for (const cls of ['fighter', 'wizard', 'cleric', 'rogue', 'barbarian', 'monk', 'sorcerer', 'warlock'] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const { state } = enterCombat(makeHero(cls), qq, seed);
        const r = act(state, { type: 'attack', targetId: 'gobbo-1' }, qq);
        for (const e of r.events) {
          if (e.type !== 'roll') continue;
          expect(e.finalTotal).toBe(keptSum(e.result) + e.parts.reduce((a, p) => a + p.value, 0));
          if (e.vs?.kind === 'armour' && e.outcome && !e.result.nat20 && !e.result.nat1)
            expect(e.outcome === 'hit' || e.outcome === 'crit').toBe(e.finalTotal >= e.vs.value);
          if (e.vs?.kind === 'difficulty' && e.outcome)
            expect(e.outcome === 'success').toBe(e.finalTotal >= e.vs.value);
        }
      }
    }
  });
});
