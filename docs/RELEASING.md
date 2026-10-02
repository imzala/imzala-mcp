# Yayınlama

### Zorunlu yayin-oncesi e2e gate

`prepublishOnly` her `npm publish` oncesi sunu calistirir: **API kapsam kontrolü + build + unit test + e2e gate**. Kapsam kontrolü (`npm run spec:check`) bu paketteki OpenAPI kopyasının (`spec/openapi.v1.public.yaml`) yayındaki API ile aynı olduğunu doğrular; API ilerlediyse `npm run spec:sync` kopyayı tazeler ve `api-coverage.json`'da sınıflandırılmamış her yeni uç testleri kırar. E2E gate (`scripts/e2e-preflight.mjs`) yayinlanacak sunucunun ta kendisini (`dist/bin/stdio.js`) stdio uzerinden **gercek bir API anahtariyla gercek backend'e** karsi surer ve her aracin gercek ciktisini dogrular. Bir arac bozuksa (ornegin v1.0.0'da `eser_tescil` her yuklemede 500 veriyordu) publish **iptal** edilir.

Yayinlamadan once gercek bir anahtar export edin:

```bash
export IMZALA_E2E_API_KEY=imz_...                          # timestamps + templates + demands kapsamli
export IMZALA_E2E_BASE_URL=https://test-api.imzala.org     # istege bagli (prod kredisi harcamamak icin test ortami)
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
