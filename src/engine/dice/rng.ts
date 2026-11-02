/** mulberry32 — state is a uint32 carried in GameState. */
export type Rng = number;

export function rngFromSeed(seed: number): Rng {
  return seed >>> 0;
}

/** Returns [float in [0,1), next state]. */
export function nextFloat(state: Rng): [number, Rng] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(next ^ (next >>> 15), next | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const v = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [v, next];
}

/** Integer in [1, sides]. */
export function nextInt(state: Rng, sides: number): [number, Rng] {
  const [v, s] = nextFloat(state);
  return [Math.floor(v * sides) + 1, s];
}
