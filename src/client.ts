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

export interface ReminderPartyDetail {
  party_id: string;
  first_name: string;
  last_name: string;
  sms?: { status: 'sent' | 'failed' | 'skipped'; reason?: string };
  email?: { status: 'sent' | 'failed' | 'skipped'; reason?: string };
}
export interface ReminderResult {
  demand_id: string;
  demand_status: string;
  channels_requested: string[];
  reminders_sent: number;
  reminders_skipped: number;
  details: ReminderPartyDetail[];
}
export interface SendReminderInput {
  demandId: string;
  channels?: ('sms' | 'email')[];
  force?: boolean;
}

// ── Sözleşme listesi (GET /api/v1/demands) — counts-only, party PII yok ──
export interface DemandListItem {
  id: string;
  title: string | null;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  created_at: string;
  completed_at: string | null;
  parties_total: number;
  parties_signed: number;
  pdf_url: string | null;
}
export interface DemandListResult {
  demands: DemandListItem[];
  total: number;
  page: number;
  limit: number;
}
export interface ListDemandsInput {
  /** API status filtresi (PENDING/COMPLETED/CANCELLED/EXPIRED). Tool Türkçe `durum`'u buraya map eder. */
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

// ── Sözleşme iptal (POST /api/v1/demands/:id/cancel) ──
export interface CancelDemandResult {
  id: string;
  title: string | null;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  /** Yalnızca toplu (bulk) sözleşme iptalinde döner: iade edilen rezerve kredi. */
  refunded?: number;
}

// ── Kişi (Contact) — liste + oluştur. 🔴 KVKK: TC (government_id) YOK. ──
export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_id: string | null;
  company: { id: string; name: string | null } | null;
  notes: string | null;
  address_country: string | null;
  address_city: string | null;
  address_district: string | null;
  address_line: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface ContactListResult {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
}
export interface ListContactsInput {
  q?: string;
  page?: number;
  limit?: number;
}
export interface CreateContactInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  job_title?: string;
  address_country?: string;
  address_city?: string;
  address_district?: string;
  address_line?: string;
  // 🔴 government_id (TC) BİLEREK YOK — KVKK m.4/m.9: en hassas tanımlayıcı bu
  // kanaldan (yurt dışı AI sağlayıcısı) akmasın. Backend de kabul etmez.
}

// ── Zaman damgası listesi (GET /api/v1/timestamps) ──
export interface TimestampListItem {
  id: string;
  original_file_name: string;
  original_file_size: number | null;
  timestamp_date: string;
  status: string;
  description: string | null;
  created_at: string;
  /** S3 key / internal / Faz D şifreli — tarayıcıdan indirilebilir link DEĞİL. */
  timestamp_file_url: string;
}
export interface TimestampListResult {
  timestamps: TimestampListItem[];
  total: number;
  page: number;
  limit: number;
}
export interface ListTimestampsInput {
  page?: number;
  limit?: number;
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
  sendReminder(input: SendReminderInput): Promise<ReminderResult>;
  listDemands(input?: ListDemandsInput): Promise<DemandListResult>;
  cancelDemand(demandId: string, reason?: string): Promise<CancelDemandResult>;
  listContacts(input?: ListContactsInput): Promise<ContactListResult>;
  createContact(input: CreateContactInput): Promise<Contact>;
  listTimestamps(input?: ListTimestampsInput): Promise<TimestampListResult>;
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

  async function sendReminder(input: SendReminderInput): Promise<ReminderResult> {
    const body: Record<string, unknown> = {};
    if (input.channels !== undefined) body.channels = input.channels;
    if (input.force !== undefined) body.force = input.force;
    const res = await fetchFn(`${baseUrl}/api/v1/demands/${encodeURIComponent(input.demandId)}/reminders`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Reminders use a NESTED error envelope: { error: { code, message, retry_after_seconds } }
      let code: string | undefined; let message = `HTTP ${res.status}`;
      try {
        const b = await res.json() as { error?: { code?: string; message?: string } | string; code?: string };
        if (b.error && typeof b.error === 'object') { code = b.error.code; message = b.error.message ?? message; }
        else { code = b.code; message = (typeof b.error === 'string' ? b.error : message); }
      } catch { /* keep defaults */ }
      throw new ImzalaApiError(res.status, code, message);
    }
    const parsed = await res.json() as { success: boolean; data: ReminderResult };
    return parsed.data;
  }

  async function listDemands(input: ListDemandsInput = {}): Promise<DemandListResult> {
    const params = new URLSearchParams();
    params.set('page', String(input.page ?? 1));
    params.set('limit', String(input.limit ?? 20));
    if (input.q) params.set('q', input.q);
    if (input.status) params.set('status', input.status);
    const res = await fetchFn(`${baseUrl}/api/v1/demands?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const body = await res.json() as { success: boolean; data: DemandListResult };
    return body.data;
  }

  async function cancelDemand(demandId: string, reason?: string): Promise<CancelDemandResult> {
    const body: Record<string, unknown> = {};
    if (reason !== undefined && reason !== '') body.reason = reason;
    const res = await fetchFn(`${baseUrl}/api/v1/demands/${encodeURIComponent(demandId)}/cancel`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const parsed = await res.json() as { success: boolean; data: CancelDemandResult };
    return parsed.data;
  }

  async function listContacts(input: ListContactsInput = {}): Promise<ContactListResult> {
    const params = new URLSearchParams();
    params.set('page', String(input.page ?? 1));
    params.set('limit', String(input.limit ?? 20));
    if (input.q) params.set('q', input.q);
    const res = await fetchFn(`${baseUrl}/api/v1/contacts?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const body = await res.json() as { success: boolean; data: ContactListResult };
    return body.data;
  }

  async function createContact(input: CreateContactInput): Promise<Contact> {
    // 🔴 Yalnızca allowlist alanları gönderilir — government_id (TC) HİÇ eklenmez.
    const body: Record<string, unknown> = {
      first_name: input.first_name,
      last_name: input.last_name,
    };
    if (input.email !== undefined) body.email = input.email;
    if (input.phone !== undefined) body.phone = input.phone;
    if (input.job_title !== undefined) body.job_title = input.job_title;
    if (input.address_country !== undefined) body.address_country = input.address_country;
    if (input.address_city !== undefined) body.address_city = input.address_city;
    if (input.address_district !== undefined) body.address_district = input.address_district;
    if (input.address_line !== undefined) body.address_line = input.address_line;
    const res = await fetchFn(`${baseUrl}/api/v1/contacts`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const parsed = await res.json() as { success: boolean; data: Contact };
    return parsed.data;
  }

  async function listTimestamps(input: ListTimestampsInput = {}): Promise<TimestampListResult> {
    const params = new URLSearchParams();
    params.set('page', String(input.page ?? 1));
    params.set('limit', String(input.limit ?? 20));
    const res = await fetchFn(`${baseUrl}/api/v1/timestamps?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const body = await res.json() as { success: boolean; data: TimestampListResult };
    return body.data;
  }

  return {
    getMe, createTimestamp, getDemand, listTemplates, getTemplate, downloadPdf, createDemand, sendReminder,
    listDemands, cancelDemand, listContacts, createContact, listTimestamps,
  };
}
