import { isDiceExpr } from '../dice/parse';
import { ITEMS } from '../../content/items';
import { CLASSES } from '../../content/classes';
import { SKILL_ABILITY, ABILITY_IDS } from '../rules';
import { BACKDROPS, DAMAGE_TYPES, CONDITION_NAMES, ITEM_KINDS } from './schema-enums';
import type { Quest } from './types';

export interface ValidationResult {
  ok: boolean;
  quest?: Quest;
  errors: string[];
  warnings: string[];
}

const SCENE_TYPES = ['narration', 'dialogue', 'check', 'encounter', 'loot', 'ending'];
const OUTCOMES = ['victory', 'neutral', 'defeat'];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

export function validateQuest(json: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(m);

  if (!isObj(json)) return { ok: false, errors: ['quest is not an object'], warnings };
  const q = json;

  if (q.schemaVersion !== 1) err('schemaVersion must be 1');
  for (const f of ['id', 'version', 'title', 'summary', 'start'] as const) {
    if (!isStr(q[f])) err(`missing/invalid string field "${f}"`);
  }
  if (isStr(q.id) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.id)) err('id must be kebab-case');
  if (q.flags !== undefined && !isObj(q.flags)) err('flags must be an object');
  if (!isObj(q.scenes) || Object.keys(q.scenes).length === 0) err('scenes must be a non-empty object');
  if (errors.length) return { ok: false, errors, warnings };

  const scenes = q.scenes as Record<string, Record<string, unknown>>;
  const npcs = isObj(q.npcs) ? (q.npcs as Record<string, unknown>) : {};
  const enemies = isObj(q.enemies) ? (q.enemies as Record<string, unknown>) : {};
  const items = isObj(q.items) ? (q.items as Record<string, unknown>) : {};

  const hasScene = (id: unknown) => isStr(id) && id in scenes;
  const hasItem = (id: unknown) => isStr(id) && (id in items || id in ITEMS);

  // ---- NPCs / items ------------------------------------------------------------
  for (const [id, npc] of Object.entries(npcs)) {
    if (!isObj(npc) || !isStr(npc.name)) err(`npc "${id}" needs a name`);
  }
  for (const [id, item] of Object.entries(items)) {
    if (!isObj(item) || !isStr(item.name) || !ITEM_KINDS.includes(item.kind as never)) {
      err(`item "${id}" needs name and valid kind`);
      continue;
    }
    if (item.kind === 'weapon') {
      if (!isStr(item.damage) || !isDiceExpr(item.damage as string)) err(`item "${id}" bad damage dice`);
      if (!['slashing', 'piercing', 'bludgeoning'].includes(item.damageType as string) &&
          !DAMAGE_TYPES.includes(item.damageType as never)) err(`item "${id}" bad damageType`);
    }
    if (item.kind === 'armour' && !['light', 'medium', 'heavy'].includes(item.armour as string))
      err(`item "${id}" bad armour weight`);
  }

  // ---- Enemies -----------------------------------------------------------------
  for (const [id, en] of Object.entries(enemies)) {
    if (!isObj(en)) { err(`enemy "${id}" invalid`); continue; }
    if (!isStr(en.name)) err(`enemy "${id}" needs a name`);
    if (!isNum(en.ac)) err(`enemy "${id}" needs numeric ac`);
    if (!isStr(en.hp) || !isDiceExpr(en.hp)) err(`enemy "${id}" bad hp dice`);
    if (!isNum(en.dex)) err(`enemy "${id}" needs numeric dex`);
    if (!isNum(en.passivePerception)) err(`enemy "${id}" needs passivePerception`);
    if (!isNum(en.xp)) err(`enemy "${id}" needs numeric xp`);
    if (!Array.isArray(en.actions) || en.actions.length === 0) {
      err(`enemy "${id}" needs actions`);
      continue;
    }
    for (const [ai, act] of en.actions.entries()) {
      const p = `enemy "${id}" action ${ai}`;
      if (!isObj(act) || !isStr(act.name)) { err(`${p} needs a name`); continue; }
      if (act.attack === undefined && act.save === undefined) err(`${p} needs attack or save`);
      if (act.damage !== undefined && (!isStr(act.damage) || !isDiceExpr(act.damage)))
        err(`${p} bad damage dice`);
      if (act.save !== undefined) {
        if (!isObj(act.save) || !ABILITY_IDS.includes(act.save.ability as never) || !isNum(act.save.dc))
          err(`${p} bad save`);
      }
    }
    for (const list of ['resist', 'vulnerable', 'immune'] as const) {
      if (en[list] !== undefined && (!Array.isArray(en[list]) || !(en[list] as unknown[]).every((t) => DAMAGE_TYPES.includes(t as never))))
        err(`enemy "${id}" bad ${list} list`);
    }
  }

  // ---- helpers for nested structures -------------------------------------------
  const checkCond = (cond: unknown, path: string) => {
    if (!isObj(cond)) { err(`${path}: invalid condition`); return; }
    if ('flag' in cond) { if (!isStr(cond.flag)) err(`${path}: flag needs a key`); return; }
    if ('hasItem' in cond) { if (!hasItem(cond.hasItem)) err(`${path}: unknown item "${cond.hasItem}"`); return; }
    if ('class' in cond) {
      if (!Array.isArray(cond.class) || !cond.class.every((c) => isStr(c) && c in CLASSES))
        err(`${path}: bad class list`);
      return;
    }
    if ('ability' in cond) {
      if (!ABILITY_IDS.includes(cond.ability as never) || !isNum(cond.gte)) err(`${path}: bad ability condition`);
      return;
    }
    if ('gold' in cond || 'level' in cond) {
      const g = 'gold' in cond ? cond.gold : (cond as { level: unknown }).level;
      if (!isObj(g)) err(`${path}: bad range condition`);
      return;
    }
    if ('all' in cond || 'any' in cond) {
      const list = ('all' in cond ? cond.all : cond.any) as unknown;
      if (!Array.isArray(list) || list.length === 0) err(`${path}: empty combinator`);
      else list.forEach((c, i) => checkCond(c, `${path}[${i}]`));
      return;
    }
    if ('not' in cond) { checkCond(cond.not, `${path}.not`); return; }
    err(`${path}: unknown condition`);
  };

  const checkEffects = (effects: unknown, path: string) => {
    if (effects === undefined) return;
    if (!Array.isArray(effects)) { err(`${path}: effects must be an array`); return; }
    effects.forEach((eff, i) => {
      const p = `${path}.effects[${i}]`;
      if (!isObj(eff)) { err(`${p}: invalid effect`); return; }
      if ('gold' in eff) {
        if (!isNum(eff.gold) && !(isStr(eff.gold) && isDiceExpr(eff.gold))) err(`${p}: bad gold`);
      } else if ('heal' in eff) {
        if (!isStr(eff.heal) || !isDiceExpr(eff.heal)) err(`${p}: bad heal dice`);
      } else if ('damage' in eff) {
        if (!isStr(eff.damage) || !isDiceExpr(eff.damage)) err(`${p}: bad damage dice`);
        if (eff.type !== undefined && !DAMAGE_TYPES.includes(eff.type as never)) err(`${p}: bad damage type`);
        if (eff.save !== undefined) {
          const sv = eff.save;
          if (!isObj(sv) || !ABILITY_IDS.includes(sv.ability as never) || !isNum(sv.dc)) err(`${p}: bad save`);
        }
      } else if ('addItem' in eff) {
        if (!hasItem(eff.addItem)) err(`${p}: unknown item "${eff.addItem}"`);
      } else if ('removeItem' in eff) {
        if (!hasItem(eff.removeItem)) err(`${p}: unknown item "${eff.removeItem}"`);
      } else if ('condition' in eff) {
        if (!CONDITION_NAMES.includes(eff.condition as never)) err(`${p}: bad condition "${eff.condition}"`);
      } else if ('xp' in eff) {
        if (!isNum(eff.xp)) err(`${p}: bad xp`);
      } else if ('setFlag' in eff) {
        if (!isStr(eff.setFlag) || !(isStr(eff.value) || isNum(eff.value) || isBool(eff.value))) err(`${p}: bad setFlag`);
      } else if ('addFlag' in eff) {
        if (!isStr(eff.addFlag) || !isNum(eff.by)) err(`${p}: bad addFlag`);
      } else if ('restoreSlots' in eff) {
        if (eff.restoreSlots !== true) err(`${p}: bad restoreSlots`);
      } else err(`${p}: unknown effect`);
    });
  };

  const checkOutcome = (o: unknown, path: string) => {
    if (!isObj(o)) { err(`${path}: invalid outcome`); return; }
    if (!hasScene(o.goto)) err(`${path}: unknown goto "${String(o.goto)}"`);
    if (o.text !== undefined && !isStr(o.text)) err(`${path}: text must be a string`);
    checkEffects(o.effects, path);
  };

  const checkCheckDef = (c: unknown, path: string) => {
    if (!isObj(c)) { err(`${path}: invalid check`); return; }
    if (c.skill === undefined && c.ability === undefined) err(`${path}: check needs skill or ability`);
    if (c.skill !== undefined && (!isStr(c.skill) || !(c.skill in SKILL_ABILITY))) err(`${path}: unknown skill "${String(c.skill)}"`);
    if (c.ability !== undefined && !ABILITY_IDS.includes(c.ability as never)) err(`${path}: bad ability`);
    if (!isNum(c.dc)) err(`${path}: check needs numeric dc`);
    if (c.advantageIf) checkCond(c.advantageIf, `${path}.advantageIf`);
    if (c.disadvantageIf) checkCond(c.disadvantageIf, `${path}.disadvantageIf`);
  };

  const checkChoices = (choices: unknown, path: string) => {
    if (!Array.isArray(choices) || choices.length === 0) {
      err(`${path}: needs at least one choice`);
      return;
    }
    choices.forEach((ch, i) => {
      const p = `${path}.choices[${i}]`;
      if (!isObj(ch) || !isStr(ch.text)) { err(`${p}: choice needs text`); return; }
      if (ch.requires) checkCond(ch.requires, `${p}.requires`);
      if (ch.check !== undefined) {
        checkCheckDef(ch.check, `${p}.check`);
        checkOutcome(ch.success, `${p}.success`);
        checkOutcome(ch.failure, `${p}.failure`);
      } else {
        if (!hasScene(ch.goto)) err(`${p}: unknown goto "${String(ch.goto)}"`);
        checkEffects(ch.effects, p);
      }
    });
  };

  // ---- scenes ------------------------------------------------------------------
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: unknown) => {
    if (isStr(to)) adjacency.get(from)!.push(to);
  };

  for (const [id, sc] of Object.entries(scenes)) {
    adjacency.set(id, []);
    const p = `scene "${id}"`;
    if (!isObj(sc) || !SCENE_TYPES.includes(sc.type as string)) { err(`${p}: bad type`); continue; }
    if (!isStr(sc.title) || !isStr(sc.text)) err(`${p}: needs title and text`);
    if (sc.rest !== undefined && sc.rest !== 'short' && sc.rest !== 'long') err(`${p}: bad rest`);
    if (sc.backdrop !== undefined && !BACKDROPS.includes(sc.backdrop as never)) err(`${p}: unknown backdrop "${String(sc.backdrop)}"`);
    checkEffects(sc.onEnter, `${p}.onEnter`);

    const linkChoices = (choices: unknown) => {
      if (!Array.isArray(choices)) return;
      for (const c of choices) {
        if (!isObj(c)) continue;
        if (c.check) {
          link(id, isObj(c.success) ? c.success.goto : undefined);
          link(id, isObj(c.failure) ? c.failure.goto : undefined);
        } else link(id, c.goto);
      }
    };

    switch (sc.type) {
      case 'narration':
        checkChoices(sc.choices, p);
        linkChoices(sc.choices);
        break;
      case 'dialogue': {
        if (!isStr(sc.speaker) || !(sc.speaker in npcs)) err(`${p}: unknown speaker "${String(sc.speaker)}"`);
        checkChoices(sc.choices, p);
        linkChoices(sc.choices);
        break;
      }
      case 'check':
        checkCheckDef(sc.check, p);
        checkOutcome(sc.success, `${p}.success`);
        checkOutcome(sc.failure, `${p}.failure`);
        link(id, (sc.success as { goto?: string })?.goto);
        link(id, (sc.failure as { goto?: string })?.goto);
        break;
      case 'encounter': {
        if (!Array.isArray(sc.enemies) || sc.enemies.length === 0) {
          err(`${p}: needs enemies`);
        } else {
          sc.enemies.forEach((e: unknown, i: number) => {
            if (!isObj(e) || !isStr(e.enemy) || !(e.enemy in enemies)) err(`${p}.enemies[${i}]: unknown enemy`);
            if (isObj(e) && e.count !== undefined && (!isNum(e.count) || (e.count as number) < 1)) err(`${p}.enemies[${i}]: bad count`);
          });
        }
        if (sc.surprise !== undefined && sc.surprise !== 'hero' && sc.surprise !== 'enemies') err(`${p}: bad surprise`);
        if (sc.fleeDC !== undefined && !isNum(sc.fleeDC)) err(`${p}: bad fleeDC`);
        checkOutcome(sc.victory, `${p}.victory`);
        if (sc.canFlee !== false && sc.flee === undefined) err(`${p}: canFlee encounters need a flee outcome`);
        if (sc.flee !== undefined) checkOutcome(sc.flee, `${p}.flee`);
        if (sc.defeat !== undefined) checkOutcome(sc.defeat, `${p}.defeat`);
        link(id, (sc.victory as { goto?: string })?.goto);
        link(id, (sc.flee as { goto?: string })?.goto);
        link(id, (sc.defeat as { goto?: string })?.goto);
        break;
      }
      case 'loot': {
        if (sc.gold !== undefined && !isNum(sc.gold) && !(isStr(sc.gold) && isDiceExpr(sc.gold))) err(`${p}: bad gold`);
        if (sc.items !== undefined) {
          if (!Array.isArray(sc.items)) err(`${p}: items must be an array`);
          else sc.items.forEach((it: unknown, i: number) => {
            if (!isObj(it) || !hasItem(it.item)) err(`${p}.items[${i}]: unknown item`);
          });
        }
        checkOutcome(sc.next, `${p}.next`);
        link(id, (sc.next as { goto?: string })?.goto);
        break;
      }
      case 'ending': {
        if (!OUTCOMES.includes(sc.outcome as string)) err(`${p}: bad outcome`);
        if (sc.xp !== undefined && !isNum(sc.xp)) err(`${p}: bad xp`);
        break;
      }
    }
  }

  // ---- reachability -------------------------------------------------------------
  if (!hasScene(q.start)) err(`start "${String(q.start)}" is not a scene`);
  const reachable = new Set<string>();
  if (hasScene(q.start)) {
    const stack = [q.start as string];
    while (stack.length) {
      const cur = stack.pop()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      for (const nxt of adjacency.get(cur) ?? []) if (!reachable.has(nxt)) stack.push(nxt);
    }
  }
  let endingCount = 0;
  let reachableEnding = false;
  for (const [id, sc] of Object.entries(scenes)) {
    if (sc.type === 'ending') {
      endingCount++;
      if (reachable.has(id)) reachableEnding = true;
    }
    if (!reachable.has(id)) warnings.push(`scene "${id}" is unreachable`);
  }
  if (endingCount === 0) err('quest needs at least one ending scene');
  else if (!reachableEnding) err('no ending scene is reachable from start');

  return {
    ok: errors.length === 0,
    ...(errors.length === 0 ? { quest: q as unknown as Quest } : {}),
    errors,
    warnings,
  };
}
