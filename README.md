# @imzala/mcp-server

**İmzala MCP sunucusu:** yapay zekâ asistanınızın (Claude, Cursor vb.) İmzala hesabınıza erişmesini sağlar. API anahtarıyla kimlik doğrulaması yapılır ve on sekiz araç sunar.

| Araç | Ne yapar | Kapsam |
|------|----------|--------|
| `whoami` | Hesap ve kredi bilgisi | (her anahtar) |
| `sozlesmelerim` | Sözleşme listesi; durum, arşiv, başlık ve tarih filtresi | `demands:read` |
| `sozlesme_durumu` | Sözleşme durumu, imza takibi, zarf belgeleri, süre takibi | `demands:read` |
| `sozlesme_audit` | Sözleşmenin denetim izi (kim, ne, ne zaman) | `demands:read` |
| `imzali_pdf_indir` | Tamamlanmış sözleşmenin imzalı PDF'i | `demands:read` |
| `sozlesme_sertifikasi` | Tamamlanma sertifikası (PDF) | `demands:read` |
| `raporlar` | Sözleşme sayıları özeti | `demands:read` |
| `sablonlarim` | Şablon listesi | `templates:read` |
| `sablon_detay` | Şablonun tarafları, değişkenleri ve belgeleri | `templates:read` |
| `kisilerim` | Kayıtlı kişi listesi | `contacts:read` |
| `zaman_damgalarim` | Eser Tasdik kayıtları | `timestamps` |
| `eser_tescil` | Eser Tasdik: dosya için var olma ve değişmezlik kaydı (tescil değildir; kredi harcar) | `timestamps` |
| `sablondan_sozlesme_olustur` | Şablondan yeni sözleşme (kredi harcar) | `demands:write` |
| `toplu_sozlesme_gonder` | Aynı şablondan birden çok alıcıya ayrı sözleşme (kredi harcar) | `demands:write` |
| `hatirlatma_gonder` | İmzalamamış taraflara gerçek SMS ve e-posta hatırlatması | `demands:write` |
| `sozlesme_iptal` | Bekleyen sözleşmeyi iptal eder (geri alınamaz) | `demands:write` |
| `sozlesme_sil` | Tamamlanmamış sözleşmeyi kalıcı olarak siler (geri alınamaz) | `demands:write` |
| `kisi_ekle` | Rehbere kişi ekler | `contacts:write` |

> **Önemli:** `sablondan_sozlesme_olustur`, `toplu_sozlesme_gonder`, `sozlesme_iptal`, `sozlesme_sil`, `kisi_ekle` ve `hatirlatma_gonder` **yazma (write)** araçlarıdır: sözleşme oluşturur, iptal eder ya da siler, kişi kaydeder veya gerçek SMS/e-posta gönderir. Bunlar API anahtarınızda ilgili yazma kapsamını ister (sözleşme araçları `demands:write`, `kisi_ekle` `contacts:write`); **salt-okunur** bir anahtarla çalışmazlar. `sozlesme_iptal` İmzala.org üzerindeki imza sürecinin iptalidir (platform işlemi); hukuki fesih değildir, taraflar arasındaki hukuki ilişkiyi kendiliğinden sona erdirmez ve **geri alınamaz**. Bkz. "API Anahtarı Nasıl Alınır" ve ilgili araç bölümleri.

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
4. Kapsam seçiminde, hangi araçları kullanacağınıza göre en dar kombinasyonu işaretleyin. Okuma araçları (`whoami`, `sozlesmelerim`, `sozlesme_durumu`, `sozlesme_audit`, `imzali_pdf_indir`, `sozlesme_sertifikasi`, `raporlar`, `sablonlarim`, `sablon_detay`, `kisilerim`, `zaman_damgalarim`) sözleşme oluşturmaz ya da değiştirmez. Bunlar için: sözleşme araçlarına `demands:read`, şablon araçlarına `templates:read`, `kisilerim` için `contacts:read`, `zaman_damgalarim` için `timestamps`. Paneldeki **"Yapay zekâ asistanı için salt-okunur (önerilen)"** hazır seçeneği okuma kapsamlarını tek tıkla seçer.
   `timestamps` kapsamı `eser_tescil` aracını da açar; bu araç kredi harcar ve kayıt oluşturur. Bunu istemiyorsanız `timestamps` kapsamını vermeyin.
   Yazma kapsamı **yalnızca** yazma araçlarını kullanacaksanız gerekir: `sablondan_sozlesme_olustur`, `toplu_sozlesme_gonder`, `hatirlatma_gonder`, `sozlesme_iptal` ve `sozlesme_sil` için `demands:write`; `kisi_ekle` için `contacts:write`. Yazma araçlarını kullanmayacaksanız yazma kapsamı VERMEYİN. Kullanacaksanız **ayrı bir anahtar** oluşturup yalnız ona gereken yazma kapsamını verin; salt-okunur ana anahtarınızı genişletmeyin. (Eski, ayrımsız `demands` / `templates` / `contacts` kapsamlı anahtarlar da çalışır ama yazma yetkisi de içerdiğinden önerilmez.)
5. Olusan anahtari kopyalayin ve yukaridaki yapilandirma dosyasina girin.

---

## Anahtar Guvenligi

Bu API anahtarı hesabınıza erişim sağlar; sözleşme oluşturma ve Eser Tasdik işlemleri **kredi harcar.** Aşağıdaki kurallara uyun:

- Anahtari bir parola gibi sayin; e-posta, Slack veya kaynak kod deposuna yapistirmayin.
- Anahtari eklediginiz AI aracinin saglayicisi (Anthropic, Cursor vb.) yapılandirma dosyanizi okuyabilir. Bu riski kabul edilebilir kilmak icin **salt-okunur** bir anahtar kullanin (`timestamps` + `demands:read` + `templates:read`, dashboard'daki "Yapay zeka asistani icin salt-okunur" secenegi); yazma yetkisi (`demands:write`) veren ya da tam yetkili anahtar **vermeyin**. Böylece anahtar sızsa bile üçüncü taraf sözleşme oluşturamaz, değiştiremez, gerçek SMS ya da e-posta gönderemez. `timestamps` kapsamı verdiyseniz Eser Tasdik işlemiyle kredi harcayabilir; bunu istemiyorsanız `timestamps` kapsamını vermeyin.
- `sablondan_sozlesme_olustur` ve `hatirlatma_gonder` kasitli olarak `demands:write` kapsami GEREKTIRIR: salt-okunur bir anahtarla (yukaridaki onerilen kombinasyon) bu iki arac calismaz, sadece hata doner. Bu bir guvenlik onlemidir: bir AI asistanina salt-okunur anahtar veren kullanici, o asistanin adiniza sozlesme olusturmasini ya da karsi taraflara gercek mesaj gondermesini istemiyor demektir. Bu iki araci kullanmak isterseniz, ayri bir `demands:write` kapsamli anahtar olusturun ve sadece o kullanim icin verin.
- Anahtarinizin gizlendigini dusunuyorsaniz dashboard'daki **API Anahtarlari** sayfasindan hemen iptal edin ve yeni bir anahtar olusturun.

### Veri akışı (önemli)

Bu araçları kullandığınızda sorguladığınız ve yazdığınız veri, kullandığınız yapay zekâ aracının sağlayıcısının (Anthropic, Cursor vb.) altyapısından geçer ve onun veri işleme koşullarına tabi olur. Bu sağlayıcılar çoğunlukla yurt dışındadır; bu durumda kişisel veri yurt dışına aktarılmış olur.

Asistana giden veriler:

- `sozlesme_durumu`: tarafların adı ve e-postası (API maskeli döndürüyorsa kısaltılmış ad ve maskeli e-posta), imza ve ret tarihleri; zarftaki belge başlıkları, belge türü, belge başına kaç tarafın karar verdiği ve mühür durumu; arşiv ve süre takibi tarihleri. Hangi tarafın hangi belgeyi kabul ya da reddettiği ve açık rıza kayıtları gösterilmez.
- `sozlesmelerim`: sözleşme başlıkları, durum ve sayılar. Taraf adı ve e-postası listelenmez.
- `sozlesme_audit`: denetim izi (kısaltılmış ad, maskeli e-posta ve IP). Bir tarafın imza sayfasında yazdığı not varsa (ör. ret gerekçesi) tırnak içinde ve kısaltılarak gösterilir; bu not kişisel veri içerebilir.
- `imzali_pdf_indir` ve `sozlesme_sertifikasi`: `save_path` verilmezse belgenin tamamı asistana gider. İmzalı PDF sözleşmenin tüm içeriğini (varsa T.C. kimlik numarası, adres, finansal veri) taşır; sertifika taraflara ait kişisel veri (iletişim bilgileri ve işlem kayıtları) içerir. Yerel dosyaya kaydetmek için `save_path` kullanın.
- `kisilerim`: rehberdeki kişilerin adı, e-postası, telefonu, unvanı ve şirketi (maskesiz).
- `sablondan_sozlesme_olustur`, `toplu_sozlesme_gonder`, `kisi_ekle`: asistana yazdığınız ad, e-posta ve telefon bilgileri önce yapay zekâ sağlayıcısına, ardından İmzala'ya ulaşır.
- `eser_tescil`: `file_base64` ile verirseniz dosyanın içeriği.

Kimin kararı: bu paket yalnızca İmzala API'siyle konuşur; yapay zekâ sağlayıcısına veri gönderen, sizin seçtiğiniz araçtır. Kişisel çalışma alanında bu kararı siz verirsiniz. Kurum çalışma alanında veri sorumlusu kurumunuzdur: bu araçları kurum verisiyle kullanmadan önce kurumunuzun buna izin verdiğini teyit edin (kurum yöneticisi erişimi kapatabilir, bkz. "Kurum politikası"). Sözleşme taraflarına ait verileri bu yolla işlemeden önce, yurt dışına aktarım dahil veri sorumlusu yükümlülüklerini değerlendirin. Belgeleriniz sağlık gibi özel nitelikli veri içeriyorsa bu araçlarla işlemeden önce ayrıca değerlendirin.

---

## Kurum politikası

Bir kurumun yöneticisi, bu paketin kurumun İmzala çalışma alanına erişimini kapatabilir. Bu durumda paket üzerinden gelen istekler reddedilir ve araç "Kurumunuz yapay zekâ araçlarının İmzala hesabına erişimini kapattı" mesajını döner. Bu bir kurum politikasıdır, teknik bir kilit değildir: yalnızca bu resmî paketi tanır, API anahtarını başka bir istemciyle kullanan erişimi engellemez. Kesin engel için kurum yöneticisi ilgili API anahtarlarını iptal etmelidir. Erişim için kurum yöneticinizle görüşün.

---

## Hata durumlarında

Araçlar sunucunun ham hata metnini aktarmaz; ne olduğunu ve sonraki adımı söyleyen kısa bir mesaj döner. Sözleşme oluşturan araçlarda bilmeniz gerekenler:

- **Mesaj bir sözleşme kimliği veriyorsa sözleşme oluşmuştur.** Kredi yetersizliği, üye aylık limiti ya da kredi mutabakatı hatasında sözleşme taslak olarak kalabilir ve davet gönderilmez. Aracı yeniden çağırmayın; taslak panelden gönderilir.
- **Tekrar koruması.** `idempotency_key` vermeden aynı içerikle (aynı şablon, taraflar ve değişkenler) 10 dakika içinde ikinci bir sözleşme oluşturma isteği durdurulur ve mevcut sözleşmenin kimliği döner. Bu en iyi çaba korumasıdır, kesin bir engel değildir. İkinci sözleşmeyi bilerek istiyorsanız `tekrar_onayi: true` verin.
- **`idempotency_key`.** Aynı anahtar ve aynı içerikle yapılan tekrar istek yeni sözleşme oluşturmaz, ilk sözleşmeyi döndürür. Anahtar 1-255 karakter, boşluksuz ve yalnız ASCII olmalıdır.
- **İstek sınırı.** Anahtar başına dakikada 60 istek; toplu gönderimde dakikada 5, Eser Tasdik işleminde dakikada 10. Aşıldığında araç kaç saniye beklemeniz gerektiğini söyler.

---

## Araclar

### `whoami`

Hesap bilgilerini ve anlık kredi bakiyesini gösterir.

**Girdi:** yok

**Cikti ornegi:**

```
Hesap: ayse@example.com (Ayşe Yılmaz)
Kredi: 42 kalan
Calisma alani: Kisisel
```

---

### `eser_tescil`

Eser Tasdik hizmeti: verdiğiniz dosya için bir kayıt oluşturur; dosyanın özeti (SHA-256) bir zaman damgası sağlayıcısının ürettiği RFC 3161 zaman damgasıyla damgalanır. Kayıt, dosyanın en geç belirtilen anda var olduğunu ve o andan sonra değişmediğini teknik (kriptografik) olarak gösterir. Kredi harcar. Araç adındaki "tescil" tarihsel bir addır: bu işlem eser, telif ya da başka bir hak tescili değildir, imza da değildir.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `file_path` | `string` | XOR | Eser Tasdik kaydı oluşturulacak dosyanın yerel yolu |
| `file_base64` | `string` | XOR | Dosya icerigi (standart canonical base64; data-URL veya URL-safe base64 kabul edilmez) |
| `file_name` | `string` | Evet | Dosya adi, uzanti dahil (orn. `belge.pdf`) |
| `owner_first_name` | `string` | Hayir | Eser sahibinin adi (beyan) |
| `owner_last_name` | `string` | Hayir | Eser sahibinin soyadi (beyan) |
| `description` | `string` | Hayir | Eser aciklamasi |
| `idempotency_key` | `string` | Hayir | Ayni istegi tekrarlamamak icin benzersiz anahtar |

`file_path` ve `file_base64` ayni anda kullanilmaz; birini verin.

---

### `sozlesme_durumu`

Bir sözleşmenin durumunu ve hangi tarafların imzaladığını gösterir. "X sözleşmesini kim imzaladı, imzalandı mı" sorularını yanıtlar. Sözleşme arşivlendiyse, süre takibi tanımlıysa ya da birden çok belgeli bir zarfsa bunları da gösterir (belge başına kaç tarafın karar verdiği ve mühür durumu). Taraf adları ve e-postaları API'nin döndürdüğü biçimde (kısaltılmış ve maskeli) gösterilir; yukarıdaki maske biçimi örnektir.

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
- Ayşe Y. (a***@example.com): imzaladı (2026-06-30T10:15:00Z)
- Örnek Kiracı (k***@example.com): bekliyor

Belgeler (imzalı PDF için imzali_pdf_indir aracına belge_id verilir):
- 1. Kira Sözleşmesi [doc_1], tür: Sözleşme, zorunlu, imza gerekir, durum: kısmen karar verildi (1/2 taraf)
- 2. Aydınlatma Metni [doc_2], tür: Aydınlatma metni, imza gerekmez, durum: karar bekleniyor (0/2 taraf)
Not: Belge durumu kararın verildiğini gösterir; kabul mü ret mi olduğunu göstermez. Onay ve açık rıza kayıtları İmzala.org panelinden ve tamamlanma sertifikasından izlenir.

Sonuç sayfası: https://e.imzala.org/sonuc/xyz789
```

Durum değerleri: Taslak (oluşturuldu ama taraflara gönderilmedi), Bekliyor, Tamamlandı, Süresi doldu, İptal edildi.

---

### `sozlesmelerim`

Hesaptaki (veya kurum çalışma alanındaki) sözleşmeleri listeler. Yalnız özet döner (başlık, durum, imzalayan taraf sayısı); taraf adları ve e-postaları listelenmez.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `durum` | `string` | Hayir | `taslak`, `bekliyor`, `tamamlandi`, `iptal`, `suresi-doldu` |
| `arsiv` | `string` | Hayir | `haric`, `yalniz`, `dahil`. Verilmezse arşivli sözleşmeler de listelenir (paneldeki listenin tersine) |
| `arama` | `string` | Hayir | Sözleşme kimliği, başlığı ve açıklamasında arar. Taraf adı, e-posta ve telefonda aramaz |
| `baslangic_tarih`, `bitis_tarih` | `string` | Hayir | Oluşturma tarihi aralığı (YYYY-AA-GG) |
| `sayfa`, `limit` | `number` | Hayir | Sayfalama (varsayılan 20, en az 10, en fazla 100) |

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

Bir şablonun detayını gösterir: taraflar, doldurulabilir değişkenler ve (varsa) zarftaki belgeler. Şablondan sözleşme oluşturmadan önce hangi değişkenlerin gerektiğini ve hangi belgelerin gönderileceğini öğrenmek için kullanılır. Belge kimlikleri, sözleşme oluştururken `documents.include` / `documents.exclude` ile belge seçmek için gerekir.

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

Belgeler (sözleşme oluştururken documents.include / documents.exclude ile seçilir):
- 1. Kira Sözleşmesi [doc_1], tür: CONTRACT, zorunlu, imza gerekir, varsayılan: gönderilir, atanan roller (template_party_id): tp_1, tp_2
- 2. Aydınlatma Metni [doc_2], tür: KVKK_NOTICE, imza gerekmez, varsayılan: gönderilmez, atanan roller (template_party_id): atanmış rol yok

Doldurulabilir değişkenler (sözleşme oluştururken kullanılır):
- signer.full_name (İmzalayan Ad Soyad), tip: text, zorunlu
- contract.start_date (Sözleşme Başlangıç Tarihi), tip: date, zorunlu, otomatik kaynak: current.date
```

> Belge bölümü yalnız şablonun zarf yapısı hazırsa görünür. Şablon kopyalandığında (panelden "Kopyala" ya da sözleşmeden şablon oluşturma) belge kimlikleri YENİDİR; kopyanın kimliklerini bu araçla yeniden okuyun.

---

### `imzali_pdf_indir`

Tamamlanmış bir sözleşmenin imzalı PDF'ini indirir. Sözleşmenin sahipliği önce doğrulanır; yalnız tamamlanmış (COMPLETED) sözleşmelerde çalışır. İndirme API anahtarınızla yapılır.

Çok belgeli zarfta her belgenin imzalı PDF'i ayrıdır: `belge_id` vermezseniz araç belgeleri listeler, istediğiniz belgeyi belirtip yeniden çağırırsınız. Belge henüz mühürleniyorsa araç bunu söyler ve dosya yazmaz; birkaç dakika sonra tekrar deneyin.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `demand_id` | `string` | Evet | İmzalı PDF'i indirilecek tamamlanmış sözleşmenin kimliği |
| `belge_id` | `string` | Hayir | Çok belgeli zarfta indirilecek belgenin kimliği (`sozlesme_durumu` çıktısından) |
| `save_path` | `string` | Hayir | PDF'in kaydedileceği yerel dosya yolu. Mutlak yol ve `.pdf` uzantısı gerekir; var olan bir dosyanın üzerine yazılmaz. Verilmezse base64 döner |

**Cikti ornegi (save_path verildiğinde):**

```
İmzalı PDF kaydedildi: /Users/ayse/Downloads/kira-sozlesmesi.pdf (284213 bayt)
```

**Cikti ornegi (save_path verilmediğinde, dosya küçükse):**

```
İmzalı PDF (base64):
JVBERi0xLjcKJ...
```

---

> **Not:** Bu MCP sunucusundaki dört sözleşme/şablon aracı (`sozlesme_durumu`, `imzali_pdf_indir`, `sablonlarim`, `sablon_detay`) yalnızca **okuma** kapsamı gerektirir: `sozlesme_durumu` + `imzali_pdf_indir` için `demands:read`, `sablonlarim` + `sablon_detay` için `templates:read`. Bu salt-okunur kapsamlar sözleşme oluşturma veya değiştirme yetkisi VERMEZ, dolayısıyla bir yapay zeka asistanına vermek için en güvenli seçimdir. Dashboard'daki "Yapay zeka asistanı için salt-okunur (önerilen)" hazır seçeneği bu kombinasyonu tek tıkla seçer.

---

### `sablondan_sozlesme_olustur`

Bir şablondan yeni sözleşme oluşturur. **Kredi harcar:** tutar imzacı sayısına, imza türüne, doğrulama yöntemine ve her imzacıya atanan belge sayısına göre hesaplanır (çok belgeli zarfta belge sayısı arttıkça kademeli indirim uygulanır). Harcanan kredi bu araçla geri alınmaz; iade yalnız belirli iptal ve silme hallerinde, hizmet koşullarına göre yapılır. Varsayılan olarak (`gonder` verilmez veya `false`) yalnızca sözleşmeyi oluşturur, taraflara herhangi bir mesaj GÖNDERMEZ; daveti sonradan panelden gönderirsiniz. `gonder: true` verirseniz taraflara hemen gerçek SMS ve e-posta daveti gönderilir.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `template_id` | `string` | Evet | Sözleşmenin oluşturulacağı şablonun kimliği |
| `parties` | `array` | Evet | Taraflar. Her öğe: `template_party_id` (sablon_detay ile öğrenilir) + `first_name` + `last_name` + (`email` veya `phone`) + isteğe bağlı `variables` |
| `variables` | `object` | Hayir | Şablon geneli değişkenler (slug: değer) |
| `documents` | `object` | Hayir | Bu sözleşmede gönderilecek belgeleri seçer: `include` (varsayılanda gönderilmeyeni ekler) ve/veya `exclude` (varsayılanda gönderileni çıkarır), liste başına en fazla 20 belge kimliği. Verilmezse şablonun varsayılan belge kümesi gider |
| `gonder` | `boolean` | Hayir | `true` verilirse taraflara HEMEN gerçek SMS ve e-posta daveti gönderilir. Varsayılan `false`: sadece oluşturur, mesaj göndermez |
| `idempotency_key` | `string` | Hayir | Sizin verdiğiniz iş referansı (ör. sipariş numarası). Aynı anahtar ve aynı içerikle tekrar istek yeni sözleşme oluşturmaz. 1-255 karakter, boşluksuz, yalnız ASCII |
| `tekrar_onayi` | `boolean` | Hayir | Tekrar koruması bir isteği durdurduktan sonra, aynı içerikte ikinci bir sözleşmeyi bilerek istiyorsanız `true`. `idempotency_key` ile birlikte kullanılamaz |

**Cikti ornegi (`gonder: false`, varsayılan):**

```
Sözleşme oluşturuldu: Kira Sözleşmesi 2026 [dem_789]
Durum: Bekliyor
Kredi harcandı: tutar imzacı sayısına, imza türüne, doğrulama yöntemine ve her imzacıya atanan belge sayısına göre hesaplanır. Güncel bakiye için whoami.

Taraflar:
- Ayşe Yılmaz

Davet gönderilmedi. Taraflara imza daveti İmzala.org panelindeki sözleşme sayfasından gönderilir. Bu aracı gonder: true ile yeniden çağırmayın; ikinci bir sözleşme oluşur.
Sonuç sayfası: https://e.imzala.org/sonuc/dem_789
```

**Belge seçimi (çok belgeli zarf):** Çıkarılan belge bu imza sürecine eklenmez: imzacıya gösterilmez, imzalı PDF'te ve tamamlanma sertifikasında yer almaz, kredi hesabına girmez. Sonuçta en az bir belge kalmalı ve eşlediğiniz her role en az bir belge düşmelidir. Mevzuat gereği karşı tarafa verilmesi gereken belgeleri (ör. ön bilgilendirme formu, aydınlatma metni) başka bir kanaldan vermiyorsanız çıkarmayın; bu belgelerin verilmesi yükümlülüğü sözleşmeyi gönderene aittir.

Belge seçimi hatalarında araç ne yapılacağını söyleyen ayrı mesajlar döner: seçimde şablona ait olmayan ya da iki listede birden geçen kimlik, seçim sonrası belge kalmaması, bir role hiç belge düşmemesi (bu durumda sözleşme ya hiç oluşmaz ya da taslakta kalır, her iki halde de kredi harcanmaz), şablonun belge yapısının henüz hazır olmaması ve ilk belgenin kaynak dosyasının bulunmaması.

> ⚠️ Bu araç **`demands:write`** kapsamı gerektirir. Salt-okunur bir anahtarla (`demands:read` / `templates:read`) çalışmaz, hata döner. Sablon_detay ile hangi `template_party_id` ve değişkenlerin gerektiğini önce öğrenin. Başarısızlıkta bu aracı körü körüne tekrar çağırmayın: hata mesajı bir sözleşme kimliği veriyorsa sözleşme zaten oluşmuştur. Ayrıntı için "Hata durumlarında" bölümüne bakın.

---

### `hatirlatma_gonder`

Bir sözleşmede henüz imzalamamış taraflara **gerçek SMS ve e-posta hatırlatması** gönderir.

**Girdiler:**

| Alan | Tip | Zorunlu | Aciklama |
|------|-----|---------|----------|
| `demand_id` | `string` | Evet | Hatırlatma gönderilecek sözleşmenin kimliği |
| `kanallar` | `array` | Hayir | Hangi kanallardan gönderilsin: `sms`, `email` (varsayılan: ikisi de) |
| `zorla` | `boolean` | Hayir | `true` verilirse 5 dakikalık bekleme süresi aşılır (kişi başı 3 SMS + 3 e-posta sınırı yine geçerlidir) |

**Cikti ornegi:**

```
Hatırlatma sonucu (sözleşme dem_789):
1 taraf için hatırlatma gönderildi, 0 taraf için gönderilmedi.

- Ayşe Yılmaz: SMS: sent, E-posta: sent
```

> ⚠️ Bu araç **`demands:write`** kapsamı gerektirir ve **gerçek mesaj gönderir**; geri alınamaz, dikkatli kullanın. Hatırlatmalar yalnızca imza için bekleyen sözleşmenin taraflarına giden işlemsel bildirimlerdir; pazarlama ya da tanıtım içermez. Anti-spam koruması vardır: aynı sözleşmeye 5 dakika içinde tekrar hatırlatma engellenir (`zorla: true` ile aşılabilir), kişi başına en fazla 3 SMS ve 3 e-posta gönderilir. Taraflara henüz gönderilmemiş (taslak) ya da süresi dolmuş sözleşmeye hatırlatma yapılamaz.

---

> **⚠️ Yazma (write) araçları, kapsam kuralı:** `sablondan_sozlesme_olustur` ve `hatirlatma_gonder` **`demands:write`** kapsamı gerektirir. Salt-okunur bir anahtar (`demands:read` / `templates:read`, dashboard'daki "Yapay zeka asistanı için salt-okunur" seçeneği) bu iki aracı KULLANAMAZ; bu kasıtlıdır. Yapay zeka asistanına salt-okunur anahtar veren bir kullanıcı, o asistanın kendi adına sözleşme oluşturmasını veya karşı taraflara gerçek mesaj göndermesini istemiyor demektir. Bu iki aracı kullanmak isteyenler, dashboard'dan `demands:write` kapsamlı **ayrı bir anahtar** oluşturmalıdır.

---

## Eser Tasdik Hakkında Hukuki Not

`eser_tescil` aracı İmzala.org'un Eser Tasdik hizmetini çalıştırır. Araç adındaki "tescil" tarihsel bir addır; işlem bir tescil değildir. Hizmet, dosyanızın özetini bir zaman damgası sağlayıcısının ürettiği RFC 3161 zaman damgasıyla kayda alır. Bu kayıt, dosyanın en geç belirtilen anda var olduğunu ve o andan sonra değişmediğini teknik (kriptografik) olarak gösterir; bir uyuşmazlıktaki ispat değeri ilgili hukuki çerçeveye göre değerlendirilir.

Bu işlem:

- Dijital imza ya da 5070 sayılı Kanun anlamında güvenli elektronik imza değildir; elle atılan imzanın yerine geçmez.
- Eser sahipliğinin, telif hakkının ya da başka bir hakkın resmî tescili değildir; sahiplik bilgisi yalnızca beyanınızdır.
- Noter onayı değildir.

5070 sayılı Kanun'da zaman damgası, elektronik sertifika hizmet sağlayıcısının (ESHS) elektronik imzayla doğruladığı kayıttır. İmzala.org ESHS değildir ve zaman damgası satmaz; harcanan kredi Eser Tasdik hizmetinin karşılığıdır.

Bu not hukuki danışmanlık değildir; belirli bir amaç için kullanmadan önce bir hukukçuya danışın.

---

## Katkı ve test

```bash
npm install
npm run typecheck
npm test
```

Yayın adımları için `docs/RELEASING.md` dosyasına bakın.
