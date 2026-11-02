import { roll, type RollResult } from './dice/roll';
import type { GameEvent, GameState } from './model';

export interface RollOpts {
  actor: string;
  actorName: string;
  purpose: 'attack' | 'damage' | 'save' | 'check' | 'initiative' | 'heal' | 'gold' | 'other';
  /** Dice-only expression (e.g. '1d20', '2d20kh1', '2d6'). Modifiers go in parts. */
  expr: string;
  parts?: { label: string; value: number }[];
  source?: string;
  targetName?: string;
  vs?: { kind: 'armour' | 'difficulty'; value: number };
  outcome?: 'hit' | 'miss' | 'crit' | 'success' | 'failure';
  label?: string;
  advantage?: boolean;
  disadvantage?: boolean;
  critical?: boolean;
}

export const keptSum = (r: RollResult): number =>
  r.rolls.reduce((a, d) => a + (d.kept ? d.value : 0), 0);

/** Roll dice, emit a structured roll event, return result + finalTotal. */
export function rollEvent(
  s: GameState,
  events: GameEvent[],
  opts: RollOpts,
): { result: RollResult; total: number } {
  const { result, rng } = roll(opts.expr, s.rng, {
    advantage: opts.advantage,
    disadvantage: opts.disadvantage,
    critical: opts.critical,
  });
  s.rng = rng;
  const parts = opts.parts ?? [];
  const total = keptSum(result) + parts.reduce((a, p) => a + p.value, 0);
  events.push({
    type: 'roll',
    label: opts.label ?? opts.source ?? opts.purpose,
    result,
    actor: opts.actor,
    actorName: opts.actorName,
    purpose: opts.purpose,
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.targetName ? { targetName: opts.targetName } : {}),
    parts,
    finalTotal: total,
    ...(opts.vs ? { vs: opts.vs } : {}),
    ...(opts.outcome ? { outcome: opts.outcome } : {}),
  });
  return { result, total };
}
