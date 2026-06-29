export interface ImzalaClientOpts {
  apiKey: string;
  baseUrl: string;
  fetch: typeof fetch;
}

export interface MeResult {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  workspace: { type: 'personal' | 'organization'; organization_id: string | null };
  credits: { remaining: number };
}

export interface TimestampResult {
  id: string;
  timestamp_time: string;
  tsa_authority: string;
  file_sha256: string;
  verify_url: string;
  certificate_url: string;
  credits_used: number;
  credits_remaining: number;
}

export class ImzalaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ImzalaApiError';
  }
}

async function parseErrorBody(
  res: Response,
  status: number,
): Promise<ImzalaApiError> {
  try {
    const body = await res.json() as { error?: string; code?: string };
    return new ImzalaApiError(status, body.code, body.error ?? `HTTP ${status}`);
  } catch {
    return new ImzalaApiError(status, undefined, `HTTP ${status}`);
  }
}

export function makeClient(o: ImzalaClientOpts): {
  getMe(): Promise<MeResult>;
  createTimestamp(input: {
    fileBuffer: Buffer;
    fileName: string;
    description?: string;
    ownerFirstName?: string;
    ownerLastName?: string;
    idempotencyKey?: string;
  }): Promise<TimestampResult>;
} {
  const { apiKey, baseUrl, fetch: fetchFn } = o;

  async function getMe(): Promise<MeResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/me`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const body = await res.json() as { success: boolean; data: MeResult };
    return body.data;
  }

  async function createTimestamp(input: {
    fileBuffer: Buffer;
    fileName: string;
    description?: string;
    ownerFirstName?: string;
    ownerLastName?: string;
    idempotencyKey?: string;
  }): Promise<TimestampResult> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.fileBuffer)]),
      input.fileName,
    );
    if (input.description !== undefined) {
      form.append('description', input.description);
    }
    if (input.ownerFirstName !== undefined) {
      form.append('owner_first_name', input.ownerFirstName);
    }
    if (input.ownerLastName !== undefined) {
      form.append('owner_last_name', input.ownerLastName);
    }

    const headers: Record<string, string> = { 'X-API-Key': apiKey };
    if (input.idempotencyKey !== undefined) {
      headers['Idempotency-Key'] = input.idempotencyKey;
    }

    const res = await fetchFn(`${baseUrl}/api/v1/timestamps`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const body = await res.json() as { success: boolean; data: TimestampResult };
    return body.data;
  }

  return { getMe, createTimestamp };
}
