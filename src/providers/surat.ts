import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CarrierProvider, DistrictMeta } from '../types';
import { normalizeTurkish } from '../utils/normalize';

function slugify(text: string): string {
    return normalizeTurkish(text)
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export class SuratProvider implements CarrierProvider {
    public readonly id = 'surat-kargo';
    public readonly displayName = 'Sürat Kargo';

    private client: AxiosInstance;
    private localDistrictsPath: string;
    private provinceCache: Map<string, string[]> = new Map();

    constructor() {
        const seedPath = path.resolve(process.cwd(), 'data', 'seeds', 'surat_districts.json');
        this.localDistrictsPath = fs.existsSync(seedPath) ? seedPath : path.resolve(process.cwd(), 'surat_districts.json');

        this.client = axios.create({
            baseURL: 'https://www.enyakinkargo.com',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
    }

    public async init(): Promise<void> {
        // Ready
    }

    public async getDistricts(fresh = false): Promise<DistrictMeta[]> {
        if (!fresh && fs.existsSync(this.localDistrictsPath)) {
            return JSON.parse(fs.readFileSync(this.localDistrictsPath, 'utf-8'));
        }

        let baseDistricts: DistrictMeta[] = [];
        const pttFile = [path.resolve(process.cwd(), 'data', 'seeds', 'ptt_districts.json'), path.resolve(process.cwd(), 'ptt_districts.json')].find(f => fs.existsSync(f));
        const arasFile = [path.resolve(process.cwd(), 'data', 'seeds', 'aras_cities.json'), path.resolve(process.cwd(), 'aras_cities.json')].find(f => fs.existsSync(f));

        if (pttFile) {
            baseDistricts = JSON.parse(fs.readFileSync(pttFile, 'utf-8'));
        } else if (arasFile) {
            const raw = JSON.parse(fs.readFileSync(arasFile, 'utf-8'));
            const unique = new Map<string, DistrictMeta>();
            for (const r of raw) {
                const key = `${r.cityName}_${r.townName}`;
                if (!unique.has(key)) {
                    unique.set(key, { il: r.cityName, ilce: r.townName });
                }
            }
            baseDistricts = Array.from(unique.values());
        }

        fs.writeFileSync(this.localDistrictsPath, JSON.stringify(baseDistricts, null, 2), 'utf-8');
        return baseDistricts;
    }

    public async checkBranch(district: DistrictMeta, retries = 3): Promise<boolean> {
        const ilSlug = slugify(district.il);
        const targetIlceNorm = normalizeTurkish(district.ilce);

        let branchAddresses = this.provinceCache.get(ilSlug);

        if (!branchAddresses) {
            try {
                const res = await this.client.get(`/surat-kargo/${ilSlug}`);
                const html = res.data;
                const matches = html.match(/<span class="text-sm text-gray-600">([\s\S]*?)<\/span>/g) || [];
                const parsedAddresses = matches.map((m: string) => normalizeTurkish(m));
                branchAddresses = parsedAddresses;
                this.provinceCache.set(ilSlug, parsedAddresses);
            } catch {
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, 1500));
                    return this.checkBranch(district, retries - 1);
                }
                this.provinceCache.set(ilSlug, []);
                return false;
            }
        }

        return (branchAddresses || []).some(addr => addr.includes(targetIlceNorm));
    }

    public async close(): Promise<void> {
        this.provinceCache.clear();
    }
}
