import { useSyncExternalStore } from 'preact/compat';
import { initialState, step } from '../engine/state';
import type { Action, GameEvent, GameState, Hero } from '../engine/model';
import type { Quest } from '../engine/quest/types';
import {
  DEFAULT_SETTINGS,
  deleteSlot as persistDelete,
  loadSettings,
  loadSlot,
  MemoryAdapter,
  NewerVersionError,
  reconcileQuestDrift,
  saveSettings,
  saveSlot,
  LocalStorageAdapter,
  type Settings,
  type StorageAdapter,
} from '../persistence';
import { listQuests, loadQuest } from '../quests/registry';
import { rngFromSeed } from '../engine/dice';
import { firstUngatedHeroRoll, nextPlaybackCursor, pendingRoll, type Gates } from './playback';

export type Screen = 'title' | 'slots' | 'create' | 'quests' | 'adventure' | 'settings';
export type Drawer = 'character' | 'inventory' | 'log' | null;

export interface UiState {
  screen: Screen;
  drawer: Drawer;
  settings: Settings;
  notices: string[];
  /** Number of queued events already played back. */
  playback: number;
}

export interface Store {
  game: GameState;
  quest: Quest | null;
  questInfos: import('../quests/registry').QuestInfo[];
  slot: number | null;
  checkpoint: GameState | null;
  ui: UiState;
  queue: GameEvent[];
  /** Queue indices of extra manual-roll gates (see playback.ts). Reset with the queue. */
  gates: Gates;
}

let adapter: StorageAdapter = new MemoryAdapter();
try {
  globalThis.localStorage.setItem('dungeon:probe', '1');
  globalThis.localStorage.removeItem('dungeon:probe');
  adapter = new LocalStorageAdapter();
} catch {
  // localStorage unavailable (tests, SSR) — memory adapter stays
}

export function getAdapter(): StorageAdapter {
  return adapter;
}

const freshSeed = (): number => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]!;
};

let store: Store = {
  game: initialState(),
  quest: null,
  questInfos: [],
  slot: null,
  checkpoint: null,
  ui: {
    screen: 'title',
    drawer: null,
    settings: DEFAULT_SETTINGS,
    notices: [],
    playback: 0,
  },
  queue: [],
  gates: new Set(),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const setStore = (patch: Partial<Store>) => {
  store = { ...store, ...patch };
  emit();
};
const setUi = (patch: Partial<UiState>) => setStore({ ui: { ...store.ui, ...patch } });

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getStore(): Store {
  return store;
}
export function useStore<T>(selector: (s: Store) => T): T {
  return useSyncExternalStore(subscribe, () => selector(store));
}

const now = () => Date.now();

function autosave(): void {
  if (store.slot === null || !store.game.hero) return;
  saveSlot(adapter, store.slot, store.game, store.checkpoint, store.quest, now);
}

function notice(msg: string): void {
  setUi({ notices: [...store.ui.notices, msg] });
}
export function dismissNotice(i: number): void {
  setUi({ notices: store.ui.notices.filter((_, n) => n !== i) });
}

// ---------- navigation ----------

export function gotoScreen(screen: Screen): void {
  setUi({ screen, drawer: null });
}
export function setDrawer(drawer: Drawer): void {
  setUi({ drawer });
}
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
  const settings = { ...store.ui.settings, [k]: v };
  saveSettings(adapter, settings);
  setUi({ settings });
}

// ---------- game actions ----------

export function dispatch(action: Action): void {
  const { state, events } = step(store.game, action, { quest: store.quest });
  if (state === store.game && events.every((e) => e.type === 'error')) {
    if (events[0]?.type === 'error') notice(events[0].message);
    return;
  }
  const hadSceneEnter = events.some((e) => e.type === 'sceneEnter');
  const queue = [...store.queue, ...events];
  const extra = store.game.status === 'inCombat' ? firstUngatedHeroRoll(events) : null;
  const gates = extra === null ? store.gates : new Set([...store.gates, store.queue.length + extra]);
  setStore({
    game: state,
    queue,
    gates,
    // first item of the new batch is revealed immediately — no initial delay
    ui: { ...store.ui, playback: nextPlaybackCursor(queue, queue.length - events.length, !store.ui.settings.autoRoll, gates) },
    ...(hadSceneEnter && state.status !== 'dead' ? { checkpoint: state } : {}),
  });
  autosave();
}

/** Advance the playback cursor by one, or fully when `all` is set. */
export function advancePlayback(all = false): void {
  setUi({
    playback: all
      ? store.queue.length
      : nextPlaybackCursor(store.queue, store.ui.playback, !store.ui.settings.autoRoll, store.gates),
  });
}

/** The hero roll awaiting a manual click, if manual rolling is on. */
export function manualRollPending() {
  return store.ui.settings.autoRoll ? null : pendingRoll(store.queue, store.ui.playback, store.gates);
}

/** Reveal the gated roll and continue playback (presentation only — result is fixed). */
export function confirmRoll(): void {
  const pending = manualRollPending();
  if (!pending) return;
  const at = store.queue.indexOf(pending, store.ui.playback);
  setUi({ playback: nextPlaybackCursor(store.queue, at + 1, !store.ui.settings.autoRoll, store.gates) });
  // ^ consume the gated event at cursor then resume; +1 skips past the gate
}

export async function refreshQuests(): Promise<void> {
  setStore({ questInfos: await listQuests() });
}

export async function newGame(hero: Hero, slot: number): Promise<void> {
  const seed = freshSeed();
  const { state } = step(initialState(), { type: 'newGame', hero, seed }, { quest: null });
  setStore({ game: state, quest: null, slot, checkpoint: null, queue: [], gates: new Set() });
  autosave();
  await refreshQuests();
  gotoScreen('quests');
}

export async function startQuestById(id: string): Promise<void> {
  try {
    const quest = await loadQuest(id);
    setStore({ quest });
    dispatch({ type: 'startQuest' });
    gotoScreen('adventure');
  } catch (e) {
    notice(`Could not start quest: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function loadGame(slot: number): Promise<void> {
  try {
    const res = loadSlot(adapter, slot, now);
    if (res.warning) notice(res.warning);
    if (!res.save) {
      notice('That slot is empty.');
      return;
    }
    let { save } = res;
    let quest: Quest | null = null;
    if (save.state.quest) {
      try {
        quest = await loadQuest(save.state.quest.questId);
        const drift = reconcileQuestDrift(save, quest);
        save = drift.save;
        if (drift.reset) notice('This quest changed since you saved — you were returned to its start.');
      } catch {
        notice('The saved quest is missing; your hero waits at the title screen.');
      }
    }
    setStore({
      game: save.state,
      quest,
      slot,
      checkpoint: save.checkpoint,
      queue: save.state.log.map((l) => l.event), // battle history survives reload
      gates: new Set(),
      ui: { ...store.ui, playback: save.state.log.length },
    });
    gotoScreen(save.state.status === 'idle' ? 'quests' : 'adventure');
    if (save.state.status === 'idle') await refreshQuests();
  } catch (e) {
    if (e instanceof NewerVersionError) notice('That save was made by a newer version of the game.');
    else notice(`Could not load: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function deleteGame(slot: number): void {
  persistDelete(adapter, slot);
  emit();
}

export function retryCheckpoint(): void {
  if (!store.checkpoint) return;
  const state = structuredClone(store.checkpoint);
  state.rng = rngFromSeed(freshSeed()); // fresh luck — the same seed replays the same death
  setStore({ game: state, queue: [], gates: new Set() });
  autosave();
}

export function returnToTitle(): void {
  autosave();
  setStore({ quest: null, queue: [], gates: new Set() });
  gotoScreen('title');
}

export function initStore(): void {
  setUi({ settings: loadSettings(adapter) });
}
