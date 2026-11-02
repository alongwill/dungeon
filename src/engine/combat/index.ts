import { parseExpr } from '../dice/parse';
import { roll, type RollResult } from '../dice/roll';
import { rollEvent } from '../rolls';
import { nextFloat } from '../dice/rng';
import { ABILITIES, type AbilityDef } from '../../content/abilities';
import { CLASSES } from '../../content/classes';
import { ITEMS } from '../../content/items';
import { abilityMod, abilityName, computeAC, proficiencyBonus, slotsFor } from '../rules';
import { findItem, healHero, heroSave } from '../quest/eval';
import type {
  AbilityId,
  DamageType,
  EncounterScene,
  EnemyDef,
  Quest,
  WeaponDef,
} from '../quest/types';
import type {
  CombatEnemy,
  GameEvent,
  GameState,
  Hero,
  HeroTurn,
} from '../model';

// ---------- helpers ----------

export function heroAC(s: GameState): number {
  const hero = s.hero!;
  const armourItem = hero.equipment.armour ? ITEMS[hero.equipment.armour] : undefined;
  const armour = armourItem?.kind === 'armour' ? armourItem.armour : undefined;
  return computeAC(armour, !!hero.equipment.shield, abilityMod(hero.abilities.DEX));
}

function hasCond(conds: { name: string }[], name: string): boolean {
  return conds.some((c) => c.name === name);
}
const heroCond = (h: Hero, n: string) => hasCond(h.conditions, n);
const enemyCond = (e: CombatEnemy, n: string) => hasCond(e.conditions, n);

function endOfTurnTick(conds: { name: string; rounds: number | 'combat' }[]): void {
  for (const c of conds) {
    if (typeof c.rounds === 'number') c.rounds--;
  }
  for (let i = conds.length - 1; i >= 0; i--) {
    const c = conds[i]!;
    if (typeof c.rounds === 'number' && c.rounds <= 0) conds.splice(i, 1);
  }
}

function diceCountOf(expr: string): number {
  const t = parseExpr(expr).terms.find((x) => x.kind === 'dice');
  return t && t.kind === 'dice' ? t.count : 0;
}

interface HeroAttackOutcome {
  result: RollResult;
  total: number;
  hit: boolean;
  crit: boolean;
  mods: AttackMods;
}

/** Shared hero attack roll: advantage/disadvantage, Bless/Inspiration, hidden and
 *  Guiding Bolt consumption, and a narrate line with the final total vs AC. */
function heroAttackRoll(
  s: GameState,
  target: CombatEnemy,
  ability: AbilityId | 'attack',
  label: string,
  events: GameEvent[],
): HeroAttackOutcome {
  const hero = s.hero!;
  const combat = s.combat!;
  const mods = heroAttackMods(s, target);
  const parts: { label: string; value: number }[] = [];
  if (ability === 'attack') parts.push({ label: 'attack bonus', value: heroAttackBonus(s) });
  else {
    parts.push({ label: abilityName(ability), value: abilityMod(hero.abilities[ability]) });
    parts.push({ label: 'proficiency', value: proficiencyBonus(hero.level) });
  }
  if (heroCond(hero, 'blessed')) {
    const b = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'other', expr: '1d4', source: 'Bless' });
    parts.push({ label: 'Bless (d4)', value: b.result.total });
  }
  if (heroCond(hero, 'inspired')) {
    const b = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'other', expr: '1d6', source: 'Inspiration' });
    parts.push({ label: 'Inspiration (d6)', value: b.result.total });
    hero.conditions = hero.conditions.filter((c) => c.name !== 'inspired');
    events.push({ type: 'condition', target: 'hero', condition: 'inspired', on: false });
  }
  const r = rollEvent(s, events, {
    actor: 'hero', actorName: hero.name, purpose: 'attack', expr: '1d20',
    advantage: mods.advantage, disadvantage: mods.disadvantage,
    parts, source: label, targetName: target.name,
    vs: { kind: 'armour', value: target.ac },
  });
  const total = r.total;
  // attacking ends hidden; Guiding Bolt's marked target grants advantage once
  if (heroCond(hero, 'hidden')) {
    hero.conditions = hero.conditions.filter((c) => c.name !== 'hidden');
    events.push({ type: 'condition', target: 'hero', condition: 'hidden', on: false });
  }
  if (combat.guidingBoltTarget === target.id) combat.guidingBoltTarget = null;
  const crit = r.result.nat20;
  const hit = crit || (!r.result.nat1 && total >= target.ac);
  const ev = events[events.length - 1]!;
  if (ev.type === 'roll') ev.outcome = crit ? 'crit' : hit ? 'hit' : 'miss';
  return { result: r.result, total, hit, crit, mods };
}

function heroAttackBonus(s: GameState): number {
  const hero = s.hero!;
  return abilityMod(hero.abilities.STR) + proficiencyBonus(hero.level);
}

function weaponOf(hero: Hero, quest: Quest | null): WeaponDef | undefined {
  const id = hero.equipment.weapon;
  const def = id ? findItem(id, quest) : undefined;
  return def?.kind === 'weapon' ? def : undefined;
}

function weaponAbilityMod(hero: Hero, w: WeaponDef | undefined): number {
  const str = abilityMod(hero.abilities.STR);
  const dex = abilityMod(hero.abilities.DEX);
  if (!w) return str;
  if (w.ability === 'STR') return str;
  if (w.ability === 'DEX') return dex;
  return Math.max(str, dex); // finesse
}

function applyType(amount: number, type: DamageType | undefined, e: CombatEnemy): number {
  if (!type) return amount;
  if (e.immune.includes(type)) return 0;
  if (e.vulnerable.includes(type)) return amount * 2;
  if (e.resist.includes(type)) return Math.floor(amount / 2);
  return amount;
}

function damageEnemy(
  _s: GameState,
  e: CombatEnemy,
  amount: number,
  type: DamageType | undefined,
  events: GameEvent[],
): void {
  const applied = Math.max(0, applyType(amount, type, e));
  e.hp = Math.max(0, e.hp - applied);
  events.push({ type: 'damage', target: e.id, amount: applied, damageType: type, targetName: e.name, hpLeft: e.hp, hpMax: e.maxHp });
  if (e.hp === 0) {
    e.dead = true;
    events.push({ type: 'narrate', text: `${e.name} is defeated.` });
  }
  firePhases(e, events);
}

function firePhases(e: CombatEnemy, events: GameEvent[]): void {
  if (!e.phases) return;
  const pct = (e.hp / e.maxHp) * 100;
  e.phases.forEach((ph, i) => {
    if (!e.phasesFired.includes(i) && pct <= ph.belowHpPct && e.hp > 0) {
      e.phasesFired.push(i);
      events.push({ type: 'narrate', text: ph.text });
      if (ph.addActions) e.actions.push(...ph.addActions);
    }
  });
}

function damageHero(
  s: GameState,
  amount: number,
  type: DamageType | undefined,
  events: GameEvent[],
): void {
  const hero = s.hero!;
  const combat = s.combat!;
  // Uncanny Dodge: halve first hit each round (rogue L5)
  if (
    hero.classId === 'rogue' &&
    hero.level >= 5 &&
    amount > 0 &&
    combat.uncannyUsedRound < combat.round
  ) {
    combat.uncannyUsedRound = combat.round;
    amount = Math.floor(amount / 2);
  }
  if (heroCond(hero, 'wildshape') && combat.beastHp > 0) {
    const absorbed = Math.min(combat.beastHp, amount);
    combat.beastHp -= absorbed;
    amount -= absorbed;
    events.push({ type: 'damage', target: 'hero-beast', amount: absorbed, targetName: 'beast form', hpLeft: combat.beastHp, hpMax: 11 });
    if (combat.beastHp === 0) {
      hero.conditions = hero.conditions.filter((c) => c.name !== 'wildshape');
      events.push({ type: 'condition', target: 'hero', condition: 'wildshape', on: false });
      events.push({ type: 'narrate', text: 'The beast form collapses.' });
    }
    if (amount === 0) return;
  }
  hero.hp = Math.max(0, hero.hp - amount);
  events.push({ type: 'damage', target: 'hero', amount, damageType: type, targetName: hero.name, hpLeft: hero.hp, hpMax: hero.maxHp });
  if (hero.hp === 0) onHeroDown(s, events);
}

function onHeroDown(s: GameState, events: GameEvent[]): void {
  const combat = s.combat!;
  if (combat.defeatOutcome) {
    combat.result = 'defeat';
    events.push({ type: 'combatEnd', result: 'defeat' });
  } else {
    combat.result = 'death';
    events.push({ type: 'combatEnd', result: 'death' });
    events.push({ type: 'death' });
  }
}

function checkVictory(s: GameState, events: GameEvent[]): void {
  const combat = s.combat!;
  if (combat.result) return;
  if (combat.enemies.every((e) => e.dead || e.fled)) {
    combat.result = 'victory';
    events.push({ type: 'combatEnd', result: 'victory' });
  }
}

// ---------- start ----------

function makeEnemy(s: GameState, defId: string, def: EnemyDef, n: number): CombatEnemy {
  const { result, rng } = roll(parseExpr(def.hp), s.rng);
  s.rng = rng;
  return {
    id: `${defId}-${n}`,
    defId,
    name: def.name,
    ac: def.ac,
    hp: result.total,
    maxHp: result.total,
    dex: def.dex,
    saves: { ...(def.saves ?? {}) },
    passivePerception: def.passivePerception,
    xp: def.xp,
    resist: [...(def.resist ?? [])],
    vulnerable: [...(def.vulnerable ?? [])],
    immune: [...(def.immune ?? [])],
    undead: !!def.undead,
    actions: def.actions.map((a) => ({ ...a })),
    morale: def.morale,
    phases: def.phases,
    phasesFired: [],
    conditions: [],
    rechargeReadyAt: {},
    fled: false,
    dead: false,
  };
}

export function startCombat(
  s: GameState,
  quest: Quest,
  scene: EncounterScene,
  events: GameEvent[],
): void {
  const hero = s.hero!;
  let n = 0;
  const enemies: CombatEnemy[] = [];
  for (const slot of scene.enemies) {
    const def = quest.enemies?.[slot.enemy];
    if (!def) continue;
    for (let i = 0; i < (slot.count ?? 1); i++) enemies.push(makeEnemy(s, slot.enemy, def, ++n));
  }
  // number same-named groups ("Marsh Wolf 1/2/3")
  {
    const groups = new Map<string, CombatEnemy[]>();
    for (const e of enemies) {
      const g = groups.get(e.name) ?? [];
      g.push(e);
      groups.set(e.name, g);
    }
    for (const g of groups.values())
      if (g.length > 1) g.forEach((e, i) => (e.name = `${e.name} ${i + 1}`));
  }

  // initiative: d20 + DEX mod each; sort desc, ties → higher DEX → hero first.
  // surprise:'hero' pins the hero to the top of the order; surprise:'enemies'
  // keeps the hero's rolled slot but skips their round-1 turn (heroSurprised).
  const init = rollEvent(s, events, {
    actor: 'hero', actorName: hero.name, purpose: 'initiative', expr: '1d20',
    parts: [{ label: 'Dexterity', value: abilityMod(hero.abilities.DEX) }],
    source: 'Initiative', label: `Initiative: ${hero.name}`,
  });
  const heroScore = init.total;

  const entries = enemies.map((e) => {
    const r = rollEvent(s, events, {
      actor: e.id, actorName: e.name, purpose: 'initiative', expr: '1d20',
      parts: [{ label: 'Dexterity', value: abilityMod(e.dex) }],
      source: 'Initiative', label: `Initiative: ${e.name}`,
    });
    return { id: e.id, score: r.total, dex: e.dex };
  });
  entries.push({ id: 'hero', score: heroScore, dex: hero.abilities.DEX });
  entries.sort(
    (a, b) =>
      b.score - a.score || b.dex - a.dex || (a.id === 'hero' ? -1 : 1) - (b.id === 'hero' ? -1 : 1),
  );
  if (scene.surprise === 'hero') {
    const i = entries.findIndex((x) => x.id === 'hero');
    entries.unshift(entries.splice(i, 1)[0]!);
  }
  s.combat = {
    enemies,
    round: 1,
    order: entries.map((x) => x.id),
    turnIndex: 0,
    heroSurprised: scene.surprise === 'enemies',
    heroTurn: null,
    canFlee: scene.canFlee !== false,
    fleeDC: scene.fleeDC ?? 12,
    victory: scene.victory,
    ...(scene.flee ? { fleeOutcome: scene.flee } : {}),
    ...(scene.defeat ? { defeatOutcome: scene.defeat } : {}),
    beastHp: 0,
    uncannyUsedRound: 0,
    guidingBoltTarget: null,
  };
  s.status = 'inCombat';
  events.push({ type: 'combatStart' });

  advance(s, events);
}

function freshHeroTurn(): HeroTurn {
  return { actionUsed: false, bonusUsed: false, extraAction: false, sneakUsed: false, attacked: false };
}

function beginHeroTurn(s: GameState, events: GameEvent[]): void {
  const combat = s.combat!;
  const hero = s.hero!;
  combat.heroTurn = freshHeroTurn();
  // 'dodging' lasts until the start of the hero's next turn
  if (heroCond(hero, 'dodging')) {
    hero.conditions = hero.conditions.filter((c) => c.name !== 'dodging');
    events.push({ type: 'condition', target: 'hero', condition: 'dodging', on: false });
  }
  events.push({ type: 'turnStart', who: 'hero' });
}

/** Advance through the turn order, running enemy turns, until the hero acts. */
function advance(s: GameState, events: GameEvent[]): void {
  const combat = s.combat!;
  while (!combat.result) {
    if (combat.turnIndex >= combat.order.length) {
      combat.turnIndex = 0;
      combat.round++;
    }
    const id = combat.order[combat.turnIndex]!;
    if (id === 'hero') {
      if (combat.heroSurprised) {
        combat.heroSurprised = false;
        events.push({ type: 'narrate', text: `${s.hero!.name} is caught off guard!` });
      } else if (heroCond(s.hero!, 'stunned')) {
        events.push({ type: 'narrate', text: `${s.hero!.name} is stunned and loses the turn.` });
        endOfTurnTick(s.hero!.conditions);
      } else {
        beginHeroTurn(s, events);
        return;
      }
    } else {
      const e = combat.enemies.find((x) => x.id === id);
      if (e && !e.dead && !e.fled) runEnemyTurn(s, e, events);
      if (combat.result) return;
    }
    combat.turnIndex++;
  }
}

// ---------- hero attack ----------

interface AttackMods {
  advantage: boolean;
  disadvantage: boolean;
}

function heroAttackMods(s: GameState, target: CombatEnemy): AttackMods {
  const hero = s.hero!;
  const combat = s.combat!;
  let advantage =
    heroCond(hero, 'hidden') ||
    enemyCond(target, 'restrained') ||
    combat.guidingBoltTarget === target.id;
  let disadvantage =
    heroCond(hero, 'restrained') || heroCond(hero, 'frightened') || heroCond(hero, 'poisoned');
  if (advantage && disadvantage) return { advantage: false, disadvantage: false };
  return { advantage, disadvantage };
}

function heroWeaponAttack(
  s: GameState,
  target: CombatEnemy,
  opts: { smiteSlot?: number },
  events: GameEvent[],
  quest: Quest | null,
): void {
  const hero = s.hero!;
  const combat = s.combat!;
  const wild = heroCond(hero, 'wildshape');
  const weapon = weaponOf(hero, quest);

  const atkAbility = wild ? 'attack' as const : (weapon?.ability === 'DEX' ? 'DEX' : 'STR') as AbilityId;
  const atk = heroAttackRoll(s, target, wild ? 'attack' : atkAbility, wild ? 'Bite' : weapon?.name ?? 'strike', events);
  if (!atk.hit) return;
  const { crit, mods } = atk;

  // damage — dice-only expr; the flat modifier is a labelled part
  let dmgExpr: string;
  let dmgType: DamageType | undefined;
  let flatBonus = 0;
  if (wild) {
    dmgExpr = '2d4';
    dmgType = 'piercing';
    flatBonus = 2;
  } else {
    const wExpr = weapon?.damage ?? '1d4';
    dmgExpr = wExpr.includes('+') || wExpr.includes('-') ? wExpr : wExpr;
    dmgType = weapon?.damageType;
    flatBonus = weaponAbilityMod(hero, weapon);
    const m = dmgExpr.match(/^(.+?)([+-]\d+)?$/);
    void m;
  }
  const diceOnly = dmgExpr.replace(/[+-]\d+$/, '');
  const exprMod = dmgExpr.match(/([+-]\d+)$/)?.[1] ? parseInt(dmgExpr.match(/([+-]\d+)$/)![1]!, 10) : 0;
  flatBonus += exprMod;
  const dmg = rollEvent(s, events, {
    actor: 'hero', actorName: hero.name, purpose: 'damage', expr: diceOnly,
    critical: crit, source: wild ? 'Bite' : weapon?.name ?? 'strike', targetName: target.name,
    parts: flatBonus ? [{ label: abilityName(atkAbility === 'attack' ? 'STR' : atkAbility), value: flatBonus }] : [],
    label: crit ? 'Damage (critical!)' : 'Damage',
  });
  let total = dmg.total;

  // Sneak Attack
  if (
    hero.classId === 'rogue' &&
    !combat.heroTurn!.sneakUsed &&
    (mods.advantage || (combat.round === 1 && combat.order.indexOf('hero') < combat.order.indexOf(target.id)))
  ) {
    const dice = Math.ceil(hero.level / 2);
    const sn = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'damage', expr: `${dice}d6`, critical: crit, source: 'Sneak Attack', targetName: target.name, label: 'Sneak Attack' });
    total += sn.total;
    combat.heroTurn!.sneakUsed = true;
  }

  // Hunter's Mark
  if (enemyCond(target, 'marked')) {
    const hm = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'damage', expr: '1d6', source: "Hunter's Mark", targetName: target.name, label: "Hunter's Mark" });
    total += hm.total;
  }

  // Divine Smite
  let smiteTotal = 0;
  if (opts.smiteSlot !== undefined) {
    const slotIdx = opts.smiteSlot - 1;
    if (slotIdx >= 0 && (hero.slotsUsed[slotIdx] ?? 0) < (slotsMaxFor(hero)[slotIdx] ?? 0)) {
      hero.slotsUsed[slotIdx]!++;
      const smDef = ABILITIES['divine-smite']!;
      const baseDice = diceCountOf(smDef.damage!);
      const upcastDice = diceCountOf(smDef.upcast!.dice!);
      const dice = baseDice + (opts.smiteSlot - 1) * upcastDice + (target.undead ? 1 : 0);
      const sm = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'damage', expr: `${dice}d8`, critical: crit, source: 'Divine Smite', targetName: target.name, label: 'Divine Smite' });
      smiteTotal = sm.total;
    }
  }

  damageEnemy(s, target, total, dmgType, events);
  if (smiteTotal > 0) damageEnemy(s, target, smiteTotal, 'radiant', events);
  checkVictory(s, events);
}

// ---------- enemy turns ----------

function enemyAttack(s: GameState, e: CombatEnemy, act: EnemyDef['actions'][number], events: GameEvent[]): void {
  const hero = s.hero!;
  const dis = enemyCond(e, 'restrained') || enemyCond(e, 'frightened') || enemyCond(e, 'poisoned') || heroCond(hero, 'dodging');
  const adv = heroCond(hero, 'restrained');
  const ac = heroAC(s);
  const r = rollEvent(s, events, {
    actor: e.id, actorName: e.name, purpose: 'attack', expr: '1d20',
    advantage: adv && !dis, disadvantage: dis && !adv,
    parts: [{ label: 'attack bonus', value: act.attack ?? 0 }],
    source: act.name, targetName: hero.name, vs: { kind: 'armour', value: ac },
    label: `${e.name}: ${act.name}`,
  });
  const hit = r.result.nat20 || (!r.result.nat1 && r.total >= ac);
  const ev = events[events.length - 1]!;
  if (ev.type === 'roll') ev.outcome = r.result.nat20 ? 'crit' : hit ? 'hit' : 'miss';
  if (!hit) return;
  if (act.damage) {
    const diceOnly = act.damage.replace(/[+-]\d+$/, '');
    const flat = parseInt(act.damage.match(/([+-]\d+)$/)?.[1] ?? '0', 10);
    const dmg = rollEvent(s, events, {
      actor: e.id, actorName: e.name, purpose: 'damage', expr: diceOnly,
      critical: r.result.nat20, source: act.name, targetName: hero.name, label: 'Damage',
      parts: flat ? [{ label: 'damage bonus', value: flat }] : [],
    });
    damageHero(s, dmg.total, act.type, events);
  }
}

function enemySaveAction(s: GameState, e: CombatEnemy, act: EnemyDef['actions'][number], events: GameEvent[]): void {
  const save = act.save!;
  const hero = s.hero!;
  const { saved } = heroSave(s, save.ability, save.dc, events, act.name);
  if (act.damage) {
    const diceOnly = act.damage.replace(/[+-]\d+$/, '');
    const flat = parseInt(act.damage.match(/([+-]\d+)$/)?.[1] ?? '0', 10);
    const dmg = rollEvent(s, events, {
      actor: e.id, actorName: e.name, purpose: 'damage', expr: diceOnly,
      source: act.name, targetName: hero.name, label: `${e.name}: ${act.name}`,
      parts: flat ? [{ label: 'damage bonus', value: flat }] : [],
    });
    const amount = saved && save.half ? Math.floor(dmg.total / 2) : saved ? 0 : dmg.total;
    if (amount > 0) damageHero(s, amount, act.type, events);
  }
}

function pickEnemyAction(s: GameState, e: CombatEnemy): EnemyDef['actions'][number] | undefined {
  const combat = s.combat!;
  const ready = e.actions.filter(
    (a) => a.recharge === undefined || (e.rechargeReadyAt[a.name] ?? 0) <= combat.round,
  );
  if (ready.length === 0) return undefined;
  // prefer a ready recharge action, else weighted random
  let pick = ready.find((a) => a.recharge !== undefined);
  if (!pick) {
    const totalW = ready.reduce((sum, a) => sum + (a.weight ?? 1), 0);
    const [v, rng] = nextFloat(s.rng);
    s.rng = rng;
    let acc = v * totalW;
    pick = ready[ready.length - 1]!;
    for (const a of ready) {
      acc -= a.weight ?? 1;
      if (acc <= 0) { pick = a; break; }
    }
  }
  if (pick.recharge !== undefined) e.rechargeReadyAt[pick.name] = combat.round + pick.recharge;
  return pick;
}

function runEnemyTurn(s: GameState, e: CombatEnemy, events: GameEvent[]): void {
  events.push({ type: 'turnStart', who: e.name });
  if (enemyCond(e, 'stunned')) {
    events.push({ type: 'narrate', text: `${e.name} is stunned and cannot act.` });
  } else if (e.morale && (e.hp / e.maxHp) * 100 < e.morale.fleeBelowHpPct) {
    e.fled = true;
    events.push({ type: 'narrate', text: `${e.name} turns and flees!` });
    checkVictory(s, events);
  } else {
    const act = pickEnemyAction(s, e);
    if (act) {
      if (act.attack !== undefined) enemyAttack(s, e, act, events);
      else if (act.save) enemySaveAction(s, e, act, events);
    }
  }
  // numeric durations decrement at the END of the combatant's turn — even a
  // turn skipped by 'stunned'
  endOfTurnTick(e.conditions);
}

// ---------- public hero combat actions (called by state.ts) ----------

export function usableBonusActions(s: GameState): AbilityDef[] {
  const hero = s.hero;
  const combat = s.combat;
  if (!hero || !combat || !combat.heroTurn || combat.heroTurn.bonusUsed) return [];
  return CLASSES[hero.classId].abilities
    .map((id) => ABILITIES[id]!)
    .filter((a) => a && a.minLevel <= hero.level && a.kind === 'bonus' && canPayCost(s, a));
}

export function canPayCost(s: GameState, a: AbilityDef): boolean {
  const hero = s.hero!;
  if (a.slot !== undefined) {
    if (heroCond(hero, 'wildshape')) return false;
    const idx = a.slot - 1;
    if (idx >= hero.slotsUsed.length) return false;
    const max = slotsMaxFor(hero)[idx] ?? 0;
    if ((hero.slotsUsed[idx] ?? 0) >= max) return false;
  }
  if (a.resource !== undefined) {
    if ((hero.resources[a.resource] ?? 0) <= 0) return false;
  }
  return true;
}

const slotsMaxFor = (hero: Hero): number[] => slotsFor(hero.classId, hero.level);

export function heroAttackAction(
  s: GameState,
  quest: Quest | null,
  targetId: string,
  smiteSlot: number | undefined,
  events: GameEvent[],
): boolean {
  const hero = s.hero!;
  const combat = s.combat!;
  const t = combat.enemies.find((e) => e.id === targetId && !e.dead && !e.fled);
  if (!t) return false;

  const attacks = hero.level >= 5 &&
    ((hero.classId === 'fighter' && CLASSES.fighter.abilities.includes('extra-attack')) ||
     (hero.classId === 'ranger' && CLASSES.ranger.abilities.includes('extra-attack-ranger')))
    ? 2 : 1;
  for (let i = 0; i < attacks; i++) {
    if (combat.result || t.dead) break;
    heroWeaponAttack(s, t, { smiteSlot: i === 0 ? smiteSlot : undefined }, events, quest);
  }
  combat.heroTurn!.attacked = true;
  return true;
}

// ---------- ability use ----------

export function heroUseAbility(
  s: GameState,
  abilityId: string,
  targetId: string | undefined,
  slotLevel: number | undefined,
  amount: number | undefined,
  events: GameEvent[],
): { ok: boolean; cost: 'action' | 'bonus' | 'free' | 'none'; error?: string } {
  const hero = s.hero!;
  const combat = s.combat!;
  const def = ABILITIES[abilityId];
  if (!def || def.classId !== hero.classId) return { ok: false, cost: 'none', error: 'unknown ability' };
  if (def.minLevel > hero.level) return { ok: false, cost: 'none', error: 'not unlocked yet' };
  if (def.special === 'smite') return { ok: false, cost: 'none', error: 'choose Smite when attacking' };
  if (def.slot !== undefined && heroCond(hero, 'wildshape'))
    return { ok: false, cost: 'none', error: 'cannot cast while wild-shaped' };

  const lvl = slotLevel ?? def.slot ?? 0;
  if (def.slot !== undefined) {
    const idx = lvl - 1;
    const max = slotsMaxFor(hero)[idx] ?? 0;
    if (lvl < def.slot || idx >= hero.slotsUsed.length || (hero.slotsUsed[idx] ?? 0) >= max)
      return { ok: false, cost: 'none', error: 'no slot available' };
  }
  if (def.resource !== undefined && (hero.resources[def.resource] ?? 0) <= 0)
    return { ok: false, cost: 'none', error: 'no uses left' };

  const targets = ((): CombatEnemy[] => {
    if (def.target === 'all-enemies') return combat.enemies.filter((e) => !e.dead && !e.fled);
    if (def.target === 'enemy') {
      const t = combat.enemies.find((e) => e.id === targetId && !e.dead && !e.fled);
      return t ? [t] : [];
    }
    return [];
  })();
  if ((def.target === 'enemy' || def.target === 'all-enemies') && targets.length === 0)
    return { ok: false, cost: 'none', error: 'no valid target' };

  // pay costs
  if (def.slot !== undefined) hero.slotsUsed[lvl - 1]!++;
  if (def.resource !== undefined && def.special !== 'lay-on-hands') hero.resources[def.resource]!--;

  // resolve
  resolveAbility(s, def, targets, lvl, amount, events);

  return { ok: true, cost: def.kind === 'passive' ? 'none' : def.kind };
}

export function upcastDice(base: string, perLevel: string | undefined, lvl: number, min: number): string {
  if (!perLevel || lvl <= min) return base;
  const extra = parseExpr(perLevel);
  const d = extra.terms.find((t) => t.kind === 'dice');
  if (!d || d.kind !== 'dice') return base;
  return `${base}+${(lvl - min) * d.count}d${d.sides}`;
}

function resolveAbility(
  s: GameState,
  def: AbilityDef,
  targets: CombatEnemy[],
  lvl: number,
  amount: number | undefined,
  events: GameEvent[],
): void {
  const hero = s.hero!;
  const combat = s.combat!;
  const prof = proficiencyBonus(hero.level);
  const casting = CLASSES[hero.classId].castingAbility;
  const saveDC = casting ? 8 + prof + abilityMod(hero.abilities[casting]) : 10;

  // ---- specials first ----
  switch (def.special) {
    case 'second-wind': {
      const r = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'heal', expr: '1d10', parts: [{ label: 'level', value: hero.level }], source: 'Second Wind' });
      healHero(s, r.total, events);
      return;
    }
    case 'action-surge':
      combat.heroTurn!.extraAction = true;
      events.push({ type: 'narrate', text: `${hero.name} surges with renewed vigour.` });
      return;
    case 'cunning-hide': {
      const dc = Math.max(...combat.enemies.filter((e) => !e.dead && !e.fled).map((e) => e.passivePerception), 0);
      const r = rollEvent(s, events, {
        actor: 'hero', actorName: hero.name, purpose: 'check', expr: '1d20',
        parts: [{ label: 'Dexterity', value: abilityMod(hero.abilities.DEX) }, { label: 'expertise', value: 2 * prof }],
        source: 'Stealth (Hide)', vs: { kind: 'difficulty', value: dc }, label: 'Stealth (Hide)',
      });
      const passed = r.total >= dc;
      const ev = events[events.length - 1]!;
      if (ev.type === 'roll') ev.outcome = passed ? 'success' : 'failure';
      if (passed) {
        hero.conditions.push({ name: 'hidden', rounds: 'combat' });
        events.push({ type: 'condition', target: 'hero', condition: 'hidden', on: true });
      } else {
        events.push({ type: 'narrate', text: `${hero.name} fails to find cover.` });
      }
      return;
    }
    case 'lay-on-hands': {
      const pool = hero.resources['lay-on-hands'] ?? 0;
      const spend = Math.min(amount ?? pool, pool);
      if (spend <= 0) { events.push({ type: 'error', message: 'lay on hands pool empty' }); return; }
      hero.resources['lay-on-hands'] = pool - spend;
      healHero(s, spend, events);
      return;
    }
    case 'hunters-mark': {
      const t = targets[0]!;
      // move mark: remove from other enemies
      for (const e of combat.enemies) e.conditions = e.conditions.filter((c) => c.name !== 'marked');
      t.conditions.push({ name: 'marked', rounds: 'combat' });
      events.push({ type: 'condition', target: t.id, condition: 'marked', on: true });
      return;
    }
    case 'wild-shape':
      combat.beastHp = 11;
      hero.conditions.push({ name: 'wildshape', rounds: 'combat' });
      events.push({ type: 'condition', target: 'hero', condition: 'wildshape', on: true });
      events.push({ type: 'narrate', text: `${hero.name} takes the shape of a wolf.` });
      return;
    case 'turn-undead': {
      for (const t of targets) {
        if (!t.undead) continue;
        const saved = enemySaveRoll(s, t, 'WIS', saveDC, events);
        if (!saved) {
          t.conditions.push({ name: 'frightened', rounds: 2 }, { name: 'stunned', rounds: 2 });
          events.push({ type: 'condition', target: t.id, condition: 'stunned', on: true });
        }
      }
      return;
    }
    case 'inspiration':
      hero.conditions.push({ name: 'inspired', rounds: 'combat' });
      events.push({ type: 'condition', target: 'hero', condition: 'inspired', on: true });
      return;
    case 'magic-missile': {
      const darts = 3 + (lvl - (def.slot ?? 1));
      for (let i = 0; i < darts; i++) {
        const r = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'damage', expr: def.damage!, source: `Magic Missile dart ${i + 1}`, targetName: targets[0]!.name });
        damageEnemy(s, targets[0]!, r.total, def.damageType, events);
      }
      checkVictory(s, events);
      return;
    }
    default:
      break;
  }

  // ---- generic resolution ----
  const dmgExpr0 = def.scalesAt && hero.level >= def.scalesAt.level ? def.scalesAt.damage : def.damage;
  const dmgExpr = dmgExpr0 && def.slot ? upcastDice(dmgExpr0, def.upcast?.dice, lvl, def.slot) : dmgExpr0;

  for (const t of targets) {
    let hits = true;
    if (def.attack) {
      const ability = def.attack.ability === 'weapon' ? 'STR' : def.attack.ability;
      const atk = heroAttackRoll(s, t, ability, def.name, events);
      if (def.attack.bonus) {
        // rare bonus folds into the emitted roll's parts post-hoc
        void 0;
      }
      hits = atk.hit;
      if (!hits) continue;
      if (dmgExpr) {
        const dmg = rollEvent(s, events, {
          actor: 'hero', actorName: hero.name, purpose: 'damage', expr: dmgExpr,
          critical: atk.crit, source: def.name, targetName: t.name, label: 'Damage',
        });
        damageEnemy(s, t, dmg.total, def.damageType, events);
      }
      if (def.id === 'guiding-bolt') combat.guidingBoltTarget = t.id;
    } else if (def.save) {
      const saved = enemySaveRoll(s, t, def.save.ability, saveDC, events, def.name);
      if (dmgExpr) {
        const dmg = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'damage', expr: dmgExpr, source: def.name, targetName: t.name });
        const amount = saved && def.save.half ? Math.floor(dmg.total / 2) : saved ? 0 : dmg.total;
        if (amount > 0) damageEnemy(s, t, amount, def.damageType, events);
      }
      if (!saved && def.condition) {
        t.conditions.push({ name: def.condition.name, rounds: def.condition.rounds });
        events.push({ type: 'condition', target: t.id, condition: def.condition.name, on: true });
      }
    }
  }
  if (def.heal) {
    const expr = upcastDice(def.heal, def.upcast?.dice, lvl, def.slot ?? lvl).replace(/[+-]\d+$/, '');
    const mod = def.healAbility ? abilityMod(hero.abilities[def.healAbility]) : 0;
    const r = rollEvent(s, events, {
      actor: 'hero', actorName: hero.name, purpose: 'heal', expr,
      parts: mod ? [{ label: def.healAbility ? abilityName(def.healAbility) : 'bonus', value: mod }] : [],
      source: def.name, targetName: hero.name,
    });
    healHero(s, r.total, events);
  }
  if (def.condition?.on === 'self') {
    hero.conditions.push({ name: def.condition.name, rounds: def.condition.rounds });
    events.push({ type: 'condition', target: 'hero', condition: def.condition.name, on: true });
  }
  if (def.condition?.on === 'target' && def.target === 'enemy' && targets[0]) {
    targets[0].conditions.push({ name: def.condition.name, rounds: def.condition.rounds });
    events.push({ type: 'condition', target: targets[0].id, condition: def.condition.name, on: true });
  }
  checkVictory(s, events);
}

function enemySaveRoll(s: GameState, e: CombatEnemy, ability: AbilityId, dc: number, events: GameEvent[], source?: string): boolean {
  const bonus = e.saves[ability] ?? 0;
  const r = rollEvent(s, events, {
    actor: e.id, actorName: e.name, purpose: 'save', expr: '1d20',
    parts: [{ label: abilityName(ability), value: bonus }],
    source: source ?? `${abilityName(ability)} save`, targetName: e.name,
    vs: { kind: 'difficulty', value: dc },
    outcome: undefined, label: `${e.name} ${abilityName(ability)} save`,
  });
  const saved = r.total >= dc;
  const ev = events[events.length - 1]!;
  if (ev.type === 'roll') ev.outcome = saved ? 'success' : 'failure';
  return saved;
}

// ---------- turn management ----------

/** Whether the hero's bonus action could still do something. */
export function hasUsableBonus(s: GameState): boolean {
  return usableBonusActions(s).length > 0;
}

/** Try to auto-end the hero turn; returns true if the turn ended. */
export function maybeAutoEndTurn(s: GameState, events: GameEvent[]): boolean {
  const combat = s.combat;
  const ht = combat?.heroTurn;
  if (!combat || !ht || combat.result) return true;
  const actionDone = ht.actionUsed && !ht.extraAction; // Action Surge leaves an action open
  const bonusDone = ht.bonusUsed || !hasUsableBonus(s);
  if (actionDone && bonusDone) {
    endHeroTurn(s, events);
    return true;
  }
  return false;
}

export function endHeroTurn(s: GameState, events: GameEvent[]): void {
  const combat = s.combat!;
  combat.heroTurn = null;
  // hero's numeric durations decrement at the END of the hero turn; 'dodging'
  // is exempt — it's removed at the START of the next hero turn instead
  endOfTurnTick(s.hero!.conditions.filter((c) => c.name !== 'dodging'));
  s.hero!.conditions = s.hero!.conditions.filter(
    (c) => c.name === 'dodging' || typeof c.rounds !== 'number' || c.rounds > 0,
  );
  combat.turnIndex++;
  advance(s, events);
}
