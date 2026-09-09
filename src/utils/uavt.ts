import * as fs from 'fs';
import * as path from 'path';
import { normalizeTurkish } from './normalize';

export interface UavtRecord {
    ilKodu: number;
    ilceKodu: number;
    il: string;
    ilce: string;
}

let uavtMap: Map<string, UavtRecord> | null = null;
let allRecords: UavtRecord[] = [];

// City alias normalizations (e.g. Afyon -> Afyonkarahisar, İçel -> Mersin)
const CITY_ALIASES: Record<string, string> = {
    'afyon': 'afyonkarahisar',
    'icel': 'mersin',
    'k.maras': 'kahramanmaras',
    'kmaras': 'kahramanmaras',
    'maras': 'kahramanmaras',
    'g.antep': 'gaziantep',
    'antep': 'gaziantep'
};

const DISTRICT_ALIASES: Record<string, string> = {
    'kahramankazan': 'kazan',
    'eyupsultan': 'eyup',
    'eyup': 'eyupsultan',
    '19 mayis': '19.may',
    '19.mayis': '19.may',
    'ondokuzmayis': '19.may',
    'ondokuz mayis': '19.may',
    '19.may': '19 mayis',
    'mihaliccik': 'mihalicik'
};

// Newly formed districts (2017-2018) & canonical overrides
const CANONICAL_OVERRIDES: UavtRecord[] = [
    { ilKodu: 8, ilceKodu: 2105, il: 'Artvin', ilce: 'Kemalpaşa' },
    { ilKodu: 68, ilceKodu: 2106, il: 'Aksaray', ilce: 'Sultanhanı' },
    { ilKodu: 30, ilceKodu: 2107, il: 'Hakkari', ilce: 'Derecik' },
    { ilKodu: 34, ilceKodu: 1325, il: 'İstanbul', ilce: 'Eyüpsultan' },
    { ilKodu: 55, ilceKodu: 1830, il: 'Samsun', ilce: '19 Mayıs' },
    { ilKodu: 72, ilceKodu: 1174, il: 'Batman', ilce: 'Merkez' }
];

function normalizeCity(name: string): string {
    const norm = normalizeTurkish(name);
    return CITY_ALIASES[norm] || norm;
}

function normalizeTown(name: string): string {
    let norm = normalizeTurkish(name);
    norm = norm.replace(/\s*\(merkez\)/g, '').trim();
    return DISTRICT_ALIASES[norm] || norm;
}

/**
 * Initializes and caches the UAVT registry in memory
 */
export function initUavtRegistry(): void {
    if (uavtMap) return;

    uavtMap = new Map<string, UavtRecord>();
    allRecords = [];

    const seedPaths = [
        path.resolve(__dirname, '..', '..', 'data', 'seeds', 'ptt_districts.json'),
        path.resolve(process.cwd(), 'data', 'seeds', 'ptt_districts.json'),
        path.resolve(__dirname, 'data', 'seeds', 'ptt_districts.json')
    ];

    const seedFile = seedPaths.find(p => fs.existsSync(p));
    if (seedFile) {
        try {
            const raw = fs.readFileSync(seedFile, 'utf-8');
            const list = JSON.parse(raw);

            for (const item of list) {
                if (!item.il || !item.ilce) continue;

                // Fix: Batman Merkez duplicate in PTT seed (1174 is the official NVİ/UAVT code, 1552 is invalid)
                if (normalizeCity(item.il) === 'batman' && normalizeTown(item.ilce) === 'merkez' && Number(item.townId) === 1552) {
                    continue;
                }

                let displayIlce = item.ilce;
                // Canonical name mappings
                if (normalizeCity(item.il) === 'istanbul' && normalizeTown(item.ilce) === 'eyup') {
                    displayIlce = 'Eyüpsultan';
                } else if (normalizeCity(item.il) === 'samsun' && (item.ilce === '19.may' || Number(item.townId) === 1830)) {
                    displayIlce = '19 Mayıs';
                } else if (normalizeCity(item.il) === 'ankara' && normalizeTown(item.ilce) === 'kazan') {
                    displayIlce = 'Kahramankazan';
                }

                const record: UavtRecord = {
                    ilKodu: Number(item.cityId) || 0,
                    ilceKodu: Number(item.townId) || 0,
                    il: item.il,
                    ilce: displayIlce
                };

                const key1 = `${normalizeCity(item.il)}_${normalizeTown(item.ilce)}`;
                const key2 = `${normalizeCity(item.il)}_${normalizeTurkish(displayIlce)}`;
                uavtMap.set(key1, record);
                uavtMap.set(key2, record);
                allRecords.push(record);
            }
        } catch (err) {
            console.error('❌ [UAVT] Seed yüklenirken hata:', err);
        }
    }

    // Apply canonical overrides & newly formed districts (Kemalpaşa, Sultanhanı, Derecik, etc.)
    for (const ov of CANONICAL_OVERRIDES) {
        const key1 = `${normalizeCity(ov.il)}_${normalizeTown(ov.ilce)}`;
        const key2 = `${normalizeCity(ov.il)}_${normalizeTurkish(ov.ilce)}`;
        uavtMap.set(key1, ov);
        uavtMap.set(key2, ov);

        // Update or insert into allRecords
        const existingIdx = allRecords.findIndex(r => r.ilKodu === ov.ilKodu && normalizeTurkish(r.ilce) === normalizeTurkish(ov.ilce));
        if (existingIdx >= 0) {
            allRecords[existingIdx] = ov;
        } else {
            allRecords.push(ov);
        }
    }
}

/**
 * Lookup UAVT information by province and district name.
 */
export function lookupUavt(il: string, ilce: string): UavtRecord | null {
    if (!uavtMap) {
        initUavtRegistry();
    }

    if (!uavtMap) return null;

    const normIl = normalizeCity(il);
    const normIlce = normalizeTown(ilce);

    // KKTC exception: Northern Cyprus districts do NOT exist in Turkey UAVT.
    // Must return null so panel correctly treats them as unmeasured.
    if (normIl.startsWith('kuzey kibris') || normIl.includes('kibris')) {
        return null;
    }

    // 1. Direct match (il + ilce)
    const exact = uavtMap.get(`${normIl}_${normIlce}`) || uavtMap.get(`${normIl}_${normalizeTurkish(ilce)}`);
    if (exact) return exact;

    // 2. Fallback: match by ilce if unique across Turkey
    const matches = allRecords.filter(r => normalizeTown(r.ilce) === normIlce || normalizeTurkish(r.ilce) === normalizeTurkish(ilce));
    if (matches.length === 1) {
        return matches[0];
    }

    // 3. Fallback: match by il code if il is numeric string
    const numIl = parseInt(il, 10);
    if (!isNaN(numIl) && numIl >= 1 && numIl <= 81) {
        const matchByCode = allRecords.find(r => r.ilKodu === numIl && (normalizeTown(r.ilce) === normIlce || normalizeTurkish(r.ilce) === normalizeTurkish(ilce)));
        if (matchByCode) return matchByCode;
    }

    return null;
}

/**
 * Returns all UAVT records
 */
export function getAllUavtRecords(): UavtRecord[] {
    if (!uavtMap) {
        initUavtRegistry();
    }
    return allRecords;
}
