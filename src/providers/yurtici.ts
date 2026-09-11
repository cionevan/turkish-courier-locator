import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CarrierProvider, DistrictMeta } from '../types';

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

    private normalizeWords(text: string): string[] {
        return (text || '')
            .toLowerCase()
            .replace(/İ/g, 'i')
            .replace(/I/g, 'i')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'c')
            .replace(/[^a-z0-9]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    private matchesDistrict(text: string, targetDistrict: string): boolean {
        const normTarget = this.normalizeWords(targetDistrict).join('');
        const textWords = this.normalizeWords(text);
        const textCollapsed = textWords.join('');

        if (normTarget.length <= 3) {
            return textWords.includes(normTarget);
        }
        return textCollapsed.includes(normTarget) || textWords.includes(normTarget);
    }

    public async checkBranch(district: DistrictMeta, retries = 3): Promise<boolean> {
        try {
            const normIl = this.normalizeWords(district.il).join('');
            const normIlce = this.normalizeWords(district.ilce).join('');

            const candidateQueries = [
                `${district.ilce} ${district.il}`,
                `${district.il} ${district.ilce}`,
                district.ilce
            ];

            let matches: any[] = [];

            // 1. Primary resolver: /service/getgeosearch
            for (const q of candidateQueries) {
                try {
                    const geoRes = await this.client.get('/service/getgeosearch', {
                        params: {
                            address: q,
                            maxResultCount: 20,
                            language: 'tr'
                        }
                    });
                    if (Array.isArray(geoRes.data) && geoRes.data.length > 0) {
                        const found = geoRes.data.filter((it: any) => {
                            const itCity = this.normalizeWords(it.CityName).join('');
                            const itCounty = this.normalizeWords(it.CountyName).join('');
                            const cityOk = itCity.includes(normIl) || normIl.includes(itCity);
                            const countyOk = itCounty.includes(normIlce) || normIlce.includes(itCounty);
                            return cityOk && countyOk;
                        });
                        if (found.length > 0) {
                            matches = found;
                            break;
                        }
                    }
                } catch {
                    // Try next query
                }
            }

            // 2. Secondary fallback resolver: /service/geodistricts
            if (matches.length === 0) {
                for (const q of candidateQueries) {
                    try {
                        const geoRes = await this.client.get('/service/geodistricts', {
                            params: {
                                address: q,
                                count: 50,
                                excludeCyprus: true,
                                language: 'tr'
                            }
                        });
                        if (Array.isArray(geoRes.data) && geoRes.data.length > 0) {
                            const found = geoRes.data.filter((it: any) => {
                                const itCity = this.normalizeWords(it.CityName).join('');
                                const itCounty = this.normalizeWords(it.CountyName).join('');
                                const cityOk = itCity.includes(normIl) || normIl.includes(itCity);
                                const countyOk = itCounty.includes(normIlce) || normIlce.includes(itCounty);
                                return cityOk && countyOk;
                            });
                            if (found.length > 0) {
                                matches = found;
                                break;
                            }
                        }
                    } catch {
                        // Try next query
                    }
                }
            }

            if (matches.length === 0) {
                return false;
            }

            // Test up to 5 distinct DistrictIds for this county
            const distinctDistrictIds: number[] = Array.from(new Set(matches.map((m: any) => m.DistrictId))).slice(0, 5);

            for (const distId of distinctDistrictIds) {
                const sample = matches.find((m: any) => m.DistrictId === distId);
                if (!sample || !sample.CityId || !sample.CountyId) continue;

                try {
                    const branchRes = await this.client.get('/service/getbranchesbycitytown', {
                        params: {
                            cityId: sample.CityId,
                            countyId: sample.CountyId,
                            districtId: distId,
                            language: 'tr'
                        }
                    });

                    if (Array.isArray(branchRes.data) && branchRes.data.length > 0) {
                        const hasLocalBranch = branchRes.data.some((b: any) =>
                            this.matchesDistrict(b.Address, district.ilce) || this.matchesDistrict(b.Name, district.ilce)
                        );
                        if (hasLocalBranch) {
                            return true;
                        }
                    }
                } catch {
                    // Try next district ID
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
        // No persistent resources
    }
}
