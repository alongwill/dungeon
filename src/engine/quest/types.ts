export type AbilityId = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export type SkillId =
  | 'athletics'
  | 'acrobatics'
  | 'stealth'
  | 'sleightOfHand'
  | 'arcana'
  | 'history'
  | 'investigation'
  | 'insight'
  | 'medicine'
  | 'perception'
  | 'survival'
  | 'deception'
  | 'intimidation'
  | 'performance'
  | 'persuasion';

export type ClassId =
  | 'fighter'
  | 'rogue'
  | 'paladin'
  | 'bard'
  | 'druid'
  | 'wizard'
  | 'cleric'
  | 'ranger';

export type ConditionName =
  | 'hidden'
  | 'restrained'
  | 'frightened'
  | 'poisoned'
  | 'blessed'
  | 'marked'
  | 'dodging'
  | 'stunned'
  | 'wildshape'
  | 'inspired';

export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'radiant'
  | 'psychic'
  | 'force'
  | 'poison'
  | 'cold'
  | 'necrotic';

export type FlagValue = number | boolean | string;

// ---------- Conditions (requirements / advantageIf) ----------

export type Condition =
  | { flag: string; eq?: FlagValue; gte?: number; lte?: number }
  | { hasItem: string }
  | { class: string[] }
  | { ability: AbilityId; gte: number }
  | { gold: { gte?: number; lte?: number } }
  | { level: { gte?: number; lte?: number } }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

// ---------- Effects ----------

export type Effect =
  | { setFlag: string; value: FlagValue }
  | { addFlag: string; by: number }
  | { gold: number | string }
  | { addItem: string; qty?: number }
  | { removeItem: string; qty?: number }
  | { xp: number }
  | { heal: string }
  | { damage: string; type?: DamageType; save?: SaveSpec }
  | { condition: ConditionName; rounds?: number }
  | { restoreSlots: true };

export interface SaveSpec {
  ability: AbilityId;
  dc: number;
  half?: boolean;
}

export interface Outcome {
  goto: string;
  effects?: Effect[];
  text?: string;
}

export interface CheckDef {
  skill?: SkillId;
  ability?: AbilityId;
  dc: number;
  advantageIf?: Condition;
  disadvantageIf?: Condition;
}

export interface Choice {
  text: string;
  requires?: Condition;
  hideIfUnmet?: boolean;
  check?: CheckDef;
  success?: Outcome;
  failure?: Outcome;
  goto?: string;
  effects?: Effect[];
}

// ---------- Scenes ----------

interface SceneBase {
  title: string;
  text: string;
  image?: string;
  onEnter?: Effect[];
  rest?: 'short' | 'long';
}

export interface NarrationScene extends SceneBase {
  type: 'narration';
  choices: Choice[];
}
export interface DialogueScene extends SceneBase {
  type: 'dialogue';
  speaker: string;
  choices: Choice[];
}
export interface CheckScene extends SceneBase {
  type: 'check';
  check: CheckDef;
  success: Outcome;
  failure: Outcome;
}
export interface EncounterScene extends SceneBase {
  type: 'encounter';
  enemies: { enemy: string; count?: number }[];
  boss?: boolean;
  surprise?: 'hero' | 'enemies';
  canFlee?: boolean;
  fleeDC?: number;
  victory: Outcome;
  flee?: Outcome;
  defeat?: Outcome;
}
export interface LootScene extends SceneBase {
  type: 'loot';
  gold?: number | string;
  items?: { item: string; qty?: number }[];
  next: Outcome;
}
export interface EndingScene extends SceneBase {
  type: 'ending';
  outcome: 'victory' | 'neutral' | 'defeat';
  xp?: number;
  epilogue?: string;
}

export type Scene =
  | NarrationScene
  | DialogueScene
  | CheckScene
  | EncounterScene
  | LootScene
  | EndingScene;

// ---------- Actors / items ----------

export interface AvatarSpec {
  seed: number;
  skin?: string;
  hair?: string;
  hairColour?: string;
  eyes?: string;
  mouth?: string;
  accessory?: string;
  frame?: string;
  creature?: string;
}

export interface EnemyAction {
  name: string;
  attack?: number; // to-hit bonus
  damage?: string;
  type?: DamageType;
  save?: SaveSpec;
  weight?: number;
  recharge?: number; // usable every N rounds
}

export interface EnemyPhase {
  belowHpPct: number;
  text: string;
  addActions?: EnemyAction[];
}

export interface EnemyDef {
  name: string;
  avatar?: AvatarSpec;
  ac: number;
  hp: string; // dice
  dex: number;
  saves?: Partial<Record<AbilityId, number>>;
  passivePerception: number;
  xp: number;
  resist?: DamageType[];
  vulnerable?: DamageType[];
  immune?: DamageType[];
  undead?: boolean;
  actions: EnemyAction[];
  phases?: EnemyPhase[];
  morale?: { fleeBelowHpPct: number };
}

export interface NpcDef {
  name: string;
  avatar?: AvatarSpec;
  title?: string;
}

export type ItemKind = 'weapon' | 'armour' | 'shield' | 'consumable' | 'treasure' | 'key';

export interface WeaponDef {
  name: string;
  kind: 'weapon';
  damage: string;
  damageType: DamageType;
  ability: 'STR' | 'DEX' | 'finesse';
  value?: number;
}
export interface ArmourDef {
  name: string;
  kind: 'armour';
  armour: 'light' | 'medium' | 'heavy';
  value?: number;
}
export interface ShieldDef {
  name: string;
  kind: 'shield';
  value?: number;
}
export interface ConsumableDef {
  name: string;
  kind: 'consumable';
  use: Effect[];
  value?: number;
}
export interface MiscItemDef {
  name: string;
  kind: 'treasure' | 'key';
  value?: number;
}
export type ItemDef = WeaponDef | ArmourDef | ShieldDef | ConsumableDef | MiscItemDef;

export interface Quest {
  schemaVersion: 1;
  id: string;
  version: string;
  title: string;
  summary: string;
  author?: string;
  recommendedLevel?: number;
  estimatedMinutes?: number;
  start: string;
  flags?: Record<string, FlagValue>;
  npcs?: Record<string, NpcDef>;
  enemies?: Record<string, EnemyDef>;
  items?: Record<string, ItemDef>;
  scenes: Record<string, Scene>;
}
