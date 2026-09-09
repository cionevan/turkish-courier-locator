# Katkıda Bulunma Rehberi (Contributing Guide)

Projeye katkıda bulunmak istediğiniz için teşekkürler! Bu proje, Türkiye'deki kargo ağlarının şube durumlarını şeffaf ve açık kaynaklı olarak analiz etmeyi amaçlar.

---

## 🛠️ Geliştirme Ortamı Kurulumu

1. Projeyi fork edin ve yerel ortamınıza klonlayın:
   ```bash
   git clone https://github.com/cionevan/turkish-courier-locator.git
   cd turkish-courier-locator
   ```
2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   npm run setup
   ```
3. TypeScript derlemesini kontrol edin:
   ```bash
   npm run build
   ```

---

## 🧩 Yeni Bir Kargo Sağlayıcısı (Provider) Eklemek

Yeni bir kargo firması eklemek son derece kolaydır:

1. `src/providers/<firma-adi>.ts` dosyasını oluşturun ve `CarrierProvider` arayüzünü uygulayın:
   ```typescript
   import { CarrierProvider, DistrictMeta } from '../types';

   export class OrnekKargoProvider implements CarrierProvider {
       public readonly id = 'ornek-kargo';
       public readonly displayName = 'Örnek Kargo';

       async init(): Promise<void> {}
       async getDistricts(fresh?: boolean): Promise<DistrictMeta[]> {}
       async checkBranch(district: DistrictMeta): Promise<boolean> {}
       async close(): Promise<void> {}
   }
   ```
2. `src/providers/index.ts` dosyasındaki listeye yeni sağlayıcınızı ekleyin.
3. `npm run scan:all -- --il="Istanbul" --ilce="Kadikoy"` komutuyla test edin.
4. Bir Pull Request (PR) açın!

---

## 📋 Kod Kuralları
- Çapraz platform uyumluluğunu korumak için dosya yollarında asla sabit `\` kullanmayın (`path.join` / `path.resolve` kullanın).
- Türkçe karakter karşılaştırmalarında `normalizeTurkish` fonksiyonunu kullanın.
- PR göndermeden önce `npm run build` komutunun hatasız çalıştığından emin olun.
