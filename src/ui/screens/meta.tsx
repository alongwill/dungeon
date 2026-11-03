import { describeEventText } from '../describe';
import { useState } from 'preact/hooks';
import { loadSlot } from '../../persistence';
import { getAdapter } from '../store';
import { detectWebGL } from '../../fx';
import {
  deleteGame, dismissNotice, gotoScreen, loadGame,
  returnToTitle, retryCheckpoint, setSetting, useStore,
} from '../store';
import type { SaveSummary } from '../../persistence';
import { Avatar } from '../../avatar/Avatar';
import { CLASSES } from '../../content/classes';
import type { ClassId } from '../../engine/quest/types';
import { inferBackdrop, SceneArt } from '../art/SceneArt';
import { useMotion } from '../motion';
import { medals, questStats } from '../stats';

const slotSave = (n: number) => {
  try {
    return loadSlot(getAdapter(), n, () => Date.now()).save ?? null;
  } catch {
    return null;
  }
};
const slotSummary = (n: number): SaveSummary | null => slotSave(n)?.summary ?? null;

const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`, delay: `${-(i * 0.73) % 6}s`, dur: `${5 + (i % 5)}s`, dx: `${((i * 53) % 80) - 40}px`,
}));

export function TitleScreen() {
  const summaries = [1, 2, 3].map(slotSummary);
  const hasSave = summaries.some((s) => s && s.status !== 'dead');
  const motion = useMotion();
  return (
    <main class="screen title">
      <div class="title-hero">
        <SceneArt backdrop="camp" still={!motion} />
        {motion && (
          <div class="embers" aria-hidden="true">
            {EMBERS.map((e, i) => <i key={i} style={{ left: e.left, animationDelay: e.delay, animationDuration: e.dur, '--dx': e.dx }} />)}
          </div>
        )}
        <div class="logo-wrap">
          <h1 class="logo">Dungeon</h1>
          <p class="tagline">A tiny adventure for one brave hero.</p>
        </div>
      </div>
      <nav class="menu">
        <button disabled={!hasSave} onClick={() => {
          const idx = summaries.findIndex((s) => s && s.status !== 'dead');
          void loadGame(idx + 1);
        }}>Continue</button>
        <button onClick={() => gotoScreen('slots')}>New Game</button>
        <button onClick={() => gotoScreen('slots')}>Load Game</button>
        <button onClick={() => gotoScreen('settings')}>Settings</button>
      </nav>
      <Notices />
      <footer class="version">v0.1.0 · A game by Dungeon</footer>
    </main>
  );
}

export function Notices() {
  const notices = useStore((s) => s.ui.notices);
  if (!notices.length) return null;
  return (
    <div class="notices">
      {notices.map((n, i) => (
        <div class="notice" role="status" key={i}>
          {n} <button class="link" onClick={() => dismissNotice(i)}>dismiss</button>
        </div>
      ))}
    </div>
  );
}

export function SlotsScreen() {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmOver, setConfirmOver] = useState<number | null>(null);
  const tick = useStore((s) => s.queue.length); // re-render on store change
  void tick;
  return (
    <main class="screen">
      <h2>Save Slots</h2>
      <div class="slots">
        {[1, 2, 3].map((n) => {
          const save = slotSave(n);
          const sum = save?.summary ?? null;
          return (
            <div class="slot card" key={n}>
              {sum ? (
                <>
                  <div class="slot-head">
                    {save?.state.hero && <Avatar spec={save.state.hero.avatar} size={56} label={sum.name} />}
                    <p><strong>{sum.name}</strong><br /><span class="dim">Level {sum.level} {CLASSES[sum.classId as ClassId]?.name ?? sum.classId}</span></p>
                  </div>
                  <p class="dim">{sum.questTitle ?? 'Between adventures'}{sum.sceneTitle ? ` · ${sum.sceneTitle}` : ''}</p>
                  <p class="dim">{sum.status === 'dead' ? 'Fallen' : sum.status}</p>
                  <div class="row">
                    <button onClick={() => void loadGame(n)}>Load</button>
                    {confirmDelete === n ? (
                      <span>Delete? <button class="danger" onClick={() => { deleteGame(n); setConfirmDelete(null); }}>Yes</button>
                      <button onClick={() => setConfirmDelete(null)}>No</button></span>
                    ) : (
                      <button onClick={() => setConfirmDelete(n)}>Delete</button>
                    )}
                  </div>
                </>
              ) : (
                <p class="dim">Empty slot</p>
              )}
              <div class="row">
                {confirmOver === n ? (
                  <span>Overwrite? <button class="danger" onClick={() => { setConfirmOver(null); setPendingSlot(n); gotoScreen('create'); }}>Yes</button>
                  <button onClick={() => setConfirmOver(null)}>No</button></span>
                ) : (
                  <button onClick={() => (sum ? setConfirmOver(n) : (setPendingSlot(n), gotoScreen('create')))}>
                    New Game
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => gotoScreen('title')}>Back</button>
    </main>
  );
}

// pending slot for character creation
let pendingSlot = 1;
export function setPendingSlot(n: number) { pendingSlot = n; }
export function getPendingSlot(): number { return pendingSlot; }

export function DeathScreen() {
  const hasCheckpoint = useStore((s) => !!s.checkpoint);
  const hero = useStore((s) => s.game.hero);
  return (
    <main class="screen death">
      {hero && <Avatar spec={hero.avatar} size={110} label={hero.name} />}
      <h2>Here ends the tale of {hero?.name}</h2>
      <p>Defeated, but not forgotten.</p>
      <div class="menu">
        <button disabled={!hasCheckpoint} onClick={retryCheckpoint}>Retry from checkpoint</button>
        <button onClick={returnToTitle}>Return to title</button>
      </div>
    </main>
  );
}

export function EndingScreen() {
  const s = useStore((st) => st);
  const scene = s.quest && s.game.quest ? s.quest.scenes[s.game.quest.sceneId] : undefined;
  const ending = scene?.type === 'ending' ? scene : undefined;
  const motion = useMotion();
  const st = questStats(s.game.log.map((l) => l.event));
  const xp = s.game.hero && s.game.quest ? s.game.hero.xp - s.game.quest.startXp : 0;
  const gold = s.game.hero && s.game.quest ? s.game.hero.gold - s.game.quest.startGold : 0;
  const tiles: [string | number, string][] = [
    [`+${xp}`, 'experience'], [`${gold >= 0 ? '+' : ''}${gold}`, 'gold'], [st.foes, 'foes defeated'],
    [st.dealt, 'damage dealt'], [st.taken, 'damage taken'], [st.crits, 'critical hits'],
  ];
  return (
    <main class="screen ending">
      {scene && <SceneArt backdrop={inferBackdrop(scene, s.game.quest?.sceneId)} still={!motion} />}
      <h2 class={`outcome-${ending?.outcome ?? 'neutral'}`}>
        {ending?.outcome === 'victory' ? 'Victory!' : ending?.outcome === 'defeat' ? 'Defeat' : 'The End'}
      </h2>
      <h3>{scene?.title}</h3>
      <p class="epilogue">{ending?.epilogue ?? scene?.text}</p>
      <div class="ornament">✦</div>
      <div class="stats-grid">
        {tiles.map(([v, label], i) => (
          <div class="stat" key={label} style={{ animationDelay: `${i * 0.08}s` }}><b>{v}</b><span>{label}</span></div>
        ))}
      </div>
      {medals(st).length > 0 && (
        <div class="medals">
          {medals(st).map((m, i) => <span class="medal" key={m.name} style={{ animationDelay: `${0.5 + i * 0.1}s` }}><i>{m.icon}</i>{m.name}</span>)}
        </div>
      )}
      <p class="dim">Carrying: {s.game.hero?.gold ?? 0} gold · Level {s.game.hero?.level}</p>
      <details class="how-ended"><summary>How it ended</summary>
        <ul>{s.game.log.slice(-15).map((l) => {
          const t = describeEventText(l.event);
          return t ? <li key={l.seq}>{t}</li> : null;
        })}</ul>
      </details>
      <div class="menu">
        <button onClick={() => gotoScreen('quests')}>Choose another quest</button>
        <button onClick={returnToTitle}>Title</button>
      </div>
    </main>
  );
}

export function SettingsScreen() {
  const settings = useStore((s) => s.ui.settings);
  const [confirm, setConfirm] = useState('');
  return (
    <main class="screen">
      <h2>Settings</h2>
      <label class="row" title="Animated scenes, combat effects and 3D dice">
        <input type="checkbox" checked={settings.animations}
          onChange={(e) => setSetting('animations', e.currentTarget.checked)} />
        Animations and battle effects
        {!detectWebGL() && <span class="dim">— 3D effects unavailable on this device (WebGL)</span>}
      </label>
      <label class="row" title="Procedural sound effects">
        <input type="checkbox" checked={settings.sound}
          onChange={(e) => setSetting('sound', e.currentTarget.checked)} />
        Sound effects
      </label>
      <label class="row" title="When off, click Roll before each of your rolls">
        <input type="checkbox" checked={settings.autoRoll}
          onChange={(e) => setSetting('autoRoll', e.currentTarget.checked)} />
        Auto-roll dice (off = click to roll)
      </label>
      <label class="row">
        Roll playback speed
        <select value={settings.rollPlaybackMs}
          onChange={(e) => setSetting('rollPlaybackMs', Number(e.currentTarget.value))}>
          <option value={0}>Instant</option>
          <option value={150}>Fast</option>
          <option value={350}>Normal</option>
          <option value={700}>Slow</option>
        </select>
      </label>
      <h3>Reset all data</h3>
      <p>Type <code>DELETE</code> to erase every save slot and setting.</p>
      <input value={confirm} onInput={(e) => setConfirm(e.currentTarget.value)} placeholder="DELETE" />
      <button class="danger" disabled={confirm !== 'DELETE'} onClick={() => {
        for (let n = 1; n <= 3; n++) deleteGame(n);
        setConfirm('');
      }}>Erase everything</button>
      <button onClick={() => gotoScreen('title')}>Back</button>
    </main>
  );
}
