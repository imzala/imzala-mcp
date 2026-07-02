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

export interface DemandParty {
  party_id: string;
  first_name: string;
  last_name: string;
  email: string;
  signed: boolean;      // NOTE: backend bug — counts all fields; do NOT trust. Use signed_at.
  signed_at: string | null;
  signing_url: string;
}

export interface DemandStatusResult {
  id: string;
  title: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  created_at: string;
  completed_at: string | null;
  parties: DemandParty[];
  result_url: string;
  pdf_url: string | null;
}

export interface TemplatePartyBrief {
  id: string;
  order: number;
  label: string;
  is_required: boolean;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  usage_count: number;
  parties: TemplatePartyBrief[];
}

export interface TemplateListResult {
  templates: TemplateListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface TemplateVariable {
  slug: string;
  label: string;
  item_type: string;
  is_required: boolean;
  default_source: string | null;
}

export interface TemplateDetailResult {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  usage_count: number;
  parties: TemplatePartyBrief[];
  pages_count: number;
  variables: TemplateVariable[];
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
  getDemand(id: string): Promise<DemandStatusResult>;
  listTemplates(page?: number, limit?: number): Promise<TemplateListResult>;
  getTemplate(id: string): Promise<TemplateDetailResult>;
  downloadPdf(url: string): Promise<Buffer>;
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

  async function getDemand(id: string): Promise<DemandStatusResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/demands/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const body = await res.json() as { success: boolean; data: DemandStatusResult };
    return body.data;
  }

  async function listTemplates(page = 1, limit = 20): Promise<TemplateListResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/templates?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const body = await res.json() as { success: boolean; data: TemplateListResult };
    return body.data;
  }

  async function getTemplate(id: string): Promise<TemplateDetailResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/templates/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const body = await res.json() as { success: boolean; data: TemplateDetailResult };
    return body.data;
  }

  async function downloadPdf(url: string): Promise<Buffer> {
    const res = await fetchFn(url, { method: 'GET' });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  return { getMe, createTimestamp, getDemand, listTemplates, getTemplate, downloadPdf };
}
