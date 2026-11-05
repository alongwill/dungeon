import { nextFloat, type Rng } from '../engine/dice/rng';
import type { ClassId } from '../engine/quest/types';

const NAMES: Record<ClassId, string[]> = {
  fighter: ['Borin', 'Kessa', 'Dain', 'Hilda', 'Rurik', 'Sable', 'Garrick', 'Ottavia'],
  rogue: ['Pip', 'Nyra', 'Slick', 'Mira', 'Corvin', 'Tessa', 'Jinx', 'Wren'],
  paladin: ['Aldric', 'Seraphine', 'Gideon', 'Liora', 'Roland', 'Mira', 'Cassian', 'Elira'],
  bard: ['Fenn', 'Lila', 'Orsino', 'Melody', 'Quill', 'Sorrel', 'Tamsin', 'Riff'],
  druid: ['Rowan', 'Fern', 'Ashdown', 'Sylvie', 'Bramble', 'Elowen', 'Thorn', 'Ivy'],
  wizard: ['Eldrin', 'Vex', 'Morwen', 'Pellinore', 'Iris', 'Talthus', 'Nimue', 'Oswic'],
  cleric: ['Anwen', 'Brother Aldous', 'Ceri', 'Dunstan', 'Freya', 'Lucan', 'Petra', 'Sabine'],
  ranger: ['Hart', 'Eryn', 'Falk', 'Juniper', 'Kestrel', 'Linden', 'Reed', 'Briar'],
  barbarian: ['Grond', 'Ulfa', 'Krag', 'Brunhild', 'Torvak', 'Ysolde', 'Hrothgar', 'Magda'],
  monk: ['Shen', 'Brother Tam', 'Lio', 'Sister Ama', 'Kai', 'Noor', 'Jin', 'Sora'],
  sorcerer: ['Zephyra', 'Cinder', 'Valen', 'Ember', 'Draven', 'Lyric', 'Azura', 'Corin'],
  warlock: ['Malachai', 'Hesper', 'Vesper', 'Nyx', 'Sorrow', 'Thessaly', 'Raum', 'Ilse'],
};

/** Deterministic name suggestion for a class. */
export function suggestName(classId: ClassId, rng: Rng): { name: string; rng: Rng } {
  const table = NAMES[classId];
  const [v, next] = nextFloat(rng);
  return { name: table[Math.floor(v * table.length)]!, rng: next };
}
