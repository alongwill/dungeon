import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameEvent } from '../engine/model';
import { confirmRoll, manualRollPending, useStore } from './store';
import { DieChip } from './describe';



export function RollPrompt({ onRoll }: { onRoll?: () => void }) {
  const pending = useStore(manualRollPending) as Extract<GameEvent, { type: 'roll' }> | null;
  const [rolling, setRolling] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pending) { setRolling(false); btn.current?.focus(); }
  }, [pending]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.key === 'r' || e.key === 'R' || e.key === ' ') { e.preventDefault(); btn.current?.click(); }
    };
    if (pending) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);
  if (!pending) return null;
  const sides = pending.result.rolls[0]?.sides ?? 20;
  const mods = pending.parts.filter((p) => p.value !== 0)
    .map((p) => `${p.value >= 0 ? '+' : '−'}${Math.abs(p.value)} ${p.label}`).join(', ');
  const dice = pending.result.expr.replace(/^1d/, 'd');
  const ctx =
    pending.purpose === 'attack' ? `to attack ${pending.targetName ?? 'the enemy'}${pending.source ? ` with ${pending.source}` : ''}`
    : pending.purpose === 'save' ? `for a ${pending.source ?? 'save'}${pending.vs ? ` (need ${pending.vs.value}+)` : ''}`
    : pending.purpose === 'check' ? `for ${pending.source ?? pending.label}${pending.vs ? ` (need ${pending.vs.value}+)` : ''}`
    : pending.purpose === 'damage' ? `for ${pending.source ?? 'damage'}${pending.targetName ? ` on ${pending.targetName}` : ''}`
    : pending.purpose === 'heal' ? `to heal with ${pending.source ?? 'healing'}`
    : pending.purpose === 'initiative' ? 'for initiative (who acts first)'
    : `for ${pending.source ?? pending.label}`;
  const hint =
    pending.purpose === 'attack' && pending.vs ? `Hit if your total reaches ${pending.vs.value} (its armour).`
    : pending.purpose === 'damage' ? 'Spells like this always land — roll to see how hard.'
    : pending.purpose === 'heal' ? 'Roll to see how much health you get back.'
    : '';
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roll = () => {
    onRoll?.(); // Three.js tumble when fx are on
    if (reduced) { confirmRoll(); return; }
    setRolling(true);
    setTimeout(confirmRoll, 500);
  };
  return (
    <div class="roll-prompt" role="group" aria-label="roll the dice">
      <span class="big-die"><DieChip sides={sides} value={pending.result.rolls[0]?.value ?? 0} kept note={undefined} /></span>
      <div>
        <button ref={btn} class="btn-primary roll-btn" onClick={roll} autoFocus>
          Roll {dice} {ctx}
        </button>
        <p class="dim">{hint} {mods ? `You'll add ${mods}.` : ''}</p>
      </div>
      {rolling && <span class="die-land">{pending.result.rolls[0]?.value}</span>}
    </div>
  );
}
