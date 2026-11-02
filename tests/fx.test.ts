import { describe, expect, it } from 'vitest';
import { shouldEnableFx } from '../src/fx';

describe('shouldEnableFx', () => {
  it('requires all three conditions', () => {
    expect(shouldEnableFx({ animations: true, reducedMotion: false, webgl: true })).toBe(true);
    expect(shouldEnableFx({ animations: false, reducedMotion: false, webgl: true })).toBe(false);
    expect(shouldEnableFx({ animations: true, reducedMotion: true, webgl: true })).toBe(false);
    expect(shouldEnableFx({ animations: true, reducedMotion: false, webgl: false })).toBe(false);
  });
});
