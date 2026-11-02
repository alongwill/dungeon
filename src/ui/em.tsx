import type { ComponentChildren } from 'preact';

/** Render *emphasis* as <em> — splits on asterisks, no innerHTML. */
export function em(text: string): ComponentChildren {
  const parts = text.split(/\*([^*]+)\*/g);
  return parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : p));
}
