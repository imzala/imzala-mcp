import { describe, test, expect } from 'vitest';
import { mimeFromFileName } from '../client.js';

describe('mimeFromFileName', () => {
  test('maps common extensions', () => {
    expect(mimeFromFileName('belge.pdf')).toBe('application/pdf');
    expect(mimeFromFileName('a.txt')).toBe('text/plain');
    expect(mimeFromFileName('IMG.JPG')).toBe('image/jpeg');
    expect(mimeFromFileName('rapor.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
  test('unknown/no extension falls back to octet-stream', () => {
    expect(mimeFromFileName('noext')).toBe('application/octet-stream');
    expect(mimeFromFileName('archive.xyz')).toBe('application/octet-stream');
  });
});
