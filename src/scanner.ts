import { CarrierProvider, District } from './types';
import { StorageManager } from './storage/db';
import { runWithConcurrency } from './utils/pool';
import { normalizeTurkish } from './utils/normalize';

export interface ScanOptions {
    filterIl?: string;
    filterIlce?: string;
    fresh?: boolean;
    concurrency?: number;
}

export async function runCarrierScan(provider: CarrierProvider, options: ScanOptions = {}): Promise<void> {
    const concurrency = options.concurrency || parseInt(process.env.CONCURRENCY || '5', 10);
    const storage = new StorageManager(provider.id);

    console.log(`\n======================================================`);
    console.log(`🚀 Starting scan for: ${provider.displayName}`);
    console.log(`======================================================`);

    await storage.init();
    await provider.init();

    try {
        let districts = await provider.getDistricts(options.fresh);
        console.log(`[${provider.displayName}] Total districts loaded: ${districts.length}`);

        if (options.filterIl) {
            const targetIl = normalizeTurkish(options.filterIl);
            districts = districts.filter(d => normalizeTurkish(d.il) === targetIl);
        }

        if (options.filterIlce) {
            const targetIlce = normalizeTurkish(options.filterIlce);
            districts = districts.filter(d => normalizeTurkish(d.ilce) === targetIlce);
        }

        console.log(`[${provider.displayName}] Scanning ${districts.length} districts (Concurrency: ${concurrency})...`);

        let completed = 0;
        const results: District[] = [];

        const tasks = districts.map((district) => async () => {
            try {
                const subeVar = await provider.checkBranch(district);
                results.push({
                    il: district.il,
                    ilce: district.ilce,
                    subeVar
                });
            } catch (err: any) {
                console.error(`[${provider.displayName}] Error checking ${district.il} / ${district.ilce}:`, err.message);
            } finally {
                completed++;
                if (completed % 100 === 0 || completed === districts.length) {
                    console.log(`[${provider.displayName}] Progress: ${completed} / ${districts.length}`);
                }
            }
        });

        await runWithConcurrency(tasks, concurrency);

        console.log(`[${provider.displayName}] Saving outputs to disk...`);
        const changes = await storage.saveResults(results);

        console.log(`✅ [${provider.displayName}] Scan finished!`);
        console.log(`   - Total Scanned: ${results.length}`);
        console.log(`   - Branches Present: ${results.filter(r => r.subeVar).length}`);
        console.log(`   - Branches Absent: ${results.filter(r => !r.subeVar).length}`);
        console.log(`   - New Branches (Added): ${changes.subeEklenenIlceler.length}`);
        console.log(`   - Removed Branches: ${changes.subeKaldirilanIlceler.length}`);
    } finally {
        await provider.close();
        await storage.close();
    }
}
