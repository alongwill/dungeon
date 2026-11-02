import { nextInt, type Rng } from './rng';
import { parseExpr, type DiceExpr, type Term } from './parse';

export interface DieRoll {
  sides: number;
  value: number;
  kept: boolean;
}

export interface RollResult {
  expr: string;
  rolls: DieRoll[];
  modifier: number;
  total: number;
  nat1: boolean;
  nat20: boolean;
}

export interface RollOpts {
  advantage?: boolean;
  disadvantage?: boolean;
  critical?: boolean;
}

function applyAdvDisadv(expr: DiceExpr, opts: RollOpts): DiceExpr {
  const adv = !!opts.advantage;
  const dis = !!opts.disadvantage;
  if (adv === dis) return expr; // cancel (or neither)
  const idx = expr.terms.findIndex((t) => t.kind === 'dice' && t.sides === 20);
  if (idx < 0) return expr;
  const terms = expr.terms.map((t, i): Term =>
    i === idx && t.kind === 'dice'
      ? { ...t, count: 2, keep: { mode: adv ? 'kh' : 'kl', n: 1 } }
      : t,
  );
  return { source: expr.source, terms };
}

export function roll(
  input: string | DiceExpr,
  state: Rng,
  opts: RollOpts = {},
): { result: RollResult; rng: Rng } {
  let expr = typeof input === 'string' ? parseExpr(input) : input;
  expr = applyAdvDisadv(expr, opts);

  let rng = state;
  const rolls: DieRoll[] = [];
  let modifier = 0;
  let total = 0;
  let sawD20 = false;
  let keptD20Values: number[] = [];

  for (const term of expr.terms) {
    if (term.kind === 'mod') {
      modifier += term.sign * term.value;
      continue;
    }
    const count = term.count * (opts.critical ? 2 : 1);
    const values: number[] = [];
    for (let k = 0; k < count; k++) {
      const [v, s] = nextInt(rng, term.sides);
      rng = s;
      values.push(v);
    }
    let keptFlags: boolean[];
    if (term.keep) {
      const order = values
        .map((v, i) => ({ v, i }))
        .sort((a, b) => a.v - b.v || a.i - b.i);
      const { mode, n } = term.keep;
      keptFlags = values.map((_, i) => {
        const pos = order.findIndex((o) => o.i === i); // rank ascending
        if (mode === 'dh') return pos < count - n;
        if (mode === 'dl') return pos >= n;
        if (mode === 'kh') return pos >= count - n;
        return pos < n; // kl
      });
    } else {
      keptFlags = values.map(() => true);
    }
    let keptSum = 0;
    values.forEach((v, i) => {
      const kept = keptFlags[i]!;
      rolls.push({ sides: term.sides, value: v, kept });
      if (kept) {
        keptSum += v;
        if (term.sides === 20) keptD20Values.push(v);
      }
      if (term.sides === 20) sawD20 = true;
    });
    total += term.sign * keptSum;
  }
  total += modifier;

  return {
    result: {
      expr: expr.source,
      rolls,
      modifier,
      total,
      nat1: sawD20 && keptD20Values.includes(1),
      nat20: sawD20 && keptD20Values.includes(20),
    },
    rng,
  };
}

/** Format a possibly-negative modifier for embedding in a dice expression. */
export const fmtMod = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

/** e.g. `2d20kh1+5 → [17, (4)] + 5 = 22` */
export function formatRoll(r: RollResult): string {
  const dice = r.rolls.map((d) => (d.kept ? `${d.value}` : `(${d.value})`)).join(', ');
  const parts: string[] = [];
  if (r.rolls.length) parts.push(`[${dice}]`);
  if (r.modifier !== 0) parts.push(`${r.modifier > 0 ? '+' : '−'} ${Math.abs(r.modifier)}`);
  const rhs = parts.length ? ` ${parts.join(' ')} = ${r.total}` : ` = ${r.total}`;
  return `${r.expr} →${rhs}`;
}
