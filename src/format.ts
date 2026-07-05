import type { MeResult, TimestampResult, DemandStatusResult, TemplateListResult, TemplateDetailResult, CreateDemandResult } from './client.js';
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
      return "Bu API anahtarının 'timestamps' yetkisi yok. Dashboard'da anahtara timestamps kapsamı verin.";
    }
    if (e.status === 402 || e.code === 'INSUFFICIENT_CREDITS') {
      return 'Yetersiz kredi. Eser tescil için yeterli krediniz yok.';
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
 * "sent". Always surfaces the credit-spend + irreversibility notice, and
 * warns against blind retries (this endpoint is not idempotent server-side).
 */
export function formatCreateDemand(r: CreateDemandResult, sent: boolean): string {
  const lines: string[] = [];
  lines.push(`Sözleşme oluşturuldu: ${r.title} [${r.id}]`);
  lines.push(`Durum: ${r.status === 'PENDING' ? 'Bekliyor' : r.status}`);
  lines.push(`1 kredi harcandı.`);
  lines.push('');
  lines.push('Taraflar ve imza linkleri:');
  for (const p of r.signing_urls) {
    const name = `${p.first_name} ${p.last_name}`.trim();
    lines.push(`- ${name}: ${p.signing_url}`);
  }
  lines.push('');
  if (sent) {
    lines.push(`Davetler gönderildi (${r.dispatched} taraf için SMS ve e-posta iletildi).`);
  } else {
    lines.push('Davet gönderilmedi. Yukarıdaki imza linklerini taraflara siz iletin, ya da hatirlatma_gonder aracıyla gönderin.');
  }
  lines.push(`Sonuç sayfası: ${r.result_url}`);
  lines.push('');
  lines.push('Not: Bu işlem 1 kredi harcadı ve geri alınamaz. Aynı aracı tekrar çağırmak ikinci bir sözleşme oluşturur.');
  return lines.join('\n');
}
