import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { District, ChangesReport } from '../types';

export class StorageManager {
    private outputDir: string;
    private carrierId: string;
    private db: Database | null = null;

    constructor(carrierId: string, customOutputDir?: string) {
        this.carrierId = carrierId;
        this.outputDir = customOutputDir || path.resolve(process.cwd(), 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private get sqlitePath(): string {
        return path.join(this.outputDir, `${this.carrierId}.sqlite`);
    }

    private get jsonPath(): string {
        return path.join(this.outputDir, `${this.carrierId}.json`);
    }

    private get csvPath(): string {
        return path.join(this.outputDir, `${this.carrierId}.csv`);
    }

    private get changesPath(): string {
        return path.join(this.outputDir, `${this.carrierId}-changes.json`);
    }

    public async init(): Promise<void> {
        this.db = await open({
            filename: this.sqlitePath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS districts (
                il TEXT,
                ilce TEXT,
                sube_var BOOLEAN,
                checked_at DATETIME,
                PRIMARY KEY (il, ilce)
            )
        `);
    }

    public async getPreviousState(): Promise<Map<string, boolean>> {
        if (!this.db) throw new Error("DB not initialized");
        const rows = await this.db.all('SELECT il, ilce, sube_var FROM districts');
        const map = new Map<string, boolean>();
        for (const r of rows) {
            map.set(`${r.il}_${r.ilce}`, r.sube_var === 1);
        }
        return map;
    }

    public async saveResults(results: District[]): Promise<ChangesReport> {
        if (!this.db) throw new Error("DB not initialized");

        const prevMap = await this.getPreviousState();

        // Sort alphabetically
        results.sort((a, b) => {
            const ilComp = a.il.localeCompare(b.il, 'tr');
            if (ilComp !== 0) return ilComp;
            return a.ilce.localeCompare(b.ilce, 'tr');
        });

        // 1. JSON
        fs.writeFileSync(this.jsonPath, JSON.stringify(results, null, 2), 'utf-8');

        // 2. CSV
        const csvHeader = 'il,ilce,subeVar\n';
        const csvRows = results.map(r => `${r.il},${r.ilce},${r.subeVar}`).join('\n');
        fs.writeFileSync(this.csvPath, csvHeader + csvRows, 'utf-8');

        // 3. SQLite & 4. Changes
        const changes: ChangesReport = {
            carrier: this.carrierId,
            checkedAt: new Date().toISOString(),
            subeEklenenIlceler: [],
            subeKaldirilanIlceler: []
        };

        const now = changes.checkedAt;

        await this.db.exec('BEGIN TRANSACTION');
        try {
            for (const r of results) {
                const key = `${r.il}_${r.ilce}`;
                const prevSubeVar = prevMap.get(key);

                if (prevSubeVar !== undefined) {
                    if (prevSubeVar === false && r.subeVar === true) {
                        changes.subeEklenenIlceler.push({ il: r.il, ilce: r.ilce });
                    } else if (prevSubeVar === true && r.subeVar === false) {
                        changes.subeKaldirilanIlceler.push({ il: r.il, ilce: r.ilce });
                    }
                }

                await this.db.run(
                    `INSERT OR REPLACE INTO districts (il, ilce, sube_var, checked_at) VALUES (?, ?, ?, ?)`,
                    [r.il, r.ilce, r.subeVar ? 1 : 0, now]
                );
            }
            await this.db.exec('COMMIT');
        } catch (e) {
            await this.db.exec('ROLLBACK');
            throw e;
        }

        // Save changes JSON
        fs.writeFileSync(this.changesPath, JSON.stringify(changes, null, 2), 'utf-8');

        // If this is Aras Kargo, also mirror to aras-kargo.json / output/changes.json for backwards compatibility
        if (this.carrierId === 'aras-kargo') {
            fs.writeFileSync(path.join(this.outputDir, 'changes.json'), JSON.stringify({
                subeEklenenIlceler: changes.subeEklenenIlceler,
                subeKaldirilanIlceler: changes.subeKaldirilanIlceler
            }, null, 2), 'utf-8');
        }

        return changes;
    }

    public async getMeasuredDistricts(since?: string): Promise<Array<{ il: string; ilce: string; subeVar: boolean; checkedAt: string }>> {
        if (!this.db) {
            await this.init();
        }

        let query = "SELECT il, ilce, sube_var, checked_at FROM districts WHERE il IS NOT NULL AND il != '' AND ilce IS NOT NULL AND ilce != ''";
        const params: any[] = [];
        if (since) {
            query += ' AND checked_at >= ?';
            params.push(since);
        }
        query += ' ORDER BY il ASC, ilce ASC';

        try {
            const rows = await this.db!.all(query, params);
            if (rows && rows.length > 0) {
                return rows.map(r => ({
                    il: r.il,
                    ilce: r.ilce,
                    subeVar: r.sube_var === 1,
                    checkedAt: r.checked_at || new Date().toISOString()
                }));
            }
        } catch {
            // Fallback to JSON below
        }

        // Fallback to JSON file if SQLite has no rows or is missing
        if (fs.existsSync(this.jsonPath)) {
            try {
                const raw = fs.readFileSync(this.jsonPath, 'utf-8');
                const list: District[] = JSON.parse(raw);
                let fallbackDate = new Date().toISOString();
                if (fs.existsSync(this.changesPath)) {
                    try {
                        const ch = JSON.parse(fs.readFileSync(this.changesPath, 'utf-8'));
                        if (ch.checkedAt) fallbackDate = ch.checkedAt;
                    } catch {}
                }
                const filtered = list.filter(() => {
                    if (!since) return true;
                    return fallbackDate >= since;
                });
                return filtered.map(item => ({
                    il: item.il,
                    ilce: item.ilce,
                    subeVar: Boolean(item.subeVar),
                    checkedAt: fallbackDate
                }));
            } catch {}
        }

        return [];
    }

    public getLastAttemptInfo(): { lastAttemptAt: string | null; lastAttemptOk: boolean; lastError: string | null } {
        if (fs.existsSync(this.changesPath)) {
            try {
                const ch = JSON.parse(fs.readFileSync(this.changesPath, 'utf-8'));
                return {
                    lastAttemptAt: ch.checkedAt || null,
                    lastAttemptOk: true,
                    lastError: null
                };
            } catch {}
        }

        if (fs.existsSync(this.sqlitePath)) {
            const stats = fs.statSync(this.sqlitePath);
            return {
                lastAttemptAt: stats.mtime.toISOString(),
                lastAttemptOk: true,
                lastError: null
            };
        }

        return {
            lastAttemptAt: null,
            lastAttemptOk: false,
            lastError: 'Henüz ölçüm yapılmadı'
        };
    }

    public async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

