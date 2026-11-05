import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../avatar/Avatar';
import { ABILITIES } from '../../content/abilities';
import { CLASSES } from '../../content/classes';
import { formatRoll } from '../../engine/dice';
import { abilityMod, hpGainPerLevel, proficiencyBonus, slotsFor } from '../../engine/rules';
import { evalCondition, findItem, interpolate } from '../../engine/quest/eval';
import { EventFeed } from '../EventFeed';
import { RollPrompt } from '../RollPrompt';
import { setSetting } from '../store';
import { abilityName, resourceMax, skillName, SKILL_ABILITY } from '../../engine/rules';
import { describeEventText } from '../describe';
import { displayState, playbackSettled } from '../display';
import { AbilityLabel } from '../abilityInfo';
import { detectWebGL, mountFx, shouldEnableFx, type FxHandle } from '../../fx';
import { em } from '../em';
import { lowestFreeSlot, usableBonusActions } from '../../engine/combat';
import type { Choice, ItemDef, Scene } from '../../engine/quest/types';
import type { Hero, PendingOutcome } from '../../engine/model';
import { abilityCost, abilityRows, classInfoLines, describeAbility, resourcePips } from '../format';
import { questAssetUrl } from '../../quests/registry';
import {
  advancePlayback, dispatch, getStore, gotoScreen, manualRollPending, retryCheckpoint, setDrawer, startQuestById, useStore,
} from '../store';
import { DeathScreen, EndingScreen } from './meta';
import { inferBackdrop, SceneArt } from '../art/SceneArt';
import { useMotion } from '../motion';
import { enemySpec, nameHash as hash } from '../actors';
import { randomAvatar } from '../../avatar/generate';
import { rngFromSeed } from '../../engine/dice';
import { playSfx } from '../../sfx';
import type { GameEvent } from '../../engine/model';


const ord = (n: number) => ['—','1st','2nd','3rd','4th','5th'][n] ?? `${n}th`;

const hpDescriptor = (hp: number, max: number) => {
  const p = hp / max;
  return p >= 1 ? 'Unhurt' : p > 0.5 ? 'Wounded' : p > 0.25 ? 'Bloodied' : 'Near defeat';
};

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const tier = pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low';
  return (
    <div class="bar" role="img" aria-label={`${label}: ${value} of ${max}`} data-tier={value > 0 ? tier : 'low'}>
      <div class="bar-ghost" style={{ width: `${pct}%` }} />
      <div class="bar-fill" style={{ width: `${pct}%` }} />
      <span class="bar-text">{value}/{max}</span>
    </div>
  );
}

/** Adds `cls` for `ms` whenever `trigger` changes to a truthy new value. */
function useFlash(trigger: unknown, ms = 450): boolean {
  const [on, setOn] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!trigger) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [trigger]);
  return on;
}

const HeartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M12 21s-8-5.5-10-10.5C.7 6 3 3 6.5 3 9 3 11 5 12 6.5 13 5 15 3 17.5 3 21 3 23.3 6 22 10.5 20 15.5 12 21 12 21z"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 15l.9 2.6 2.1.7-2.1.7L19 21l-.9-2.6-2.1-.7 2.1-.7z"/>
  </svg>
);
const pips = (left: number, max: number) => '●'.repeat(left) + '○'.repeat(Math.max(0, max - left));

function StatusBar(props: { hero: Hero }) {
  const hero = useStore((st) => st) && (displayState(getStore().game, getStore().queue, getStore().ui.playback).hero ?? props.hero);
  const slots = slotsFor(hero.classId, hero.level);
  const caster = slots.length > 0;
  const resources = resourcePips(hero);
  const lohMax = resourceMax(hero.classId, 'lay-on-hands', hero.abilities, hero.level);
  const magicLabel = caster ? 'Spell slots' : 'Powers';
  const magicAria = caster
    ? `Spell slots: ${slots.flatMap((m, i) => m > 0 ? [`${ord(i + 1)} level ${m - (hero.slotsUsed[i] ?? 0)} of ${m} left`] : []).join(', ')}. Spells use a slot; cantrips are free; slots return after a ${CLASSES[hero.classId].caster === 'pact' ? 'short' : 'long'} rest.`
    : `Powers: ${resourcePips(hero).map((r) => `${r.name} ${r.left} of ${r.max} left`).join(', ')}`;
  const autoRoll = useStore((st) => st.ui.settings.autoRoll);
  const prevHp = useRef(hero.hp);
  const [hurtTick, setHurtTick] = useState(0);
  useEffect(() => {
    if (hero.hp < prevHp.current) setHurtTick((n) => n + 1);
    prevHp.current = hero.hp;
  }, [hero.hp]);
  const hurt = useFlash(hurtTick);
  return (
    <header class={`statusbar ${hurt ? 'hurt' : ''}`}>
      <Avatar spec={hero.avatar} size={48} label="hero avatar" />
      <span class="who"><strong>{hero.name}</strong><span>Level {hero.level} {CLASSES[hero.classId].name}</span></span>
      <span class="gold">{hero.gold} gp</span>
      <div class="vitals">
        <span class="health" aria-label={`health: ${hero.hp} of ${hero.maxHp}`}>
          <HeartIcon /> <b>Health</b> <Bar value={hero.hp} max={hero.maxHp} label="Hit points" />
        </span>
        {(caster || resources.length > 0) && (
          <span class="magic" aria-label={magicAria} title={magicAria}>
            <SparkleIcon /> <b>{magicLabel}</b>
            {caster
              ? slots.map((m, i) => {
                  if (m === 0) return null;
                  const left = m - (hero.slotsUsed[i] ?? 0);
                  return <span key={i} class="pipgroup">{ord(i + 1)} <span class="pips">{pips(left, m)}</span></span>;
                })
              : resourcePips(hero).map((r) => (
                  <span key={r.id} class="pipgroup"><span class="nowrap">{r.name}</span> <span class="pips">{pips(r.left, r.max)}</span></span>
                ))}
          </span>
        )}
        {hero.classId === 'paladin' && lohMax > 0 && (
          <span class="loh" aria-label={`lay on hands: ${hero.resources['lay-on-hands'] ?? 0} of ${lohMax}`}
            title="Lay on Hands pool">
            LoH <span class="bar"><i style={{ width: `${((hero.resources['lay-on-hands'] ?? 0) / lohMax) * 100}%` }} /></span>
          </span>
        )}
        {hero.classId === 'druid' && hero.level >= 2 && (
          <span class="pipgroup" title="Wild Shape uses">Wild Shape <span class="pips">{pips(hero.resources['wild-shape'] ?? 0, resourceMax('druid', 'wild-shape', hero.abilities, hero.level))}</span></span>
        )}
        {hero.classId === 'bard' && (
          <span class="pipgroup" title="Bardic Inspiration">Inspiration <span class="pips">{pips(hero.resources['inspiration'] ?? 0, resourceMax('bard', 'inspiration', hero.abilities, hero.level))}</span></span>
        )}
      </div>
      <button class="switch" role="switch" aria-checked={autoRoll} title="Off: click Roll before each of your rolls"
        onClick={() => setSetting('autoRoll', !autoRoll)}>
        <span class="track"><span class="knob" /></span>
        <span class="dim">Auto-roll dice: {autoRoll ? 'On' : 'Off'}</span>
      </button>
    </header>
  );
}

function reqReason(c: NonNullable<Choice['requires']>) {
  if ('gold' in c && c.gold.gte) return `needs ${c.gold.gte} gp`;
  if ('hasItem' in c) return `needs ${String(c.hasItem).replace(/-/g, ' ')}`;
  if ('class' in c) return `${c.class.join('/')} only`;
  if ('level' in c) return `level ${(c.level as { gte?: number }).gte}+`;
  if ('ability' in c) return <>needs <AbilityLabel id={(c as { ability: import('../../engine/quest/types').AbilityId }).ability} /> {(c as { gte: number }).gte}+</>;
  if ('flag' in c) return 'not yet';
  return 'requirements unmet';
}

function PendingCard({ pending, quest }: { pending: PendingOutcome; quest: import('../../engine/quest/types').Quest }) {
  const hero = useStore((s) => s.game.hero)!;
  const inspireOk =
    pending.kind === 'check' && !pending.success && !pending.inspired &&
    (hero.resources['inspiration'] ?? 0) > 0;
  useEffect(() => { if (pending.kind === 'loot') playSfx('coin'); }, [pending]);
  return (
    <div class="pending card" role="status">
      {pending.kind === 'check' && (
        <>
          <p><strong>{pending.label} (difficulty {pending.check.dc}):</strong> {formatRoll(pending.roll)}
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
        <div class="loot-card">
          <ChestIcon />
          <p>Found: {pending.gold > 0 ? `${pending.gold} gp` : ''}{' '}
            {pending.items.map((i) => `${findItem(i.item, quest)?.name ?? i.item} ×${i.qty}`).join(', ')}</p>
        </div>
      )}
      <button class="primary" onClick={() => dispatch({ type: 'continue' })}>Continue</button>
    </div>
  );
}

const ChestIcon = () => (
  <svg class="chest" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="22" rx="22" ry="14" fill="#ffd84a" opacity="0.25" />
    <path d="M10 30 Q10 14 32 14 Q54 14 54 30 Z" fill="#8a5a2a" />
    <path d="M10 30 Q10 14 32 14 Q54 14 54 30" fill="none" stroke="#c9a227" stroke-width="3" />
    <rect x="10" y="30" width="44" height="24" rx="2" fill="#6a4220" />
    <path d="M10 30 H54 M10 42 H54" stroke="#c9a227" stroke-width="3" />
    <rect x="28" y="34" width="8" height="10" rx="1" fill="#f3d27a" stroke="#7a5a14" />
    <circle cx="22" cy="26" r="3" fill="#ffe27a" /><circle cx="40" cy="24" r="2.5" fill="#ffe27a" /><circle cx="31" cy="22" r="2" fill="#fff4c0" />
  </svg>
);

function SceneView({ scene }: { scene: Scene }) {
  const s = useStore((st) => st);
  const motion = useMotion();
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
  const rollWaiting = !!manualRollPending();

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
      <div class="scene-banner">
        {imgUrl
          ? <img class="scene-img" src={imgUrl} alt="" />
          : <SceneArt backdrop={inferBackdrop(scene, s.game.quest?.sceneId)} still={!motion} />}
        <h3 tabIndex={-1} ref={headingRef}>{scene.title}</h3>
      </div>
      <EventFeed queue={s.queue} playback={s.ui.playback} />
      <div class={`narration ${speaker ? 'has-speaker' : ''}`}>
        {speaker && (
          <div class="speaker">
            <Avatar spec={speaker.avatar ?? randomAvatar('npc', rngFromSeed(hash(speaker.name))).spec} size={52} label={speaker.name} />
            <strong>{speaker.name}{speaker.title ? `, ${speaker.title}` : ''}</strong>
          </div>
        )}
        {scene.text.split('\n\n').map((p, i) => <p key={i}>{em(interpolate(p, s.game, quest))}</p>)}
      </div>

      <RollPrompt />
      {rollWaiting ? null : pending ? (
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

function EnemyCard({ id, targeted, onTarget, hit, boss }: {
  id: string; targeted: boolean; onTarget: () => void; hit?: 'hit' | 'crit-hit'; boss: boolean;
}) {
  const st = useStore((st) => st);
  const e = displayState(st.game, st.queue, st.ui.playback).combat!.enemies.find((x) => x.id === id)!;
  const spec = enemySpec(e.id, st.quest);
  const out = e.dead || e.fled;
  return (
    <div class={`enemy card ${e.dead ? 'dead' : ''} ${e.fled ? 'fled' : ''} ${targeted && !out ? 'targeted' : ''} ${hit ?? ''} ${boss ? 'boss' : ''}`}
      data-enemy-id={id} data-enemy-name={e.name} onClick={() => !out && onTarget()}>
      <span class="portrait"><Avatar spec={spec} size={boss ? 92 : 72} label={e.name} /></span>
      <strong>{e.name}</strong>
      <Bar value={e.hp} max={e.maxHp} label={`${e.name} hit points`} />
      <div class="row">
        <span class="dim">{e.fled ? 'Fled' : e.dead ? 'Defeated' : hpDescriptor(e.hp, e.maxHp)}</span>
        <span class="dim armour" title="Armour: the total an attack must reach to hit">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 9.6-8 11-4.6-1.4-8-6-8-11V5z"/></svg>
          {' '}{e.ac}
        </span>
      </div>
      <span class="sr-live">{hpText(e.hp, e.maxHp)}</span>
      {e.conditions.length > 0 && (
        <span class="conds">{e.conditions.map((c) => <span key={c.name}>{c.name}</span>)}</span>
      )}
      {!out && (
        <button class={targeted ? 'selected' : ''} onClick={(ev) => { ev.stopPropagation(); onTarget(); }}
          aria-pressed={targeted}>{targeted ? 'Targeted' : 'Target'}</button>
      )}
    </div>
  );
}

interface Floater { id: number; x: number; y: number; text: string; cls: string }
let floaterSeq = 0;

/** Turns revealed combat events into floating numbers, hit jolts, shakes and flashes. */
function useCombatJuice(stageRef: { current: HTMLDivElement | null }, events: GameEvent[], motion: boolean) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [hits, setHits] = useState<Record<string, 'hit' | 'crit-hit'>>({});
  const [shake, setShake] = useState(0);
  const [hurt, setHurt] = useState(0);
  const critPending = useRef(false);
  useEffect(() => {
    if (!motion || !events.length || events.length > 8 || !stageRef.current) return;
    const stage = stageRef.current.getBoundingClientRect();
    const at = (target: string) => {
      const el = stageRef.current?.querySelector(target === 'hero' ? '.stage-hero .avatar' : `[data-enemy-id="${target}"] .portrait`);
      if (!el) return { x: stage.width * 0.18, y: stage.height * 0.72 };
      const r = el.getBoundingClientRect();
      return { x: r.left - stage.left + r.width / 2, y: r.top - stage.top + r.height * 0.4 };
    };
    const add: Floater[] = [];
    const newHits: Record<string, 'hit' | 'crit-hit'> = {};
    const push = (target: string, text: string, cls: string) => {
      const p = at(target);
      const jitter = (add.length % 3 - 1) * 18;
      add.push({ id: ++floaterSeq, x: p.x + jitter, y: p.y, text, cls });
    };
    for (const ev of events) {
      if (ev.type === 'roll' && ev.purpose === 'attack') {
        if (ev.outcome === 'crit') { critPending.current = true; if (ev.actor === 'hero') setShake((n) => n + 1); }
        if (ev.outcome === 'miss') {
          const cards = [...stageRef.current.querySelectorAll<HTMLElement>('.enemy:not(.dead):not(.fled)')]
            .filter((c) => c.dataset.enemyName === ev.targetName);
          const card = cards.find((c) => c.classList.contains('targeted')) ?? cards[0];
          push(ev.actor === 'hero' ? card?.dataset.enemyId ?? 'hero' : 'hero', ev.result.nat1 ? 'Fumble!' : 'Miss', 'miss');
        }
      } else if (ev.type === 'damage' && ev.amount > 0) {
        const crit = critPending.current;
        critPending.current = false;
        if (ev.target === 'hero' || ev.target === 'hero-beast') {
          push('hero', `-${ev.amount}`, `dmg hero ${crit ? 'crit' : ''}`);
          setHurt((n) => n + 1);
          setShake((n) => n + 1);
        } else {
          push(ev.target, crit ? `${ev.amount}!` : `-${ev.amount}`, crit ? 'crit' : 'dmg');
          newHits[ev.target] = crit ? 'crit-hit' : 'hit';
          if (ev.hpLeft === 0) push(ev.target, 'Defeated!', 'big-text');
        }
      } else if (ev.type === 'heal' && ev.amount > 0) {
        push('hero', `+${ev.amount}`, 'heal');
      } else if (ev.type === 'combatEnd' && ev.result === 'victory') {
        add.push({ id: ++floaterSeq, x: stage.width / 2, y: stage.height * 0.45, text: 'Victory!', cls: 'crit' });
      }
    }
    if (add.length) {
      setFloaters((f) => [...f, ...add]);
      const ids = new Set(add.map((a) => a.id));
      setTimeout(() => setFloaters((f) => f.filter((x) => !ids.has(x.id))), 1300);
    }
    if (Object.keys(newHits).length) {
      setHits((h) => ({ ...h, ...newHits }));
      setTimeout(() => setHits((h) => {
        const n = { ...h };
        for (const k of Object.keys(newHits)) delete n[k];
        return n;
      }), 450);
    }
  }, [events]);
  return { floaters, hits, shaking: useFlash(shake, 350), hurting: useFlash(hurt, 600) };
}

function CombatScreen() {
  const s = useStore((st) => st);
  const motion = useMotion();
  const shown = displayState(s.game, s.queue, s.ui.playback);
  const combat = shown.combat!;
  const hero = shown.hero!;
  const settled = playbackSettled(s.queue, s.ui.playback, manualRollPending());
  const [target, setTarget] = useState<string | null>(null);
  const [smiteSlot, setSmiteSlot] = useState(0);
  const [slotPick, setSlotPick] = useState<Record<string, number>>({});
  const [lohAmount, setLohAmount] = useState(5);
  const [menu, setMenu] = useState<'abilities' | 'items' | null>(null);
  const ht = combat.heroTurn;
  const alive = combat.enemies.filter((e) => !e.dead && !e.fled);
  const tgt = target && alive.some((e) => e.id === target) ? target : alive[0]?.id;
  const scene = s.quest && s.game.quest ? s.quest.scenes[s.game.quest.sceneId] : undefined;
  const bossId = scene?.type === 'encounter' && scene.boss
    ? combat.enemies.reduce((a, b) => (b.maxHp > a.maxHp ? b : a)).id : null;

  const playing = s.ui.playback < s.queue.length;
  const combatRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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
  // events newly revealed by playback since the last render (history is never replayed)
  const seen = useRef(s.ui.playback);
  const [revealed, setRevealed] = useState<GameEvent[]>([]);
  useEffect(() => {
    const from = seen.current;
    seen.current = s.ui.playback;
    if (s.ui.playback <= from) return;
    const evs = s.queue.slice(from, s.ui.playback);
    setRevealed(evs);
    const fx = fxRef.current;
    if (fx && evs.length > 6) fx.cancel(); // skip flushed the queue — stop in-flight effects
    else if (fx) {
      for (const ev of evs) {
        const tgtEl = combatRef.current?.querySelector(`[data-enemy-id="${(ev as { target?: string }).target ?? ''}"] .portrait`);
        fx.play(ev, {
          targetRect: tgtEl?.getBoundingClientRect(),
          heroRect: combatRef.current?.querySelector('.stage-hero')?.getBoundingClientRect(),
        });
      }
    }
  }, [s.ui.playback]);
  const juice = useCombatJuice(stageRef, revealed, motion);

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
        {combat.order.map((id, i) => {
          const en = combat.enemies.find((e) => e.id === id);
          return (
            <li key={id} class={`${i === combat.turnIndex ? 'current' : ''} ${id === 'hero' ? 'is-hero' : ''} ${en && (en.dead || en.fled) ? 'gone' : ''}`}>
              {id === 'hero' ? hero.name : en?.name ?? id}
            </li>
          );
        })}
      </ol>
      <div class={`stage ${juice.shaking ? 'shake' : ''}`} ref={stageRef}>
        <SceneArt backdrop={scene ? inferBackdrop(scene, s.game.quest?.sceneId) : 'road'} still={!motion} />
        <span class="round">Round {combat.round}</span>
        {hero.hp > 0 && hero.hp / hero.maxHp <= 0.25 && motion && <div class="low-hp" />}
        <div class="enemies">
          {combat.enemies.map((e) => (
            <EnemyCard key={e.id} id={e.id} targeted={tgt === e.id} onTarget={() => setTarget(e.id)}
              hit={juice.hits[e.id]} boss={e.id === bossId} />
          ))}
        </div>
        <div class="stage-hero">
          <Avatar spec={hero.avatar} size={56} label={hero.name} />
          <div>
            <strong>{hero.name}</strong>
            <Bar value={hero.hp} max={hero.maxHp} label="Your hit points" />
            <div class="hero-conds">
              {hero.conditions.map((c) => <span key={c.name} class="cond">{c.name}</span>)}
              {combat.beastHp > 0 && <span class="cond">beast form {combat.beastHp}</span>}
            </div>
          </div>
        </div>
        <div class={`hurt-vignette ${juice.hurting ? 'on' : ''}`} />
        <div class="floaters" aria-hidden="true">
          {juice.floaters.map((f) => (
            <span key={f.id} class={`floater ${f.cls}`} style={{ left: `${f.x}px`, top: `${f.y}px` }}>{f.text}</span>
          ))}
        </div>
      </div>
      {combat.result && settled && (
        <div ref={(el) => el?.closest('.combat')?.querySelector('.feed')?.scrollTo({ top: 1e9 })} class={`result-banner ${combat.result}`} role="status">
          <h3>{combat.result === 'victory' ? 'Victory!' : combat.result === 'fled' ? 'You escaped' : combat.result === 'defeat' ? 'Defeated…' : 'You have fallen'}</h3>
          {combat.result === 'death' ? (
            <>
              <button class="btn-primary" onClick={() => retryCheckpoint()}>Retry from checkpoint</button>
              <button onClick={() => gotoScreen('title')}>Return to title</button>
            </>
          ) : (
            <button class="btn-primary" onClick={() => dispatch({ type: 'continue' })}>Continue</button>
          )}
        </div>
      )}
      {!combat.result && (
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
      )}
      <RulesHelp />
      <RollPrompt onRoll={() => fxRef.current?.play({
        type: 'roll', label: 'Roll', result: { expr: '1d20', rolls: [], total: 0, modifier: 0, nat20: false, nat1: false },
        actor: 'hero', actorName: hero.name, purpose: 'attack', parts: [], finalTotal: 0,
      }, {})} />
      <EventFeed queue={s.queue} playback={s.ui.playback} />
      {menu === 'abilities' && (
        <div class="card abilities-menu">
          {[...bonusAbilities.map((a) => ({ a, bonus: true })), ...heroAbilities.map((a) => ({ a, bonus: false }))].map(({ a, bonus }) => {
            const usable = bonus ? bonusOpen : actionOpen;
            const min = a.slot ?? 0;
            const pick = slotPick[a.id] ?? lowestFreeSlot(hero, min) ?? min;
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

function RulesHelp() {
  return (
    <details class="rules-help">
      <summary>How do the dice work?</summary>
      <ul>
        <li><b>Attacking:</b> roll a 20-sided die (d20) and add your bonuses. If the total reaches the target's <b>armour</b> number, you hit. Enemies do the same against <i>your</i> armour.</li>
        <li><b>Bonuses</b> come from two places: your <b>ability score</b> for the action (Strength for swords, Dexterity for bows, Wisdom or Intelligence for spells — every 2 points above 10 is +1) and your <b>proficiency</b>, a training bonus (+2 at levels 1–4) for things your class is good at.</li>
        <li><b>Damage:</b> on a hit, roll the weapon or spell's damage dice (e.g. d8) and add your ability bonus.</li>
        <li><b>Saves:</b> some spells make the <i>target</i> roll to resist against your spell difficulty. They often still take half damage.</li>
        <li><b>Natural 20</b> (the die shows 20) always hits and doubles the damage dice. <b>Natural 1</b> always misses.</li>
        <li>Hover or tap any underlined word on a roll for a reminder.</li>
      </ul>
    </details>
  );
}

function canPay(a: (typeof ABILITIES)[string], hero: Hero, inCombat: boolean): boolean {
  if (a.slot !== undefined) {
    if (lowestFreeSlot(hero, a.slot) === undefined) return false;
  }
  if (a.resource && (hero.resources[a.resource] ?? 0) < (a.resourceCost ?? 1)) return false;
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
        {abilityRows(hero).map((r) => (
          <li key={r.id} class="ability-row"><AbilityLabel id={r.id} /><span class="ability-score">{r.score} ({r.mod >= 0 ? '+' : ''}{r.mod})</span></li>
        ))}
      </ul>
      <p>Proficiency +{prof} · Hit die (healing on rests): d{cls.hitDie} · Saving throws: {cls.saves.map((ab, i) => <span key={ab}>{i > 0 && ', '}<AbilityLabel id={ab} /></span>)}</p>
      <p>Skills: {cls.skills.map((sk) => `${skillName(sk)} (${abilityName(SKILL_ABILITY[sk])})${cls.expertise.includes(sk) ? ' (expertise)' : ''}`).join(', ')}</p>
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
      <ul>{shown.slice().reverse().map((l, i) => <li key={i}>{describeEventText(l.event)}</li>)}</ul>
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
  useEffect(() => { playSfx('levelup'); }, []);
  const cls = CLASSES[hero.classId];
  const hpGain = hpGainPerLevel(cls.hitDie, abilityMod(hero.abilities.CON));
  const oldSlots = slotsFor(hero.classId, hero.level), newSlots = slotsFor(hero.classId, nextLevel);
  const slotGains = newSlots.map((n, i) => n - (oldSlots[i] ?? 0)).map((d, i) => (d > 0 ? `+${d} ${ord(i + 1)}-level slot${d > 1 ? 's' : ''}` : '')).filter(Boolean);
  const newAbilities = cls.abilities.map((id) => ABILITIES[id]!).filter((a) => a.minLevel === nextLevel);
  const profUp = proficiencyBonus(nextLevel) > proficiencyBonus(hero.level);
  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="level up">
      <div class="modal card levelup">
        <div class="rays" aria-hidden="true" />
        <p class="dim">{hero.name} grows stronger</p>
        <h3>Level {nextLevel}!</h3>
        <ul class="gains">
          <li>+{hpGain} maximum health</li>
          {slotGains.map((g) => <li key={g}>{g}</li>)}
          {profUp && <li>Proficiency bonus +{proficiencyBonus(nextLevel)}</li>}
          {newAbilities.map((a) => <li key={a.id}>New: <strong>{a.name}</strong></li>)}
        </ul>
        {needsAsi && (
          <div>
            <p>Ability Score Improvement: +2 to one score, or +1 to two.</p>
            {abilityRows(hero).map((r) => (
              <label key={r.id} class="row">
                <AbilityLabel id={r.id} /> ({r.score})
                <select value={asi[r.id] ?? 0} onChange={(e) => setAsi({ ...asi, [r.id]: Number(e.currentTarget.value) })}>
                  <option value={0}>—</option><option value={1}>+1</option><option value={2}>+2</option>
                </select>
                <input type="hidden" value={r.id} />
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
  const settledTop = playbackSettled(s.queue, s.ui.playback, manualRollPending());
  if (s.game.status === 'dead' && !s.game.combat) return <DeathScreen />; // in-combat death keeps the battle + banner
  // death inside combat: keep the battle on screen; its banner offers retry/title
  if (s.game.status === 'questComplete' && settledTop && s.game.quest && s.quest?.scenes[s.game.quest.sceneId]?.type === 'ending')
    return <EndingScreen />;

  const scene = s.quest && s.game.quest ? s.quest.scenes[s.game.quest.sceneId] : undefined;
  return (
    <div class="adventure">
      <StatusBar hero={hero} />
      {s.game.combat ? (
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
              <SceneArt backdrop={q.cover} still />
              <div class="quest-body">
                <h3>{q.title} {done && <span class="badge">completed</span>}</h3>
                <p>{q.summary}</p>
                <p class="dim">Level {q.recommendedLevel ?? 1}+ · ~{q.estimatedMinutes ?? '?'} min</p>
                {bad ? (
                  <details><summary>Invalid quest ({q.errors.length} errors)</summary>
                    <ul>{q.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></details>
                ) : (
                  <button class="primary" onClick={() => void startQuestById(q.id)}>Begin</button>
                )}
              </div>
            </div>
          );
        })}
        {quests.length === 0 && <p class="dim">No quests found.</p>}
      </div>
      <button onClick={() => gotoScreen('title')}>Title</button>
    </main>
  );
}
