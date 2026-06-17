import { describe, expect, it } from 'vitest';
import { rolloverBump, safeRolloverBump } from './version.js';

describe('rolloverBump', () => {
  it('bumps patch when patch < 9', () => {
    expect(rolloverBump('0.1.3')).toBe('0.1.4');
    expect(rolloverBump('2.5.0')).toBe('2.5.1');
    expect(rolloverBump('1.0.8')).toBe('1.0.9');
  });

  it('rolls over to minor when patch is 9', () => {
    expect(rolloverBump('1.4.9')).toBe('1.5.0');
    expect(rolloverBump('0.0.9')).toBe('0.1.0');
  });

  it('rolls over to major when both minor and patch are 9', () => {
    expect(rolloverBump('0.9.9')).toBe('1.0.0');
    expect(rolloverBump('2.9.9')).toBe('3.0.0');
  });

  it('throws on malformed input', () => {
    expect(() => rolloverBump('1.2')).toThrow();
    expect(() => rolloverBump('not-a-version')).toThrow();
  });
});

describe('safeRolloverBump', () => {
  it('returns the next version on valid input', () => {
    expect(safeRolloverBump('0.1.0')).toBe('0.1.1');
  });

  it('returns null on invalid input', () => {
    expect(safeRolloverBump('garbage')).toBeNull();
  });
});
