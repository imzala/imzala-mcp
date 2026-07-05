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
  // Backend response shape varies by deployment: older/raw returns
  // first_name/last_name/email; newer (KVKK "mask all") returns a pre-masked
  // `name` ("Ahmet Y.") + `email_masked`. All optional — read tolerantly
  // (see formatContractStatus). Never assume raw PII is present.
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  email_masked?: string;
  signed?: boolean;     // backend heuristic — do NOT trust; use signed_at.
  signed_at: string | null;
  rejected?: boolean;
  rejected_at?: string | null;
  signing_url?: string;
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

export interface CreateDemandPartyMapping {
  template_party_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  variables?: Record<string, string | number | boolean | null>;
}
export interface CreateDemandInput {
  templateId: string;
  partyMapping: CreateDemandPartyMapping[];
  variables?: Record<string, string | number | boolean | null>;
  /** false (default) = create-only, no messages. true = backend sends SMS+email immediately. */
  send: boolean;
  idempotencyKey?: string;
}
export interface CreateDemandSigningUrl {
  party_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  signing_url: string;
}
export interface CreateDemandResult {
  id: string;
  title: string;
  status: string;
  template_id: string;
  signing_urls: CreateDemandSigningUrl[];
  result_url: string;
  variables_applied: string[];
  dispatched: number;
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

// Extension → MIME map for the timestamp upload.
// WHY: the backend's POST /api/v1/timestamps returns an unhandled 500 when the
// multipart file part's Content-Type is `application/octet-stream` (which is
// what a browser/undici Blob defaults to when constructed without a `type`).
// A timestamp is MIME-agnostic (it only hashes bytes), so this is a backend
// bug — but the client-side mitigation is to send an accurate content-type
// derived from the file name. Covers the file kinds real eser-tescil uploads
// use (documents, images, archives). Unknown extensions fall back to
// octet-stream (still hits the backend bug until it is fixed server-side).
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml',
  rtf: 'application/rtf', md: 'text/markdown', html: 'text/html',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  gz: 'application/gzip',
  mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', mov: 'video/quicktime',
};

/** Best-effort MIME from a file name. Falls back to octet-stream if unknown. */
export function mimeFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
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
  createDemand(input: CreateDemandInput): Promise<CreateDemandResult>;
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
      // Set an explicit content-type: a type-less Blob defaults to
      // application/octet-stream, which the backend 500s on (see EXT_TO_MIME).
      new Blob([new Uint8Array(input.fileBuffer)], { type: mimeFromFileName(input.fileName) }),
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

  async function createDemand(input: CreateDemandInput): Promise<CreateDemandResult> {
    const body: Record<string, unknown> = {
      template_id: input.templateId,
      party_mapping: input.partyMapping,
    };
    if (input.variables !== undefined) body.variables = input.variables;
    // DEFAULT create-only: suppress the backend's send-immediately behavior.
    // Only when the caller explicitly opts in (send:true) do we omit the flag
    // so the API's default (send SMS+email to every party) takes effect.
    if (!input.send) body.dispatch_notifications = false;

    const headers: Record<string, string> = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
    if (input.idempotencyKey !== undefined) headers['Idempotency-Key'] = input.idempotencyKey;

    const res = await fetchFn(`${baseUrl}/api/v1/demands`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const parsed = await res.json() as { success: boolean; data: CreateDemandResult };
    return parsed.data;
  }

  return { getMe, createTimestamp, getDemand, listTemplates, getTemplate, downloadPdf, createDemand };
}
