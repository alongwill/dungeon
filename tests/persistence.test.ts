import { describe, expect, it } from 'vitest';
import {
  corruptKey,
  CURRENT_SCHEMA,
  loadSlot,
  MemoryAdapter,
  NewerVersionError,
  reconcileQuestDrift,
  saveSlot,
  slotKey,
} from '../src/persistence';
import type { SaveEnvelope, SaveV0 } from '../src/persistence';
import type { Quest } from '../src/engine/quest/types';
import saveV0 from './fixtures/save-v0.json';
import questJson from '../quests/template-cellar-rats/quest.json';
import { makeHero, newGame } from './helpers';

const quest = questJson as Quest;
const clock = () => 1_700_000_000_000;

describe('persistence', () => {
  it('round-trips a save', () => {
    const a = new MemoryAdapter();
    const state = newGame(makeHero('fighter', 'Borin'), 99);
    saveSlot(a, 1, state, null, null, clock);
    const res = loadSlot(a, 1, clock);
    expect(res.save).not.toBeNull();
    expect(res.migrated).toBe(false);
    expect(res.save!.state.hero!.name).toBe('Borin');
    expect(res.save!.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(res.save!.summary.name).toBe('Borin');
  });

  it('empty slot returns no save', () => {
    const res = loadSlot(new MemoryAdapter(), 2, clock);
    expect(res.save).toBeNull();
    expect(res.warning).toBeUndefined();
  });

  it('migrates v0 → v1 and rewrites the save', () => {
    const a = new MemoryAdapter();
    a.set(slotKey(1), JSON.stringify(saveV0));
    const res = loadSlot(a, 1, clock);
    expect(res.migrated).toBe(true);
    const env = res.save!;
    expect(env.schemaVersion).toBe(1);
    expect(env.state.hero!.name).toBe('Old Hero');
    expect(env.state.hero!.hp).toBe(18);
    expect(env.state.rng).toBe((saveV0 as SaveV0).rng);
    expect(env.summary.classId).toBe('fighter');
    // rewritten in storage
    const stored = JSON.parse(a.get(slotKey(1))!) as SaveEnvelope;
    expect(stored.schemaVersion).toBe(1);
    // second load: no migration needed
    expect(loadSlot(a, 1, clock).migrated).toBe(false);
  });

  it('refuses saves from a newer version', () => {
    const a = new MemoryAdapter();
    const newer = { ...JSON.parse(JSON.stringify(saveV0)), schemaVersion: CURRENT_SCHEMA + 1 };
    a.set(slotKey(3), JSON.stringify(newer));
    expect(() => loadSlot(a, 3, clock)).toThrow(NewerVersionError);
    expect(() => loadSlot(a, 3, clock)).toThrow(/newer version/);
  });

  it('quarantines unparseable saves and reports the slot empty', () => {
    const a = new MemoryAdapter();
    a.set(slotKey(1), '{not json!!');
    const res = loadSlot(a, 1, clock);
    expect(res.save).toBeNull();
    expect(res.warning).toMatch(/quarantined/);
    expect(a.get(slotKey(1))).toBeNull();
    expect(a.get(corruptKey(1, clock()))).toBe('{not json!!');
  });

  it('quest drift resets to start when the scene vanished', () => {
    const a = new MemoryAdapter();
    const state = newGame(makeHero(), 5);
    state.quest = {
      questId: quest.id, questVersion: quest.version,
      sceneId: 'deleted-scene', flags: {}, visited: ['deleted-scene'], pending: null,
    };
    state.status = 'inQuest';
    const env = saveSlot(a, 1, state, null, quest, clock);
    const { reset, save } = reconcileQuestDrift(env, quest);
    expect(reset).toBe(true);
    expect(save.state.quest!.sceneId).toBe(quest.start);
    // no drift case
    const env2 = structuredClone(env);
    env2.state.quest!.sceneId = 'cellar';
    expect(reconcileQuestDrift(env2, quest).reset).toBe(false);
  });
});
