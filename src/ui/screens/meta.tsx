import { useState } from 'preact/hooks';
import { loadSlot } from '../../persistence';
import { getAdapter } from '../store';
import { detectWebGL } from '../../fx';
import {
  deleteGame, dismissNotice, gotoScreen, loadGame,
  returnToTitle, retryCheckpoint, setSetting, useStore,
} from '../store';
import type { SaveSummary } from '../../persistence';

const slotSummary = (n: number): SaveSummary | null => {
  try {
    const res = loadSlot(getAdapter(), n, () => Date.now());
    return res.save?.summary ?? null;
  } catch {
    return null;
  }
};

export function TitleScreen() {
  const summaries = [1, 2, 3].map(slotSummary);
  const hasSave = summaries.some((s) => s && s.status !== 'dead');
  return (
    <main class="screen title">
      <h1 class="logo">Dungeon</h1>
      <p class="tagline">A tiny adventure for one brave hero.</p>
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
          const sum = slotSummary(n);
          return (
            <div class="slot card" key={n}>
              {sum ? (
                <>
                  <p><strong>{sum.name}</strong> — level {sum.level} {sum.classId}</p>
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
  return (
    <main class="screen ending">
      <h2 class={`outcome-${ending?.outcome ?? 'neutral'}`}>
        {ending?.outcome === 'victory' ? 'Victory!' : ending?.outcome === 'defeat' ? 'Defeat' : 'The End'}
      </h2>
      <h3>{scene?.title}</h3>
      <p>{ending?.epilogue ?? scene?.text}</p>
      <p class="dim">XP earned: {ending?.xp ?? 0} · Gold: {s.game.hero?.gold ?? 0} gp</p>
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
      <label class="row" title="3D battle effects (needs WebGL)">
        <input type="checkbox" checked={settings.animations && detectWebGL()} disabled={!detectWebGL()}
          onChange={(e) => setSetting('animations', e.currentTarget.checked)} />
        3D battle effects (needs WebGL)
        {!detectWebGL() && <span class="dim">— unavailable on this device</span>}
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
