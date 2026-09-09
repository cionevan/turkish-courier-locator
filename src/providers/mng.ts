import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CarrierProvider, DistrictMeta } from '../types';
import { normalizeTurkish } from '../utils/normalize';

export class MngProvider implements CarrierProvider {
    public readonly id = 'mng-kargo';
    public readonly displayName = 'MNG Kargo (DHL eCommerce)';

    private client: AxiosInstance;
    private localDistrictsPath: string;
    private cityCodeMap: Map<string, string> = new Map();

    constructor() {
        const seedPath = path.resolve(process.cwd(), 'data', 'seeds', 'mng_districts.json');
        this.localDistrictsPath = fs.existsSync(seedPath) ? seedPath : path.resolve(process.cwd(), 'mng_districts.json');

        this.client = axios.create({
            baseURL: 'https://www.dhlecommerce.com.tr',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://www.dhlecommerce.com.tr/subelerimiz',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    }

    public async init(): Promise<void> {
        try {
            // Load 81 cities mapping
            const res = await this.client.post('/DeliveryPoint/GetCityToText', 'text=');
            if (Array.isArray(res.data)) {
                for (const c of res.data) {
                    this.cityCodeMap.set(normalizeTurkish(c.cityName), c.cityId);
                }
            }
        } catch (e: any) {
            console.warn(`[MNG] Warmup failed: ${e.message}`);
        }
    }

    public async getDistricts(fresh = false): Promise<DistrictMeta[]> {
        if (!fresh && fs.existsSync(this.localDistrictsPath)) {
            return JSON.parse(fs.readFileSync(this.localDistrictsPath, 'utf-8'));
        }

        // Use base districts from data/seeds/ if present
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
        try {
            const normCity = normalizeTurkish(district.il);
            let cityCode = this.cityCodeMap.get(normCity);

            if (!cityCode) {
                // Try to reload cities if map was empty
                const res = await this.client.post('/DeliveryPoint/GetCityToText', 'text=');
                if (Array.isArray(res.data)) {
                    for (const c of res.data) {
                        this.cityCodeMap.set(normalizeTurkish(c.cityName), c.cityId);
                    }
                }
                cityCode = this.cityCodeMap.get(normCity);
            }

            if (!cityCode) {
                // Fallback: guess plate code from cityId if available
                if (district.cityId) {
                    cityCode = district.cityId.toString().padStart(2, '0');
                } else {
                    return false;
                }
            }

            // Look up districtId in MNG system
            const distRes = await this.client.post(
                '/DeliveryPoint/GetDistrictToText',
                `cityId=${cityCode}&text=${encodeURIComponent(district.ilce)}`
            );

            if (!Array.isArray(distRes.data) || distRes.data.length === 0) {
                return false;
            }

            const targetIlceNorm = normalizeTurkish(district.ilce);
            const mngDist = distRes.data.find((d: any) => {
                const dn = normalizeTurkish(d.districtName || '');
                return dn === targetIlceNorm || dn.includes(targetIlceNorm);
            }) || distRes.data[0];

            if (!mngDist || !mngDist.districtId) {
                return false;
            }

            // Get close delivery points
            const branchRes = await this.client.post(
                '/DeliveryPoint/GetCloseDeliveryPoint',
                `cityCode=${cityCode}&districtCode=${mngDist.districtId}`
            );

            if (Array.isArray(branchRes.data) && branchRes.data.length > 0) {
                // Verify if any branch is physically situated in this district
                const hasLocal = branchRes.data.some((b: any) => {
                    const addr = normalizeTurkish(b.Address || '');
                    const name = normalizeTurkish(b.BranchName || '');
                    return addr.includes(targetIlceNorm) || name.includes(targetIlceNorm);
                });
                return hasLocal;
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
