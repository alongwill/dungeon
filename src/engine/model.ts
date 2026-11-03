import type { Rng } from './dice/rng';
import type { RollResult } from './dice/roll';
import type {
  AbilityId,
  AvatarSpec,
  CheckDef,
  ClassId,
  ConditionName,
  DamageType,
  EnemyDef,
  FlagValue,
  Outcome,
  Quest,
} from './quest/types';

export interface ActiveCondition {
  name: ConditionName;
  rounds: number | 'combat';
}

export interface Hero {
  name: string;
  classId: ClassId;
  avatar: AvatarSpec;
  abilities: Record<AbilityId, number>;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  hitDiceUsed: number;
  gold: number;
  inventory: { item: string; qty: number }[];
  equipment: { weapon?: string; armour?: string; shield?: string };
  /** Slots expended, indexed by slot level - 1. */
  slotsUsed: number[];
  /** Remaining uses / pool points per resource id. */
  resources: Record<string, number>;
  conditions: ActiveCondition[];
  completedQuests: string[];
  pendingLevelUps: number;
  shortRestsSinceLong: number;
  dead: boolean;
}

export interface CombatEnemy {
  id: string;
  defId: string;
  name: string;
  ac: number;
  hp: number;
  maxHp: number;
  dex: number;
  saves: Partial<Record<AbilityId, number>>;
  passivePerception: number;
  xp: number;
  resist: DamageType[];
  vulnerable: DamageType[];
  immune: DamageType[];
  undead: boolean;
  actions: EnemyDef['actions'];
  morale?: EnemyDef['morale'];
  phases?: EnemyDef['phases'];
  phasesFired: number[];
  conditions: ActiveCondition[];
  /** round number when each recharging action is next available. */
  rechargeReadyAt: Record<string, number>;
  fled: boolean;
  dead: boolean;
}

export interface HeroTurn {
  actionUsed: boolean;
  bonusUsed: boolean;
  extraAction: boolean; // Action Surge grant available
  sneakUsed: boolean;
  attacked: boolean;
}

export interface CombatState {
  enemies: CombatEnemy[];
  round: number;
  /** Full turn order ('hero' + enemy ids), sorted by initiative. */
  order: string[];
  /** Index into order for the combatant whose turn is next/current. */
  turnIndex: number;
  /** surprise:'enemies' — the hero keeps their order slot but skips their round-1 turn. */
  heroSurprised: boolean;
  heroTurn: HeroTurn | null;
  canFlee: boolean;
  fleeDC: number;
  victory: Outcome;
  fleeOutcome?: Outcome;
  defeatOutcome?: Outcome;
  /** Beast HP pool while wild-shaped. */
  beastHp: number;
  uncannyUsedRound: number;
  /** Enemy defId that hero's guiding bolt marked for advantage. */
  guidingBoltTarget: string | null;
  /** Set when combat ends; state.ts applies the outcome. */
  result?: 'victory' | 'fled' | 'defeat' | 'death';
  /** set once endCombat has emitted (stays until continue resolves outcome) */
  resultApplied?: boolean;
}

export type PendingOutcome =
  | {
      kind: 'check';
      check: CheckDef;
      label: string;
      roll: RollResult;
      success: boolean;
      successOutcome: Outcome;
      failureOutcome: Outcome;
      inspired: boolean;
      /** Bardic inspiration die added on top of roll.total. */
      inspirationBonus: number;
    }
  | { kind: 'outcome'; outcome: Outcome }
  | {
      kind: 'loot';
      gold: number;
      items: { item: string; qty: number }[];
      next: Outcome;
    };

export interface QuestProgress {
  questId: string;
  questVersion: string;
  sceneId: string;
  flags: Record<string, FlagValue>;
  visited: string[];
  pending: PendingOutcome | null;
  startGold: number;
  startXp: number;
}

export type GameStatus = 'idle' | 'inQuest' | 'inCombat' | 'dead' | 'questComplete';

export interface LogEntry {
  seq: number;
  event: GameEvent;
}

export interface GameState {
  version: 1;
  rng: Rng;
  hero: Hero | null;
  quest: QuestProgress | null;
  combat: CombatState | null;
  log: LogEntry[];
  logSeq: number;
  status: GameStatus;
}

export type Action =
  | { type: 'newGame'; hero: Hero; seed: number }
  | { type: 'startQuest' }
  | { type: 'choose'; index: number }
  | { type: 'continue' }
  | { type: 'useInspiration' }
  | { type: 'attack'; targetId: string; smiteSlot?: number }
  | { type: 'useAbility'; abilityId: string; targetId?: string; slotLevel?: number; amount?: number }
  | { type: 'useItem'; itemId: string; targetId?: string }
  | { type: 'dodge' }
  | { type: 'flee' }
  | { type: 'endTurn' }
  | { type: 'rest'; kind: 'short' | 'long'; hitDice?: number }
  | { type: 'equip'; itemId: string }
  | { type: 'levelUp'; asi?: Partial<Record<AbilityId, 1 | 2>> };

export type GameEvent =
  | { type: 'roll'; label: string; result: RollResult;
      actor: string; actorName: string;
      purpose: 'attack' | 'damage' | 'save' | 'check' | 'initiative' | 'heal' | 'gold' | 'other';
      source?: string; targetName?: string;
      parts: { label: string; value: number }[];
      finalTotal: number;
      vs?: { kind: 'armour' | 'difficulty'; value: number };
      outcome?: 'hit' | 'miss' | 'crit' | 'success' | 'failure' }
  | { type: 'damage'; target: string; amount: number; damageType?: DamageType; targetName?: string; hpLeft?: number; hpMax?: number }
  | { type: 'heal'; target: string; amount: number }
  | { type: 'narrate'; text: string }
  | { type: 'sceneEnter'; sceneId: string; title: string }
  | { type: 'combatStart' }
  | { type: 'turnStart'; who: string; /** combatant id ('hero' or enemy id); absent in old saves */ actor?: string }
  | { type: 'combatEnd'; result: 'victory' | 'fled' | 'defeat' | 'death' }
  | { type: 'levelUpAvailable' }
  | { type: 'condition'; target: string; condition: ConditionName; on: boolean }
  | { type: 'questComplete'; outcome: string; xp: number }
  | { type: 'death' }
  | { type: 'error'; message: string };

export interface StepCtx {
  quest: Quest | null;
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export const LOG_CAP = 500;
