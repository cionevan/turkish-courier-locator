<div align="center">

# 📦 Kargo Şube Kontrol & Takip Motoru
### Multi-Carrier Branch Locator, Change Detection & REST API

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Automated-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](Dockerfile)
[![Dokploy](https://img.shields.io/badge/Dokploy-%26_Traefik_Ready-7C3AED?style=for-the-badge)](https://dokploy.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br/>

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/cionevan/turkish-courier-locator)
[![GitHub Stars](https://img.shields.io/github/stars/cionevan/turkish-courier-locator?style=social)](https://github.com/cionevan/turkish-courier-locator)
[![GitHub Forks](https://img.shields.io/github/forks/cionevan/turkish-courier-locator?style=social)](https://github.com/cionevan/turkish-courier-locator)

<br/>

**Türkiye'nin 81 il ve 984 ilçesinde 5 büyük kargo firmasının fiziksel şube varlığını tarayan, değişiklikleri izleyen, canlı REST API ve görsel web arayüzü sunan açık kaynaklı lojistik zekası.**

[English Documentation (README_EN.md)](README_EN.md) · [🚀 Canlı Demo & API](https://turkish-courier-locator.onrender.com) · [Hata Bildir](https://github.com/cionevan/turkish-courier-locator/issues) · [Katkıda Bulun](CONTRIBUTING.md)

<br/>

![Web Dashboard](assets/dashboard_bolvadin.png)
*Görsel Web Sorgu Arayüzü - Bolvadin Sorgusu Örneği*

</div>

---

## 🌟 Neden Bu Proje?

E-ticaret siteleri, lojistik operasyonları, pazar yeri satıcıları ve son tüketiciler için **"Bu ilçeye hangi kargo gidiyor? Hangi kargonun şubesi var?"** sorusu kritik bir operasyonel veridir. 

Bu proje;
1. **Gereksiz Verileri Eler:** Şube adı, koordinatı veya telefonuna boğulmadan yalnızca **il, ilçe, şube var mı (true/false)** bilgisini hedefler.
2. **5 Büyük Kargo Ağını Kapsar:** Aras Kargo, PTT Kargo, Yurtiçi Kargo, MNG Kargo (DHL) ve Sürat Kargo'yu tek çatı altında toplar.
3. **Değişiklikleri Yakalar (Diff Engine):** Yeni açılan veya kapanan şubeleri SQLite tabanlı tarihsel karşılaştırmayla anında tespit eder.
4. **Milisaniyelik REST API:** 984 ilçeyi yerel SQLite önbelleğinde tutarak milisaniyeler içinde çoklu kargo yanıtı döner.

---

## 🚚 Desteklenen Kargo Firmaları

| Kargo Firması | Sağlayıcı ID | Sorgu Yöntemi | Durum |
| :--- | :--- | :--- | :---: |
| **Aras Kargo** | `aras-kargo` | Aras Kargo Official API (`/api/units/by-town-id`) | ✅ Aktif |
| **PTT Kargo** | `ptt-kargo` | EnYakınPTT Kamu API (`/api/Isyerleri`) | ✅ Aktif |
| **Yurtiçi Kargo** | `yurtici-kargo` | Yurtiçi Kargo Geo/Branch Servisi (`/service/getbranchesbycitytown`) | ✅ Aktif |
| **MNG Kargo (DHL)** | `mng-kargo` | DHL eCommerce DeliveryPoint API (`/DeliveryPoint/GetCloseDeliveryPoint`) | ✅ Aktif |
| **Sürat Kargo** | `surat-kargo` | Sürat Kargo Bölge/İlçe Harita Kataloğu | ✅ Aktif |

---

## 📸 Canlı Doğrulama Örnekleri

Sistem sahadaki gerçek şube varlık durumlarını %100 isabetle doğrular:

<div align="center">
  <img src="assets/dashboard_light.png" width="48%" alt="Apple Aydınlık Mod (Light Mode)" />
  <img src="assets/dashboard_dark.png" width="48%" alt="Apple Karanlık Mod (Dark Mode)" />
</div>

- **Apple Human Interface (Aydınlık & Karanlık Mod):** Sistem tercihinize göre otomatik açılır, tek tıkla (`☀️ / 🌙`) anında modlar arası pürüzsüz geçiş yapılır.
- **Rize / Çamlıhemşin:** Dağlık/kırsal ilçelerde özel kargo firmalarının fiziksel şubesi **yoktur**; yalnızca kamu kuruluşu olan **PTT Kargo** şubesi bulunur (`PTT: true`, diğerleri `false`).
- **İstanbul / Kadıköy & Afyon / Bolvadin:** 5 kargo firmasının tamamının fiziksel şubesi mevcuttur (`Tümü: true`).

---

## 🚀 Hızlı Başlangıç

### 1. Kurulum

```bash
# Projeyi klonlayın
git clone https://github.com/cionevan/turkish-courier-locator.git
cd turkish-courier-locator

# Bağımlılıkları yükleyin
npm install

# Playwright tarayıcı bileşenlerini kurun
npm run setup
```

### 2. Canlı REST API & Web Panelini Başlatın

```bash
npm run api
```
Tarayıcınızda açın: **`http://localhost:3000`**

---

## 📡 REST API Kullanımı

Sisteminizi kendi backend veya frontend uygulamanıza bağlamak için hazır REST endpoint'leri:

### `GET /api/check?ilce=:ilce`
Belirtilen ilçede hangi kargoların şubesi olduğunu JSON olarak döner.

#### Örnek İstek:
```bash
curl "http://localhost:3000/api/check?ilce=Bolvadin"
```

#### Örnek Yanıt:
```json
{
  "query": { "il": null, "ilce": "Yenişehir" },
  "matched": { "il": "Bursa", "ilce": "Yenişehir" },
  "alternatives": [
    { "il": "Diyarbakır", "ilce": "Yenişehir" },
    { "il": "Mersin", "ilce": "Yenişehir" }
  ],
  "summary": {
    "subesiOlanlar": [
      "Aras Kargo",
      "PTT Kargo",
      "Yurtiçi Kargo",
      "MNG Kargo (DHL eCommerce)",
      "Sürat Kargo"
    ],
    "subesiOlmayanlar": [],
    "toplamVar": 5,
    "toplamYok": 0,
    "mesaj": "Bursa / Yenişehir ilçesinde tüm kargoların şubesi mevcuttur."
  },
  "carriers": {
    "aras-kargo": { "name": "Aras Kargo", "hasBranch": true, "source": "cache" },
    "ptt-kargo": { "name": "PTT Kargo", "hasBranch": true, "source": "cache" },
    "yurtici-kargo": { "name": "Yurtiçi Kargo", "hasBranch": true, "source": "cache" },
    "mng-kargo": { "name": "MNG Kargo (DHL eCommerce)", "hasBranch": true, "source": "cache" },
    "surat-kargo": { "name": "Sürat Kargo", "hasBranch": true, "source": "cache" }
  }
}
```

> **Not:** Türkiye'de aynı ada sahip farklı ilçeler (Örn: *Gölbaşı: Adıyaman / Ankara*, *Yenişehir: Bursa / Diyarbakır / Mersin*) sorgulandığında, `alternatives` alanında diğer alternatif iller listelenir. Doğrudan net il seçmek için `?il=Ankara&ilce=Gölbaşı` şeklinde kesin sorgu yapabilirsiniz.

#### Canlı Canlı Sorgu (`&live=true`):
Önbellek yerine o an kargo sitelerine doğrudan istek atmak isterseniz `&live=true` parametresini ekleyebilirsiniz:
```bash
curl "http://localhost:3000/api/check?il=Istanbul&ilce=Kadikoy&live=true"
```

---

### `GET /api/branches` (Toplu Şube Listesi & B2B E-Ticaret Entegrasyonu)
E-ticaret panelleri ve sipariş işleme sistemleri için toplu şube verisini döner. Resmi **UAVT kodları** (`ilKodu`, `ilceKodu`), HTTP `ETag` (304 Not Modified) ve opsiyonel `?since=` filtrelemesi içerir.

#### Örnek İstek (Tekil Taşıyıcı):
```bash
curl -H "X-API-KEY: gizli_anahtar" "http://localhost:3000/api/branches?carrier=aras-kargo"
```

#### Örnek Yanıt:
```json
{
  "carrier": "aras-kargo",
  "generatedAt": "2026-09-09T16:36:52.694Z",
  "lastAttemptAt": "2026-09-09T16:36:52.694Z",
  "lastAttemptOk": true,
  "lastError": null,
  "totalCount": 979,
  "items": [
    {
      "ilKodu": 35,
      "ilceKodu": 1203,
      "il": "İzmir",
      "ilce": "Bornova",
      "hasBranch": true,
      "checkedAt": "2026-09-09T16:36:52.694Z"
    },
    {
      "ilKodu": 35,
      "ilceKodu": 1178,
      "il": "İzmir",
      "ilce": "Bayındır",
      "hasBranch": false,
      "checkedAt": "2026-09-09T16:36:52.694Z"
    }
  ]
}
```

- **Tüm Taşıyıcılar:** `?carrier=` belirtilmezse tüm 5 kargo firması `{ "aras-kargo": {...}, "ptt-kargo": {...} }` biçiminde döner.
- **Değişim Akışı:** `?since=2026-09-01T00:00:00Z` verilerek sadece belirli bir tarihten sonra güncellenenler çekilebilir.
- **ETag / 304:** `If-None-Match: "..."` başlığı ile liste değişmediğinde gövde indirilmeden `304 Not Modified` yanıtı alınır.

---


## 💻 CLI Tarama Komutları

Komut satırından toplu veya tekil taramalar yapabilirsiniz:

```bash
# 5 kargo firmasının tamamını tüm Türkiye genelinde sırayla tara
npm run scan:all

# Sadece tek bir kargo firmasını tara
npm run scan:aras
npm run scan:ptt
npm run scan:yurtici
npm run scan:mng
npm run scan:surat

# Filtreli tarama yap (İl veya İlçe bazlı)
npm run scan:all -- --il="Istanbul"
npm run scan:all -- --il="Istanbul" --ilce="Kadikoy"

# Eşzamanlılık (Concurrency) hızını belirterek çalıştır
npm run scan:ptt -- --concurrency=10

# İl/İlçe listesini API'den tazeleyerek yeniden indir
npm run scan:fresh
```

---

## 📁 Çıktı Dosyaları (`output/`)

Her tarama sonucunda `output/` dizininde 4 farklı formatta çıktı üretilir:

```
output/
├── aras-kargo.json / .csv / .sqlite / -changes.json
├── ptt-kargo.json / .csv / .sqlite / -changes.json
├── yurtici-kargo.json / .csv / .sqlite / -changes.json
├── mng-kargo.json / .csv / .sqlite / -changes.json
└── surat-kargo.json / .csv / .sqlite / -changes.json
```

### Değişiklik Raporu Formatı (`output/<kargo>-changes.json`):
```json
{
  "carrier": "aras-kargo",
  "checkedAt": "2026-09-09T19:04:18.000Z",
  "subeEklenenIlceler": [
    { "il": "Adana", "ilce": "Ceyhan" }
  ],
  "subeKaldirilanIlceler": []
}
```

---

## 🖥️ Çapraz Platform Desteği

Proje her türlü ortamda sıfır konfigürasyon ile çalışacak şekilde tasarlanmıştır:

- **Windows 11 / 10:** PowerShell & CMD uyumlu.
- **Linux (Ubuntu, Debian, CentOS, Fedora, Arch):** Headless kütüphaneleri optimize edildi.
- **macOS Intel (x86_64) & Apple Silicon (ARM64 M1/M2/M3/M4):** Native prebuild uyumlu.
- **Docker:**
  ```bash
  docker build -t kargo-scraper .
  docker run -p 3000:3000 -v $(pwd)/output:/app/output kargo-scraper npm run api
  ```

---

## 🚀 Dokploy & Traefik Desteği (%100 Uyumlu)

Bu proje, modern PaaS platformu **Dokploy** ve onun varsayılan ters vekili (reverse proxy) olan **Traefik** ile **%100 tam uyumlu** çalışacak şekilde yapılandırılmıştır.

### 🌟 Dokploy Özellikleri:
- **Otomatik SSL (Let's Encrypt):** Traefik üzerinden domaininize tek tıkla HTTPS sertifikası bağlanır.
- **Sağlık Kontrolü (Healthcheck):** `/health` uç noktası sayesinde konteyner açılmadan trafik yönlendirilmez (Zero-Downtime Deployment).
- **Kalıcı Depolama (Volume):** SQLite veritabanı ve taranan ilçe verileri her yeni sürüm yayınlandığında (`deploy`) silinmez, `/app/output` volume'unda güvenle saklanır.

### Dokploy'a Kurulum Yöntemleri:

#### Yöntem 1: Dokploy Web Paneli Üzerinden (En Kolay)
1. Dokploy panelinizde **Applications** -> **Create Application** seçin.
2. Kaynak olarak Git reponuzu bağlayın (`Build Type: Dockerfile`).
3. Port kısmına **`3000`** yazın.
4. Domains sekmesinden alan adınızı (Örn: `kargo.domaininiz.com`) ekleyin.
5. **Deploy** butonuna basın! Dokploy ve Traefik SSL dahil tüm yönlendirmeyi otomatik yapacaktır.

#### Yöntem 2: Docker Compose (Stack) ile
Projeyle birlikte gelen [`docker-compose.yml`](docker-compose.yml) dosyasını kullanarak:
```bash
# .env dosyasında domaininizi tanımlayın:
DOMAIN=kargo.domaininiz.com

# Başlatın
```

---

## ⚙️ Ortam Değişkenleri (.env Yapılandırması)

Sunucunuzda projeyi istediğiniz çalışma moduna göre `.env` üzerinden özelleştirebilirsiniz:

| Değişken | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `PORT` | `3000` | Sunucunun dinleyeceği port |
| `HOST` | `0.0.0.0` | Sunucu host adresi |
| `ENABLE_UI` | `true` | `false` yapılırsa web arayüzü kapatılır; sunucu saf **Headless REST API** olarak çalışır. |
| `ENABLE_ROBOTS_INDEX` | `false` | `false` iken arama motorları engellenir (`noindex`, `Disallow: /`). |
| `ENABLE_CRON` | `true` | `true` iken dahili zamanlayıcı her gece 5 kargonun ilçelerini otomatik günceller. |
| `CRON_SCHEDULE` | `0 5 * * *` | Gece senkronizasyonunun çalışacağı saat (Standart cron ifadesi). |
| `API_KEY` | *(Boş)* | Tanımlanırsa API isteklerinde `X-API-KEY` başlığı veya `?api_key=` parametresi zorunlu olur. |
| `CONCURRENCY` | `5` | Eşzamanlı ağ istek sayısı (Scraper hız ayarı). |

---

## 🧩 Yeni Kargo Sağlayıcısı Eklemek

Sistem **Provider Pattern** mimarisiyle inşa edilmiştir. Yeni bir firma eklemek sadece 2 adımdır:

1. `src/providers/<firma>.ts` dosyasını oluşturup `CarrierProvider` arayüzünü uygulayın.
2. `src/providers/index.ts` dosyasına kaydedin.

Detaylar için [CONTRIBUTING.md](CONTRIBUTING.md) belgesini inceleyebilirsiniz.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında açık kaynak olarak lisanslanmıştır.
