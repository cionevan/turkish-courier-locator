# Changelog

Tüm önemli değişiklikler bu dosyada belgelenmektedir. Proje [Semantic Versioning](https://semver.org/lang/tr/) standardını takip eder.

---

## [2.3.0] - 2026-09-10

### Eklenenler (Added)
- **Toplu Şube Listesi & B2B E-Ticaret Entegrasyonu (`GET /api/branches`):**
  - Türkiye Ulusal Adres Veri Tabanı (**UAVT**) resmi il ve ilçe kodları (`ilKodu`, `ilceKodu`) eşleştirme motoru.
  - E-ticaret panelleri ve sipariş işleme sistemleri için toplu şube kontrol ucu.
  - HTTP `ETag` ve `If-None-Match` ile `304 Not Modified` önbellek ve bant genişliği tasarrufu.
  - `?carrier=` (tekil/tümü) ve `?since=` (değişim akışı) parametrik filtreleme desteği.
  - Yalnızca ölçülmüş ilçeleri döndüren, `hasBranch: boolean`, `generatedAt`, `lastAttemptAt` ve `checkedAt` alanları içeren sözleşme uyumlu JSON şeması.
- **Graceful Shutdown & Container Yaşam Döngüsü:**
  - `SIGTERM` ve `SIGINT` sinyal yakalama mekanizması ile Docker/Dokploy sıfır kesintili (zero-downtime) rolling deploy desteği.
- **Çoklu İlçe Çözümleme Rozetleri (Multi-Province Disambiguation Pills):** Türkiye genelinde birden fazla ilde aynı ada sahip olan 27 ilçe (örneğin *Yenişehir*, *Gölbaşı*, *Ereğli*, *Kemer*) için kullanıcı sorgu yaptığında anında alternatif illeri gösteren dinamik hızlı geçiş hapları eklendi.
- **Apple Human Interface Arayüz Tasarımı:**
  - SF Pro / Inter font ailesi ve Apple tipografi hiyerarşisi.
  - Açık modda (`#F5F5F7` tuval, saf beyaz `#FFFFFF` kartlar, zarif sınırlar).
  - Karanlık modda (`#000000` tuval, `#161617` kartlar, Apple koyu gri yükseltmeleri).
  - Sistem teması (OS prefers-color-scheme) otomatik algılama ve kalıcı kullanıcı seçimi (`localStorage`).
  - Giriş alanları için bağımsız tek tıkla temizleme (`✕`) butonları.
  - 5/5 kargo firması için responsive 5 sütunlu kart ızgarası.
- **Dinamik SEO & Sosyal Paylaşım Entegrasyonu:**
  - Dinamik Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) ve Twitter Card meta etiketleri.
  - Arama motorları için dinamik `sitemap.xml` ve `robots.txt` uç noktaları.
  - Schema.org `WebApplication` ve `SoftwareApplication` JSON-LD yapılandırılmış verisi.
  - Host bağımsız dinamik domain algılama (`req.headers.host` veya `.env` `DOMAIN`).
- **Dokploy & Docker Swarm Entegrasyonu:**
  - Traefik reverse proxy etiketleri, healthcheck direktifleri ve `.dockerignore` iyileştirmeleri.
  - Dahili `node-cron` zamanlayıcı ile bağımsız periyodik otomatik tarama mekanizması.

### Düzeltilenler (Fixed)
- Dokploy container yeniden başlatmalarında oluşan npm `SIGTERM` hata çıkış kodu giderildi.
- Sürat Kargo sağlayıcısındaki tip güvenliği ve regex ayrıştırma hataları giderildi.
- Tailwind CSS v4.3.3 `@custom-variant dark` tanımlaması eklenerek sınıf tabanlı karanlık mod tam uyumlu hale getirildi.
- SQLite3 0-vulnerability güncel sürüme yükseltildi.

---

## [2.2.0] - 2026-02-15

### Eklenenler (Added)
- **MNG Kargo (DHL eCommerce):** DeliveryPoint API entegrasyonu tamamlandı.
- **Sürat Kargo:** Bölge ve ilçe şube tarayıcısı eklendi.
- Çoklu sağlayıcı tarama altyapısı (`npm run scan:all`) ve eşzamanlı istek havuzu (`PromisePool`).

---

## [2.0.0] - 2026-01-10

### Eklenenler (Added)
- **REST API & SQLite Ön Bellekleme:** 984 ilçenin şube durumlarını milisaniyeler mertebesinde sorgulayan Express REST API.
- **Tarihsel Değişiklik Algılama (Diff Engine):** Kapanan veya yeni açılan şubeleri tespit edip JSON raporu üreten motor.
- **PTT & Yurtiçi Kargo Entegrasyonu:** Kamu ve özel kargo ağlarının şube sorgulama servisleri eklendi.

---

## [1.0.0] - 2025-11-20

### Eklenenler (Added)
- Aras Kargo il/ilçe şube tarayıcısı ve CLI sorgu aracı.
- JSON, CSV ve SQLite veri aktarım formatları.
