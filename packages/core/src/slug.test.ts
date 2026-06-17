import { describe, expect, it } from 'vitest';
import { createSlugger, headingSlug } from './slug.js';

describe('headingSlug', () => {
  it('produces github-style lowercase hyphenated slugs', () => {
    expect(headingSlug('Authentication Flow')).toBe('authentication-flow');
  });

  it('strips punctuation', () => {
    expect(headingSlug('Hello, World!')).toBe('hello-world');
  });
});

describe('createSlugger', () => {
  it('disambiguates duplicate headings within a document', () => {
    const slugger = createSlugger();
    expect(slugger.next('Setup')).toBe('setup');
    expect(slugger.next('Setup')).toBe('setup-1');
    expect(slugger.next('Setup')).toBe('setup-2');
  });

  it('reset clears the dedup state', () => {
    const slugger = createSlugger();
    slugger.next('Setup');
    slugger.reset();
    expect(slugger.next('Setup')).toBe('setup');
  });
});
