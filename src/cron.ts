import cron from 'node-cron';
import { getAllProviders } from './providers';
import { runCarrierScan } from './scanner';

let isSyncRunning = false;

export async function runFullSync(): Promise<void> {
    if (isSyncRunning) {
        console.log('[Scheduler] Bir önceki senkronizasyon hala devam ediyor, yeni tarama atlandı.');
        return;
    }

    isSyncRunning = true;
    const startTime = Date.now();
    console.log('\n======================================================');
    console.log(`[Scheduler] Otomatik Gece Taraması Başlatıldı: ${new Date().toISOString()}`);
    console.log('======================================================\n');

    try {
        const providers = getAllProviders();
        for (const provider of providers) {
            try {
                console.log(`[Scheduler] ${provider.displayName} taranıyor...`);
                await runCarrierScan(provider, {
                    fresh: false,
                    concurrency: parseInt(process.env.CONCURRENCY || '5', 10)
                });
            } catch (err: any) {
                console.error(`[Scheduler] ${provider.displayName} tarama hatası:`, err.message);
            }
        }
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        console.log(`\n✅ [Scheduler] Tüm kargolar başarıyla senkronize edildi! Süre: ${durationSec} sn`);
    } catch (err: any) {
        console.error('[Scheduler] Genel senkronizasyon hatası:', err.message);
    } finally {
        isSyncRunning = false;
    }
}

export function initScheduler(): void {
    const enableCron = process.env.ENABLE_CRON !== 'false';
    const scheduleExpr = process.env.CRON_SCHEDULE || '0 5 * * *'; // Default: her gece 05:00

    if (!enableCron) {
        console.log('⏰ [Scheduler] Otomatik cron taraması devre dışı (ENABLE_CRON=false).');
        return;
    }

    if (!cron.validate(scheduleExpr)) {
        console.error(`❌ [Scheduler] Geçersiz CRON_SCHEDULE formatı: ${scheduleExpr}`);
        return;
    }

    console.log(`⏰ [Scheduler] Zamanlayıcı aktif! Planlanan çalışma: "${scheduleExpr}" (Varsayılan: Her gece 05:00)`);

    cron.schedule(scheduleExpr, () => {
        runFullSync().catch(err => {
            console.error('[Scheduler] Zamanlanmış görev yürütülürken hata:', err);
        });
    });
}
