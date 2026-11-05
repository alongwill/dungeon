import type { ClassId } from '../engine/quest/types';

/** Built-in part tables. Spec fields are string keys into these records. */

export const SKINS = {
  peach: '#f2c9a0',
  tan: '#d9a066',
  brown: '#a06a3a',
  umber: '#6e4529',
  rose: '#f5d7c3',
} as const;

export const HAIR_STYLES = ['crop', 'bob', 'long', 'mohawk', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_COLOURS = {
  black: '#2c2220',
  brown: '#5a3a22',
  auburn: '#8c3b1f',
  gold: '#c98f2e',
  white: '#d8d5cc',
} as const;

export const EYES = ['round', 'narrow', 'bright', 'sleepy', 'wide'] as const;
export type EyeStyle = (typeof EYES)[number];

export const MOUTHS = ['smile', 'grin', 'flat', 'open', 'smirk'] as const;
export type MouthStyle = (typeof MOUTHS)[number];

export const ACCESSORIES = ['none', 'scar', 'freckles', 'eyepatch', 'circlet'] as const;
export type Accessory = (typeof ACCESSORIES)[number];

/** Frame colour per class (or npc/enemy). */
export const FRAME_COLOURS: Record<ClassId | 'npc' | 'enemy', string> = {
  fighter: '#8c3b2e',
  rogue: '#3e4a5a',
  paladin: '#c9a227',
  bard: '#7d4a8c',
  druid: '#3f6b35',
  wizard: '#2e4a8c',
  cleric: '#a8a29a',
  ranger: '#4a5d23',
  barbarian: '#9a4a1c',
  monk: '#c07a2a',
  sorcerer: '#a8324a',
  warlock: '#4a2a6a',
  npc: '#6b5a44',
  enemy: '#5a2e2e',
};
