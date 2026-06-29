import type { MeResult } from './client.js';
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
      return 'Kimlik doğrulama başarısız — IMZALA_API_KEY anahtarını kontrol edin.';
    }
    if (e.status === 403 && e.code === 'INSUFFICIENT_SCOPE') {
      return "Bu API anahtarının 'timestamps' yetkisi yok. Dashboard'da anahtara timestamps kapsamı verin.";
    }
    if (e.status === 402 || e.code === 'INSUFFICIENT_CREDITS') {
      return 'Yetersiz kredi (eser tescil başına 4 kredi gerekir).';
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
