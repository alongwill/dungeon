import { useEffect, useRef } from 'preact/hooks';
import { getStore, initStore, setDrawer, useStore } from './store';
import { AdventureScreen, QuestSelectScreen } from './screens/adventure';
import { CreateScreen } from './screens/create';
import { Notices, SettingsScreen, SlotsScreen, TitleScreen } from './screens/meta';
import { advancePlayback, dispatch } from './store';
import { formatRoll } from '../engine/dice';
import { playEvents, setSfxEnabled } from '../sfx';
import { tickDelay } from './playback';
import './styles.css';

const ACTIONS: Record<string, string> = { c: 'character', i: 'inventory', l: 'log' };

export function App() {
  const s = useStore((st) => st);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => { initStore(); }, []);

  // keyboard: 1-9 choices/combat actions, C/I/L drawers, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
      const st = getStore();
      if (e.key === 'Escape') { setDrawer(null); return; }
      const d = ACTIONS[e.key.toLowerCase()];
      if (d && st.ui.screen === 'adventure') {
        setDrawer(st.ui.drawer === d ? null : (d as never));
        return;
      }
      const n = parseInt(e.key, 10);
      if (!(n >= 1 && n <= 9) || st.ui.screen !== 'adventure' || st.ui.playback < st.queue.length) return;
      if (st.game.status === 'inCombat' && st.game.combat?.heroTurn) {
        const combat = st.game.combat;
        const heroTurn = combat.heroTurn!;
        const alive = combat.enemies.find((x) => !x.dead && !x.fled);
        const actionOpen = !heroTurn.actionUsed || heroTurn.extraAction;
        const acts: (() => void)[] = [
          () => alive && dispatch({ type: 'attack', targetId: alive.id }),
          () => {}, // abilities menu — keyboard-only navigation is UI-only
          () => {},
          () => actionOpen && dispatch({ type: 'dodge' }),
          () => combat.canFlee && actionOpen && dispatch({ type: 'flee' }),
          () => dispatch({ type: 'endTurn' }),
        ];
        acts[n - 1]?.();
        return;
      }
      const scene = st.quest && st.game.quest ? st.quest.scenes[st.game.quest.sceneId] : undefined;
      if (scene && (scene.type === 'narration' || scene.type === 'dialogue') && !st.game.quest?.pending) {
        const c = scene.choices[n - 1];
        if (c) dispatch({ type: 'choose', index: n - 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // playback: reveal one queued event at a time unless reduced-motion or ms=0
  useEffect(() => {
    if (s.ui.playback >= s.queue.length) return;
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || s.ui.settings.rollPlaybackMs <= 0) { advancePlayback(true); return; }
    const t = setTimeout(() => advancePlayback(), tickDelay(s.queue, s.ui.playback, s.ui.settings.rollPlaybackMs));
    return () => clearTimeout(t);
  }, [s.ui.playback, s.queue.length, s.ui.settings.rollPlaybackMs]);

  // sound effects for each small batch of newly revealed events (big jumps = load/skip: silent)
  useEffect(() => { setSfxEnabled(s.ui.settings.sound); }, [s.ui.settings.sound]);
  const heard = useRef(0);
  useEffect(() => {
    const from = heard.current;
    heard.current = s.ui.playback;
    const n = s.ui.playback - from;
    if (n > 0 && n <= 8 && s.ui.settings.sound) playEvents(s.queue.slice(from, s.ui.playback));
  }, [s.ui.playback]);

  // aria-live announces each item as it's revealed
  useEffect(() => {
    const ev = s.queue[s.ui.playback - 1];
    if (!ev || !liveRef.current) return;
    const text =
      ev.type === 'narrate' ? ev.text
      : ev.type === 'roll' ? `${ev.label}: ${formatRoll(ev.result)}`
      : ev.type === 'sceneEnter' ? `Now entering: ${ev.title}`
      : ev.type === 'combatStart' ? 'Combat begins'
      : ev.type === 'combatEnd' ? `Combat over: ${ev.result}`
      : ev.type === 'death' ? 'You have fallen.'
      : null;
    if (text) liveRef.current.textContent = text;
  }, [s.ui.playback]);

  return (
    <>
      <div class="sr-live" aria-live="polite" ref={liveRef} />
      {s.ui.screen === 'title' && <TitleScreen />}
      {s.ui.screen === 'slots' && <SlotsScreen />}
      {s.ui.screen === 'create' && <CreateScreen />}
      {s.ui.screen === 'quests' && <QuestSelectScreen />}
      {s.ui.screen === 'adventure' && <AdventureScreen />}
      {s.ui.screen === 'settings' && <SettingsScreen />}
      {s.ui.screen !== 'title' && <Notices />}
    </>
  );
}
