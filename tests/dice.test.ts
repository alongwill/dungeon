import { describe, expect, it } from 'vitest';
import { DiceParseError, formatRoll, parseExpr, roll, rngFromSeed } from '../src/engine/dice';

describe('parser', () => {
  it.each([
    ['d20', [{ kind: 'dice', count: 1, sides: 20 }]],
    ['1d20+3', [{ kind: 'dice', count: 1, sides: 20 }]],
    ['2d6+1d4-1', [{ kind: 'dice', count: 2, sides: 6 }, { kind: 'dice', count: 1, sides: 4 }]],
    ['4d6dl1', [{ kind: 'dice', count: 4, sides: 6 }]],
    ['2d20kh1', [{ kind: 'dice', count: 2, sides: 20 }]],
    ['2d20kl1', [{ kind: 'dice', count: 2, sides: 20 }]],
    ['d%', [{ kind: 'dice', count: 1, sides: 100 }]],
    ['5', []],
  ])('parses %s', (src) => {
    const e = parseExpr(src);
    expect(e.terms.length).toBeGreaterThan(0);
  });

  it('keep modes parse', () => {
    for (const m of ['kh', 'kl', 'dh', 'dl']) {
      const e = parseExpr(`4d6${m}1`);
      const t = e.terms[0]!;
      expect(t.kind).toBe('dice');
      if (t.kind === 'dice') expect(t.keep).toEqual({ mode: m, n: 1 });
    }
  });

  it.each(['', 'd', '1dd20', 'd20+', '3d0', '2d6kh', '1d4kh3', 'foo', '1d-3'])(
    'rejects %s',
    (src) => expect(() => parseExpr(src)).toThrow(DiceParseError),
  );

  it('handles negative terms and multiple terms', () => {
    const e = parseExpr('2d6-1d4-1');
    expect(e.terms).toHaveLength(3);
    expect(e.terms[2]).toEqual({ kind: 'mod', sign: -1, value: 1 });
  });
});

describe('roll', () => {
  it('is deterministic for a seed', () => {
    const a = roll('3d6+2', rngFromSeed(42));
    const b = roll('3d6+2', rngFromSeed(42));
    expect(a.result).toEqual(b.result);
  });

  it('d% rolls 1-100', () => {
    const r = roll('d%', rngFromSeed(7)).result;
    expect(r.rolls[0]!.value).toBeGreaterThanOrEqual(1);
    expect(r.rolls[0]!.value).toBeLessThanOrEqual(100);
  });

  it('dl1 drops the lowest', () => {
    const r = roll('4d6dl1', rngFromSeed(3)).result;
    const kept = r.rolls.filter((d) => d.kept);
    const dropped = r.rolls.filter((d) => !d.kept);
    expect(kept).toHaveLength(3);
    expect(dropped).toHaveLength(1);
    expect(Math.min(...r.rolls.map((d) => d.value))).toBe(dropped[0]!.value);
    expect(r.total).toBe(kept.reduce((n, d) => n + d.value, 0));
  });

  it('kh1 keeps the highest (advantage)', () => {
    const r = roll('2d20kh1+5', rngFromSeed(11)).result;
    const kept = r.rolls.find((d) => d.kept)!;
    const dropped = r.rolls.find((d) => !d.kept)!;
    expect(kept.value).toBeGreaterThanOrEqual(dropped.value);
    expect(r.total).toBe(kept.value + 5);
  });

  it('advantage option rewrites the d20 term', () => {
    const r = roll('1d20+2', rngFromSeed(11), { advantage: true }).result;
    expect(r.rolls).toHaveLength(2);
    expect(r.rolls.filter((d) => d.kept)).toHaveLength(1);
  });

  it('advantage + disadvantage cancel', () => {
    const r = roll('1d20+2', rngFromSeed(11), { advantage: true, disadvantage: true }).result;
    expect(r.rolls).toHaveLength(1);
  });

  it('critical doubles dice not modifiers', () => {
    const norm = roll('1d8+3', rngFromSeed(5)).result;
    const crit = roll('1d8+3', rngFromSeed(5), { critical: true }).result;
    expect(crit.rolls).toHaveLength(2);
    expect(norm.rolls).toHaveLength(1);
    expect(crit.modifier).toBe(3);
    expect(crit.total).toBe(crit.rolls[0]!.value + crit.rolls[1]!.value + 3);
  });

  it('flags nat1 and nat20 on d20s', () => {
    let nat1 = false;
    let nat20 = false;
    let rng = rngFromSeed(0);
    for (let i = 0; i < 500 && !(nat1 && nat20); i++) {
      const r = roll('1d20', rng);
      rng = r.rng;
      if (r.result.rolls[0]!.value === 1) { nat1 = true; expect(r.result.nat1).toBe(true); }
      if (r.result.rolls[0]!.value === 20) { nat20 = true; expect(r.result.nat20).toBe(true); }
    }
    expect(nat1 && nat20).toBe(true);
  });
});

describe('formatRoll', () => {
  it('shows kept and dropped dice', () => {
    const r = roll('2d20kh1+5', rngFromSeed(11)).result;
    const s = formatRoll(r);
    expect(s).toMatch(/^2d20kh1\+5 → \[\d+, \(\d+\)|\(\d+\), \d+\] \+ 5 = \d+$/);
  });
});
