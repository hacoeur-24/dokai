import { describe, expect, it } from 'vitest';
import {
  buildAllowedHosts,
  filterForwardHeaders,
  isHostAllowed,
  parseTargetUrl,
  readRawBody,
} from './openapi-proxy.js';

describe('parseTargetUrl', () => {
  it('accepts http/https', () => {
    expect(parseTargetUrl('https://api.example.com/x')?.hostname).toBe('api.example.com');
    expect(parseTargetUrl('http://localhost:3000/x')?.hostname).toBe('localhost');
  });
  it('rejects non-http and garbage', () => {
    expect(parseTargetUrl('ftp://x/y')).toBeNull();
    expect(parseTargetUrl('not a url')).toBeNull();
    expect(parseTargetUrl(null)).toBeNull();
  });
});

describe('isHostAllowed', () => {
  const allowed = buildAllowedHosts({ settingsHosts: ['Api.Example.com'], specHosts: ['svc.local'] });
  it('always allows loopback', () => {
    expect(isHostAllowed('localhost', allowed)).toBe(true);
    expect(isHostAllowed('127.0.0.1', allowed)).toBe(true);
  });
  it('allows configured + spec hosts (case-insensitive)', () => {
    expect(isHostAllowed('api.example.com', allowed)).toBe(true);
    expect(isHostAllowed('svc.local', allowed)).toBe(true);
  });
  it('blocks the cloud metadata IP even if listed', () => {
    const withMeta = buildAllowedHosts({ settingsHosts: ['169.254.169.254'], specHosts: [] });
    expect(isHostAllowed('169.254.169.254', withMeta)).toBe(false);
  });
  it('denies unknown hosts', () => {
    expect(isHostAllowed('evil.example.org', allowed)).toBe(false);
  });
});

describe('filterForwardHeaders', () => {
  it('keeps authorization, drops hop-by-hop and host', () => {
    const out = filterForwardHeaders({
      host: 'localhost:8128',
      connection: 'keep-alive',
      'content-length': '10',
      authorization: 'Bearer abc',
      'content-type': 'application/json',
    });
    expect(out['authorization']).toBe('Bearer abc');
    expect(out['content-type']).toBe('application/json');
    expect(out['host']).toBeUndefined();
    expect(out['connection']).toBeUndefined();
    expect(out['content-length']).toBeUndefined();
  });
});

describe('readRawBody', () => {
  async function* gen(parts: string[]) {
    for (const p of parts) yield Buffer.from(p);
  }
  it('concatenates chunks', async () => {
    const buf = await readRawBody(gen(['ab', 'cd']) as AsyncIterable<Buffer>, 1024);
    expect(buf.toString('utf8')).toBe('abcd');
  });
  it('throws past the cap', async () => {
    await expect(readRawBody(gen(['abcdef']) as AsyncIterable<Buffer>, 3)).rejects.toThrow(/too large/i);
  });
});
