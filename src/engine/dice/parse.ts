export class DiceParseError extends Error {
  constructor(public readonly input: string, message: string) {
    super(`Invalid dice expression "${input}": ${message}`);
    this.name = 'DiceParseError';
  }
}

export interface DiceTerm {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number; // d% => 100
  keep?: { mode: 'kh' | 'kl' | 'dh' | 'dl'; n: number };
}

export interface ModTerm {
  kind: 'mod';
  sign: 1 | -1;
  value: number;
}

export type Term = DiceTerm | ModTerm;

export interface DiceExpr {
  source: string;
  terms: Term[];
}

const TERM_RE = /^(?:(\d*)d(\d+|%)(?:(kh|kl|dh|dl)(\d+))?|(\d+))/i;

export function parseExpr(input: string): DiceExpr {
  const src = input.trim().replace(/\s+/g, '');
  if (!src) throw new DiceParseError(input, 'empty expression');
  const terms: Term[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  let expectTerm = true;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '+' || ch === '-') {
      if (expectTerm) throw new DiceParseError(input, `unexpected "${ch}" at position ${i}`);
      sign = ch === '+' ? 1 : -1;
      i++;
      expectTerm = true;
      continue;
    }
    const m = TERM_RE.exec(src.slice(i));
    if (!m || m[0].length === 0) {
      throw new DiceParseError(input, `unexpected "${src.slice(i, i + 6)}" at position ${i}`);
    }
    const [tok, countStr, sidesStr, keepMode, keepN, intStr] = m;
    i += tok.length;
    if (intStr !== undefined) {
      terms.push({ kind: 'mod', sign, value: parseInt(intStr, 10) });
    } else {
      const count = countStr === '' || countStr === undefined ? 1 : parseInt(countStr, 10);
      const sides = sidesStr === '%' ? 100 : parseInt(sidesStr!, 10);
      if (count < 1 || count > 100) throw new DiceParseError(input, 'die count must be 1–100');
      if (!Number.isFinite(sides) || sides < 2) throw new DiceParseError(input, 'die needs ≥2 sides');
      let keep: DiceTerm['keep'];
      if (keepMode) {
        const n = parseInt(keepN!, 10);
        const mode = keepMode.toLowerCase() as 'kh' | 'kl' | 'dh' | 'dl';
        if (n < 1 || n >= count) throw new DiceParseError(input, `${mode}${n} invalid for ${count} dice`);
        keep = { mode, n };
      }
      terms.push({ kind: 'dice', sign, count, sides, keep });
    }
    sign = 1;
    expectTerm = false;
  }
  if (expectTerm) throw new DiceParseError(input, 'expression ends mid-term');
  return { source: src, terms };
}

export function isDiceExpr(s: string): boolean {
  try {
    parseExpr(s);
    return true;
  } catch {
    return false;
  }
}
