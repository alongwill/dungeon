import { Avatar } from '../avatar/Avatar';
import type { AvatarSpec, Quest } from '../engine/quest/types';
import { useStore } from './store';

export const nameHash = (t: string) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

/** Combat enemy ids are `${defId}-${n}`. */
export const defIdOf = (enemyId: string) => enemyId.replace(/-\d+$/, '');

/** Avatar for an enemy: its quest avatar, else a stable generic creature. */
export function enemySpec(enemyId: string, quest: Quest | null): AvatarSpec {
  const defId = defIdOf(enemyId);
  return quest?.enemies?.[defId]?.avatar ?? { seed: nameHash(defId) + nameHash(enemyId), frame: 'enemy', creature: 'beast' };
}

/** Small portrait for whoever an event belongs to ('hero' or an enemy id). */
export function ActorAvatar({ actor, size = 28 }: { actor: string; size?: number }) {
  const spec = useStore((s) => (actor === 'hero' ? s.game.hero?.avatar : enemySpec(actor, s.quest)));
  return spec ? <Avatar spec={spec} size={size} label="" /> : null;
}

/** Friendly explanations for the numbers added to rolls. */
const ABILITY_WORDS: Record<string, string> = {
  Strength: 'muscle', Dexterity: 'agility and aim', Constitution: 'toughness',
  Intelligence: 'book-smarts', Wisdom: 'instinct and awareness', Charisma: 'force of personality',
};
export function explainPart(label: string): string {
  if (ABILITY_WORDS[label]) return `${label} bonus: comes from your ${label} score (${ABILITY_WORDS[label]}). Every 2 points above 10 adds +1.`;
  if (label === 'proficiency') return 'Proficiency bonus: extra skill from training — added when you use a weapon, spell or skill your class is good at. +2 at levels 1–4, +3 at level 5.';
  if (label === 'expertise') return 'Expertise: a rogue is so practised at this that their proficiency bonus counts twice.';
  if (label === 'attack bonus') return "This creature's skill at hitting — the monster equivalent of your ability and proficiency bonuses.";
  if (label === 'damage bonus') return "This creature's extra damage on a hit (its strength or a sharp weapon).";
  if (label === 'level') return 'Your level is added to this roll.';
  if (/Bless/.test(label)) return 'Bless: a holy blessing adds an extra d4 to your attacks and saves.';
  if (/Inspiration/.test(label)) return 'Bardic Inspiration: an extra d6 of confidence.';
  return label;
}
