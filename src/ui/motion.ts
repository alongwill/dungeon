import { useStore } from './store';

/** True while motion is allowed (animations setting on and no OS reduced-motion). */
export function useMotion(): boolean {
  const animations = useStore((st) => st.ui.settings.animations);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return animations && !reduced;
}
