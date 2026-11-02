import type { GameEvent } from '../engine/model';

export interface FxHandle {
  play(event: GameEvent, ctx: { targetRect?: DOMRect; heroRect?: DOMRect }): void;
  cancel(): void;
  dispose(): void;
}

/** Pure gate: fx needs the animations toggle on, no reduced-motion, and WebGL. */
export function shouldEnableFx(opts: {
  animations: boolean;
  reducedMotion: boolean;
  webgl: boolean;
}): boolean {
  return opts.animations && !opts.reducedMotion && opts.webgl;
}

let webglCache: boolean | null = null;
export function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(
      c.getContext('webgl2') ?? c.getContext('webgl') ?? c.getContext('experimental-webgl')
    );
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** Lazily load the Three.js scene; null on any failure. */
export async function mountFx(container: HTMLElement): Promise<FxHandle | null> {
  try {
    const m = await import('./scene');
    return await m.createFx(container);
  } catch {
    return null;
  }
}
