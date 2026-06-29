# @imzala/mcp-server

**İmzala MCP server:** AI asistanınızın (Claude, Cursor vb.) İmzala hesabınıza erişmesini sağlar. API anahtarıyla kimlik doğrulaması yapılır; iki araç sunar: `whoami` (hesap ve kredi bilgisi) ile `eser_tescil` (RFC 3161 zaman damgası).

> **@next ön-sürüm:** Bu paket şu an İmzala test ortamına (`https://test-api.imzala.org`) bağlıdır. Değerlendirme amaçlıdır; üretime alınmadan önce kapsam onayı ve avukat incelemesi tamamlanacaktır.

---

## Kurulum ve Yapılandırma

`npx @imzala/mcp-server@next` komutuyla kurulum gerektirmeden çalışır. Aşağıdaki JSON bloğunu ilgili araç yapılandırma dosyasına ekleyin:

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) veya `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "imzala": {
      "command": "npx",
      "args": ["-y", "@imzala/mcp-server@next"],
      "env": { "IMZALA_API_KEY": "imz_..." }
    }
  }
}
```

### Claude Code (CLI)

`.claude/settings.json` (proje) veya `~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "imzala": {
      "command": "npx",
      "args": ["-y", "@imzala/mcp-server@next"],
      "env": { "IMZALA_API_KEY": "imz_..." }
    }
  }
}
```

### Cursor

`.cursor/mcp.json` (proje) veya `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "imzala": {
      "command": "npx",
      "args": ["-y", "@imzala/mcp-server@next"],
      "env": { "IMZALA_API_KEY": "imz_..." }
    }
  }
}
```

### Ortam Degiskenleri

| Degisken | Zorunlu | Aciklama |
|----------|---------|----------|
| `IMZALA_API_KEY` | Evet | `imz_` ile baslayan API anahtari |
| `IMZALA_API_BASE_URL` | Hayir | Varsayilan: `https://test-api.imzala.org`. Prod'a geciste `https://api-prd.imzala.org` olacak |

---

## API Anahtari Nasil Alinir

1. [app.imzala.org](https://app.imzala.org) adresinden hesabiniza giris yapin.
2. Saga ustten **Hesap ayarlari** bölümüne gidin.
3. **API Anahtarlari** sekmesini acin ve **Yeni Anahtar** butonuna tiklayin.
4. Kapsam seciminde **sadece `timestamps`** isaretleyin. Hesabiniza genis erisim tanimayan minimal bir kapsam secmek, olasiligi dusuk bir sorun durumunda hasari sinirlar.
5. Olusan anahtari kopyalayin ve yukaridaki yapilandirma dosyasina girin.

---

## Anahtar Guvenligi

Bu API anahtari hesabiniza erisim saglar ve her zaman damgasi isleminde **kredi harcar.** Asagidaki kurallara uyun:

- Anahtari bir parola gibi sayin; e-posta, Slack veya kaynak kod deposuna yapistirmayin.
- Anahtari eklediginiz AI aracinin saglayicisi (Anthropic, Cursor vb.) yapılandirma dosyanizi okuyabilir. Bu riski kabul edilebilir kilmak icin **yalnizca `timestamps` kapsamli** bir anahtar kullanin; genis kapsamli ya da tam yetkili anahtar **vermeyin**.
- Anahtarinizin gizlendigini dusunuyorsaniz dashboard'daki **API Anahtarlari** sayfasindan hemen iptal edin ve yeni bir anahtar olusturun.

---

## Araclar

### `whoami`

Hesap bilgilerini ve anlık kredi bakiyesini gösterir.

**Girdi:** yok

**Cikti ornegi:**

```
Hesap: Ahmet Yilmaz (ahmet@ornek.com)
Kredi: 42 kalan
Calisma alani: Kisisel
```

---

### `eser_tescil`

Bir dosyaya RFC 3161 zaman damgasi uygular. Dosyanin belirtilen anda var oldugunu ve o andan bu yana degismedigini kriptografik olarak kanitlar.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `file_path` | `string` | XOR | Damgalanacak dosyanin yerel yolu |
| `file_base64` | `string` | XOR | Dosya icerigi (standart canonical base64; data-URL veya URL-safe base64 kabul edilmez) |
| `file_name` | `string` | Evet | Dosya adi, uzanti dahil (orn. `belge.pdf`) |
| `owner_first_name` | `string` | Hayir | Eser sahibinin adi (beyan) |
| `owner_last_name` | `string` | Hayir | Eser sahibinin soyadi (beyan) |
| `description` | `string` | Hayir | Eser aciklamasi |
| `idempotency_key` | `string` | Hayir | Ayni istegi tekrarlamamak icin benzersiz anahtar |

`file_path` ve `file_base64` ayni anda kullanilmaz; birini verin.

---

## Zaman Damgasi Hakkinda Hukuki Not

`eser_tescil` RFC 3161 standardinda bir zaman damgasidir. Dosyanin belirtilen anda var olduğunu ve degismedigini ispat eder. Bu islem:

- Dijital veya elektronik imza degildir.
- Nitelikli elektronik imza (QES) degildir.
- Resmi eser sahipligi veya telif hakki tescili degildir.

Belirli bir hukuki amac icin kullanmadan once bagimsiz hukuki danisma alin.

---

## Gelistirici Notu: Yayinlama

Tag-driven release akisi (kullanici calistirir, CI/CD servisi degil):

```bash
# Ön-sürüm olarak yayinla
npm publish --tag next

# Yeterli soak sonrasi stable'a yukselt
npm dist-tag add @imzala/mcp-server@<v> latest
```

Bu komutlari yalnizca npm tokeni olan yetkili kullanici calistirir. MCP server kodu bu islemi yapmaz.
