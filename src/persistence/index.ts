import type { GameState, Hero } from '../engine/model';
import type { Quest } from '../engine/quest/types';

export const APP_VERSION = '0.1.0';
export const CURRENT_SCHEMA = 2;
export const SLOT_COUNT = 3;

export const slotKey = (n: number) => `dungeon:slot:${n}`;
export const SETTINGS_KEY = 'dungeon:settings';
export const corruptKey = (n: number, ts: number) => `dungeon:corrupt:${n}:${ts}`;

// ---------- storage adapters ----------

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private storage: Storage = globalThis.localStorage) {}
  get(key: string) {
    return this.storage.getItem(key);
  }
  set(key: string, value: string) {
    this.storage.setItem(key, value);
  }
  remove(key: string) {
    this.storage.removeItem(key);
  }
  keys() {
    const out: string[] = [];
    for (let i = 0; i < this.storage.length; i++) out.push(this.storage.key(i)!);
    return out;
  }
}

export class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  get(key: string) {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.map.set(key, value);
  }
  remove(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()];
  }
}

// ---------- envelope ----------

export interface SaveSummary {
  name: string;
  classId: string;
  level: number;
  questTitle: string | null;
  sceneTitle: string | null;
  status: 'active' | 'dead' | 'idle';
}

export interface SaveEnvelope {
  schemaVersion: number;
  appVersion: string;
  savedAt: string;
  summary: SaveSummary;
  state: GameState;
  checkpoint: GameState | null;
}

/**
 * Pre-release v0 shape (never shipped publicly): a flat hero with hp/maxHp and
 * no summary, no checkpoint, no quest progress. Migrated to v1 by wrapping it
 * in a full GameState with sensible defaults.
 */
export interface SaveV0 {
  schemaVersion: 0;
  appVersion: string;
  savedAt: string;
  rng: number;
  hero: {
    name: string;
    classId: string;
    level: number;
    xp: number;
    hp: number;
    maxHp: number;
    gold: number;
    abilities: Record<string, number>;
  };
  status: 'active' | 'dead' | 'idle';
}

export class NewerVersionError extends Error {
  constructor(found: number) {
    super(`Save was made by a newer version (schema ${found} > ${CURRENT_SCHEMA})`);
    this.name = 'NewerVersionError';
  }
}

const migrate0to1 = (old: unknown): SaveEnvelope => {
  const v0 = old as SaveV0;
  const hero: Hero = {
    name: v0.hero.name,
    classId: v0.hero.classId as Hero['classId'],
    avatar: { seed: 1 },
    abilities: v0.hero.abilities as Hero['abilities'],
    level: v0.hero.level,
    xp: v0.hero.xp,
    hp: v0.hero.hp,
    maxHp: v0.hero.maxHp,
    hitDiceUsed: 0,
    gold: v0.hero.gold,
    inventory: [],
    equipment: {},
    slotsUsed: [],
    resources: {},
    conditions: [],
    completedQuests: [],
    pendingLevelUps: 0,
    shortRestsSinceLong: 0,
    dead: v0.status === 'dead',
  };
  const state: GameState = {
    version: 1,
    rng: v0.rng >>> 0,
    hero,
    quest: null,
    combat: null,
    log: [],
      logSeq: 0,
    status: v0.status === 'dead' ? 'dead' : 'idle',
  };
  return {
    schemaVersion: 1,
    appVersion: v0.appVersion,
    savedAt: v0.savedAt,
    summary: {
      name: hero.name,
      classId: hero.classId,
      level: hero.level,
      questTitle: null,
      sceneTitle: null,
      status: v0.status,
    },
    state,
    checkpoint: null,
  };
};

/** migrations[n] upgrades a v-n envelope to v-(n+1). */
function migrate1to2(old: unknown): SaveEnvelope {
  const env = structuredClone(old) as SaveEnvelope;
  env.schemaVersion = 2;
  const st = env.state as unknown as {
    log?: { text?: string; event?: unknown; seq?: number }[];
    logSeq?: number;
    hero?: { gold?: number; xp?: number };
    quest?: { startGold?: number; startXp?: number } | null;
  };
  const raw = st.log ?? [];
  const events = raw.map((l, i) => l.event
    ? { seq: typeof l.seq === 'number' ? l.seq : i, event: l.event }
    : { seq: i, event: { type: 'narrate', text: l.text ?? '' } });
  st.log = events as never;
  st.logSeq = typeof st.logSeq === 'number' ? st.logSeq : events.length;
  if (st.quest) {
    st.quest.startGold ??= st.hero?.gold ?? 0;
    st.quest.startXp ??= st.hero?.xp ?? 0;
  }
  return env;
}

export const migrations: Record<number, (old: unknown) => SaveEnvelope> = {
  0: migrate0to1,
  1: migrate1to2,
};

// ---------- load / save ----------

export interface LoadResult {
  save: SaveEnvelope | null;
  migrated: boolean;
  warning?: string;
}

export function makeSummary(state: GameState, quest: Quest | null): SaveSummary {
  const hero = state.hero;
  const scene = state.quest && quest ? quest.scenes[state.quest.sceneId] : undefined;
  return {
    name: hero?.name ?? '',
    classId: hero?.classId ?? '',
    level: hero?.level ?? 1,
    questTitle: quest?.title ?? null,
    sceneTitle: scene?.title ?? null,
    status: hero?.dead ? 'dead' : state.status === 'idle' ? 'idle' : 'active',
  };
}

export function saveSlot(
  adapter: StorageAdapter,
  slot: number,
  state: GameState,
  checkpoint: GameState | null,
  quest: Quest | null,
  now: () => number,
): SaveEnvelope {
  const env: SaveEnvelope = {
    schemaVersion: CURRENT_SCHEMA,
    appVersion: APP_VERSION,
    savedAt: new Date(now()).toISOString(),
    summary: makeSummary(state, quest),
    state,
    checkpoint,
  };
  adapter.set(slotKey(slot), JSON.stringify(env));
  return env;
}

export function loadSlot(adapter: StorageAdapter, slot: number, now: () => number): LoadResult {
  const raw = adapter.get(slotKey(slot));
  if (raw === null) return { save: null, migrated: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const key = corruptKey(slot, now());
    adapter.set(key, raw);
    adapter.remove(slotKey(slot));
    return { save: null, migrated: false, warning: `Save in slot ${slot} was unreadable and has been quarantined.` };
  }
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { schemaVersion?: unknown }).schemaVersion !== 'number') {
    const key = corruptKey(slot, now());
    adapter.set(key, raw);
    adapter.remove(slotKey(slot));
    return { save: null, migrated: false, warning: `Save in slot ${slot} was unreadable and has been quarantined.` };
  }
  let env = parsed as SaveEnvelope;
  if (env.schemaVersion > CURRENT_SCHEMA) throw new NewerVersionError(env.schemaVersion);
  let migrated = false;
  while (env.schemaVersion < CURRENT_SCHEMA) {
    const mig = migrations[env.schemaVersion];
    if (!mig) throw new Error(`No migration from schema ${env.schemaVersion}`);
    env = mig(env);
    migrated = true;
  }
  if (migrated) adapter.set(slotKey(slot), JSON.stringify(env));
  return { save: env, migrated };
}

export function deleteSlot(adapter: StorageAdapter, slot: number): void {
  adapter.remove(slotKey(slot));
}

// ---------- quest drift ----------

/**
 * If the saved scene no longer exists in the loaded quest, reset progress to
 * the quest start (keeping the character) and report it.
 */
export function reconcileQuestDrift(
  save: SaveEnvelope,
  quest: Quest,
): { save: SaveEnvelope; reset: boolean } {
  const qp = save.state.quest;
  if (!qp || qp.questId !== quest.id) return { save, reset: false };
  if (quest.scenes[qp.sceneId]) return { save, reset: false };
  qp.sceneId = quest.start;
  qp.visited = [quest.start];
  qp.pending = null;
  save.state.combat = null;
  save.state.status = 'inQuest';
  return { save, reset: true };
}

// ---------- settings ----------

export interface Settings {
  animations: boolean;
  rollPlaybackMs: number;
  autoRoll: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { animations: true, rollPlaybackMs: 350, autoRoll: false, sound: true };

export function loadSettings(adapter: StorageAdapter): Settings {
  const raw = adapter.get(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      animations: typeof p.animations === 'boolean' ? p.animations : true,
      autoRoll: typeof p.autoRoll === 'boolean' ? p.autoRoll : false,
      sound: typeof p.sound === 'boolean' ? p.sound : true,
      rollPlaybackMs:
        typeof p.rollPlaybackMs === 'number' && p.rollPlaybackMs >= 0
          ? p.rollPlaybackMs === 600 ? 350 : p.rollPlaybackMs // legacy 600 → Normal
          : 350,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(adapter: StorageAdapter, settings: Settings): void {
  adapter.set(SETTINGS_KEY, JSON.stringify(settings));
}
