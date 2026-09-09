import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { CarrierProvider, DistrictMeta } from '../types';

export class ArasProvider implements CarrierProvider {
    public readonly id = 'aras-kargo';
    public readonly displayName = 'Aras Kargo';

    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private localDistrictsPath: string;

    constructor() {
        const seedPath = path.resolve(process.cwd(), 'data', 'seeds', 'aras_cities.json');
        this.localDistrictsPath = fs.existsSync(seedPath) ? seedPath : path.resolve(process.cwd(), 'aras_cities.json');
    }

    public async init(): Promise<void> {
        // Launch headless browser with cross-platform flags
        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        });

        // Acquire session cookies
        const page = await this.context.newPage();
        try {
            await page.goto('https://www.araskargo.com.tr/subelerimiz', { waitUntil: 'networkidle', timeout: 30000 });
        } catch (e: any) {
            console.warn(`[Aras] Initial page load warning: ${e.message}. Continuing with API context...`);
        } finally {
            await page.close();
        }
    }

    public async getDistricts(fresh = false): Promise<DistrictMeta[]> {
        if (!fresh && fs.existsSync(this.localDistrictsPath)) {
            const data = JSON.parse(fs.readFileSync(this.localDistrictsPath, 'utf-8'));
            return this.deduplicate(data);
        }

        if (!this.context) throw new Error("ArasProvider context not initialized");

        console.log("[Aras] Downloading city and district data from API...");
        const res = await this.context.request.post('https://www.araskargo.com.tr/api/city/with-town', {
            data: { search: "", LanguageCode: "tr" },
            headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        if (!json.ok) throw new Error(`[Aras] Failed to fetch city list: ${JSON.stringify(json.error)}`);

        fs.writeFileSync(this.localDistrictsPath, JSON.stringify(json.data, null, 2), 'utf-8');
        return this.deduplicate(json.data);
    }

    private deduplicate(rawItems: any[]): DistrictMeta[] {
        const unique = new Map<string | number, DistrictMeta>();
        for (const item of rawItems) {
            if (!unique.has(item.townId)) {
                unique.set(item.townId, {
                    il: item.cityName,
                    ilce: item.townName,
                    townId: item.townId,
                    cityId: item.cityId
                });
            }
        }
        return Array.from(unique.values());
    }

    public async checkBranch(district: DistrictMeta, retries = 3): Promise<boolean> {
        if (!this.context) throw new Error("ArasProvider context not initialized");

        try {
            const res = await this.context.request.post('https://www.araskargo.com.tr/api/units/by-town-id', {
                data: { Id: district.townId?.toString(), LanguageCode: "tr" },
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            const json = await res.json();

            if (json.ok && json.data) {
                if (json.data.Code === 444) return false;
                if (json.data.Code === 200 && Array.isArray(json.data.Responses) && json.data.Responses.length > 0) {
                    return true;
                }
            }
            return false;
        } catch (err: any) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 1500));
                return this.checkBranch(district, retries - 1);
            }
            throw err;
        }
    }

    public async close(): Promise<void> {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
