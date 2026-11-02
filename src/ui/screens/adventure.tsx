import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../avatar/Avatar';
import { ABILITIES } from '../../content/abilities';
import { CLASSES } from '../../content/classes';
import { formatRoll } from '../../engine/dice';
import { abilityMod, proficiencyBonus, slotsFor } from '../../engine/rules';
import { evalCondition, findItem, interpolate } from '../../engine/quest/eval';
import { EventFeed } from '../EventFeed';
import { detectWebGL, mountFx, shouldEnableFx, type FxHandle } from '../../fx';
import { em } from '../em';
import { resourceMax } from '../../engine/rules';
import { usableBonusActions } from '../../engine/combat';
import type { Choice, ItemDef, Scene } from '../../engine/quest/types';
import type { Hero, PendingOutcome } from '../../engine/model';
import { abilityCost, classInfoLines, describeAbility } from '../format';
import { questAssetUrl } from '../../quests/registry';
import {
  advancePlayback, dispatch, gotoScreen, setDrawer, startQuestById, useStore,
} from '../store';
import { DeathScreen, EndingScreen } from './meta';

const hash = (t: string) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

const ord = (n: number) => ['—','1st','2nd','3rd','4th','5th'][n] ?? `${n}th`;

const hpDescriptor = (hp: number, max: number) => {
  const p = hp / max;
  return p >= 1 ? 'Unhurt' : p > 0.5 ? 'Wounded' : p > 0.25 ? 'Bloodied' : 'Near defeat';
};

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div class="bar" role="img" aria-label={`${label}: ${value} of ${max}`}>
      <div class="bar-fill" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      <span class="bar-text">{value}/{max}</span>
    </div>
  );
}

function StatusBar({ hero }: { hero: Hero }) {
  const slots = slotsFor(hero.classId, hero.level);
  return (
    <header class="statusbar">
      <Avatar spec={hero.avatar} size={36} label="hero avatar" />
      <span><strong>{hero.name}</strong> · L{hero.level} {CLASSES[hero.classId].name}</span>
      <Bar value={hero.hp} max={hero.maxHp} label="Hit points" />
      {slots.length > 0 && (
        <span class="slots" aria-label="spell slots">
          {slots.map((m, i) => `${ord(i + 1)} ${m - (hero.slotsUsed[i] ?? 0)}/${m}`).join(' · ')}
        </span>
      )}
      {Object.entries(hero.resources).map(([id, n]) => {
        const def = CLASSES[hero.classId].resources[id];
        const max = resourceMax(hero.classId, id, hero.abilities, hero.level);
        return <span key={id} class="resource">{def?.name ?? id} {n}/{max}</span>;
      })}
      <span class="gold">{hero.gold} gp</span>
    </header>
  );
}

function reqReason(c: NonNullable<Choice['requires']>): string {
  if ('gold' in c && c.gold.gte) return `needs ${c.gold.gte} gp`;
  if ('hasItem' in c) return `needs ${String(c.hasItem).replace(/-/g, ' ')}`;
  if ('class' in c) return `${c.class.join('/')} only`;
  if ('level' in c) return `level ${(c.level as { gte?: number }).gte}+`;
  if ('ability' in c) return `${c.ability} ${(c as { gte: number }).gte}+`;
  if ('flag' in c) return 'not yet';
  return 'requirements unmet';
}

function PendingCard({ pending, quest }: { pending: PendingOutcome; quest: import('../../engine/quest/types').Quest }) {
  const hero = useStore((s) => s.game.hero)!;
  const inspireOk =
    pending.kind === 'check' && !pending.success && !pending.inspired &&
    (hero.resources['inspiration'] ?? 0) > 0;
  return (
    <div class="pending card" role="status">
      {pending.kind === 'check' && (
        <>
          <p><strong>{pending.label} (DC {pending.check.dc}):</strong> {formatRoll(pending.roll)}
            {pending.inspired && ` +${pending.inspirationBonus} inspiration`}</p>
          <p class={pending.success ? 'success' : 'failure'}>{pending.success ? 'Success!' : 'Failure.'}</p>
          {inspireOk && (
            <button onClick={() => dispatch({ type: 'useInspiration' })}>
              Use Bardic Inspiration (+1d6) ×{hero.resources['inspiration']}
            </button>
          )}
        </>
      )}
      {pending.kind === 'loot' && (
        <p>Found: {pending.gold > 0 ? `${pending.gold} gp` : ''}{' '}
          {pending.items.map((i) => `${findItem(i.item, quest)?.name ?? i.item} ×${i.qty}`).join(', ')}</p>
      )}
      <button class="primary" onClick={() => dispatch({ type: 'continue' })}>Continue</button>
    </div>
  );
}

function SceneView({ scene }: { scene: Scene }) {
  const s = useStore((st) => st);
  const quest = s.quest!;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [s.game.quest?.sceneId]);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    setImgUrl(null);
    if (scene.image && s.quest) {
      void questAssetUrl(s.quest!.id, scene.image!).then(setImgUrl);
    }
  }, [s.game.quest?.sceneId, s.quest]);

  const speaker = scene.type === 'dialogue' ? quest.npcs?.[scene.speaker] : undefined;
  const pending = s.game.quest?.pending;

  const visibleChoices = (scene.type === 'narration' || scene.type === 'dialogue')
    ? scene.choices.filter((c) => {
        if (!c.requires) return true;
        const ok = evalCondition(c.requires, s.game, quest);
        return ok || !c.hideIfUnmet;
      })
    : [];
  // map visible index back to real choice index
  const allChoices = (scene.type === 'narration' || scene.type === 'dialogue') ? scene.choices : [];

  return (
    <article class="scene">
      <h3 tabIndex={-1} ref={headingRef}>{scene.title}</h3>
      {imgUrl && <img class="scene-img" src={imgUrl} alt="" />}
      <EventFeed queue={s.queue} playback={s.ui.playback} />
      <div class="narration">
        {speaker && (
          <div class="speaker">
            {speaker.avatar && <Avatar spec={speaker.avatar} size={40} label={speaker.name} />}
            <strong>{speaker.name}{speaker.title ? `, ${speaker.title}` : ''}</strong>
          </div>
        )}
        {scene.text.split('\n\n').map((p, i) => <p key={i}>{em(interpolate(p, s.game, quest))}</p>)}
      </div>

      {pending ? (
        <PendingCard pending={pending} quest={quest} />
      ) : (
        <ol class="choices">
          {visibleChoices.map((c) => {
            const realIx = allChoices.indexOf(c);
            const ok = !c.requires || evalCondition(c.requires, s.game, quest);
            return (
              <li key={realIx}>
                <button disabled={!ok} onClick={() => dispatch({ type: 'choose', index: realIx })}>
                  <kbd>{realIx + 1}</kbd> {em(interpolate(c.text, s.game, quest))}
                  {!ok && c.requires && <em class="dim"> ({reqReason(c.requires)})</em>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <RestControls />
    </article>
  );
}

function RestControls() {
  const s = useStore((st) => st);
  const hero = s.game.hero!;
  const scene = s.quest && s.game.quest ? s.quest.scenes[s.game.quest.sceneId] : undefined;
  const [dice, setDice] = useState(1);
  const [open, setOpen] = useState(false);
  const diceLeft = hero.level - hero.hitDiceUsed;
  const canShort = s.game.status !== 'inCombat' && hero.shortRestsSinceLong < 2;
  const canLong = scene?.rest === 'long' && s.game.status === 'inQuest';
  if (!canShort && !canLong) return null;
  return (
    <div class="rest">
      <button onClick={() => setOpen(!open)}>Rest…</button>
      {open && (
        <div class="card">
          {canShort && (
            <p>
              Short rest ({2 - hero.shortRestsSinceLong} left): spend
              <select value={dice} onChange={(e) => setDice(Number(e.currentTarget.value))}>
                {Array.from({ length: diceLeft + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
              </select>
              hit dice ({diceLeft} left)
              <button onClick={() => { dispatch({ type: 'rest', kind: 'short', hitDice: dice }); setOpen(false); }}>Short rest</button>
            </p>
          )}
          {canLong && (
            <p><button onClick={() => { dispatch({ type: 'rest', kind: 'long' }); setOpen(false); }}>Long rest</button></p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- combat ----------

function hpText(hp: number, max: number) {
  return `${hpDescriptor(hp, max)} (${hp}/${max})`;
}

function EnemyCard({ id, targeted, onTarget }: { id: string; targeted: boolean; onTarget: () => void }) {
  const e = useStore((s) => s.game.combat!.enemies.find((x) => x.id === id))!;
  const scene = useStore((s) => {
    const q = s.quest;
    return q?.enemies?.[e.defId];
  });
  const spec = scene?.avatar ?? { seed: hash(e.defId) + hash(e.id), frame: 'enemy' as const, creature: 'beast' };
  return (
    <div class={`enemy card ${e.dead ? 'dead' : ''} ${e.fled ? 'fled' : ''}`} data-enemy-id={id}>
      <div class="row">
        <Avatar spec={spec} size={36} label={e.name} />
        <strong>{e.name}</strong>
        <span class="dim">AC {e.ac}</span>
      </div>
      <Bar value={e.hp} max={e.maxHp} label={`${e.name} hit points`} />
      <span class="dim">{hpText(e.hp, e.maxHp)}</span>
      {e.conditions.length > 0 && (
        <span class="conds">{e.conditions.map((c) => c.name).join(', ')}</span>
      )}
      {!e.dead && !e.fled && (
        <button class={targeted ? 'selected' : ''} onClick={onTarget}>Target</button>
      )}
    </div>
  );
}

function CombatScreen() {
  const s = useStore((st) => st);
  const combat = s.game.combat!;
  const hero = s.game.hero!;
  const [target, setTarget] = useState<string | null>(null);
  const [smiteSlot, setSmiteSlot] = useState(0);
  const [slotPick, setSlotPick] = useState<Record<string, number>>({});
  const [lohAmount, setLohAmount] = useState(5);
  const [menu, setMenu] = useState<'abilities' | 'items' | null>(null);
  const ht = combat.heroTurn;
  const alive = combat.enemies.filter((e) => !e.dead && !e.fled);
  const tgt = target && alive.some((e) => e.id === target) ? target : alive[0]?.id;

  const playing = s.ui.playback < s.queue.length;
  const combatRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<FxHandle | null>(null);
  const webgl = detectWebGL();
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fxOn = shouldEnableFx({ animations: s.ui.settings.animations, reducedMotion: reduced, webgl });
  useEffect(() => {
    if (!fxOn || !combatRef.current) return;
    let dead = false;
    void mountFx(combatRef.current).then((h) => { if (dead) h?.dispose(); else fxRef.current = h; });
    return () => { dead = true; fxRef.current?.dispose(); fxRef.current = null; };
  }, [fxOn]);
  // feed events to fx as playback reveals them; last playback event index
  const lastPlayed = useRef(-1); // -1 = fx not yet mounted — don't replay history
  useEffect(() => {
    const fx = fxRef.current;
    if (!fx) return;
    if (lastPlayed.current < 0) { lastPlayed.current = s.ui.playback; return; }
    while (lastPlayed.current < s.ui.playback) {
      const ev = s.queue[lastPlayed.current]!;
      lastPlayed.current++;
      const tgtEl = combatRef.current?.querySelector(`[data-enemy-id="${(ev as { target?: string }).target ?? ''}"]`);
      fx.play(ev, {
        targetRect: tgtEl?.getBoundingClientRect(),
        heroRect: combatRef.current?.querySelector('.hero-conds')?.getBoundingClientRect(),
      });
    }
    if (!playing) fx.cancel(); // skip flushed the queue — stop in-flight effects
  }, [s.ui.playback, playing]);

  const actionOpen = ht ? (!ht.actionUsed || ht.extraAction) : false;
  const bonusOpen = ht ? !ht.bonusUsed : false;
  const bonusAbilities = usableBonusActions(s.game);
  const heroAbilities = CLASSES[hero.classId].abilities
    .map((id) => ABILITIES[id]!)
    .filter((a) => a.minLevel <= hero.level && a.kind !== 'passive' && !bonusAbilities.includes(a));
  const consumables = hero.inventory.filter((i) => findItem(i.item, s.quest)?.kind === 'consumable');
  const slots = slotsFor(hero.classId, hero.level);

  return (
    <div class="combat" ref={combatRef}>
      <ol class="initiative" aria-label="initiative order">
        {combat.order.map((id, i) => (
          <li key={id} class={i === combat.turnIndex ? 'current' : ''}>
            {id === 'hero' ? hero.name : combat.enemies.find((e) => e.id === id)?.name ?? id}
          </li>
        ))}
      </ol>
      <div class="enemies">
        {combat.enemies.map((e) => (
          <EnemyCard key={e.id} id={e.id} targeted={tgt === e.id} onTarget={() => setTarget(e.id)} />
        ))}
      </div>
      <div class="hero-conds dim">
        {hero.conditions.map((c) => <span key={c.name} class="cond">{c.name}</span>)}
        {combat.beastHp > 0 && <span class="cond">beast HP {combat.beastHp}</span>}
      </div>
      <div class="actionbar" role="toolbar" aria-label="combat actions">
        <button disabled={playing || !actionOpen || !tgt} onClick={() => tgt && dispatch({ type: 'attack', targetId: tgt, ...(smiteSlot ? { smiteSlot } : {}) })}>
          <kbd>1</kbd> Attack
        </button>
        {hero.classId === 'paladin' && slots.some((m, i) => (hero.slotsUsed[i] ?? 0) < m) && (
          <label class="smite">
            Smite slot
            <select value={smiteSlot} onChange={(e) => setSmiteSlot(Number(e.currentTarget.value))}>
              <option value={0}>off</option>
              {slots.map((m, i) => (hero.slotsUsed[i] ?? 0) < m && <option key={i} value={i + 1}>L{i + 1}</option>)}
            </select>
          </label>
        )}
        <button disabled={playing} onClick={() => setMenu(menu === 'abilities' ? null : 'abilities')}><kbd>2</kbd> Abilities</button>
        {consumables.length > 0 && <button disabled={playing} onClick={() => setMenu(menu === 'items' ? null : 'items')}><kbd>3</kbd> Items</button>}
        <button disabled={playing || !actionOpen} onClick={() => dispatch({ type: 'dodge' })}><kbd>4</kbd> Dodge</button>
        {combat.canFlee && <button disabled={playing || !actionOpen} onClick={() => dispatch({ type: 'flee' })}><kbd>5</kbd> Flee</button>}
        <button disabled={playing} onClick={() => dispatch({ type: 'endTurn' })}><kbd>6</kbd> End Turn</button>
      </div>

      <EventFeed queue={s.queue} playback={s.ui.playback} />
      {menu === 'abilities' && (
        <div class="card abilities-menu">
          {[...bonusAbilities.map((a) => ({ a, bonus: true })), ...heroAbilities.map((a) => ({ a, bonus: false }))].map(({ a, bonus }) => {
            const usable = bonus ? bonusOpen : actionOpen;
            const min = a.slot ?? 0;
            const pick = slotPick[a.id] ?? min;
            return (
              <div key={a.id} class="row">
                <button disabled={!usable || !canPay(a, hero, s.game.combat !== null)}
                  onClick={() => {
                    dispatch({ type: 'useAbility', abilityId: a.id, ...(a.target !== 'self' && a.target !== 'none' ? { targetId: tgt } : {}), ...(a.slot ? { slotLevel: pick } : {}), ...(a.special === 'lay-on-hands' ? { amount: lohAmount } : {}) });
                    setMenu(null);
                  }}>
                  {bonus && <em>(bonus) </em>}{describeAbility(a, hero)}
                  <span class="dim"> · {abilityCost(a)}</span>
                </button>
                {a.slot !== undefined && (
                  <select value={pick} onChange={(e) => setSlotPick({ ...slotPick, [a.id]: Number(e.currentTarget.value) })} aria-label="slot level">
                    {slots.map((m, i) => i + 1 >= min && (hero.slotsUsed[i] ?? 0) < m && <option key={i} value={i + 1}>L{i + 1}</option>)}
                  </select>
                )}
                {a.special === 'lay-on-hands' && (
                  <input type="number" min={1} max={hero.resources['lay-on-hands']} value={lohAmount}
                    onInput={(e) => setLohAmount(Number(e.currentTarget.value))} aria-label="hit points to spend" />
                )}
              </div>
            );
          })}
        </div>
      )}
      {menu === 'items' && (
        <div class="card">
          {consumables.map((i) => (
            <button key={i.item} disabled={!actionOpen}
              onClick={() => { dispatch({ type: 'useItem', itemId: i.item }); setMenu(null); }}>
              {findItem(i.item, s.quest)?.name} ×{i.qty}
            </button>
          ))}
        </div>
      )}
      {playing && (
        <button class="skip" onClick={() => advancePlayback(true)}>Skip</button>
      )}
    </div>
  );
}

function canPay(a: (typeof ABILITIES)[string], hero: Hero, inCombat: boolean): boolean {
  if (a.slot !== undefined) {
    const max = slotsFor(hero.classId, hero.level);
    if ((hero.slotsUsed[a.slot - 1] ?? 0) >= (max[a.slot - 1] ?? 0)) return false;
  }
  if (a.resource && (hero.resources[a.resource] ?? 0) <= 0) return false;
  if (a.special === 'smite') return false;
  if (!inCombat && !a.heal && a.special !== 'lay-on-hands') return false;
  return true;
}

// ---------- drawers ----------

function CharacterSheet() {
  const hero = useStore((s) => s.game.hero)!;
  const cls = CLASSES[hero.classId];
  const prof = proficiencyBonus(hero.level);
  return (
    <div class="drawer-body">
      <h3>{hero.name}</h3>
      <p>Level {hero.level} {cls.name} · {hero.xp} XP · {hero.gold} gp</p>
      <ul>
        {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => (
          <li key={ab}>{ab} {hero.abilities[ab]} ({abilityMod(hero.abilities[ab]) >= 0 ? '+' : ''}{abilityMod(hero.abilities[ab])})</li>
        ))}
      </ul>
      <p>Proficiency +{prof} · Hit die d{cls.hitDie} · Saves {cls.saves.join(', ')}</p>
      <p>Skills: {cls.skills.map((sk) => `${sk}${cls.expertise.includes(sk) ? ' (expertise)' : ''}`).join(', ')}</p>
      <h4>Abilities</h4>
      <ul class="ability-list">
        {classInfoLines(hero.classId, hero).map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <p>Completed quests: {hero.completedQuests.join(', ') || 'none'}</p>
    </div>
  );
}

function Inventory() {
  const s = useStore((st) => st);
  const hero = s.game.hero!;
  return (
    <div class="drawer-body">
      <h3>Inventory</h3>
      {hero.inventory.length === 0 && <p class="dim">Empty.</p>}
      <ul>
        {hero.inventory.map((line) => {
          const def: ItemDef | undefined = findItem(line.item, s.quest);
          const equipSlot = def && (def.kind === 'weapon' ? 'weapon' : def.kind === 'armour' ? 'armour' : def.kind === 'shield' ? 'shield' : null);
          const equipped = equipSlot && hero.equipment[equipSlot as 'weapon'] === line.item;
          return (
            <li key={line.item} class="row">
              <span>{def?.name ?? line.item} ×{line.qty}{equipped ? ' (equipped)' : ''}</span>
              {def?.kind === 'consumable' && (
                <button onClick={() => dispatch({ type: 'useItem', itemId: line.item })}>Use</button>
              )}
              {equipSlot && !equipped && (
                <button onClick={() => dispatch({ type: 'equip', itemId: line.item })}>Equip</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LogPanel() {
  const s = useStore((st) => st);
  const shown = s.game.log;
  return (
    <div class="drawer-body log">
      <h3>Log</h3>
      <ul>{shown.slice().reverse().map((l, i) => <li key={i}>{l.text}</li>)}</ul>
    </div>
  );
}

function LevelUpModal() {
  const s = useStore((st) => st);
  const hero = s.game.hero!;
  const [asi, setAsi] = useState<Record<string, number>>({});
  const nextLevel = hero.level + 1;
  const needsAsi = nextLevel === 4;
  const asiTotal = Object.values(asi).reduce((a, b) => a + b, 0);
  const confirm = () => dispatch({ type: 'levelUp', ...(needsAsi ? { asi: asi as never } : {}) });
  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="level up">
      <div class="modal card">
        <h3>Level up → {nextLevel}!</h3>
        {needsAsi && (
          <div>
            <p>Ability Score Improvement: +2 to one score, or +1 to two.</p>
            {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => (
              <label key={ab} class="row">
                {ab} ({hero.abilities[ab]})
                <select value={asi[ab] ?? 0} onChange={(e) => setAsi({ ...asi, [ab]: Number(e.currentTarget.value) })}>
                  <option value={0}>—</option><option value={1}>+1</option><option value={2}>+2</option>
                </select>
              </label>
            ))}
          </div>
        )}
        <button class="primary" disabled={needsAsi && asiTotal !== 2} onClick={confirm}>Confirm</button>
      </div>
    </div>
  );
}

export function AdventureScreen() {
  const s = useStore((st) => st);
  const hero = s.game.hero;
  if (!hero) return <main class="screen"><p>No hero. <button onClick={() => gotoScreen('title')}>Title</button></p></main>;
  if (s.game.status === 'dead') return <DeathScreen />;
  if (s.game.status === 'questComplete' && s.game.quest && s.quest?.scenes[s.game.quest.sceneId]?.type === 'ending')
    return <EndingScreen />;

  const scene = s.quest && s.game.quest ? s.quest.scenes[s.game.quest.sceneId] : undefined;
  return (
    <div class="adventure">
      <StatusBar hero={hero} />
      {s.game.status === 'inCombat' && s.game.combat ? (
        <CombatScreen />
      ) : scene ? (
        <SceneView scene={scene} />
      ) : (
        <main class="screen"><p>Between adventures.</p>
          <button onClick={() => gotoScreen('quests')}>Choose a quest</button></main>
      )}
      <nav class="tabs" aria-label="panels">
        <button onClick={() => setDrawer(s.ui.drawer === 'character' ? null : 'character')}><kbd>C</kbd> Character</button>
        <button onClick={() => setDrawer(s.ui.drawer === 'inventory' ? null : 'inventory')}><kbd>I</kbd> Inventory</button>
        <button onClick={() => setDrawer(s.ui.drawer === 'log' ? null : 'log')}><kbd>L</kbd> Log</button>
      </nav>
      {s.ui.drawer && (
        <aside class="drawer" role="complementary">
          <button class="close" onClick={() => setDrawer(null)} aria-label="close panel">×</button>
          {s.ui.drawer === 'character' && <CharacterSheet />}
          {s.ui.drawer === 'inventory' && <Inventory />}
          {s.ui.drawer === 'log' && <LogPanel />}
        </aside>
      )}
      {hero.pendingLevelUps > 0 && s.game.status !== 'inCombat' && <LevelUpModal />}
    </div>
  );
}

export function QuestSelectScreen() {
  const s = useStore((st) => st);
  const quests = s.questInfos;
  return (
    <main class="screen">
      <h2>Choose a quest</h2>
      <div class="quest-list">
        {quests.map((q) => {
          const done = s.game.hero?.completedQuests.includes(q.id);
          const bad = q.errors.length > 0;
          return (
            <div class="card quest" key={q.id}>
              <h3>{q.title} {done && <span class="badge">completed</span>}</h3>
              <p>{q.summary}</p>
              <p class="dim">Level {q.recommendedLevel ?? 1}+ · ~{q.estimatedMinutes ?? '?'} min</p>
              {bad ? (
                <details><summary>Invalid quest ({q.errors.length} errors)</summary>
                  <ul>{q.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></details>
              ) : (
                <button onClick={() => void startQuestById(q.id)}>Begin</button>
              )}
            </div>
          );
        })}
        {quests.length === 0 && <p class="dim">No quests found.</p>}
      </div>
      <button onClick={() => gotoScreen('title')}>Title</button>
    </main>
  );
}
