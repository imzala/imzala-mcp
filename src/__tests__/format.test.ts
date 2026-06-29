import { describe, test, expect } from 'vitest';
import { formatWhoami, formatError } from '../format.js';
import { ImzalaApiError, type MeResult } from '../client.js';

const personalMe: MeResult = {
  id: 'u1',
  email: 'test@example.com',
  first_name: 'Ahmet',
  last_name: 'Yılmaz',
  workspace: { type: 'personal', organization_id: null },
  credits: { remaining: 5 },
};

const orgMe: MeResult = {
  id: 'u2',
  email: 'org@company.com',
  first_name: 'Mehmet',
  last_name: 'Kaya',
  workspace: { type: 'organization', organization_id: 'org-abc-123' },
  credits: { remaining: 100 },
};

describe('formatWhoami', () => {
  test('includes email', () => {
    expect(formatWhoami(personalMe)).toContain('test@example.com');
  });

  test('shows "Kişisel" for personal workspace', () => {
    expect(formatWhoami(personalMe)).toContain('Kişisel');
  });

  test('shows "Organizasyon" and org_id for org workspace', () => {
    const text = formatWhoami(orgMe);
    expect(text).toContain('Organizasyon');
    expect(text).toContain('org-abc-123');
  });

  test('includes remaining credits', () => {
    expect(formatWhoami(personalMe)).toContain('5');
  });

  test('includes full name', () => {
    const text = formatWhoami(personalMe);
    expect(text).toContain('Ahmet');
    expect(text).toContain('Yılmaz');
  });
});

describe('formatError — redaction', () => {
  test('401 returns auth failure message mentioning IMZALA_API_KEY', () => {
    const text = formatError(new ImzalaApiError(401, 'UNAUTHORIZED', 'Bad key'));
    expect(text).toContain('IMZALA_API_KEY');
    expect(text.toLowerCase()).toContain('kimlik');
  });

  test('403 INSUFFICIENT_SCOPE mentions timestamps and dashboard', () => {
    const text = formatError(new ImzalaApiError(403, 'INSUFFICIENT_SCOPE', 'Forbidden'));
    expect(text).toContain('timestamps');
    expect(text.toLowerCase()).toContain('dashboard');
  });

  test('402 / INSUFFICIENT_CREDITS mentions kredi', () => {
    const text = formatError(new ImzalaApiError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits'));
    expect(text.toLowerCase()).toContain('kredi');
  });

  test('503 / TSA_UNAVAILABLE says service unavailable', () => {
    const text = formatError(new ImzalaApiError(503, 'TSA_UNAVAILABLE', 'Down'));
    expect(text.toLowerCase()).toContain('kullanılamıyor');
  });

  test('422 / BAD_BASE64 mentions base64', () => {
    const text = formatError(new ImzalaApiError(422, 'BAD_BASE64', 'Bad base64'));
    expect(text.toLowerCase()).toContain('base64');
  });

  test('422 / STAMP_INVALID mentions zaman damgası', () => {
    const text = formatError(new ImzalaApiError(422, 'STAMP_INVALID', 'Stamp failed'));
    expect(text.toLowerCase()).toContain('zaman damgası');
  });

  test('unknown ImzalaApiError uses code/status — never raw message', () => {
    const text = formatError(new ImzalaApiError(500, 'INTERNAL_ERROR', 'secret-host.internal crashed'));
    expect(text).toContain('INTERNAL_ERROR');
    expect(text).not.toContain('secret-host');
    expect(text).not.toContain('crashed');
  });

  test('non-ImzalaApiError (TypeError network failure) returns ulaşılamadı', () => {
    const text = formatError(new TypeError('fetch failed'));
    expect(text).toContain('ulaşılamadı');
  });

  test('none of the outputs contain a hostname', () => {
    const cases = [
      new ImzalaApiError(401, undefined, 'https://api-prd.imzala.org is wrong'),
      new ImzalaApiError(403, 'INSUFFICIENT_SCOPE', 'X'),
      new ImzalaApiError(402, 'INSUFFICIENT_CREDITS', 'X'),
      new ImzalaApiError(503, 'TSA_UNAVAILABLE', 'X'),
      new TypeError('connect to https://internal.svc failed'),
    ];
    for (const e of cases) {
      const text = formatError(e);
      expect(text, `leaked in: "${text}"`).not.toMatch(/https?:\/\//);
      expect(text, `leaked in: "${text}"`).not.toContain('.svc');
    }
  });

  test('none of the outputs contain an API key pattern', () => {
    const text = formatError(new ImzalaApiError(401, undefined, 'imz_abc123xyz is invalid'));
    expect(text).not.toContain('imz_');
  });

  test('none of the outputs contain a stack trace', () => {
    const err = new Error('something internal');
    const text = formatError(err);
    expect(text).not.toContain('    at ');
  });
});
