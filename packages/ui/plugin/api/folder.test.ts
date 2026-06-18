import { describe, expect, it } from 'vitest';
import { sectionJsonPath } from './folder.js';

describe('sectionJsonPath', () => {
  it('appends _section.json to the folder path', () => {
    expect(sectionJsonPath('guides')).toBe('guides/_section.json');
    expect(sectionJsonPath('a/b')).toBe('a/b/_section.json');
  });

  it('returns _section.json for root folder', () => {
    expect(sectionJsonPath('')).toBe('_section.json');
  });
});
