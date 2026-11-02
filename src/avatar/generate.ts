import { nextFloat, type Rng } from '../engine/dice/rng';
import type { AvatarSpec, ClassId } from '../engine/quest/types';
import { ACCESSORIES, EYES, HAIR_COLOURS, HAIR_STYLES, MOUTHS, SKINS } from './parts';

const pick = <T>(rng: Rng, list: readonly T[]): [T, Rng] => {
  const [v, next] = nextFloat(rng);
  return [list[Math.floor(v * list.length)]!, next];
};

/** Generate a deterministic random avatar spec for a class frame. */
export function randomAvatar(
  classId: ClassId | 'npc' | 'enemy',
  rng: Rng,
): { spec: AvatarSpec; rng: Rng } {
  let r = rng;
  let skin: string, hair: string, hairColour: string, eyes: string, mouth: string, accessory: string;
  [skin, r] = pick(r, Object.keys(SKINS));
  [hair, r] = pick(r, HAIR_STYLES);
  [hairColour, r] = pick(r, Object.keys(HAIR_COLOURS));
  [eyes, r] = pick(r, EYES);
  [mouth, r] = pick(r, MOUTHS);
  [accessory, r] = pick(r, ACCESSORIES);
  const [seedV, next] = nextFloat(r);
  return {
    spec: {
      seed: Math.floor(seedV * 1e9),
      skin, hair, hairColour, eyes, mouth, accessory,
      frame: classId,
    },
    rng: next,
  };
}

/** N suggested avatar specs for character creation. */
export function suggestAvatars(
  classId: ClassId,
  rng: Rng,
  n = 6,
): { specs: AvatarSpec[]; rng: Rng } {
  const specs: AvatarSpec[] = [];
  let r = rng;
  for (let i = 0; i < n; i++) {
    const { spec, rng: next } = randomAvatar(classId, r);
    specs.push(spec);
    r = next;
  }
  return { specs, rng: r };
}
