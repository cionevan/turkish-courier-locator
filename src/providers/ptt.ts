import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { CarrierProvider, DistrictMeta } from '../types';
import { titleCaseTurkish } from '../utils/normalize';

export class PttProvider implements CarrierProvider {
    public readonly id = 'ptt-kargo';
    public readonly displayName = 'PTT Kargo';

    private client: AxiosInstance;
    private localDistrictsPath: string;

    constructor() {
        const seedPath = path.resolve(process.cwd(), 'data', 'seeds', 'ptt_districts.json');
        this.localDistrictsPath = fs.existsSync(seedPath) ? seedPath : path.resolve(process.cwd(), 'ptt_districts.json');

        // PTT .gov.tr uses KamuSM / Turkish Government Root CAs which require lenient SSL validation in Node.js
        const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
        this.client = axios.create({
            baseURL: 'https://enyakinptt.ptt.gov.tr',
            httpsAgent: agent,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://enyakinptt.ptt.gov.tr/',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    }

    public async init(): Promise<void> {
        // Quick healthcheck to warm up TLS session
        try {
            await this.client.get('/');
        } catch (e: any) {
            console.warn(`[PTT] Initial ping warning: ${e.message}`);
        }
    }

    private decodeBase64(base64Str: string): any {
        if (!base64Str || typeof base64Str !== 'string') return [];
        try {
            const buf = Buffer.from(base64Str.trim(), 'base64');
            const utf8 = buf.toString('utf-8');
            return JSON.parse(utf8);
        } catch {
            return [];
        }
    }

    public async getDistricts(fresh = false): Promise<DistrictMeta[]> {
        if (!fresh && fs.existsSync(this.localDistrictsPath)) {
            return JSON.parse(fs.readFileSync(this.localDistrictsPath, 'utf-8'));
        }

        console.log("[PTT] Downloading provinces and districts from EnYakinPTT API...");
        const ilRes = await this.client.get('/api/il');
        const provinces = this.decodeBase64(ilRes.data);

        const allDistricts: DistrictMeta[] = [];

        for (const prov of provinces) {
            try {
                const ilceRes = await this.client.post('/api/ilce', `ilID=${prov.Kod}`);
                const ilceler = this.decodeBase64(ilceRes.data);

                for (const ilce of ilceler) {
                    allDistricts.push({
                        il: titleCaseTurkish(prov.Ad),
                        ilce: titleCaseTurkish(ilce.Ad),
                        cityId: prov.Kod,
                        townId: ilce.Kod
                    });
                }
            } catch (err: any) {
                console.error(`[PTT] Failed to fetch districts for province ${prov.Ad}:`, err.message);
            }
        }

        fs.writeFileSync(this.localDistrictsPath, JSON.stringify(allDistricts, null, 2), 'utf-8');
        return allDistricts;
    }

    public async checkBranch(district: DistrictMeta, retries = 3): Promise<boolean> {
        try {
            const payload = `ilID=${district.cityId}&ilceID=${district.townId}&mahKoyID=0`;
            const res = await this.client.post('/api/Isyerleri', payload);
            const branches = this.decodeBase64(res.data);

            if (Array.isArray(branches) && branches.length > 0) {
                return true;
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
        // Nothing to close for axios
    }
}
