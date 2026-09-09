import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CarrierProvider, DistrictMeta } from '../types';
import { normalizeTurkish } from '../utils/normalize';

export class YurticiProvider implements CarrierProvider {
    public readonly id = 'yurtici-kargo';
    public readonly displayName = 'Yurtiçi Kargo';

    private client: AxiosInstance;
    private localDistrictsPath: string;

    constructor() {
        const seedPath = path.resolve(process.cwd(), 'data', 'seeds', 'yurtici_districts.json');
        this.localDistrictsPath = fs.existsSync(seedPath) ? seedPath : path.resolve(process.cwd(), 'yurtici_districts.json');

        this.client = axios.create({
            baseURL: 'https://www.yurticikargo.com',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://www.yurticikargo.com/tr/online-servisler/en-yakin-sube',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
    }

    public async init(): Promise<void> {
        try {
            await this.client.get('/tr/online-servisler/en-yakin-sube');
        } catch (e: any) {
            console.warn(`[Yurtiçi] Warmup ping: ${e.message}`);
        }
    }

    public async getDistricts(fresh = false): Promise<DistrictMeta[]> {
        if (!fresh && fs.existsSync(this.localDistrictsPath)) {
            return JSON.parse(fs.readFileSync(this.localDistrictsPath, 'utf-8'));
        }

        // Use base districts from data/seeds/ if present
        let baseDistricts: DistrictMeta[];
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
        } else {
            throw new Error("[Yurtiçi] Please run 'npm run scan:ptt' or 'npm run scan:aras' once first to bootstrap Turkey district database.");
        }

        fs.writeFileSync(this.localDistrictsPath, JSON.stringify(baseDistricts, null, 2), 'utf-8');
        return baseDistricts;
    }

    public async checkBranch(district: DistrictMeta, retries = 3): Promise<boolean> {
        try {
            const geoRes = await this.client.get('/service/geodistricts', {
                params: {
                    address: `${district.il} ${district.ilce}`,
                    count: 3,
                    excludeCyprus: true,
                    language: 'tr'
                }
            });

            const items = geoRes.data;
            if (!Array.isArray(items) || items.length === 0) {
                return false;
            }

            const targetIlceNorm = normalizeTurkish(district.ilce);
            // Match item where CountyName matches target district
            const match = items.find((it: any) => {
                const countyNorm = normalizeTurkish(it.CountyName || '');
                return countyNorm === targetIlceNorm || countyNorm.includes(targetIlceNorm) || targetIlceNorm.includes(countyNorm);
            }) || items[0];

            if (!match || !match.CityId || !match.CountyId) {
                return false;
            }

            const branchRes = await this.client.get('/service/getbranchesbycitytown', {
                params: {
                    cityId: match.CityId,
                    countyId: match.CountyId,
                    districtId: match.DistrictId || '',
                    language: 'tr'
                }
            });

            if (Array.isArray(branchRes.data) && branchRes.data.length > 0) {
                // Ensure branch belongs to this district or city
                const hasLocalBranch = branchRes.data.some((b: any) => {
                    const addr = normalizeTurkish(b.Address || '');
                    const name = normalizeTurkish(b.Name || '');
                    return addr.includes(targetIlceNorm) || name.includes(targetIlceNorm);
                });
                return hasLocalBranch;
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
        // No persistent resources
    }
}
