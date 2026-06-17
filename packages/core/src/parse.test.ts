import { describe, expect, it } from 'vitest';
import { parseDocSource } from './parse.js';

const SAMPLE = `---
title: Backend API
description: REST API for the backend
tags: [backend, rest]
version: 1.2.3
status: stable
---

# Backend API

Some intro text.

## Authentication Flow

Tokens are signed with HS256.

## Endpoints

The endpoints are listed below.
`;

describe('parseDocSource', () => {
  it('parses validated frontmatter', () => {
    const parsed = parseDocSource(SAMPLE);
    expect(parsed.frontmatter.title).toBe('Backend API');
    expect(parsed.frontmatter.tags).toEqual(['backend', 'rest']);
    expect(parsed.frontmatter.version).toBe('1.2.3');
    expect(parsed.validationErrors).toEqual([]);
  });

  it('extracts headings with deterministic slugs in document order', () => {
    const parsed = parseDocSource(SAMPLE);
    expect(parsed.headings.map((h) => h.slug)).toEqual([
      'backend-api',
      'authentication-flow',
      'endpoints',
    ]);
    expect(parsed.headings[0]?.depth).toBe(1);
    expect(parsed.headings[1]?.depth).toBe(2);
  });

  it('produces a body markdown without the frontmatter', () => {
    const parsed = parseDocSource(SAMPLE);
    expect(parsed.bodyMarkdown.trim().startsWith('# Backend API')).toBe(true);
  });

  it('falls back to a synthesized frontmatter when invalid, recording errors', () => {
    const bad = `---
description: Missing title
---

# Hello
`;
    const parsed = parseDocSource(bad);
    expect(parsed.validationErrors.length).toBeGreaterThan(0);
    expect(parsed.frontmatter.title).toBe('Untitled');
  });

  it('captures plain text body for indexing', () => {
    const parsed = parseDocSource(SAMPLE);
    expect(parsed.bodyText).toContain('Tokens are signed with HS256');
    expect(parsed.bodyText).not.toContain('# Backend API');
  });
});
