import { writeFile } from 'fs/promises';
import { extname, isAbsolute } from 'path';

/**
 * Writes a downloaded PDF to a path chosen by the caller (in practice: by the
 * AI assistant). Three guards, because the path is model-supplied:
 *   - absolute path only (no surprise relative to the server's working dir),
 *   - `.pdf` extension only (never a dotfile, script or config),
 *   - never overwrites: `wx` fails if the path exists and does not follow a
 *     symlink to an existing target,
 *   - no network share (UNC) and no NTFS alternate data stream, so the file
 *     cannot be steered to a remote host,
 *   - created readable by the owner only (the PDF holds personal data).
 *
 * Returns null on success, or a user-facing Turkish error text.
 */
export async function savePdfExclusive(path: string, buf: Buffer): Promise<string | null> {
  if (!isAbsolute(path)) {
    return 'save_path mutlak (tam) bir dosya yolu olmalı, ör. /Users/ad/Belgeler/sozlesme.pdf. Dosya yazılmadı.';
  }
  if (path.startsWith('\\\\') || path.startsWith('//')) {
    return 'save_path bir ağ paylaşımı olamaz; yerel bir klasör verin. Dosya yazılmadı.';
  }
  // A colon is only legitimate as the Windows drive separator ("C:\...").
  if (path.replace(/^[A-Za-z]:/, '').includes(':')) {
    return 'save_path geçersiz karakter içeriyor (":"). Dosya yazılmadı.';
  }
  if (extname(path).toLowerCase() !== '.pdf') {
    return 'save_path .pdf uzantılı bir dosya olmalı. Dosya yazılmadı.';
  }
  try {
    await writeFile(path, buf, { flag: 'wx', mode: 0o600 });
    return null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      return 'Bu yolda zaten bir dosya var; mevcut dosyanın üzerine yazılmaz. Başka bir dosya adı verin.';
    }
    return 'Dosya yazılamadı. Klasörün var olduğundan ve yazma izninizin bulunduğundan emin olun.';
  }
}
