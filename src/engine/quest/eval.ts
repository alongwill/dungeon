import { parseExpr } from '../dice/parse';
import { fmtMod, roll } from '../dice/roll';
import { ITEMS } from '../../content/items';
import { CLASSES } from '../../content/classes';
import { abilityMod, MAX_LEVEL, proficiencyBonus, XP_THRESHOLDS } from '../rules';
import type {
  Condition,
  Effect,
  ItemDef,
  Quest,
} from './types';
import type { GameEvent, GameState, Hero } from '../model';

/** Resolve an item id against quest-local items, then the global catalog. */
export function findItem(itemId: string, quest: Quest | null): ItemDef | undefined {
  return quest?.items?.[itemId] ?? ITEMS[itemId];
}

export function evalCondition(cond: Condition, s: GameState, quest: Quest | null): boolean {
  const hero = s.hero;
  if ('flag' in cond) {
    const v = s.quest?.flags[cond.flag];
    if (cond.eq !== undefined) return v === cond.eq;
    if (cond.gte !== undefined) return typeof v === 'number' && v >= cond.gte;
    if (cond.lte !== undefined) return typeof v === 'number' && v <= cond.lte;
    return !!v;
  }
  if ('hasItem' in cond) {
    return !!hero?.inventory.some((i) => i.item === cond.hasItem && i.qty > 0);
  }
  if ('class' in cond) {
    return !!hero && (cond.class as string[]).includes(hero.classId);
  }
  if ('ability' in cond) {
    return !!hero && hero.abilities[cond.ability] >= cond.gte;
  }
  if ('gold' in cond) {
    if (!hero) return false;
    if (cond.gold.gte !== undefined && hero.gold < cond.gold.gte) return false;
    if (cond.gold.lte !== undefined && hero.gold > cond.gold.lte) return false;
    return true;
  }
  if ('level' in cond) {
    if (!hero) return false;
    if (cond.level.gte !== undefined && hero.level < cond.level.gte) return false;
    if (cond.level.lte !== undefined && hero.level > cond.level.lte) return false;
    return true;
  }
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, s, quest));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, s, quest));
  if ('not' in cond) return !evalCondition(cond.not, s, quest);
  return false;
}

export function interpolate(text: string, s: GameState, _quest: Quest | null): string {
  return text.replace(/\{\{(hero\.name|hero\.class|flag\.[\w-]+)\}\}/g, (_, key: string) => {
    if (key === 'hero.name') return s.hero?.name ?? 'hero';
    if (key === 'hero.class') return s.hero ? CLASSES[s.hero.classId].name : '';
    const flag = key.slice('flag.'.length);
    const v = s.quest?.flags[flag];
    return v === undefined ? '' : String(v);
  });
}

export function addItem(s: GameState, itemId: string, qty: number): void {
  const hero = s.hero!;
  const line = hero.inventory.find((i) => i.item === itemId);
  if (line) line.qty += qty;
  else hero.inventory.push({ item: itemId, qty });
}

export function removeItem(s: GameState, itemId: string, qty: number): boolean {
  const hero = s.hero!;
  const line = hero.inventory.find((i) => i.item === itemId);
  if (!line || line.qty < qty) return false;
  line.qty -= qty;
  if (line.qty <= 0) hero.inventory.splice(hero.inventory.indexOf(line), 1);
  return true;
}

/** Apply effects in order. Mutates the (already cloned) state draft. */
export function applyEffects(
  effects: Effect[] | undefined,
  s: GameState,
  _quest: Quest | null,
  events: GameEvent[],
): void {
  if (!effects) return;
  for (const eff of effects) {
    if ('setFlag' in eff) {
      if (s.quest) s.quest.flags[eff.setFlag] = eff.value;
    } else if ('addFlag' in eff) {
      if (s.quest) {
        const cur = s.quest.flags[eff.addFlag];
        s.quest.flags[eff.addFlag] = (typeof cur === 'number' ? cur : 0) + eff.by;
      }
    } else if ('gold' in eff) {
      let amount = 0;
      if (typeof eff.gold === 'number') amount = eff.gold;
      else {
        const { result, rng } = roll(parseExpr(eff.gold), s.rng);
        s.rng = rng;
        amount = result.total;
        events.push({ type: 'roll', label: 'Gold', result });
      }
      if (s.hero) s.hero.gold = Math.max(0, s.hero.gold + amount);
    } else if ('addItem' in eff) {
      if (s.hero) addItem(s, eff.addItem, eff.qty ?? 1);
    } else if ('removeItem' in eff) {
      if (s.hero) removeItem(s, eff.removeItem, eff.qty ?? 1);
    } else if ('xp' in eff) {
      awardXp(s, eff.xp, events);
    } else if ('heal' in eff) {
      const { result, rng } = roll(parseExpr(eff.heal), s.rng);
      s.rng = rng;
      events.push({ type: 'roll', label: 'Healing', result });
      healHero(s, result.total, events);
    } else if ('damage' in eff) {
      applyDamageEffect(s, eff, events);
    } else if ('condition' in eff) {
      if (s.hero) {
        s.hero.conditions.push({ name: eff.condition, rounds: eff.rounds ?? 'combat' });
        events.push({ type: 'condition', target: 'hero', condition: eff.condition, on: true });
      }
    } else if ('restoreSlots' in eff) {
      if (s.hero) s.hero.slotsUsed = s.hero.slotsUsed.map(() => 0);
    }
  }
}

/** The hero's saving throw: ability mod + class-save proficiency + Bless/Inspiration. */
export function heroSave(
  s: GameState,
  ability: keyof Hero['abilities'],
  dc: number,
  events: GameEvent[],
): { total: number; saved: boolean } {
  const hero = s.hero!;
  let mod = abilityMod(hero.abilities[ability]);
  if (CLASSES[hero.classId].saves.includes(ability)) mod += proficiencyBonus(hero.level);
  const r = roll(`1d20${fmtMod(mod)}`, s.rng);
  s.rng = r.rng;
  events.push({ type: 'roll', label: `${hero.name} ${ability} save`, result: r.result });
  let total = r.result.total;
  const has = (n: string) => hero.conditions.some((c) => c.name === n);
  if (has('blessed')) {
    const b = roll('1d4', s.rng);
    s.rng = b.rng;
    total += b.result.total;
    events.push({ type: 'roll', label: 'Bless', result: b.result });
  }
  if (has('inspired')) {
    const b = roll('1d6', s.rng);
    s.rng = b.rng;
    total += b.result.total;
    events.push({ type: 'roll', label: 'Inspiration', result: b.result });
    hero.conditions = hero.conditions.filter((c) => c.name !== 'inspired');
    events.push({ type: 'condition', target: 'hero', condition: 'inspired', on: false });
  }
  const saved = total >= dc;
  events.push({
    type: 'narrate',
    text: `${hero.name} ${ability} save ${total} vs DC ${dc}: ${saved ? 'saved' : 'failed'}`,
  });
  return { total, saved };
}

function applyDamageEffect(
  s: GameState,
  eff: { damage: string; type?: string; save?: { ability: string; dc: number; half?: boolean } },
  events: GameEvent[],
): void {
  const hero = s.hero;
  if (!hero) return;
  const { result, rng } = roll(parseExpr(eff.damage), s.rng);
  s.rng = rng;
  events.push({ type: 'roll', label: 'Damage', result });
  let amount = result.total;
  if (eff.save) {
    const { saved } = heroSave(s, eff.save.ability as keyof Hero['abilities'], eff.save.dc, events);
    if (saved) amount = eff.save.half ? Math.floor(amount / 2) : 0;
  }
  hero.hp = Math.max(0, hero.hp - amount);
  events.push({ type: 'damage', target: 'hero', amount, damageType: eff.type as never });
  if (hero.hp === 0 && !s.combat) {
    hero.dead = true;
    s.status = 'dead';
    events.push({ type: 'death' });
  }
}

export function awardXp(s: GameState, amount: number, events: GameEvent[]): void {
  const hero = s.hero;
  if (!hero || amount <= 0) return;
  hero.xp += amount;
  checkLevelUp(s, events);
}

export function checkLevelUp(s: GameState, events: GameEvent[]): void {
  const hero = s.hero;
  if (!hero) return;
  let warranted = hero.level;
  while (warranted < MAX_LEVEL && hero.xp >= XP_THRESHOLDS[warranted + 1]!) warranted++;
  const had = hero.pendingLevelUps;
  hero.pendingLevelUps = warranted - hero.level;
  if (hero.pendingLevelUps > had) events.push({ type: 'levelUpAvailable' });
}

export function healHero(s: GameState, amount: number, events: GameEvent[]): void {
  const hero = s.hero;
  if (!hero || amount <= 0) return;
  const healed = Math.min(amount, hero.maxHp - hero.hp);
  hero.hp += healed;
  if (healed > 0) events.push({ type: 'heal', target: 'hero', amount: healed });
}
