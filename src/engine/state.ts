import { type RollResult } from './dice/roll';
import { rollEvent } from './rolls';
import { rngFromSeed } from './dice/rng';
import { CLASSES } from '../content/classes';
import { ABILITIES } from '../content/abilities';
import {
  abilityMod,
  hpGainPerLevel,
  MAX_SHORT_RESTS,
  proficiencyBonus,
  resourceMax,
  SKILL_ABILITY,
  slotsFor,
  abilityName,
  skillName,
} from './rules';
import {
  applyEffects,
  awardXp,
  evalCondition,
  findItem,
  healHero,
  interpolate,
  removeItem,
} from './quest/eval';
import {
  endHeroTurn,
  heroAttackAction,
  heroUseAbility,
  maybeAutoEndTurn,
  startCombat,
  upcastDice,
} from './combat';
import type { CheckDef, Choice, Outcome, Scene } from './quest/types';
import type {
  Action,
  GameEvent,
  GameState,
  Hero,
  StepCtx,
  StepResult,
} from './model';

export * from './model';

export function initialState(): GameState {
  return {
    version: 1,
    rng: rngFromSeed(1),
    hero: null,
    quest: null,
    combat: null,
    log: [],
    logSeq: 0,
    status: 'idle',
  };
}

// ---------- checks ----------

function rollCheck(
  s: GameState,
  ctx: StepCtx,
  check: CheckDef,
  _events: GameEvent[],
): { rollResult: RollResult; total: number } {
  const hero = s.hero!;
  const prof = proficiencyBonus(hero.level);
  let adv = check.advantageIf ? evalCondition(check.advantageIf, s, ctx.quest) : false;
  let dis = check.disadvantageIf ? evalCondition(check.disadvantageIf, s, ctx.quest) : false;
  if (hero.classId === 'ranger' && check.skill === 'survival') adv = true; // Natural Explorer
  if (hero.conditions.some((c) => c.name === 'poisoned')) dis = true;
  const parts: { label: string; value: number }[] = [];
  if (check.skill) {
    const ability = SKILL_ABILITY[check.skill];
    parts.push({ label: abilityName(ability), value: abilityMod(hero.abilities[ability]) });
    const cls = CLASSES[hero.classId];
    if (cls.expertise.includes(check.skill)) parts.push({ label: 'expertise', value: 2 * prof });
    else if (cls.skills.includes(check.skill)) parts.push({ label: 'proficiency', value: prof });
  } else if (check.ability) {
    parts.push({ label: abilityName(check.ability), value: abilityMod(hero.abilities[check.ability]) });
  }
  const label = checkLabel(check);
  const source = check.skill ? `${skillName(check.skill)} (${abilityName(SKILL_ABILITY[check.skill])})` : label;
  const r = rollEvent(s, _events, {
    actor: 'hero', actorName: hero.name, purpose: 'check', expr: '1d20',
    advantage: adv && !dis, disadvantage: dis && !adv, parts,
    source, vs: { kind: 'difficulty', value: check.dc }, label,
  });
  const ev = _events[_events.length - 1]!;
  if (ev.type === 'roll') ev.outcome = r.total >= check.dc ? 'success' : 'failure';
  return { rollResult: r.result, total: r.total };
}

// ---------- scene runner ----------

function applyOutcome(s: GameState, ctx: StepCtx, events: GameEvent[], outcome: Outcome): void {
  applyEffects(outcome.effects, s, ctx.quest, events);
  if (outcome.text) events.push({ type: 'narrate', text: interpolate(outcome.text, s, ctx.quest) });
  enterScene(s, ctx, events, outcome.goto);
}

function enterScene(s: GameState, ctx: StepCtx, events: GameEvent[], sceneId: string): void {
  const quest = ctx.quest!;
  const scene = quest.scenes[sceneId];
  if (!scene) {
    events.push({ type: 'error', message: `missing scene "${sceneId}"` });
    return;
  }
  const qp = s.quest!;
  qp.sceneId = sceneId;
  if (!qp.visited.includes(sceneId)) qp.visited.push(sceneId);
  events.push({ type: 'sceneEnter', sceneId, title: scene.title });
  applyEffects(scene.onEnter, s, ctx.quest, events);

  switch (scene.type) {
    case 'check': {
      const { rollResult } = rollCheck(s, ctx, scene.check, events);
      qp.pending = {
        kind: 'check',
        check: scene.check,
        label: checkLabel(scene.check),
        roll: rollResult,
        success: rollResult.total >= scene.check.dc,
        successOutcome: scene.success,
        failureOutcome: scene.failure,
        inspired: false,
        inspirationBonus: 0,
      };
      break;
    }
    case 'encounter':
      startCombat(s, quest, scene, events);
      break;
    case 'loot': {
      let gold = 0;
      if (scene.gold !== undefined) {
        if (typeof scene.gold === 'number') gold = scene.gold;
        else {
          const r = rollEvent(s, events, { actor: 'hero', actorName: s.hero!.name, purpose: 'gold', expr: scene.gold, source: 'Gold', label: 'Gold' });
          gold = r.total;
        }
        s.hero!.gold += gold;
      }
      const items = (scene.items ?? []).map((i) => ({ item: i.item, qty: i.qty ?? 1 }));
      for (const it of items) {
        const line = s.hero!.inventory.find((x) => x.item === it.item);
        if (line) line.qty += it.qty;
        else s.hero!.inventory.push({ item: it.item, qty: it.qty });
      }
      qp.pending = { kind: 'loot', gold, items, next: scene.next };
      break;
    }
    case 'ending': {
      if (scene.xp) awardXp(s, scene.xp, events);
      const hero = s.hero!;
      if (!hero.completedQuests.includes(quest.id)) hero.completedQuests.push(quest.id);
      s.status = 'questComplete';
      events.push({ type: 'questComplete', outcome: scene.outcome, xp: scene.xp ?? 0 });
      break;
    }
    default:
      break;
  }
}

function checkLabel(check: CheckDef): string {
  return check.skill ? `${skillName(check.skill)} check` : `${abilityName(check.ability!)} check`;
}

/** combat stays on screen once result is set; 'continue' resolves it. */
function endCombat(s: GameState, _ctx: StepCtx, _events: GameEvent[]): void {
  const combat = s.combat;
  if (!combat?.result || combat.resultApplied) return;
  combat.resultApplied = true;
  if (combat.result === 'death') {
    s.hero!.dead = true;
    s.status = 'dead';
  }
}

/** 'continue' after combat.result applies the outcome and clears combat. */
function resolveCombatOutcome(s: GameState, ctx: StepCtx, events: GameEvent[]): void {
  const combat = s.combat;
  if (!combat?.result) return;
  const hero = s.hero!;
  const result = combat.result;
  hero.conditions = [];
  const victory = combat.victory;
  const flee = combat.fleeOutcome;
  const defeat = combat.defeatOutcome;
  const xpFor = result === 'victory'
    ? combat.enemies.reduce((n, e) => n + e.xp, 0)
    : result === 'fled'
      ? combat.enemies.filter((e) => e.dead).reduce((n, e) => n + e.xp, 0)
      : 0;
  s.combat = null;
  if (result === 'victory') {
    if (xpFor > 0) awardXp(s, xpFor, events);
    s.status = 'inQuest';
    applyOutcome(s, ctx, events, victory);
  } else if (result === 'fled') {
    if (xpFor > 0) awardXp(s, xpFor, events);
    s.status = 'inQuest';
    applyOutcome(s, ctx, events, flee ?? victory);
  } else if (result === 'defeat') {
    hero.hp = 1;
    s.status = 'inQuest';
    applyOutcome(s, ctx, events, defeat!);
  }
}

// ---------- step ----------

export function step(state: GameState, action: Action, ctx: StepCtx): StepResult {
  const s = structuredClone(state) as GameState;
  const events: GameEvent[] = [];
  dispatch(s, action, ctx, events);
  if (s.combat?.result) endCombat(s, ctx, events);
  appendLog(s, events);
  return { state: s, events };
}

function appendLog(s: GameState, events: GameEvent[]): void {
  for (const ev of events) {
    s.log.push({ seq: s.logSeq++, event: ev });
  }
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

function dispatch(s: GameState, action: Action, ctx: StepCtx, events: GameEvent[]): void {
  switch (action.type) {
    case 'newGame': {
      s.hero = structuredClone(action.hero);
      s.rng = rngFromSeed(action.seed);
      s.quest = null;
      s.combat = null;
      s.status = 'idle';
      return;
    }
    case 'startQuest': {
      const quest = ctx.quest;
      if (!quest || !s.hero || s.hero.dead) return void events.push(err('no quest or hero'));
      s.quest = {
        questId: quest.id,
        questVersion: quest.version,
        sceneId: quest.start,
        startGold: s.hero.gold,
        startXp: s.hero.xp,
        flags: { ...(quest.flags ?? {}) },
        visited: [],
        pending: null,
      };
      s.status = 'inQuest';
      s.combat = null;
      enterScene(s, ctx, events, quest.start);
      return;
    }
    case 'choose': {
      const qp = s.quest;
      const scene = qp && ctx.quest?.scenes[qp.sceneId];
      if (!qp || !scene || (scene.type !== 'narration' && scene.type !== 'dialogue'))
        return void events.push(err('nothing to choose'));
      if (qp.pending) return void events.push(err('an outcome is pending'));
      const choice = scene.choices[action.index] as Choice | undefined;
      if (!choice) return void events.push(err('invalid choice'));
      if (choice.requires && !evalCondition(choice.requires, s, ctx.quest))
        return void events.push(err('requirements not met'));
      if (choice.check) {
        const { rollResult } = rollCheck(s, ctx, choice.check, events);
        qp.pending = {
          kind: 'check',
          check: choice.check,
          label: checkLabel(choice.check),
          roll: rollResult,
          success: rollResult.total >= choice.check.dc,
          successOutcome: choice.success!,
          failureOutcome: choice.failure!,
          inspired: false,
          inspirationBonus: 0,
        };
        return;
      }
      applyOutcome(s, ctx, events, { goto: choice.goto!, ...(choice.effects ? { effects: choice.effects } : {}) });
      return;
    }
    case 'continue': {
      if (s.combat?.result) { resolveCombatOutcome(s, ctx, events); return; }
      const qp = s.quest;
      if (!qp?.pending) return void events.push(err('nothing to continue'));
      const pending = qp.pending;
      qp.pending = null;
      if (pending.kind === 'check') {
        applyOutcome(s, ctx, events, pending.success ? pending.successOutcome : pending.failureOutcome);
      } else if (pending.kind === 'outcome') {
        applyOutcome(s, ctx, events, pending.outcome);
      } else {
        applyOutcome(s, ctx, events, pending.next);
      }
      return;
    }
    case 'useInspiration': {
      const qp = s.quest;
      const hero = s.hero;
      if (qp?.pending?.kind !== 'check' || qp.pending.success || qp.pending.inspired)
        return void events.push(err('nothing to inspire'));
      if (!hero || (hero.resources['inspiration'] ?? 0) <= 0)
        return void events.push(err('no inspiration left'));
      hero.resources['inspiration']!--;
      const r = rollEvent(s, events, { actor: 'hero', actorName: hero.name, purpose: 'other', expr: '1d6', source: 'Bardic Inspiration' });
      qp.pending.inspired = true;
      qp.pending.inspirationBonus = r.result.total;
      qp.pending.success = qp.pending.roll.total + r.result.total >= qp.pending.check.dc;
      return;
    }
    case 'useItem':
      if (s.status === 'inCombat') return combatAction(s, action, ctx, events);
      return outOfCombatItem(s, action, ctx, events);
    case 'useAbility':
      if (s.status === 'inCombat') return combatAction(s, action, ctx, events);
      return outOfCombatAbility(s, action, ctx, events);
    case 'attack':
    case 'dodge':
    case 'flee':
    case 'endTurn':
      return combatAction(s, action, ctx, events);
    case 'rest':
      return restAction(s, action, ctx, events);
    case 'equip':
      return equipAction(s, action, ctx, events);
    case 'levelUp':
      return levelUpAction(s, action, ctx, events);
    default:
      return void events.push(err('unknown action'));
  }
}

const err = (m: string): GameEvent => ({ type: 'error', message: m });

// ---------- combat actions ----------

function combatAction(s: GameState, action: Action, ctx: StepCtx, events: GameEvent[]): void {
  const hero = s.hero!;
  const combat = s.combat;
  if (s.status !== 'inCombat' || !combat || !combat.heroTurn || combat.result)
    return void events.push(err('not your turn'));
  const ht = combat.heroTurn;
  const actionAvailable = !ht.actionUsed || ht.extraAction;
  const useAction = () => {
    if (ht.actionUsed) ht.extraAction = false;
    else ht.actionUsed = true;
  };

  switch (action.type) {
    case 'attack': {
      if (!actionAvailable) return void events.push(err('action already used'));
      if (!heroAttackAction(s, ctx.quest, action.targetId, action.smiteSlot, events))
        return void events.push(err('invalid target'));
      useAction();
      maybeAutoEndTurn(s, events);
      return;
    }
    case 'useAbility': {
      const def = ABILITIES[action.abilityId];
      if (!def) return void events.push(err('unknown ability'));
      if (def.kind === 'action' && !actionAvailable) return void events.push(err('action already used'));
      if (def.kind === 'bonus' && ht.bonusUsed) return void events.push(err('bonus already used'));
      const res = heroUseAbility(s, action.abilityId, action.targetId, action.slotLevel, action.amount, events);
      if (!res.ok) return void events.push(err(res.error ?? 'cannot use'));
      if (res.cost === 'action') useAction();
      else if (res.cost === 'bonus') ht.bonusUsed = true;
      maybeAutoEndTurn(s, events);
      return;
    }
    case 'useItem': {
      if (!actionAvailable) return void events.push(err('action already used'));
      const def = findItem(action.itemId, ctx.quest);
      if (!def || def.kind !== 'consumable') return void events.push(err('not usable'));
      if (!removeItem(s, action.itemId, 1)) return void events.push(err('item not held'));
      applyEffects(def.use, s, ctx.quest, events);
      useAction();
      maybeAutoEndTurn(s, events);
      return;
    }
    case 'dodge': {
      if (!actionAvailable) return void events.push(err('action already used'));
      hero.conditions.push({ name: 'dodging', rounds: 1 });
      events.push({ type: 'condition', target: 'hero', condition: 'dodging', on: true });
      useAction();
      maybeAutoEndTurn(s, events);
      return;
    }
    case 'flee': {
      if (!combat.canFlee || !combat.fleeOutcome) return void events.push(err('cannot flee here'));
      if (!actionAvailable) return void events.push(err('action already used'));
      const parts = [
        { label: 'Dexterity', value: abilityMod(hero.abilities.DEX) },
        ...(CLASSES[hero.classId].skills.includes('acrobatics') ? [{ label: 'proficiency', value: proficiencyBonus(hero.level) }] : []),
      ];
      const r = rollEvent(s, events, {
        actor: 'hero', actorName: hero.name, purpose: 'check', expr: '1d20', parts,
        source: 'Acrobatics (Dexterity)', vs: { kind: 'difficulty', value: combat.fleeDC }, label: 'Flee (Acrobatics)',
      });
      const fleeEv = events[events.length - 1]!;
      if (fleeEv.type === 'roll') fleeEv.outcome = r.total >= combat.fleeDC ? 'success' : 'failure';
      useAction();
      if (r.total >= combat.fleeDC) {
        combat.result = 'fled';
        events.push({ type: 'combatEnd', result: 'fled' });
      } else {
        events.push({ type: 'narrate', text: 'You fail to break away.' });
        endHeroTurn(s, events);
      }
      return;
    }
    case 'endTurn':
      endHeroTurn(s, events);
      return;
    default:
      return void events.push(err('not a combat action'));
  }
}

// ---------- rest / equip / level ----------

function restAction(
  s: GameState,
  action: { type: 'rest'; kind: 'short' | 'long'; hitDice?: number },
  ctx: StepCtx,
  events: GameEvent[],
): void {
  const hero = s.hero;
  if (!hero || hero.dead || s.status === 'inCombat') return void events.push(err('cannot rest now'));
  const cls = CLASSES[hero.classId];
  const refreshResources = (per: 'short' | 'long') => {
    for (const [id, def] of Object.entries(cls.resources)) {
      if (def.per === per && def.minLevel <= hero.level) {
        hero.resources[id] = resourceMax(hero.classId, id, hero.abilities, hero.level);
      }
    }
  };

  if (action.kind === 'short') {
    if (hero.shortRestsSinceLong >= MAX_SHORT_RESTS)
      return void events.push(err('need a long rest first'));
    hero.shortRestsSinceLong++;
    refreshResources('short');
    const dice = Math.max(0, Math.min(action.hitDice ?? 0, hero.level - hero.hitDiceUsed));
    for (let i = 0; i < dice; i++) {
      const r = rollEvent(s, events, {
        actor: 'hero', actorName: hero.name, purpose: 'heal', expr: `1d${cls.hitDie}`,
        parts: [{ label: 'Constitution', value: abilityMod(hero.abilities.CON) }],
        source: 'Hit Die', label: 'Hit Die',
      });
      healHero(s, r.total, events);
    }
    hero.hitDiceUsed += dice;
    // Arcane Recovery: restore one 1st-level slot once per long rest
    if (hero.classId === 'wizard' && (hero.resources['arcane-recovery'] ?? 0) > 0 && (hero.slotsUsed[0] ?? 0) > 0) {
      hero.resources['arcane-recovery']!--;
      hero.slotsUsed[0]!--;
      events.push({ type: 'narrate', text: 'Arcane Recovery restores a 1st-level slot.' });
    }
    events.push({ type: 'narrate', text: 'You take a short rest.' });
    return;
  }

  // long rest
  const scene = s.quest && ctx.quest?.scenes[s.quest.sceneId];
  if (!scene || scene.rest !== 'long') return void events.push(err('no safe place for a long rest'));
  hero.hp = hero.maxHp;
  hero.slotsUsed = hero.slotsUsed.map(() => 0);
  refreshResources('short');
  refreshResources('long');
  hero.shortRestsSinceLong = 0;
  hero.hitDiceUsed = Math.max(0, hero.hitDiceUsed - Math.ceil(hero.level / 2));
  events.push({ type: 'narrate', text: 'You take a long rest and recover fully.' });
}

function outOfCombatItem(
  s: GameState,
  action: { type: 'useItem'; itemId: string },
  ctx: StepCtx,
  events: GameEvent[],
): void {
  const hero = s.hero;
  if (!hero || hero.dead) return void events.push(err('no living hero'));
  const def = findItem(action.itemId, ctx.quest);
  if (!def || def.kind !== 'consumable') return void events.push(err('not usable'));
  if (!removeItem(s, action.itemId, 1)) return void events.push(err('item not held'));
  applyEffects(def.use, s, ctx.quest, events);
}

/** Out of combat only abilities with `heal` (plus Lay on Hands) may be used. */
function outOfCombatAbility(
  s: GameState,
  action: { type: 'useAbility'; abilityId: string; slotLevel?: number; amount?: number },
  _ctx: StepCtx,
  events: GameEvent[],
): void {
  const hero = s.hero;
  if (!hero || hero.dead) return void events.push(err('no living hero'));
  const def = ABILITIES[action.abilityId];
  if (!def || def.classId !== hero.classId) return void events.push(err('unknown ability'));
  if (def.minLevel > hero.level) return void events.push(err('not unlocked yet'));
  if (!def.heal && def.special !== 'lay-on-hands')
    return void events.push(err('cannot use that here'));

  if (def.special === 'lay-on-hands') {
    const pool = hero.resources['lay-on-hands'] ?? 0;
    const spend = Math.min(action.amount ?? pool, pool);
    if (spend <= 0) return void events.push(err('lay on hands pool empty'));
    hero.resources['lay-on-hands'] = pool - spend;
    healHero(s, spend, events);
    return;
  }
  const lvl = action.slotLevel ?? def.slot!;
  const idx = lvl - 1;
  const max = slotsFor(hero.classId, hero.level)[idx] ?? 0;
  if (def.slot === undefined || lvl < def.slot || (hero.slotsUsed[idx] ?? 0) >= max)
    return void events.push(err('no slot available'));
  hero.slotsUsed[idx]!++;
  const expr = upcastDice(def.heal!, def.upcast?.dice, lvl, def.slot).replace(/[+-]\d+$/, '');
  const mod = def.healAbility ? abilityMod(hero.abilities[def.healAbility]) : 0;
  const r = rollEvent(s, events, {
    actor: 'hero', actorName: hero.name, purpose: 'heal', expr,
    parts: mod ? [{ label: def.healAbility ? abilityName(def.healAbility) : 'bonus', value: mod }] : [],
    source: def.name, targetName: hero.name,
  });
  healHero(s, r.total, events);
}

function equipAction(
  s: GameState,
  action: { type: 'equip'; itemId: string },
  ctx: StepCtx,
  events: GameEvent[],
): void {
  const hero = s.hero;
  if (!hero || !hero.inventory.some((i) => i.item === action.itemId && i.qty > 0))
    return void events.push(err('item not held'));
  const def = findItem(action.itemId, ctx.quest);
  if (!def) return void events.push(err('unknown item'));
  if (def.kind === 'weapon') hero.equipment.weapon = action.itemId;
  else if (def.kind === 'armour') hero.equipment.armour = action.itemId;
  else if (def.kind === 'shield') hero.equipment.shield = action.itemId;
  else return void events.push(err('cannot equip that'));
  events.push({ type: 'narrate', text: `${hero.name} equips ${def.name}.` });
}

function levelUpAction(
  s: GameState,
  action: { type: 'levelUp'; asi?: Partial<Record<string, 1 | 2>> },
  _ctx: StepCtx,
  events: GameEvent[],
): void {
  const hero = s.hero;
  if (!hero || hero.pendingLevelUps <= 0 || s.status === 'inCombat')
    return void events.push(err('no level-up pending'));
  const newLevel = hero.level + 1;
  if (newLevel === 4) {
    const asi = action.asi ?? {};
    const entries = Object.entries(asi).filter(([, v]) => v);
    const total = entries.reduce((n, [, v]) => n + (v ?? 0), 0);
    const validShape = entries.length > 0 && total === 2 && entries.every(([, v]) => v === 1 || v === 2) &&
      !(entries.length === 2 && entries.some(([, v]) => v === 2));
    if (!validShape) return void events.push(err('level 4 requires +2 to one score or +1 to two'));
    for (const [ab, v] of entries) {
      const key = ab as keyof typeof hero.abilities;
      if (!(key in hero.abilities) || hero.abilities[key] + (v ?? 0) > 20)
        return void events.push(err('ASI would exceed 20'));
    }
    for (const [ab, v] of entries) hero.abilities[ab as keyof typeof hero.abilities] += v!;
  }
  const cls = CLASSES[hero.classId];
  const gain = hpGainPerLevel(cls.hitDie, abilityMod(hero.abilities.CON));
  hero.level = newLevel;
  hero.pendingLevelUps--;
  hero.maxHp += gain;
  hero.hp = Math.min(hero.maxHp, hero.hp + gain);
  // slots may grow; grant resources unlocked at this level
  const slotCount = slotsFor(hero.classId, newLevel);
  while (hero.slotsUsed.length < slotCount.length) hero.slotsUsed.push(0);
  for (const [id, def] of Object.entries(cls.resources)) {
    const max = resourceMax(hero.classId, id, hero.abilities, newLevel);
    if (def.minLevel <= newLevel) {
      hero.resources[id] = def.max === 'level5' || def.max === 'cha-mod'
        ? Math.max(hero.resources[id] ?? 0, max)
        : (hero.resources[id] ?? max);
    }
  }
  events.push({ type: 'narrate', text: `${hero.name} reaches level ${newLevel}!` });
}

export type { Hero };
export type { Scene };
