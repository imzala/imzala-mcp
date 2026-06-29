import { describe, test, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEserTescil } from '../tools/eserTescil.js';
import type { makeClient } from '../client.js';
import { ImzalaApiError, type TimestampResult } from '../client.js';
import type { ResolveClient } from '../tools/whoami.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrivateServer = { _registeredTools: Record<string, { handler: (...a: any[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> }> };

const okResult: TimestampResult = {
  id: 't1',
  timestamp_time: '2026-06-29T12:00:00.000Z',
  tsa_authority: 'TÜBİTAK KAMU SM',
  file_sha256: 'a'.repeat(64),
  verify_url: 'https://imzala.org/dogrula?seri=t1',
  certificate_url: 'https://imzala.org/dogrula?seri=t1',
  credits_used: 4,
  credits_remaining: 6,
};

/** Valid canonical base64 for the string "hello" */
const VALID_B64 = Buffer.from('hello').toString('base64'); // 'aGVsbG8='

function makeResolveWithTimestamp(
  createTimestamp: () => Promise<TimestampResult>,
): ResolveClient {
  const client = { createTimestamp } as unknown as ReturnType<typeof makeClient>;
  return async () => ({ client });
}

function makeResolveWithError(errorText: string): ResolveClient {
  return async () => ({ errorText });
}

async function callHandler(
  resolveClient: ResolveClient,
  args: Record<string, unknown>,
) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerEserTescil(server, resolveClient);
  const tools = (server as unknown as PrivateServer)._registeredTools;
  return tools['eser_tescil'].handler(args, {});
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('eser_tescil: input validation', () => {
  test('neither file_path nor file_base64 → isError', async () => {
    const resolveClient = vi.fn() as unknown as ResolveClient;
    const result = await callHandler(resolveClient, { file_name: 'test.pdf' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('file_path');
    expect(result.content[0].text).toContain('file_base64');
    // resolveClient must NOT be called for input-level errors
    expect(resolveClient).not.toHaveBeenCalled();
  });

  test('both file_path and file_base64 → isError', async () => {
    const resolveClient = vi.fn() as unknown as ResolveClient;
    const result = await callHandler(resolveClient, {
      file_path: '/tmp/a.pdf',
      file_base64: VALID_B64,
      file_name: 'test.pdf',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('file_path');
    expect(result.content[0].text).toContain('file_base64');
    expect(resolveClient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// base64 validation
// ---------------------------------------------------------------------------

describe('eser_tescil: base64 validation', () => {
  test('non-canonical base64 ("abcde") → isError, does NOT call client', async () => {
    const createTimestamp = vi.fn();
    const resolveClient = vi.fn().mockResolvedValue({
      client: { createTimestamp },
    }) as unknown as ResolveClient;

    const result = await callHandler(resolveClient, {
      file_base64: 'abcde',
      file_name: 'test.pdf',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('base64');
    // Client must not be called — resolveClient is not reached for base64 input errors
    expect(createTimestamp).not.toHaveBeenCalled();
    expect(resolveClient).not.toHaveBeenCalled();
  });

  test('data-URL prefix → isError, does NOT call client', async () => {
    const createTimestamp = vi.fn();
    const resolveClient = vi.fn().mockResolvedValue({
      client: { createTimestamp },
    }) as unknown as ResolveClient;

    const result = await callHandler(resolveClient, {
      file_base64: 'data:application/pdf;base64,aGVsbG8=',
      file_name: 'test.pdf',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('base64');
    expect(createTimestamp).not.toHaveBeenCalled();
    expect(resolveClient).not.toHaveBeenCalled();
  });

  test('URL-safe base64 with "-" → isError (not standard canonical)', async () => {
    const createTimestamp = vi.fn();
    const resolveClient = vi.fn().mockResolvedValue({
      client: { createTimestamp },
    }) as unknown as ResolveClient;

    const result = await callHandler(resolveClient, {
      // URL-safe base64: replaces + with - and / with _
      file_base64: 'aGVs-G8=',
      file_name: 'test.pdf',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('base64');
    expect(createTimestamp).not.toHaveBeenCalled();
    expect(resolveClient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('eser_tescil: happy path', () => {
  async function getHappyOutput(): Promise<string> {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => okResult),
      { file_base64: VALID_B64, file_name: 'belge.pdf' },
    );
    expect(result.isError).toBeUndefined();
    return result.content[0].text;
  }

  test('result is not an error', async () => {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => okResult),
      { file_base64: VALID_B64, file_name: 'belge.pdf' },
    );
    expect(result.isError).toBeUndefined();
  });

  test('output contains "zaman damgası"', async () => {
    expect(await getHappyOutput()).toContain('zaman damgası');
  });

  test('output contains "Kanıtlar"', async () => {
    expect(await getHappyOutput()).toContain('Kanıtlar');
  });

  test('output contains "Kanıtlamaz"', async () => {
    expect(await getHappyOutput()).toContain('Kanıtlamaz');
  });

  test('output contains verify_url with ?seri=', async () => {
    expect(await getHappyOutput()).toContain('?seri=t1');
  });

  test('output contains file SHA-256', async () => {
    expect(await getHappyOutput()).toContain('a'.repeat(64));
  });

  test('output contains "Yapay zekâ asistanına" directive', async () => {
    const output = await getHappyOutput();
    expect(output).toContain('Yapay zekâ asistanına');
    expect(output).toContain('EKLEMEYİN');
  });

  test('output contains file name and tsa_authority', async () => {
    const output = await getHappyOutput();
    expect(output).toContain('belge.pdf');
    expect(output).toContain('TÜBİTAK KAMU SM');
  });

  test('output contains remaining credits', async () => {
    expect(await getHappyOutput()).toContain('6');
  });

  // -------------------------------------------------------------------------
  // Forbidden string assertions on main content (excluding AI directive)
  // -------------------------------------------------------------------------

  test('main content has no false claim: "tescil edildi"', async () => {
    const output = await getHappyOutput();
    // Strip AI directive (it quotes forbidden phrases for instructional purposes)
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toContain('tescil edildi');
  });

  test('main content has no false claim: "telif hakkı alındı"', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toContain('telif hakkı alındı');
  });

  test('main content has no false claim: "yasal koruma" (sağlandı)', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toContain('yasal koruma');
  });

  test('main content has no false claim: "eser sahibi oldunuz"', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toContain('eser sahibi oldunuz');
  });

  test('main content has no false claim: "imzalandı"', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toContain('imzalandı');
  });

  test('output contains no em dash (—)', async () => {
    expect(await getHappyOutput()).not.toContain('—');
  });

  test('main content contains "noter onayı veya telif tescili" in negation', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).toContain('noter onayı veya telif tescili');
  });

  test('main content has no positive claim: "noter onaylı"', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toMatch(/noter onaylı/i);
  });

  test('main content has no positive claim: "noter tasdikli"', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toMatch(/noter tasdikli/i);
  });

  test('main content has no positive claim: "telif tescili yapıldı"', async () => {
    const output = await getHappyOutput();
    const mainContent = output.replace(/\(Yapay zekâ asistanına:[\s\S]*\)$/, '').trim();
    expect(mainContent).not.toMatch(/telif tescili yapıldı/i);
  });

  test('output contains no "kesin delil"', async () => {
    expect(await getHappyOutput()).not.toContain('kesin delil');
  });

  test('output contains no API key pattern (imz_)', async () => {
    expect(await getHappyOutput()).not.toContain('imz_');
  });

  test('output contains no internal service hostname (.svc)', async () => {
    expect(await getHappyOutput()).not.toContain('.svc');
  });

  test('https:// URLs in output are only for imzala.org/dogrula', async () => {
    const output = await getHappyOutput();
    const urls = output.match(/https:\/\/\S+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0); // at least the verify_url
    for (const url of urls) {
      expect(url, `unexpected https URL in output: ${url}`).toMatch(
        /^https:\/\/imzala\.org\/dogrula/,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Missing API key
// ---------------------------------------------------------------------------

describe('eser_tescil: missing API key', () => {
  test('missing key → isError with API key mention', async () => {
    const result = await callHandler(
      makeResolveWithError('IMZALA_API_KEY ayarlı değil — kurulum için README'),
      { file_base64: VALID_B64, file_name: 'test.pdf' },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('IMZALA_API_KEY');
  });
});

// ---------------------------------------------------------------------------
// API error paths
// ---------------------------------------------------------------------------

describe('eser_tescil: API error paths', () => {
  test('402 INSUFFICIENT_CREDITS → isError, mentions yetersiz kredi', async () => {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => {
        throw new ImzalaApiError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits');
      }),
      { file_base64: VALID_B64, file_name: 'test.pdf' },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('yetersiz');
    expect(result.content[0].text.toLowerCase()).toContain('kredi');
    // Must NOT leak internal details
    expect(result.content[0].text).not.toContain('imz_');
    expect(result.content[0].text).not.toMatch(/https?:\/\//);
  });

  test('503 TSA_UNAVAILABLE → isError, mentions kullanılamıyor', async () => {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => {
        throw new ImzalaApiError(503, 'TSA_UNAVAILABLE', 'TSA down');
      }),
      { file_base64: VALID_B64, file_name: 'test.pdf' },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('kullanılamıyor');
  });

  test('422 BAD_BASE64 from API → isError, mentions base64', async () => {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => {
        throw new ImzalaApiError(422, 'BAD_BASE64', 'Invalid base64');
      }),
      { file_base64: VALID_B64, file_name: 'test.pdf' },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain('base64');
  });

  test('network error → isError, mentions ulaşılamadı', async () => {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => {
        throw new TypeError('fetch failed');
      }),
      { file_base64: VALID_B64, file_name: 'test.pdf' },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ulaşılamadı');
  });

  test('error output has no hostname or stack trace', async () => {
    const result = await callHandler(
      makeResolveWithTimestamp(async () => {
        throw new ImzalaApiError(500, 'INTERNAL_ERROR', 'crash on minio.imzala-storage.svc');
      }),
      { file_base64: VALID_B64, file_name: 'test.pdf' },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain('.svc');
    expect(result.content[0].text).not.toContain('minio');
    expect(result.content[0].text).not.toMatch(/https?:\/\//);
    expect(result.content[0].text).not.toContain('    at ');
  });
});

// ---------------------------------------------------------------------------
// file_path happy path
// ---------------------------------------------------------------------------

describe('eser_tescil: file_path happy path', () => {
  test('reads temp file, calls client once, output contains verify_url', async () => {
    const { tmpdir } = await import('node:os');
    const { writeFile, unlink } = await import('node:fs/promises');

    const tmpPath = `${tmpdir()}/eser-tescil-test-${Date.now()}.pdf`;
    await writeFile(tmpPath, Buffer.from('test pdf content for eser_tescil'));

    const createTimestampSpy = vi.fn().mockResolvedValue(okResult);
    const resolveClient = makeResolveWithTimestamp(() => createTimestampSpy());

    try {
      const result = await callHandler(resolveClient, {
        file_path: tmpPath,
        file_name: 'belge.pdf',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('?seri=t1');
      expect(createTimestampSpy).toHaveBeenCalledOnce();
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  });
});
