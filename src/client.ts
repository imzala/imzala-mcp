import { SERVER_VERSION } from './version.js';

/** Her istekte gönderilen UA — backend MCP trafiğini `startsWith('imzala-mcp/')` ile ayrıştırır. */
const USER_AGENT = `imzala-mcp/${SERVER_VERSION}`;

export interface ImzalaClientOpts {
  apiKey: string;
  baseUrl: string;
  fetch: typeof fetch;
}

export interface ReportsResult {
  contracts: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    expired: number;
    this_month: number;
  };
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

export type DemandStatus = 'DRAFT' | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

/**
 * A document inside a contract's envelope (API 1.8.x+). Only the fields the
 * formatter renders are typed: `decisions[]` and `assigned_party_ids` carry
 * per-signer ids and are deliberately left out so they can never be printed.
 */
export interface DemandDocument {
  id: string;
  order: number;
  title: string;
  doc_kind: string;
  is_required?: boolean;
  signature_required?: boolean;
  progress?: { status?: string; decided_party_count?: number; active_assigned_party_count?: number };
  sealing?: { status?: string };
}

/** Term / renewal tracking (API 1.9.0+). `null` when no tracking is set. */
export interface ContractTerm {
  state?: string;
  end_date?: string | null;
  days_left?: number | null;
  renewal_type?: string | null;
  notice_deadline?: string | null;
}

export interface DemandStatusResult {
  id: string;
  title: string;
  status: DemandStatus;
  created_at: string;
  completed_at: string | null;
  parties: DemandParty[];
  result_url: string;
  pdf_url: string | null;
  /** Absent on API deployments older than 1.9.0 (tolerant read). */
  archived_at?: string | null;
  term?: ContractTerm | null;
  /** Absent before 1.8.x; `[]` on contracts that predate envelope documents. */
  documents?: DemandDocument[];
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

/**
 * A document inside a template's envelope. `id` is what the caller passes back
 * in `documents.include` / `documents.exclude` when creating a contract.
 *
 * NOTE: copying a template (panel "Kopyala", or "save as template" from a
 * contract) produces NEW document ids, so the ids must be re-read from
 * GET /templates/{id} for every template. Renaming/reordering keeps the id.
 */
export interface TemplateDocumentSummary {
  id: string;
  order: number;
  title: string;
  doc_kind: string;
  is_required: boolean;
  signature_required: boolean;
  default_included: boolean;
  assigned_template_party_ids: string[];
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
  /** Absent on API deployments older than 1.8.17 (tolerant read). */
  documents?: TemplateDocumentSummary[];
}

/**
 * Per-request override of the template's default document set. Omitted =
 * the template's `default_included` documents are sent. Max 20 ids per list
 * (the API rejects more with INVALID_DOCUMENT_SELECTION / reason `shape`).
 */
export interface DocumentSelectionInput {
  include?: string[];
  exclude?: string[];
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
  /** Optional per-request document selection; passed to the API unchanged. */
  documents?: DocumentSelectionInput;
  idempotencyKey?: string;
  /**
   * Bypasses the server's keyless duplicate guard (409 DUPLICATE_SUSPECTED:
   * same key, same template and parties, within 10 minutes). Only ever set
   * from an explicit user confirmation.
   */
  force?: boolean;
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
  /** Absent on a replayed idempotent response (`reused: true`). */
  variables_applied?: string[];
  dispatched?: number;
  /** true = same Idempotency-Key + same content: the EARLIER contract is returned, nothing new was created. */
  reused?: boolean;
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
  status: DemandStatus;
  created_at: string;
  completed_at: string | null;
  parties_total: number;
  parties_signed: number;
  pdf_url: string | null;
  archived_at?: string | null;
  term_end_date?: string | null;
}
export interface DemandListResult {
  demands: DemandListItem[];
  total: number;
  page: number;
  limit: number;
}
export interface ListDemandsInput {
  /** API status filtresi (DRAFT/PENDING/COMPLETED/CANCELLED/EXPIRED). Tool Türkçe `durum`'u buraya map eder. */
  status?: string;
  /** Arşiv filtresi. Verilmezse API arşivlileri de döndürür (panel listesinin tersi). */
  archived?: 'exclude' | 'only' | 'include';
  q?: string;
  /** Tarih aralığı başlangıcı (ISO YYYY-MM-DD). createdAt >= from. */
  from?: string;
  /** Tarih aralığı bitişi (ISO YYYY-MM-DD). createdAt <= to. */
  to?: string;
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

export interface DeleteDemandResult {
  id: string;
  deleted: boolean;
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
export interface TimelineEvent {
  id: string;
  event_type: string;
  actor_label: string | null;
  ip_masked: string | null;
  comment_text: string | null;
  created_at: string;
  metadata?: unknown;
}
export interface TimelineResult {
  events: TimelineEvent[];
}
export interface ListTimestampsInput {
  page?: number;
  limit?: number;
}

// ── Toplu sözleşme oluşturma (POST /api/v1/demands/bulk) ──
// Body şekli backend'e neredeyse birebir geçer (bkz. CreateDemandPartyMapping
// gibi snake_case wire-shape tipleri); wrapper (BulkCreateDemandsInput) bu
// yüzden camelCase DEĞİL, endpoint contract'ıyla aynı alan adlarını kullanır.
export interface BulkRow {
  party_mapping: any[];
  variables?: Record<string, string | number | boolean | null>;
  /**
   * Document selection is PER ROW on the bulk endpoint. Sending it at batch
   * level (`options.documents`) is rejected with INVALID_DOCUMENT_SELECTION.
   */
  documents?: DocumentSelectionInput;
}
export interface BulkRowResult {
  row_index: number;
  status: 'created' | 'failed';
  /** On a failed row this is the draft left behind by PARTY_WITHOUT_DOCUMENTS form (c). */
  demand_id?: string;
  signing_urls?: Array<{ first_name?: string; last_name?: string; signing_url: string }>;
  result_url?: string;
  dispatched?: number;
  error?: string;
  message?: string;
  /** error=INVALID_DOCUMENT_SELECTION: reason + the ids the caller sent. */
  details?: ImzalaApiErrorDetails;
  /** error=PARTY_WITHOUT_DOCUMENTS, row NOT created. */
  template_party_ids?: string[];
  /** error=PARTY_WITHOUT_DOCUMENTS, row created then demoted to a draft. */
  party_ids?: string[];
}
export interface BulkResult {
  template_id: string;
  total: number;
  created: number;
  failed: number;
  results: BulkRowResult[];
}
export interface BulkCreateDemandsInput {
  template_id: string;
  options?: Record<string, unknown>;
  rows: BulkRow[];
}

/**
 * Structured `details` payload carried by document-selection errors
 * (400 INVALID_DOCUMENT_SELECTION). `document_ids` only ever contains ids the
 * CALLER sent, so echoing them back leaks nothing.
 */
export interface ImzalaApiErrorDetails {
  reason?: string;
  document_ids?: string[];
}

/**
 * The structured extras a 1.8.17 error body can carry. Shared by
 * ImzalaApiError and the per-row failures of the bulk endpoint, which report
 * the very same codes and fields inside `results[i]`.
 */
export interface ImzalaApiErrorExtras {
  details?: ImzalaApiErrorDetails;
  /** 409 PARTY_WITHOUT_DOCUMENTS, forms (a)/(b): nothing was created. */
  templatePartyIds?: string[];
  /** 409 PARTY_WITHOUT_DOCUMENTS, form (c): a DRAFT contract DOES exist. */
  partyIds?: string[];
  /** `data.id` of the draft left behind by form (c). */
  demandId?: string;
  /** `data.status`, e.g. DRAFT_UNDISPATCHED. */
  demandStatus?: string;
  /** Seconds to wait before retrying (429). */
  retryAfterSeconds?: number;
}

export class ImzalaApiError extends Error {
  /** Present on 400 INVALID_DOCUMENT_SELECTION. */
  public readonly details?: ImzalaApiErrorDetails;
  /**
   * Present on 409 PARTY_WITHOUT_DOCUMENTS forms (a)/(b): the template role ids
   * that end up with no document, and the contract was NOT created. These are
   * the caller's own mapping ids (`party_mapping[].template_party_id`), so they
   * may be named back.
   */
  public readonly templatePartyIds?: string[];
  /**
   * Present on 409 PARTY_WITHOUT_DOCUMENTS form (c): the contract WAS created
   * and demoted to a draft. Distinguishing the two is what keeps a relaying
   * model from "safely" retrying and producing a second draft.
   */
  public readonly partyIds?: string[];
  public readonly demandId?: string;
  public readonly demandStatus?: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    // Additive 4th argument: every pre-existing 3-argument call site keeps working.
    extra?: ImzalaApiErrorExtras,
  ) {
    super(message);
    this.name = 'ImzalaApiError';
    this.details = extra?.details;
    this.templatePartyIds = extra?.templatePartyIds;
    this.partyIds = extra?.partyIds;
    this.demandId = extra?.demandId;
    this.demandStatus = extra?.demandStatus;
    this.retryAfterSeconds = extra?.retryAfterSeconds;
  }
}

// ── Error-body allowlist ────────────────────────────────────────────────────
// Everything an error body contributes to tool output passes through these
// validators. Tool output flows to a third-party AI provider, so a field is
// carried only when it has the exact shape we expect; free text never is.
const API_CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
const API_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const REASON_RE = /^[a-z][a-z_]{0,39}$/;

/** A machine code such as DUPLICATE_SUSPECTED; anything else is dropped. */
export function asApiCode(v: unknown): string | undefined {
  return typeof v === 'string' && API_CODE_RE.test(v) ? v : undefined;
}
/** An id-shaped token (UUID or slug); anything else is dropped. */
export function asApiId(v: unknown): string | undefined {
  return typeof v === 'string' && API_ID_RE.test(v) ? v : undefined;
}
function asApiIdList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ids = v.map(asApiId).filter((x): x is string => x !== undefined).slice(0, 20);
  return ids.length ? ids : undefined;
}
function asRetryAfter(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 3600 ? v : undefined;
}
function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
}

/**
 * Builds an ImzalaApiError from a parsed error body. Handles the three
 * envelopes /api/v1 uses:
 *   - flat   { error: "<text>", code: "<CODE>", data?: { id, status } }
 *   - coded-in-error { error: "<CODE>", demand_id? }  (duplicate guard,
 *     idempotency, AI_POLICY_UNAVAILABLE): `error` is read as a code ONLY when
 *     `code` is absent; with `code` present `error` is free text.
 *   - nested { error: { code, message, retry_after_seconds } }  (reminders)
 */
export function errorFromBody(status: number, raw: unknown): ImzalaApiError {
  const body = asObject(raw) ?? {};
  const nested = asObject(body.error);
  const code = nested
    ? asApiCode(nested.code)
    : body.code !== undefined ? asApiCode(body.code) : asApiCode(body.error);
  const data = asObject(body.data);
  const details = asObject(body.details);
  const reason = details && typeof details.reason === 'string' && REASON_RE.test(details.reason) ? details.reason : undefined;
  const documentIds = details ? asApiIdList(details.document_ids) : undefined;
  // The message is kept for debugging only; formatError never renders it.
  const message = typeof body.message === 'string' ? body.message
    : typeof body.error === 'string' ? body.error
    : nested && typeof nested.message === 'string' ? nested.message
    : `HTTP ${status}`;
  return new ImzalaApiError(status, code, message, {
    details: reason !== undefined || documentIds !== undefined ? { reason, document_ids: documentIds } : undefined,
    templatePartyIds: asApiIdList(body.template_party_ids),
    partyIds: asApiIdList(body.party_ids),
    demandId: asApiId(data?.id) ?? asApiId(body.demand_id),
    demandStatus: asApiCode(data?.status),
    retryAfterSeconds: asRetryAfter(nested ? nested.retry_after_seconds : body.retry_after_seconds),
  });
}

/** True when the buffer starts with the PDF magic bytes. */
export function isPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
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

/**
 * True only when the selection actually says something. `{}`,
 * `{ include: [] }` and `{ include: [], exclude: [] }` all mean "use the
 * template default", so they are not serialized.
 */
export function hasDocumentSelection(d: DocumentSelectionInput | undefined): d is DocumentSelectionInput {
  if (d === undefined) return false;
  return (d.include?.length ?? 0) > 0 || (d.exclude?.length ?? 0) > 0;
}

async function parseErrorBody(
  res: Response,
  status: number,
): Promise<ImzalaApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return new ImzalaApiError(status, undefined, `HTTP ${status}`);
  }
  return errorFromBody(status, body);
}

export function makeClient(o: ImzalaClientOpts): {
  getMe(): Promise<MeResult>;
  getReports(): Promise<ReportsResult>;
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
  downloadSignedPdf(demandId: string, documentId?: string): Promise<Buffer>;
  downloadCertificate(demandId: string): Promise<Buffer>;
  createDemand(input: CreateDemandInput): Promise<CreateDemandResult>;
  sendReminder(input: SendReminderInput): Promise<ReminderResult>;
  listDemands(input?: ListDemandsInput): Promise<DemandListResult>;
  cancelDemand(demandId: string, reason?: string): Promise<CancelDemandResult>;
  deleteDemand(demandId: string): Promise<DeleteDemandResult>;
  listContacts(input?: ListContactsInput): Promise<ContactListResult>;
  createContact(input: CreateContactInput): Promise<Contact>;
  listTimestamps(input?: ListTimestampsInput): Promise<TimestampListResult>;
  getDemandTimeline(demandId: string): Promise<TimelineResult>;
  bulkCreateDemands(input: BulkCreateDemandsInput, workspaceId?: string): Promise<BulkResult>;
} {
  const { apiKey, baseUrl, fetch: fetchFn } = o;

  async function getReports(): Promise<ReportsResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/reports`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const body = await res.json() as { success: boolean; data: ReportsResult };
    return body.data;
  }

  async function getMe(): Promise<MeResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/me`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
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

    const headers: Record<string, string> = { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT };
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
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
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
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
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
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const body = await res.json() as { success: boolean; data: TemplateDetailResult };
    return body.data;
  }

  // Shared by the two PDF endpoints. The signed-PDF endpoint answers 202 with a
  // plain-text body while the document is still being sealed, and `res.ok` is
  // true for 202, so the body is accepted only as status 200 + PDF magic bytes.
  async function fetchPdf(url: string): Promise<Buffer> {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    });
    if (res.status === 202) {
      throw new ImzalaApiError(202, 'SEALING_PENDING', 'sealing pending');
    }
    if (!res.ok) {
      throw await parseErrorBody(res, res.status);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.status !== 200 || !isPdf(buf)) {
      throw new ImzalaApiError(res.status, 'NOT_A_PDF', 'unexpected body');
    }
    return buf;
  }

  // İmzalı PDF — scope'lu v1 endpoint (X-API-Key ile, sahiplik + COMPLETED
  // kapısı sunucuda). Çok belgeli zarfta `documentId` verilmezse sunucu yalnız
  // ilk belgeyi döner; hangi belgenin istendiğini araç katmanı sorar.
  async function downloadSignedPdf(demandId: string, documentId?: string): Promise<Buffer> {
    const base = `${baseUrl}/api/v1/demands/${encodeURIComponent(demandId)}`;
    return fetchPdf(documentId ? `${base}/belge/${encodeURIComponent(documentId)}/pdf` : `${base}/pdf`);
  }

  // Tamamlanma/denetim sertifikası PDF'i — scope'lu v1 endpoint (X-API-Key ile).
  // Backend yalnız COMPLETED sözleşmede üretir (aksi 409); sahiplik doğrulanır.
  async function downloadCertificate(demandId: string): Promise<Buffer> {
    return fetchPdf(`${baseUrl}/api/v1/demands/${encodeURIComponent(demandId)}/certificate`);
  }

  async function createDemand(input: CreateDemandInput): Promise<CreateDemandResult> {
    const body: Record<string, unknown> = {
      template_id: input.templateId,
      party_mapping: input.partyMapping,
    };
    if (input.variables !== undefined) body.variables = input.variables;
    // Only serialized when the caller actually selected documents: a call
    // without a selection stays byte-identical to the pre-1.8.17 payload.
    // An empty selection ({} or two empty lists) is the same as "no selection":
    // dropping it keeps the payload byte-identical to a call without the field.
    if (hasDocumentSelection(input.documents)) body.documents = input.documents;
    // DEFAULT create-only: suppress the backend's send-immediately behavior.
    // Only when the caller explicitly opts in (send:true) do we omit the flag
    // so the API's default (send SMS+email to every party) takes effect.
    if (!input.send) body.dispatch_notifications = false;
    if (input.force === true) body.force = true;

    const headers: Record<string, string> = { 'X-API-Key': apiKey, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };
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
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify(body),
    });
    // Reminders use a NESTED error envelope ({ error: { code, message,
    // retry_after_seconds } }); errorFromBody reads it through the same allowlist.
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const parsed = await res.json() as { success: boolean; data: ReminderResult };
    return parsed.data;
  }

  async function listDemands(input: ListDemandsInput = {}): Promise<DemandListResult> {
    const params = new URLSearchParams();
    params.set('page', String(input.page ?? 1));
    params.set('limit', String(input.limit ?? 20));
    if (input.q) params.set('q', input.q);
    if (input.status) params.set('status', input.status);
    if (input.archived) params.set('archived', input.archived);
    if (input.from) params.set('from', input.from);
    if (input.to) params.set('to', input.to);
    const res = await fetchFn(`${baseUrl}/api/v1/demands?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
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
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const parsed = await res.json() as { success: boolean; data: CancelDemandResult };
    return parsed.data;
  }

  async function deleteDemand(demandId: string): Promise<DeleteDemandResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/demands/${encodeURIComponent(demandId)}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const parsed = await res.json() as { success: boolean; data: DeleteDemandResult };
    return parsed.data;
  }

  async function listContacts(input: ListContactsInput = {}): Promise<ContactListResult> {
    const params = new URLSearchParams();
    params.set('page', String(input.page ?? 1));
    params.set('limit', String(input.limit ?? 20));
    if (input.q) params.set('q', input.q);
    const res = await fetchFn(`${baseUrl}/api/v1/contacts?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
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
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
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
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const body = await res.json() as { success: boolean; data: TimestampListResult };
    return body.data;
  }

  async function getDemandTimeline(demandId: string): Promise<TimelineResult> {
    const res = await fetchFn(`${baseUrl}/api/v1/demands/${encodeURIComponent(demandId)}/timeline`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw await parseErrorBody(res, res.status);
    const body = await res.json() as { success: boolean; data: TimelineResult };
    return body.data;
  }

  // Bulk endpoint envelope differs from the standard {error, code} shape (see
  // sendReminder above for another endpoint-specific precedent): success can
  // be false on a 2xx response (e.g. whole-request rejection before any row
  // is processed), and the message field takes priority over `error`. Parse
  // defensively (non-JSON body must still map to ImzalaApiError, not throw a
  // raw SyntaxError) — mirrors parseErrorBody's robustness.
  async function bulkCreateDemands(input: BulkCreateDemandsInput, workspaceId?: string): Promise<BulkResult> {
    const headers: Record<string, string> = { 'X-API-Key': apiKey, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    // Same empty-selection rule as the single-create path, applied per row.
    const rows = input.rows.map((r) => {
      if (r.documents === undefined || hasDocumentSelection(r.documents)) return r;
      const { documents: _dropped, ...rest } = r;
      return rest;
    });
    const res = await fetchFn(`${baseUrl}/api/v1/demands/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, rows }),
    });
    let json: { success?: boolean; data?: BulkResult; message?: string; error?: string; code?: string } | undefined;
    try {
      json = await res.json() as typeof json;
    } catch {
      // non-JSON body — falls through to the generic HTTP-status error below.
    }
    if (!res.ok || !json?.success) throw errorFromBody(res.status, json);
    return json.data as BulkResult;
  }

  return {
    getMe, getReports, createTimestamp, getDemand, listTemplates, getTemplate, downloadSignedPdf, createDemand, sendReminder,
    listDemands, cancelDemand, deleteDemand, listContacts, createContact, listTimestamps, getDemandTimeline, downloadCertificate,
    bulkCreateDemands,
  };
}
