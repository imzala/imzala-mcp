# @imzala/mcp-server

**İmzala MCP server:** AI asistanınızın (Claude, Cursor vb.) İmzala hesabınıza erişmesini sağlar. API anahtarıyla kimlik doğrulaması yapılır; altı araç sunar: `whoami` (hesap ve kredi bilgisi), `eser_tescil` (RFC 3161 zaman damgası), `sozlesme_durumu` (sözleşme durumu ve imza takibi), `sablonlarim` (şablon listesi), `sablon_detay` (şablon detayı ve değişken kataloğu), `imzali_pdf_indir` (tamamlanmış sözleşmenin imzalı PDF'ini indirme).

> **Not:** Bu paket varsayılan olarak İmzala üretim ortamına (`https://api-prd.imzala.org`) bağlanır. Farklı bir uç nokta için `IMZALA_API_BASE_URL` değişkenini ayarlayın.

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
4. Kapsam seciminde, hangi araclari kullanacaginiza gore en dar (minimal) kombinasyonu isaretleyin. Bu MCP sunucusundaki araclarin HEPSI salt-okunurdur (hicbiri sozlesme olusturmaz ya da degistirmez), bu yuzden **salt-okunur kapsam** vermeniz onerilir: `eser_tescil` ve `whoami` icin `timestamps`; `sozlesme_durumu` ve `imzali_pdf_indir` icin `demands:read`; `sablonlarim` ve `sablon_detay` icin `templates:read`. Dashboard'da **"Yapay zeka asistani icin salt-okunur (onerilen)"** hazir secenegi tam bu kombinasyonu (`timestamps` + `demands:read` + `templates:read`) tek tikla secer. Yazma yetkisi (`demands:write`) veren bir anahtar VERMEYIN, bu araclarin hicbiri buna ihtiyac duymaz. (Eski, ayrimsiz `demands`/`templates` kapsamli anahtarlar da calisir ama yazma yetkisi de icerdiginden onerilmez.)
5. Olusan anahtari kopyalayin ve yukaridaki yapilandirma dosyasina girin.

---

## Anahtar Guvenligi

Bu API anahtari hesabiniza erisim saglar ve her zaman damgasi isleminde **kredi harcar.** Asagidaki kurallara uyun:

- Anahtari bir parola gibi sayin; e-posta, Slack veya kaynak kod deposuna yapistirmayin.
- Anahtari eklediginiz AI aracinin saglayicisi (Anthropic, Cursor vb.) yapılandirma dosyanizi okuyabilir. Bu riski kabul edilebilir kilmak icin **salt-okunur** bir anahtar kullanin (`timestamps` + `demands:read` + `templates:read`, dashboard'daki "Yapay zeka asistani icin salt-okunur" secenegi); yazma yetkisi (`demands:write`) veren ya da tam yetkili anahtar **vermeyin**. Boylece anahtar sizsa bile ucuncu taraf sozlesmelerinizi degistiremez, yalnizca okuyabilir.
- Anahtarinizin gizlendigini dusunuyorsaniz dashboard'daki **API Anahtarlari** sayfasindan hemen iptal edin ve yeni bir anahtar olusturun.

### Veri akisi (onemli)

Bu araclari kullandiginizda, sorguladiginiz veri, protokolun dogasi geregi kullandiginiz AI aracinin saglayicisinin (Anthropic, Cursor vb.) altyapisindan gecer ve onun veri isleme kosullarina tabi olur. Ozellikle:

- `sozlesme_durumu` sozlesmenizdeki **karsi tarafin adini, soyadini, e-postasini ve imza tarihini** ciktida dondurur.
- `imzali_pdf_indir` **tamamlanmis sozlesmenin tam icerigini** (varsa TC kimlik, adres, finansal veri dahil) dondurur.

Bu veri, dashboard'da zaten gorebildiginiz ayni bilgidir; **İmzala.org bu aktarimi yapmaz**, hangi AI aracini kullanacaginiza siz karar verirsiniz. Sozlesmenizin karsi tarafina ait verileri bu sekilde islemeden once kendi veri sorumlusu yukumluluklerinizi degerlendirin.

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

Sonuç sayfası: https://e.imzala.org/sonuc/xyz789
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

> **Not:** Bu MCP sunucusundaki dört sözleşme/şablon aracı (`sozlesme_durumu`, `imzali_pdf_indir`, `sablonlarim`, `sablon_detay`) yalnızca **okuma** kapsamı gerektirir: `sozlesme_durumu` + `imzali_pdf_indir` için `demands:read`, `sablonlarim` + `sablon_detay` için `templates:read`. Bu salt-okunur kapsamlar sözleşme oluşturma veya değiştirme yetkisi VERMEZ, dolayısıyla bir yapay zeka asistanına vermek için en güvenli seçimdir. Dashboard'daki "Yapay zeka asistanı için salt-okunur (önerilen)" hazır seçeneği bu kombinasyonu tek tıkla seçer.

---

## Zaman Damgasi Hakkinda Hukuki Not

`eser_tescil` RFC 3161 standardinda bir zaman damgasidir. Dosyanin belirtilen anda var olduğunu ve degismedigini ispat eder. Bu islem:

- Dijital veya elektronik imza degildir.
- Nitelikli elektronik imza (QES) degildir.
- Resmi eser sahipligi veya telif hakki tescili degildir.

Belirli bir hukuki amac icin kullanmadan once bagimsiz hukuki danisma alin.

---

## Gelistirici Notu: Yayinlama

### Zorunlu yayin-oncesi e2e gate

`prepublishOnly` her `npm publish` oncesi sunu calistirir: **build + unit test + e2e gate**. E2E gate (`scripts/e2e-preflight.mjs`) yayinlanacak sunucunun ta kendisini (`dist/bin/stdio.js`) stdio uzerinden **gercek bir API anahtariyla gercek backend'e** karsi surer ve her aracin gercek ciktisini dogrular. Bir arac bozuksa (ornegin v1.0.0'da `eser_tescil` her yuklemede 500 veriyordu) publish **iptal** edilir.

Yayinlamadan once gercek bir anahtar export edin:

```bash
export IMZALA_E2E_API_KEY=imz_...                          # timestamps + templates + demands kapsamli
export IMZALA_E2E_BASE_URL=https://test-api.imzala.org     # istege bagli — prod kredisi harcamamak icin test ortami
# istege bagli, sozlesme araclarini da test etmek icin:
export IMZALA_E2E_DEMAND_ID=<demand-id>
export IMZALA_E2E_COMPLETED_DEMAND_ID=<tamamlanmis-demand-id>

npm publish --tag next     # prepublishOnly → build + test + e2e otomatik kosar
```

Gate'i tek basina calistirmak: `npm run e2e`. `eser_tescil` gercek zaman damgasi olusturur (~4 kredi); atlamak icin `IMZALA_E2E_SKIP_TIMESTAMP=1`. Acil durum bypass (yayin DOGRULANMADAN cikar): `IMZALA_E2E_SKIP=1`.

### Release akisi

```bash
# Ön-sürüm olarak yayinla (e2e gate otomatik kosar)
npm publish --tag next

# Yeterli soak sonrasi stable'a yukselt
npm dist-tag add @imzala/mcp-server@<v> latest
```

Bu komutlari yalnizca npm tokeni olan yetkili kullanici calistirir. MCP server kodu bu islemi yapmaz.
