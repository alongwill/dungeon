import { validateQuest } from '../engine/quest/validate';
import type { Backdrop, Quest } from '../engine/quest/types';
import { inferBackdrop } from '../ui/art/SceneArt';

const questModules = import.meta.glob<{ default: unknown }>('/quests/*/quest.json');
const assetModules = import.meta.glob<string>('/quests/*/assets/*', { query: '?url', import: 'default' });

export interface QuestInfo {
  id: string;
  title: string;
  summary: string;
  recommendedLevel?: number;
  estimatedMinutes?: number;
  errors: string[];
  /** Backdrop for the quest card: the start scene's art. */
  cover: Backdrop;
}

const coverOf = (q: Partial<Quest>): Backdrop => {
  const sc = typeof q.start === 'string' ? q.scenes?.[q.start] : undefined;
  return sc && typeof sc.text === 'string' ? inferBackdrop(sc, q.start) : 'road';
};

const idOf = (path: string) => path.split('/')[2]!;

/** List discovered quests. Loads each quest.json (small) to read its metadata. */
export async function listQuests(): Promise<QuestInfo[]> {
  const out: QuestInfo[] = [];
  for (const [path, loader] of Object.entries(questModules)) {
    const mod = await loader();
    const json = (mod as { default: unknown }).default ?? mod;
    const v = validateQuest(json);
    const q = json as Partial<Quest>;
    out.push({
      id: idOf(path),
      title: typeof q.title === 'string' ? q.title : idOf(path),
      summary: typeof q.summary === 'string' ? q.summary : '',
      ...(q.recommendedLevel !== undefined ? { recommendedLevel: q.recommendedLevel } : {}),
      ...(q.estimatedMinutes !== undefined ? { estimatedMinutes: q.estimatedMinutes } : {}),
      errors: v.errors,
      cover: coverOf(q),
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** Load and validate a quest. Throws if invalid or unknown. */
export async function loadQuest(id: string): Promise<Quest> {
  const path = `/quests/${id}/quest.json`;
  const loader = questModules[path];
  if (!loader) throw new Error(`unknown quest "${id}"`);
  const mod = await loader();
  const json = (mod as { default: unknown }).default ?? mod;
  const v = validateQuest(json);
  if (!v.ok) throw new Error(`invalid quest "${id}": ${v.errors.join('; ')}`);
  return v.quest!;
}

/** Resolve an asset URL for a quest folder (e.g. 'assets/cellar.svg'). */
export async function questAssetUrl(questId: string, relPath: string): Promise<string | null> {
  const key = `/quests/${questId}/${relPath}`;
  const loader = assetModules[key];
  if (!loader) return null;
  return loader();
}
