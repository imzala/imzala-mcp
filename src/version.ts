// Tek sürüm SSOT'u. package.json ile senkron tutulur — guard:
// src/__tests__/server.test.ts ('SERVER_VERSION matches package.json version').
// package.json runtime'da import EDİLMEZ (bundling kısıtı: dist/bin yerleşiminde
// ../package.json çözümlemesi kırılgan) — hardcoded sabit + test kilidi kalıbı.
export const SERVER_VERSION = '1.9.1';
