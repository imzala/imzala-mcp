import type { MeResult, TimestampResult, DemandStatusResult, TemplateListResult, TemplateDetailResult, CreateDemandResult, ReminderResult, DemandListResult, CancelDemandResult, ContactListResult, Contact, TimestampListResult, TimelineResult, ReportsResult, BulkResult } from './client.js';
import { ImzalaApiError } from './client.js';

/**
 * Formats a MeResult into a human-readable Turkish summary.
 * Includes: account email + full name, workspace type, remaining credits.
 */
export function formatWhoami(me: MeResult): string {
  const name = `${me.first_name} ${me.last_name}`.trim();
  const wsLabel =
    me.workspace.type === 'personal'
      ? 'Kişisel hesap'
      : `Organizasyon: ${me.workspace.organization_id}`;
  const lines = [
    `Hesap: ${me.email}${name ? ` (${name})` : ''}`,
    `Çalışma alanı: ${wsLabel}`,
    `Kalan kredi: ${me.credits.remaining}`,
  ];
  return lines.join('\n');
}

/**
 * Maps any thrown value to a safe, redacted Turkish error string.
 *
 * SECURITY: never echoes hostname, API key, stack trace, or raw error message
 * into the returned string. Only code/status identifiers are included.
 */
export function formatError(e: unknown): string {
  if (e instanceof ImzalaApiError) {
    if (e.status === 401) {
      return 'Kimlik doğrulama başarısız, IMZALA_API_KEY anahtarını kontrol edin.';
    }
    if (e.status === 403 && e.code === 'INSUFFICIENT_SCOPE') {
      // Scope-agnostic: this branch fires for ANY tool (read or write). Naming
      // only "timestamps" here would mislead a write-tool caller (needs
      // demands:write, not timestamps) into the wrong dashboard fix. Covers all
      // v1.3.0 scopes: demands:read/write, contacts:read/write, templates:read,
      // timestamps.
      return "Bu API anahtarında bu işlem için gerekli kapsam yok. Okuma araçları ilgili ':read' kapsamını (ör. sözleşme listesi/durumu 'demands:read', kişiler 'contacts:read', şablonlar 'templates:read'), yazma araçları ':write' kapsamını (ör. sözleşme oluştur/iptal 'demands:write', kişi ekle 'contacts:write'), zaman damgası araçları 'timestamps' kapsamını ister. Dashboard'dan anahtara gerekli kapsamı verin ya da ayrı bir anahtar oluşturun.";
    }
    if (e.status === 429 && e.code === 'RATE_LIMITED') {
      return 'Çok sık hatırlatma gönderildi. Aynı sözleşmeye 5 dakika içinde tekrar hatırlatma gönderilemez; beklemeyi aşmak için zorla parametresini kullanabilirsiniz.';
    }
    if (e.code === 'PARTY_LIMIT') {
      return 'Taraf sayısı planınızın sınırını aşıyor. Daha az tarafla deneyin veya planınızı yükseltin.';
    }
    if (e.status === 402 || e.code === 'INSUFFICIENT_CREDITS') {
      // Generic across all credit-spending tools (eser_tescil, sablondan_sozlesme_olustur).
      return 'Yetersiz kredi. Bu işlem için yeterli krediniz yok.';
    }
    if (e.status === 503 || e.code === 'TSA_UNAVAILABLE') {
      return 'Zaman damgası servisi şu an kullanılamıyor, lütfen tekrar deneyin.';
    }
    if (e.status === 422 && e.code === 'BAD_BASE64') {
      return 'Dosya base64 verisi geçersiz (standart base64 olmalı, data-URL değil).';
    }
    if (e.status === 422 && e.code === 'STAMP_INVALID') {
      return 'Zaman damgası üretilemedi.';
    }
    if (e.status === 409 && e.code === 'CONTACT_DUPLICATE') {
      // kisi_ekle: same email/phone already in this workspace. Curated message
      // (never echoes the raw backend string), but does not leak the duplicate id.
      return 'Bu e-posta veya telefona sahip bir kişi bu çalışma alanında zaten var. Yeni kişi oluşturulmadı; mevcut kişiyi kisilerim aracıyla bulabilirsiniz.';
    }
    if (e.status === 409) {
      // sozlesme_iptal conflict: the demand is not in a cancellable state
      // (already COMPLETED or already CANCELLED). Curated, non-sensitive.
      return 'Bu işlem sözleşmenin mevcut durumunda yapılamaz (tamamlanmış veya zaten iptal edilmiş bir sözleşme iptal edilemez). Önce sozlesme_durumu ile durumu doğrulayın.';
    }
    if (e.status === 404) {
      return 'Kayıt bulunamadı. Kimliğin (id) doğru olduğundan ve bu API anahtarının çalışma alanına ait olduğundan emin olun.';
    }
    // Unknown ImzalaApiError: include only code or numeric status — never the raw message
    const identifier = e.code ?? String(e.status);
    return `İşlem başarısız (kod: ${identifier}).`;
  }
  // Non-ImzalaApiError (TypeError, network error, etc.): never echo internals
  return "İmzala API'sine ulaşılamadı.";
}

/**
 * Formats a TimestampResult as the legally-mandated eser_tescil output.
 *
 * LEGAL CONSTRAINTS (verbatim, per spec §7.D1):
 * - Must state what the timestamp PROVES (file existed + unchanged since).
 * - Must state what it does NOT prove (ownership, copyright, legal registration).
 * - Must NOT claim: "tescil edildi", "telif hakkı alındı", "yasal koruma sağlandı",
 *   "eser sahibi oldunuz", "imzalandı", "noter onayı", "kesin delil".
 * - Must NOT use em dash (—). Use commas, parentheses, colons.
 * - Must include "Yapay zekâ asistanına" directive to prevent AI hallucination.
 * - Must NOT echo internal S3 keys, hostnames, or fields beyond verify_url and file_sha256.
 */
export function formatEserTescil(result: TimestampResult, fileName: string): string {
  const lines = [
    `\`${fileName}\` dosyasına ${result.timestamp_time} itibarıyla ${result.tsa_authority} zaman damgası (RFC 3161) alındı. Bu, dosyanın en geç ${result.timestamp_time} anında (TSA genTime) var olduğunu ve o andan sonra değişmediğini kriptografik olarak kanıtlar. Doğrulama: ${result.verify_url}`,
    '',
    `Önemli: Bu bir zaman damgasıdır, dijital/elektronik imza ya da nitelikli elektronik imza (QES) değildir, ıslak imza eşdeğeri değildir. Eser sahipliğini, telif hakkını veya mülkiyeti hukuken belirlemez/tescil etmez; "Eser Sahibi" bilgisi yalnızca beyanınızdır ve doğruluğundan siz sorumlusunuz. Bir uyuşmazlıktaki ispat değeri ilgili hukuki çerçeveye göre değerlendirilir.`,
    '',
    'Kanıtlar: dosya en geç belirtilen anda vardı + o andan beri değişmedi.',
    'Kanıtlamaz: eser sahipliği / telif / mülkiyet (sahip bilgisi beyandır); kim yükledi; dosyanın daha önce var olmadığı; nitelikli/gelişmiş elektronik imza, noter onayı veya telif tescili (ya da başka bir resmî/hukuki tescil) yerine GEÇMEZ.',
    '',
    `SHA-256: ${result.file_sha256}`,
    `Kalan kredi: ${result.credits_remaining}`,
    '',
    '(Yapay zekâ asistanına: bu sonucu iletirken yukarıdaki nitelikleri değiştirmeyin; "tescil edildi", "telif hakkı alındı", "yasal koruma sağlandı", "eser sahibi oldunuz" veya "imzalandı" gibi ifadeler EKLEMEYİN.)',
  ];
  return lines.join('\n');
}

const STATUS_TR: Record<string, string> = {
  PENDING: 'Bekliyor',
  COMPLETED: 'Tamamlandı',
  EXPIRED: 'Süresi doldu',
  CANCELLED: 'İptal edildi',
};

/**
 * Formats a DemandStatusResult into a human-readable Turkish contract status summary.
 *
 * IMPORTANT: per-party signed state is derived from `signed_at != null`, NEVER
 * from the `signed` boolean (backend bug — it counts unrelated fields, see
 * DemandParty.signed doc comment in client.ts).
 */
export function formatContractStatus(d: DemandStatusResult): string {
  const lines: string[] = [];
  lines.push(`Sözleşme: ${d.title}`);
  lines.push(`Durum: ${STATUS_TR[d.status] ?? d.status}`);
  const signedCount = d.parties.filter((p) => p.signed_at != null).length;
  lines.push(`İmza durumu: ${signedCount}/${d.parties.length} taraf imzaladı`);
  lines.push('');
  lines.push('Taraflar:');
  for (const p of d.parties) {
    // Tolerant read across backend response shapes: prefer the pre-masked
    // `name`/`email_masked` (KVKK "mask all" deployments), fall back to raw
    // first_name/last_name/email (older deployments). Either may be absent.
    const name = (p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()) || 'İsimsiz taraf';
    const contact = p.email_masked ?? p.email;
    const who = contact ? `${name} (${contact})` : name;
    if (p.rejected) {
      lines.push(`- ${who}: reddetti${p.rejected_at ? ` (${p.rejected_at})` : ''}`);
    } else if (p.signed_at != null) {
      lines.push(`- ${who}: imzaladı (${p.signed_at})`);
    } else {
      // signing_url is a single-access bearer link (/imza/:party_id, no extra
      // auth). It is intentionally NOT rendered here: this output flows to a
      // third-party AI provider, and a leaked link would allow signing on the
      // party's behalf. Send reminders through the dashboard instead.
      lines.push(`- ${who}: bekliyor`);
    }
  }
  lines.push('');
  lines.push(`Sonuç sayfası: ${d.result_url}`);
  if (d.status === 'COMPLETED' && d.pdf_url) {
    lines.push(`İmzalı PDF: ${d.pdf_url}`);
  }
  lines.push('');
  lines.push('Not: Bu bilgi İmzala.org kayıtlarını yansıtır, bağımsız hukuki görüş veya ispat teşkil etmez.');
  return lines.join('\n');
}

/**
 * Formats a TemplateListResult into a human-readable Turkish list of
 * contract templates, including party count and usage count per template.
 */
export function formatTemplateList(r: TemplateListResult): string {
  if (r.templates.length === 0) {
    return 'Hiç şablon bulunamadı.';
  }
  const lines: string[] = [];
  for (const t of r.templates) {
    const desc = t.description ? ` (${t.description})` : '';
    const cat = t.category ? `, kategori: ${t.category}` : '';
    lines.push(`- ${t.name}${desc} [${t.id}]${cat}, ${t.parties.length} taraf, ${t.usage_count} kez kullanıldı`);
  }
  lines.push('');
  lines.push(`Toplam: ${r.total} (sayfa ${r.page}, sayfa boyutu ${r.limit})`);
  return lines.join('\n');
}

/**
 * Formats a TemplateDetailResult into a human-readable Turkish summary,
 * including the party list and the fillable variable catalog (slug, label,
 * type, required flag, default source) needed to create a contract from
 * this template.
 */
export function formatTemplateDetail(t: TemplateDetailResult): string {
  const lines: string[] = [];
  lines.push(`Şablon: ${t.name} [${t.id}]`);
  if (t.description) lines.push(`Açıklama: ${t.description}`);
  if (t.category) lines.push(`Kategori: ${t.category}`);
  lines.push(`Sayfa sayısı: ${t.pages_count} sayfa, ${t.usage_count} kez kullanıldı`);
  lines.push('');
  lines.push('Taraflar:');
  for (const p of t.parties) {
    lines.push(`- ${p.label} (sıra ${p.order})${p.is_required ? ', zorunlu' : ''}`);
  }
  lines.push('');
  if (t.variables.length === 0) {
    lines.push('Bu şablonda doldurulabilir değişken yok.');
  } else {
    lines.push('Doldurulabilir değişkenler (sözleşme oluştururken kullanılır):');
    for (const v of t.variables) {
      const req = v.is_required ? ', zorunlu' : '';
      const def = v.default_source ? `, otomatik kaynak: ${v.default_source}` : '';
      lines.push(`- ${v.slug} (${v.label}), tip: ${v.item_type}${req}${def}`);
    }
  }
  return lines.join('\n');
}

/**
 * Formats a CreateDemandResult (from sablondan_sozlesme_olustur) into a
 * human-readable Turkish summary.
 *
 * SAFETY: always states whether invites were actually dispatched (`sent`)
 * so the caller (and any AI relaying this) cannot mistake "created" for
 * "sent". Never renders `signing_url` (single-access bearer link, no extra
 * auth): same rationale as formatContractStatus. Always surfaces the
 * credit-spend + irreversibility notice, and
 * warns against blind retries (this endpoint is not idempotent server-side).
 */
export function formatCreateDemand(r: CreateDemandResult, sent: boolean): string {
  const lines: string[] = [];
  lines.push(`Sözleşme oluşturuldu: ${r.title} [${r.id}]`);
  lines.push(`Durum: ${r.status === 'PENDING' ? 'Bekliyor' : r.status}`);
  lines.push(`1 kredi harcandı.`);
  lines.push('');
  lines.push('Taraflar:');
  // signing_url is a single-access bearer link (/imza/:party_id, no extra
  // auth). It is intentionally NOT rendered here, mirroring the same
  // rationale as the READ tool (formatContractStatus): this output flows to
  // a third-party AI provider, and a leaked link would let someone sign on
  // the party's behalf without ever proving who they are.
  for (const p of r.signing_urls) {
    const name = `${p.first_name} ${p.last_name}`.trim();
    lines.push(`- ${name}`);
  }
  lines.push('');
  if (sent) {
    lines.push(`Davetler gönderildi (${r.dispatched} taraf için SMS ve e-posta iletildi).`);
  } else {
    lines.push('Davet gönderilmedi. Taraflara imza daveti göndermek için gonder: true kullanın, hatirlatma_gonder aracıyla gönderin, ya da dashboard\'daki sözleşme sayfasından davet edin.');
  }
  lines.push(`Sonuç sayfası: ${r.result_url}`);
  lines.push('');
  lines.push('Not: Bu işlem 1 kredi harcadı ve geri alınamaz. Aynı aracı tekrar çağırmak ikinci bir sözleşme oluşturur.');
  return lines.join('\n');
}

/**
 * Formats a ReminderResult (from hatirlatma_gonder) into a human-readable
 * Turkish summary: how many reminders were sent vs. skipped, and per-party
 * SMS/e-mail delivery detail (including the skip reason, e.g. anti-spam
 * window or per-party cap).
 */
export function formatReminder(r: ReminderResult): string {
  const lines: string[] = [];
  lines.push(`Hatırlatma sonucu (sözleşme ${r.demand_id}):`);
  lines.push(`${r.reminders_sent} taraf için hatırlatma gönderildi, ${r.reminders_skipped} taraf için gönderilmedi.`);
  lines.push('');
  for (const d of r.details) {
    const name = `${d.first_name} ${d.last_name}`.trim();
    const parts: string[] = [];
    if (d.sms) parts.push(`SMS: ${d.sms.status}${d.sms.reason ? ` (${d.sms.reason})` : ''}`);
    if (d.email) parts.push(`E-posta: ${d.email.status}${d.email.reason ? ` (${d.email.reason})` : ''}`);
    lines.push(`- ${name}: ${parts.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Formats a DemandListResult (from sozlesmelerim) into a human-readable Turkish
 * contract list. Counts-only — the backend deliberately returns no party PII
 * (no names/emails), so nothing sensitive flows to the AI provider. Per-item
 * status is shown in Turkish; the imza count comes from parties_signed/total.
 * No bearer link is ever rendered.
 */
export function formatDemandList(r: DemandListResult): string {
  if (r.demands.length === 0) {
    return 'Hiç sözleşme bulunamadı.';
  }
  const lines: string[] = [];
  for (const d of r.demands) {
    const title = d.title || 'Başlıksız sözleşme';
    const status = STATUS_TR[d.status] ?? d.status;
    const created = d.created_at ? `, oluşturma: ${d.created_at}` : '';
    lines.push(`- ${title} [${d.id}]: ${status}, ${d.parties_signed}/${d.parties_total} taraf imzaladı${created}`);
    if (d.status === 'COMPLETED' && d.pdf_url) {
      lines.push(`  İmzalı PDF: ${d.pdf_url}`);
    }
  }
  lines.push('');
  lines.push(`Toplam: ${r.total} (sayfa ${r.page}, sayfa boyutu ${r.limit})`);
  lines.push('');
  lines.push('İpucu: Bir sözleşmenin taraf/imza ayrıntısı için sozlesme_durumu aracını kimlik (id) ile çağırın.');
  return lines.join('\n');
}

/**
 * Formats a CancelDemandResult (from sozlesme_iptal) into a human-readable
 * Turkish summary. States plainly that the contract was cancelled (voided) and
 * that this is a platform action, not a legal "fesih". Surfaces the credit
 * refund only when the backend performed one (bulk contracts).
 */
export function formatCancelDemand(r: CancelDemandResult): string {
  const lines: string[] = [];
  const title = r.title || 'Sözleşme';
  lines.push(`İptal edildi: ${title} [${r.id}]`);
  lines.push(`Durum: ${STATUS_TR[r.status] ?? r.status}`);
  if (r.cancelled_at) lines.push(`İptal zamanı: ${r.cancelled_at}`);
  if (r.cancellation_reason) lines.push(`İptal sebebi: ${r.cancellation_reason}`);
  if (typeof r.refunded === 'number' && r.refunded > 0) {
    lines.push(`İade edilen kredi: ${r.refunded}`);
  }
  lines.push('');
  lines.push('Bu, İmzala.org üzerindeki sözleşme talebinin iptalidir (platform işlemi); imzalanmış bir belgenin hukuki feshi değildir. İşlem geri alınamaz; bekleyen imza davetleri ve hatırlatmalar durdurulur.');
  return lines.join('\n');
}

/**
 * Formats a ContactListResult (from kisilerim) into a human-readable Turkish
 * contact list. The backend allowlist never includes T.C. Kimlik No, so no
 * such identifier is present to render (KVKK). Encryption/workspace columns
 * are likewise absent from the response.
 */
export function formatContactList(r: ContactListResult): string {
  if (r.contacts.length === 0) {
    return 'Hiç kişi bulunamadı.';
  }
  const lines: string[] = [];
  for (const c of r.contacts) {
    lines.push(`- ${formatContactLine(c)}`);
  }
  lines.push('');
  lines.push(`Toplam: ${r.total} (sayfa ${r.page}, sayfa boyutu ${r.limit})`);
  return lines.join('\n');
}

/** Shared single-line contact renderer (list + create). No TC — not in the API allowlist. */
function formatContactLine(c: Contact): string {
  const name = `${c.first_name} ${c.last_name}`.trim() || 'İsimsiz kişi';
  const bits: string[] = [];
  if (c.email) bits.push(c.email);
  if (c.phone) bits.push(c.phone);
  if (c.job_title) bits.push(c.job_title);
  if (c.company?.name) bits.push(c.company.name);
  const suffix = bits.length ? `: ${bits.join(', ')}` : '';
  return `${name} [${c.id}]${suffix}`;
}

/**
 * Formats a freshly created Contact (from kisi_ekle) into a human-readable
 * Turkish confirmation. Makes explicit that the system only RECORDED the
 * contact (it did NOT verify the person's identity), so no "verified/doğrulanmış
 * kişi" implication is ever conveyed.
 */
export function formatContactCreate(c: Contact): string {
  const lines: string[] = [];
  lines.push(`Kişi kaydedildi: ${formatContactLine(c)}`);
  lines.push('');
  lines.push('Not: Bu araç kişiyi rehbere yalnızca KAYDEDER; kimliğini DOĞRULAMAZ. Kayıt, kişinin beyan edilen bilgileridir, doğrulanmış kimlik teşkil etmez.');
  return lines.join('\n');
}

const TIMESTAMP_STATUS_TR: Record<string, string> = {
  ACTIVE: 'Aktif',
  VERIFIED: 'Doğrulandı',
  EXPIRED: 'Süresi doldu',
  INVALID: 'Geçersiz',
};

/**
 * Formats a TimestampListResult (from zaman_damgalarim) into a human-readable
 * Turkish list of RFC 3161 timestamps. `timestamp_file_url` is an internal S3
 * key (not a browser-downloadable link), so it is intentionally NOT rendered;
 * the damga dosyası is retrieved from the dashboard.
 */
export function formatTimestampList(r: TimestampListResult): string {
  if (r.timestamps.length === 0) {
    return 'Hiç zaman damgası bulunamadı.';
  }
  const lines: string[] = [];
  for (const t of r.timestamps) {
    const status = TIMESTAMP_STATUS_TR[t.status] ?? t.status;
    const desc = t.description ? `, açıklama: ${t.description}` : '';
    lines.push(`- ${t.original_file_name} [${t.id}]: ${status}, damga: ${t.timestamp_date}${desc}`);
  }
  lines.push('');
  lines.push(`Toplam: ${r.total} (sayfa ${r.page}, sayfa boyutu ${r.limit})`);
  lines.push('');
  lines.push('Not: Damga dosyasının indirilmesi ve doğrulanması İmzala.org paneli üzerinden yapılır.');
  return lines.join('\n');
}

// Bilinen denetim (timeline) olay tiplerinin Türkçe karşılıkları. Bilinmeyen tip
// ham haliyle gösterilir (ileri uyumluluk).
const AUDIT_EVENT_TR: Record<string, string> = {
  'demand.created': 'Sözleşme oluşturuldu',
  'party.viewed': 'Taraf görüntüledi',
  'party.signed': 'Taraf imzaladı',
  'demand.completed': 'Sözleşme tamamlandı',
  'demand.cancelled': 'Sözleşme iptal edildi',
  'party.rejected': 'Taraf reddetti',
};

/**
 * Formats a TimelineResult (from sozlesme_audit) into a readable audit trail.
 * actor_label / ip_masked are already KVKK-masked by the backend; this renderer
 * never adds unmasked PII.
 */
export function formatDemandTimeline(r: TimelineResult): string {
  if (r.events.length === 0) {
    return 'Bu sözleşme için henüz denetim kaydı yok.';
  }
  const lines: string[] = ['Sözleşme denetim izi (kim, ne, ne zaman):', ''];
  for (const e of r.events) {
    const type = AUDIT_EVENT_TR[e.event_type] ?? e.event_type;
    const who = e.actor_label ? `, ${e.actor_label}` : '';
    const ip = e.ip_masked ? ` (IP ${e.ip_masked})` : '';
    const note = e.comment_text ? `, not: ${e.comment_text}` : '';
    lines.push(`- ${e.created_at}: ${type}${who}${ip}${note}`);
  }
  lines.push('');
  lines.push('Not: Aktör ve IP bilgileri KVKK gereği maskelenmiştir. Resmi denetim/tamamlanma belgesi İmzala.org panelinden indirilir.');
  return lines.join('\n');
}

/**
 * Formats a BulkResult (from toplu_sozlesme_gonder) into a human-readable
 * Turkish summary: created/failed counts, per-row outcome.
 *
 * SECURITY: `signing_url` (/imza/:party_id) is a single-access bearer link
 * with no extra auth — same as formatCreateDemand/formatContractStatus, it is
 * intentionally NOT rendered here. This output flows to a third-party AI
 * provider; a leaked signing link would let anyone sign on the party's behalf
 * without proving who they are (impersonation). Recipients receive their own
 * link privately via the dispatched email/SMS. Only the party name and the
 * PUBLIC result page (`result_url` = /sonuc/:demand_id, read-only) are shown.
 */
export function formatBulkResult(r: BulkResult): string {
  const lines: string[] = [`${r.total} sözleşmeden ${r.created}'i oluşturuldu, ${r.failed}'i başarısız.`];
  const created = r.results.filter((x) => x.status === 'created');
  if (created.length) {
    lines.push('', 'Oluşturulanlar:');
    for (const c of created) {
      const who = c.signing_urls?.[0]
        ? `${c.signing_urls[0].first_name ?? ''} ${c.signing_urls[0].last_name ?? ''}`.trim()
        : `Satır ${c.row_index + 1}`;
      const suffix = c.result_url ? ` (Sonuç: ${c.result_url})` : '';
      lines.push(`  ${c.row_index + 1}. ${who || `Satır ${c.row_index + 1}`}${suffix}`);
    }
  }
  const failed = r.results.filter((x) => x.status === 'failed');
  if (failed.length) {
    lines.push('', 'Başarısızlar:');
    for (const f of failed) lines.push(`  ${f.row_index + 1}. ${f.message ?? f.error ?? 'Bilinmeyen hata'} (${f.error ?? ''})`);
  }
  lines.push('', 'İmza bağlantıları güvenlik gereği burada gösterilmez; alıcılara davet e-posta ve SMS ile ulaşır. Panelden takip edebilirsiniz.');
  return lines.join('\n');
}

/**
 * Formats a ReportsResult (from raporlar) into a readable summary. Counts only,
 * no PII.
 */
export function formatReports(r: ReportsResult): string {
  const c = r.contracts;
  return [
    'Sözleşme özeti:',
    '',
    `- Toplam sözleşme: ${c.total}`,
    `- Bekleyen (imza sürecinde): ${c.pending}`,
    `- Tamamlanan: ${c.completed}`,
    `- İptal edilen: ${c.cancelled}`,
    `- Süresi dolmuş: ${c.expired}`,
    `- Bu ay oluşturulan: ${c.this_month}`,
  ].join('\n');
}
