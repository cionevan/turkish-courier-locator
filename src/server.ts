import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { normalizeTurkish, titleCaseTurkish } from './utils/normalize';
import { lookupUavt } from './utils/uavt';
import { StorageManager } from './storage/db';
import { getAllProviders } from './providers';
import { initScheduler } from './cron';


const PORT = parseInt(process.env.PORT || '3000', 10);
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
const ENABLE_UI = process.env.ENABLE_UI !== 'false';
const ENABLE_ROBOTS_INDEX = process.env.ENABLE_ROBOTS_INDEX === 'true';
const API_KEY = (process.env.API_KEY || '').trim();

// Carrier database connections cache
const dbCache: Map<string, Database> = new Map();

async function getCarrierDb(carrierId: string): Promise<Database> {
    if (dbCache.has(carrierId)) {
        return dbCache.get(carrierId)!;
    }

    const dbPath = path.join(OUTPUT_DIR, `${carrierId}.sqlite`);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS districts (
            il TEXT,
            ilce TEXT,
            sube_var BOOLEAN,
            checked_at DATETIME,
            PRIMARY KEY (il, ilce)
        )
    `);

    dbCache.set(carrierId, db);
    return db;
}

export async function queryDistrict(queryIlce: string, queryIl?: string, live = false) {
    const normTargetIlce = normalizeTurkish(queryIlce);
    const normTargetIl = queryIl ? normalizeTurkish(queryIl) : undefined;

    // Load canonical districts seed to reliably resolve city and town IDs
    let canonicalSeed: any[] = [];
    const seedPaths = [
        path.resolve(process.cwd(), 'data', 'seeds', 'ptt_districts.json'),
        path.resolve(process.cwd(), 'data', 'seeds', 'aras_cities.json')
    ];
    for (const sp of seedPaths) {
        if (fs.existsSync(sp)) {
            try {
                canonicalSeed = JSON.parse(fs.readFileSync(sp, 'utf-8'));
                break;
            } catch {}
        }
    }

    // Match all candidate districts from seed
    const allMatches = canonicalSeed.filter((d: any) => {
        const dIlce = normalizeTurkish(d.ilce || d.townName || '');
        return dIlce === normTargetIlce;
    });

    const matchedSeed = allMatches.find((d: any) => {
        const dIl = normalizeTurkish(d.il || d.cityName || '');
        return normTargetIl ? dIl === normTargetIl : true;
    }) || allMatches[0];

    let matchedIl = matchedSeed ? (matchedSeed.il || matchedSeed.cityName) : (queryIl ? titleCaseTurkish(queryIl) : '');
    let matchedIlce = matchedSeed ? (matchedSeed.ilce || matchedSeed.townName) : titleCaseTurkish(queryIlce);

    // Other provinces that have a district with the exact same name
    const digerIller: string[] = Array.from(new Set(
        allMatches
            .map((d: any) => (d.il || d.cityName) as string)
            .filter((ilName: string) => ilName && normalizeTurkish(ilName) !== normalizeTurkish(matchedIl))
    ));
    const resolvedMeta = matchedSeed ? {
        il: matchedIl,
        ilce: matchedIlce,
        cityId: matchedSeed.cityId,
        townId: matchedSeed.townId
    } : {
        il: matchedIl,
        ilce: matchedIlce
    };

    const providers = getAllProviders();
    const carrierResults: Record<string, {
        name: string;
        hasBranch: boolean;
        checkedAt: string | null;
        source: 'cache' | 'live';
    }> = {};

    for (const p of providers) {
        if (live) {
            // Live query on-demand
            try {
                await p.init();
                const hasBranch = await p.checkBranch(resolvedMeta);
                carrierResults[p.id] = {
                    name: p.displayName,
                    hasBranch,
                    checkedAt: new Date().toISOString(),
                    source: 'live'
                };
            } catch {
                carrierResults[p.id] = {
                    name: p.displayName,
                    hasBranch: false,
                    checkedAt: new Date().toISOString(),
                    source: 'live'
                };
            } finally {
                await p.close();
            }
        } else {
            // Instant SQLite query
            const db = await getCarrierDb(p.id);
            let row;

            if (normTargetIl) {
                row = await db.get(
                    'SELECT il, ilce, sube_var, checked_at FROM districts WHERE LOWER(il) = ? AND LOWER(ilce) = ?',
                    [normTargetIl, normTargetIlce]
                );
            }

            if (!row) {
                // Fallback: match by ilce
                const rows = await db.all(
                    'SELECT il, ilce, sube_var, checked_at FROM districts'
                );
                row = rows.find((r: any) => {
                    const sameIlce = normalizeTurkish(r.ilce) === normTargetIlce;
                    const sameIl = normTargetIl ? normalizeTurkish(r.il) === normTargetIl : true;
                    return sameIlce && sameIl;
                });
            }

            if (row) {
                matchedIl = row.il;
                matchedIlce = row.ilce;
                carrierResults[p.id] = {
                    name: p.displayName,
                    hasBranch: row.sube_var === 1,
                    checkedAt: row.checked_at,
                    source: 'cache'
                };
            } else if (live) {
                // Explicit live request asked by user/caller (?live=true)
                try {
                    await p.init();
                    const hasBranch = await p.checkBranch(resolvedMeta);
                    const now = new Date().toISOString();

                    await db.run(
                        `INSERT INTO districts (il, ilce, sube_var, checked_at) 
                         VALUES (?, ?, ?, ?) 
                         ON CONFLICT(il, ilce) DO UPDATE SET sube_var=excluded.sube_var, checked_at=excluded.checked_at`,
                        [queryIl || matchedIl || '', matchedIlce || queryIlce, hasBranch ? 1 : 0, now]
                    );

                    carrierResults[p.id] = {
                        name: p.displayName,
                        hasBranch,
                        checkedAt: now,
                        source: 'live'
                    };
                } catch {
                    carrierResults[p.id] = {
                        name: p.displayName,
                        hasBranch: false,
                        checkedAt: new Date().toISOString(),
                        source: 'cache'
                    };
                }
            } else {
                // Instant cache response (0ms wait)
                carrierResults[p.id] = {
                    name: p.displayName,
                    hasBranch: false,
                    checkedAt: null,
                    source: 'cache'
                };
            }
        }
    }

    const varOlanlar = Object.values(carrierResults).filter(c => c.hasBranch).map(c => c.name);
    const olmayanlar = Object.values(carrierResults).filter(c => !c.hasBranch).map(c => c.name);

    return {
        query: { il: queryIl || null, ilce: queryIlce },
        matched: { il: matchedIl || null, ilce: matchedIlce },
        alternatives: digerIller.map(ilName => ({ il: ilName, ilce: matchedIlce })),
        timestamp: new Date().toISOString(),
        summary: {
            subesiOlanlar: varOlanlar,
            subesiOlmayanlar: olmayanlar,
            toplamVar: varOlanlar.length,
            toplamYok: olmayanlar.length,
            mesaj: `${matchedIl ? matchedIl + ' / ' : ''}${matchedIlce} ilçesinde ${varOlanlar.join(', ')} şubesi VAR; ${olmayanlar.length > 0 ? olmayanlar.join(', ') + ' şubesi YOK.' : 'tüm kargoların şubesi mevcuttur.'}`
        },
        carriers: carrierResults
    };
}

export function createServer(): http.Server {
    return http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
        const pathname = parsedUrl.pathname;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Google & Search Engines: Anti-Index / Robots & Sitemap
        if (!ENABLE_ROBOTS_INDEX) {
            res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        } else {
            res.setHeader('X-Robots-Tag', 'index, follow');
        }

        const hostHeader = (req.headers.host || 'localhost:3000');
        const proto = (req.headers['x-forwarded-proto'] as string) || (hostHeader.includes('localhost') ? 'http' : 'https');
        const currentDomain = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : `${proto}://${hostHeader}`;

        if (pathname === '/robots.txt') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            if (ENABLE_ROBOTS_INDEX) {
                res.end(`User-agent: *\nAllow: /\n\nSitemap: ${currentDomain}/sitemap.xml\n`);
            } else {
                res.end("User-agent: *\nDisallow: /\n");
            }
            return;
        }

        if (pathname === '/sitemap.xml') {
            const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${currentDomain}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
            res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
            res.end(sitemapXml);
            return;
        }

        // Static CSS: /app.css
        if (pathname === '/app.css') {
            if (!ENABLE_UI) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Arayüz (UI) bu sunucuda devre dışı bırakılmıştır.' }));
                return;
            }

            const cssPath = [
                path.resolve(__dirname, 'public', 'app.css'),
                path.resolve(__dirname, '..', 'dist', 'public', 'app.css'),
                path.resolve(__dirname, '..', 'src', 'public', 'app.css'),
                path.resolve(process.cwd(), 'dist', 'public', 'app.css'),
                path.resolve(process.cwd(), 'src', 'public', 'app.css')
            ].find(p => fs.existsSync(p));

            if (cssPath) {
                res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
                res.end(fs.readFileSync(cssPath, 'utf-8'));
                return;
            }
        }

        // Web Dashboard UI
        if (pathname === '/' || pathname === '/index.html') {
            if (!ENABLE_UI) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    service: "Turkish Courier Locator REST API",
                    version: "2.3.0",
                    status: "online",
                    ui: "disabled",
                    endpoints: {
                        check: "/api/check?ilce=Kadikoy",
                        check_with_city: "/api/check?il=Istanbul&ilce=Besiktas",
                        carriers: "/api/carriers",
                        health: "/health"
                    }
                }, null, 2));
                return;
            }

            const htmlPath = [
                path.resolve(__dirname, 'public', 'index.html'),
                path.resolve(__dirname, '..', 'dist', 'public', 'index.html'),
                path.resolve(__dirname, '..', 'src', 'public', 'index.html'),
                path.resolve(process.cwd(), 'dist', 'public', 'index.html'),
                path.resolve(process.cwd(), 'src', 'public', 'index.html')
            ].find(p => fs.existsSync(p));

            if (htmlPath) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                const hostHeader = (req.headers.host || 'localhost:3000');
                const proto = (req.headers['x-forwarded-proto'] as string) || (hostHeader.includes('localhost') ? 'http' : 'https');
                const currentDomain = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : `${proto}://${hostHeader}`;
                const rawHtml = fs.readFileSync(htmlPath, 'utf-8');
                res.end(rawHtml.replace(/\{\{DOMAIN_URL\}\}/g, currentDomain));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Arayüz dosyası (index.html) bulunamadı.');
            }
            return;
        }

        // Healthcheck for Dokploy / Traefik / Docker (Always open)
        if (pathname === '/health' || pathname === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // Optional API Key Protection (protects /api/check, /api/branches, etc.)
        if (API_KEY) {
            const reqKey = req.headers['x-api-key'] || parsedUrl.searchParams.get('api_key');
            if (reqKey !== API_KEY) {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Yetkisiz erişim. Geçerli bir X-API-KEY başlığı veya ?api_key= parametresi gereklidir.' }));
                return;
            }
        }

        // API: /api/check
        if (pathname === '/api/check') {
            const ilce = (parsedUrl.searchParams.get('ilce') || parsedUrl.searchParams.get('q') || '').trim();
            const il = (parsedUrl.searchParams.get('il') || '').trim();
            const live = parsedUrl.searchParams.get('live') === 'true' || parsedUrl.searchParams.get('live') === '1';

            if (!ilce) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    error: "Lütfen bir ilçe parametresi belirtin. Örn: /api/check?ilce=Kadikoy veya /api/check?il=Istanbul&ilce=Besiktas"
                }));
                return;
            }

            try {
                const data = await queryDistrict(ilce, il || undefined, live);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(data, null, 2));
            } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // API: /api/carriers
        if (pathname === '/api/carriers') {
            const providers = getAllProviders();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(providers.map(p => ({ id: p.id, name: p.displayName })), null, 2));
            return;
        }

        // API: /api/branches (Toplu Şube Listesi & E-Ticaret Entegrasyon Sözleşmesi)
        if (pathname === '/api/branches') {
            const carrierParam = parsedUrl.searchParams.get('carrier')?.trim();
            const sinceParam = parsedUrl.searchParams.get('since')?.trim();
            const allProviders = getAllProviders();

            if (carrierParam) {
                const provider = allProviders.find(p => p.id === carrierParam);
                if (!provider) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        error: `Geçersiz taşıyıcı: '${carrierParam}'. Desteklenen taşıyıcılar: ${allProviders.map(p => p.id).join(', ')}`
                    }));
                    return;
                }

                const storage = new StorageManager(provider.id);
                const measured = await storage.getMeasuredDistricts(sinceParam);
                const attempt = storage.getLastAttemptInfo();
                const generatedAt = attempt.lastAttemptAt || (measured.length > 0 ? measured[0].checkedAt : '2026-09-10T00:00:00.000Z');

                const formatBranchItem = (m: { il: string; ilce: string; subeVar: boolean; checkedAt: string }) => {
                    let cleanIl = m.il;
                    if (cleanIl === 'Kuzey Kıbrıs Türk Cumhuriye' || cleanIl.startsWith('Kuzey Kıbrıs')) {
                        cleanIl = 'Kuzey Kıbrıs Türk Cumhuriyeti';
                    }
                    const u = lookupUavt(cleanIl, m.ilce);
                    return {
                        ilKodu: u ? u.ilKodu : null,
                        ilceKodu: u ? u.ilceKodu : null,
                        il: u ? u.il : cleanIl,
                        ilce: u ? u.ilce : m.ilce,
                        hasBranch: m.subeVar,
                        checkedAt: m.checkedAt
                    };
                };

                const items = measured.map(formatBranchItem);

                const responseData = {
                    carrier: provider.id,
                    generatedAt,
                    lastAttemptAt: attempt.lastAttemptAt,
                    lastAttemptOk: attempt.lastAttemptOk,
                    lastError: attempt.lastError,
                    totalCount: items.length,
                    items
                };

                const jsonString = JSON.stringify(responseData, null, 2);
                const etag = `W/"${crypto.createHash('sha1').update(jsonString).digest('hex')}"`;

                res.setHeader('ETag', etag);
                res.setHeader('Last-Modified', new Date(generatedAt).toUTCString());
                res.setHeader('Cache-Control', 'public, max-age=60');

                if (req.headers['if-none-match'] === etag) {
                    res.writeHead(304);
                    res.end();
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(jsonString);
                return;
            } else {
                // Return all carriers map: { "aras-kargo": { ... }, "ptt-kargo": { ... } }
                const responseData: Record<string, any> = {};
                let latestDate = '2026-09-10T00:00:00.000Z';

                const formatBranchItem = (m: { il: string; ilce: string; subeVar: boolean; checkedAt: string }) => {
                    let cleanIl = m.il;
                    if (cleanIl === 'Kuzey Kıbrıs Türk Cumhuriye' || cleanIl.startsWith('Kuzey Kıbrıs')) {
                        cleanIl = 'Kuzey Kıbrıs Türk Cumhuriyeti';
                    }
                    const u = lookupUavt(cleanIl, m.ilce);
                    return {
                        ilKodu: u ? u.ilKodu : null,
                        ilceKodu: u ? u.ilceKodu : null,
                        il: u ? u.il : cleanIl,
                        ilce: u ? u.ilce : m.ilce,
                        hasBranch: m.subeVar,
                        checkedAt: m.checkedAt
                    };
                };

                for (const provider of allProviders) {
                    const storage = new StorageManager(provider.id);
                    const measured = await storage.getMeasuredDistricts(sinceParam);
                    const attempt = storage.getLastAttemptInfo();
                    const generatedAt = attempt.lastAttemptAt || (measured.length > 0 ? measured[0].checkedAt : '2026-09-10T00:00:00.000Z');
                    if (generatedAt > latestDate) latestDate = generatedAt;

                    const items = measured.map(formatBranchItem);


                    responseData[provider.id] = {
                        carrier: provider.id,
                        generatedAt,
                        lastAttemptAt: attempt.lastAttemptAt,
                        lastAttemptOk: attempt.lastAttemptOk,
                        lastError: attempt.lastError,
                        totalCount: items.length,
                        items
                    };
                }

                const jsonString = JSON.stringify(responseData, null, 2);
                const etag = `W/"${crypto.createHash('sha1').update(jsonString).digest('hex')}"`;

                res.setHeader('ETag', etag);
                res.setHeader('Last-Modified', new Date(latestDate).toUTCString());
                res.setHeader('Cache-Control', 'public, max-age=60');

                if (req.headers['if-none-match'] === etag) {
                    res.writeHead(304);
                    res.end();
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(jsonString);
                return;
            }
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Endpoint bulunamadı. /api/check, /api/branches veya / adresini kullanın.' }));
    });

}

// If executed directly, listen on port
if (require.main === module) {
    const server = createServer();
    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
        console.log(`\n======================================================`);
        console.log(`🌐 Kargo Şube Kontrol REST API & Web Paneli Başlatıldı!`);
        console.log(`📍 Dinlenen Adres: http://${HOST}:${PORT}`);
        console.log(`📍 Web Paneli:     ${ENABLE_UI ? `http://localhost:${PORT}` : 'Devre dışı (API Only)'}`);
        console.log(`📍 İndeksleme:     ${ENABLE_ROBOTS_INDEX ? 'Açık (Allow)' : 'Engellendi (noindex, nofollow)'}`);
        console.log(`📍 API Güvenliği:  ${API_KEY ? 'Aktif (X-API-KEY gerekli)' : 'Açık (Genel Erişim)'}`);
        console.log(`📍 Sağlık Kontrolü: http://localhost:${PORT}/health`);
        console.log(`📍 Örnek API:      http://localhost:${PORT}/api/check?ilce=Bolvadin`);
        console.log(`======================================================\n`);

        // Start background midnight cron scheduler
        initScheduler();
    });

    const gracefulShutdown = (signal: string) => {
        console.log(`\n🛑 [Shutdown] ${signal} sinyali alındı. Sunucu kapatılıyor...`);
        server.close(() => {
            console.log('✅ [Shutdown] HTTP sunucusu kapatıldı.');
            process.exit(0);
        });
        setTimeout(() => {
            process.exit(0);
        }, 3000).unref();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}


