# @imzala/mcp-server

**İmzala MCP server:** AI asistanınızın (Claude, Cursor vb.) İmzala hesabınıza erişmesini sağlar. API anahtarıyla kimlik doğrulaması yapılır; altı araç sunar: `whoami` (hesap ve kredi bilgisi), `eser_tescil` (RFC 3161 zaman damgası), `sozlesme_durumu` (sözleşme durumu ve imza takibi), `sablonlarim` (şablon listesi), `sablon_detay` (şablon detayı ve değişken kataloğu), `imzali_pdf_indir` (tamamlanmış sözleşmenin imzalı PDF'ini indirme).

> **v1.0.0:** Bu paket varsayılan olarak İmzala üretim ortamına (`https://api-prd.imzala.org`) bağlanır. Farklı bir uç nokta için `IMZALA_API_BASE_URL` değişkenini ayarlayın.

---

## Kurulum ve Yapılandırma

`npx @imzala/mcp-server` komutuyla kurulum gerektirmeden çalışır. Aşağıdaki JSON bloğunu ilgili araç yapılandırma dosyasına ekleyin:

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) veya `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "imzala": {
      "command": "npx",
      "args": ["-y", "@imzala/mcp-server"],
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
      "args": ["-y", "@imzala/mcp-server"],
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
      "args": ["-y", "@imzala/mcp-server"],
      "env": { "IMZALA_API_KEY": "imz_..." }
    }
  }
}
```

### Ortam Degiskenleri

| Degisken | Zorunlu | Aciklama |
|----------|---------|----------|
| `IMZALA_API_KEY` | Evet | `imz_` ile baslayan API anahtari |
| `IMZALA_API_BASE_URL` | Hayir | Varsayilan: `https://api-prd.imzala.org` (uretim). Test ortami icin `https://test-api.imzala.org` ayarlanabilir |

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

### `sozlesme_durumu`

Bir sözleşmenin durumunu ve hangi tarafların imzaladığını gösterir. "X sözleşmesini kim imzaladı, imzalandı mı" sorularını yanıtlar.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `demand_id` | `string` | Evet | Durumu sorgulanacak sözleşmenin (demand) kimliği |

**Cikti ornegi:**

```
Sözleşme: Kira Sözleşmesi 2026
Durum: Bekliyor
İmza durumu: 1/2 taraf imzaladı

Taraflar:
- Ahmet Yilmaz (ahmet@ornek.com): imzaladı (2026-06-30T10:15:00Z)
- Mehmet Demir (mehmet@ornek.com): bekliyor, imza linki: https://e.imzala.org/imza/abc123

Sonuç sayfası: https://app.imzala.org/sonuc/xyz789
```

---

### `sablonlarim`

Hesaptaki sözleşme şablonlarını listeler.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `page` | `number` | Hayir | Sayfa numarasi (varsayilan 1) |
| `limit` | `number` | Hayir | Sayfa boyutu (varsayilan 20, en fazla 100) |

**Cikti ornegi:**

```
- Kira Sözleşmesi (konut kira sözleşmesi şablonu) [tpl_123], kategori: Kira, 2 taraf, 14 kez kullanıldı
- Hizmet Sözleşmesi [tpl_456], 2 taraf, 3 kez kullanıldı

Toplam: 2 (sayfa 1, sayfa boyutu 20)
```

---

### `sablon_detay`

Bir şablonun detayını gösterir: taraflar ve doldurulabilir değişkenler. Şablondan sözleşme oluşturmadan önce hangi değişkenlerin gerektiğini öğrenmek için kullanılır.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `template_id` | `string` | Evet | Detayı istenen şablonun kimliği |

**Cikti ornegi:**

```
Şablon: Kira Sözleşmesi [tpl_123]
Kategori: Kira
Sayfa sayısı: 3 sayfa, 14 kez kullanıldı

Taraflar:
- Kiraya Veren (sıra 1), zorunlu
- Kiracı (sıra 2), zorunlu

Doldurulabilir değişkenler (sözleşme oluştururken kullanılır):
- signer.full_name (İmzalayan Ad Soyad), tip: text, zorunlu
- contract.start_date (Sözleşme Başlangıç Tarihi), tip: date, zorunlu, otomatik kaynak: current.date
```

---

### `imzali_pdf_indir`

Tamamlanmış bir sözleşmenin imzalı PDF'ini indirir. Sözleşmenin sahipliği önce doğrulanır; yalnız tamamlanmış (COMPLETED) sözleşmelerde çalışır.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `demand_id` | `string` | Evet | İmzalı PDF'i indirilecek tamamlanmış sözleşmenin kimliği |
| `save_path` | `string` | Hayir | PDF'in kaydedileceği yerel dosya yolu (verilmezse base64 döner) |

**Cikti ornegi (save_path verildiğinde):**

```
İmzalı PDF kaydedildi: /Users/ahmet/Downloads/kira-sozlesmesi.pdf (284213 bayt)
```

**Cikti ornegi (save_path verilmediğinde, dosya küçükse):**

```
İmzalı PDF (base64):
JVBERi0xLjcKJ...
```

---

> **Not:** `sozlesme_durumu`, `sablonlarim`, `sablon_detay` ve `imzali_pdf_indir` araçları, API anahtarında `demands` kapsamı (scope) gerektirir. Bu kapsamlı bir anahtar, salt-okunur sorgulamanın ötesinde `demands` üzerinde yeni sözleşme de oluşturabilir (ör. gelecekte eklenecek yazma araçları aynı kapsamı kullanır); bu dört salt-okunur araç için anahtar oluştururken yine de mümkün olan en dar kapsamı seçmeniz önerilir.

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
