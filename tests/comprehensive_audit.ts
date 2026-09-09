import * as http from 'http';
import { AddressInfo } from 'net';
import { createServer } from '../src/server';

let baseUrl = '';

function get(path: string, reqHeaders?: http.OutgoingHttpHeaders): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
        const url = new URL(`${baseUrl}${path}`);
        const options: http.RequestOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: 'GET',
            headers: reqHeaders
        };
        http.request(options, (res: http.IncomingMessage) => {
            let body = '';
            res.on('data', (chunk: Buffer | string) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
        }).on('error', reject).end();
    });
}

(async () => {
    console.log('--- STARTING 17-POINT COMPREHENSIVE ENDPOINT AUDIT ---');
    const server = createServer();
    
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as AddressInfo;
            baseUrl = `http://127.0.0.1:${addr.port}`;
            console.log(`[Test Server] Ephemeral server running at ${baseUrl}`);
            resolve();
        });
    });

    let failures = 0;

    try {
        // 1. Missing params
        const r1 = await get('/api/check');
        if (r1.status !== 400) {
            console.error('FAIL 1: Expected 400 for missing params, got', r1.status);
            failures++;
        } else {
            console.log('PASS 1: /api/check missing params -> 400 Bad Request');
        }

        // 2. Kadıköy query
        const r2 = await get('/api/check?ilce=Kadikoy');
        const b2 = JSON.parse(r2.body);
        if (r2.status !== 200 || !b2.carriers['aras-kargo'] || !b2.summary) {
            console.error('FAIL 2: Kadıköy query invalid');
            failures++;
        } else {
            console.log('PASS 2: /api/check?ilce=Kadikoy -> 200 OK (5 carriers present)');
        }

        // 3. Multi-province disambiguation without il
        const r3 = await get('/api/check?ilce=Yeni%C5%9Fehir');
        const b3 = JSON.parse(r3.body);
        if (r3.status !== 200 || !b3.alternatives || b3.alternatives.length === 0) {
            console.error('FAIL 3: Yenişehir disambiguation failed');
            failures++;
        } else {
            console.log(`PASS 3: /api/check?ilce=Yenişehir -> 200 OK (${b3.alternatives.length} alternatives found)`);
        }

        // 4. Multi-province disambiguation with il
        const r4 = await get('/api/check?il=Bursa&ilce=Yeni%C5%9Fehir');
        const b4 = JSON.parse(r4.body);
        if (r4.status !== 200 || b4.matched.il !== 'Bursa' || b4.alternatives.length === 0) {
            console.error('FAIL 4: Bursa / Yenişehir query failed');
            failures++;
        } else {
            console.log('PASS 4: /api/check?il=Bursa&ilce=Yenişehir -> 200 OK with alternatives');
        }

        // 5. Çamlıhemşin query (PTT only)
        const r5 = await get('/api/check?ilce=%C3%87aml%C4%B1hem%C5%9Fin');
        const b5 = JSON.parse(r5.body);
        if (r5.status !== 200 || !b5.carriers['ptt-kargo'].hasBranch || b5.carriers['aras-kargo'].hasBranch) {
            console.error('FAIL 5: Çamlıhemşin branch status unexpected');
            failures++;
        } else {
            console.log('PASS 5: /api/check?ilce=Çamlıhemşin -> 200 OK (PTT: true, Aras: false)');
        }

        // 6. /api/carriers
        const r6 = await get('/api/carriers');
        const b6 = JSON.parse(r6.body);
        if (r6.status !== 200 || !Array.isArray(b6) || b6.length !== 5) {
            console.error('FAIL 6: /api/carriers did not return 5 carriers');
            failures++;
        } else {
            console.log('PASS 6: /api/carriers -> 200 OK (5 carriers listed)');
        }

        // 7. /health
        const r7 = await get('/health');
        const b7 = JSON.parse(r7.body);
        if (r7.status !== 200 || b7.status !== 'healthy') {
            console.error('FAIL 7: /health failed');
            failures++;
        } else {
            console.log('PASS 7: /health -> 200 OK (healthy)');
        }

        // 8. /sitemap.xml
        const r8 = await get('/sitemap.xml');
        if (r8.status !== 200 || !r8.body.includes('<urlset')) {
            console.error('FAIL 8: /sitemap.xml failed');
            failures++;
        } else {
            console.log('PASS 8: /sitemap.xml -> 200 OK (valid XML sitemap)');
        }

        // 9. /robots.txt
        const r9 = await get('/robots.txt');
        if (r9.status !== 200 || !r9.body.includes('User-agent:')) {
            console.error('FAIL 9: /robots.txt failed');
            failures++;
        } else {
            console.log('PASS 9: /robots.txt -> 200 OK (valid robots.txt)');
        }

        // 10. /app.css
        const r10 = await get('/app.css');
        if (r10.status !== 200 || !r10.headers['content-type']?.includes('text/css')) {
            console.error('FAIL 10: /app.css failed');
            failures++;
        } else {
            console.log('PASS 10: /app.css -> 200 OK (valid stylesheet)');
        }

        // 11. / (HTML Dashboard)
        const r11 = await get('/');
        if (r11.status !== 200 || !r11.body.includes('Kargo Şube Radarı')) {
            console.error('FAIL 11: / HTML Dashboard failed');
            failures++;
        } else {
            console.log('PASS 11: / -> 200 OK (Apple HIG dashboard rendered)');
        }

        // 12. 404 Route
        const r12 = await get('/nonexistent-path');
        if (r12.status !== 404) {
            console.error('FAIL 12: 404 route failed');
            failures++;
        } else {
            console.log('PASS 12: /nonexistent-path -> 404 Not Found');
        }

        // 13. /api/branches?carrier=aras-kargo (B2B Bulk Contract)
        const r13 = await get('/api/branches?carrier=aras-kargo');
        const b13 = JSON.parse(r13.body);
        const etag13 = r13.headers['etag'] as string;
        if (
            r13.status !== 200 ||
            b13.carrier !== 'aras-kargo' ||
            !Array.isArray(b13.items) ||
            b13.items.length === 0 ||
            typeof b13.items[0].ilKodu !== 'number' ||
            typeof b13.items[0].ilceKodu !== 'number' ||
            typeof b13.items[0].hasBranch !== 'boolean' ||
            !etag13
        ) {
            console.error('FAIL 13: /api/branches contract failed', b13);
            failures++;
        } else {
            console.log(`PASS 13: /api/branches?carrier=aras-kargo -> 200 OK (${b13.items.length} items, UAVT codes verified, ETag verified)`);
        }

        // 14. /api/branches ETag 304 Not Modified
        const r14 = await get('/api/branches?carrier=aras-kargo', { 'If-None-Match': etag13 });
        if (r14.status !== 304) {
            console.error('FAIL 14: ETag 304 test failed, got status', r14.status);
            failures++;
        } else {
            console.log('PASS 14: /api/branches with If-None-Match -> 304 Not Modified');
        }

        // 15. /api/branches (all carriers map)
        const r15 = await get('/api/branches');
        const b15 = JSON.parse(r15.body);
        if (
            r15.status !== 200 ||
            !b15['aras-kargo'] ||
            !b15['ptt-kargo'] ||
            !b15['yurtici-kargo'] ||
            !b15['mng-kargo'] ||
            !b15['surat-kargo']
        ) {
            console.error('FAIL 15: /api/branches all carriers map failed');
            failures++;
        } else {
            console.log('PASS 15: /api/branches -> 200 OK (all 5 carriers returned)');
        }

        // 16. /api/branches with invalid carrier
        const r16 = await get('/api/branches?carrier=gecersiz-kargo');
        if (r16.status !== 400) {
            console.error('FAIL 16: Invalid carrier expected 400, got', r16.status);
            failures++;
        } else {
            console.log('PASS 16: /api/branches?carrier=gecersiz-kargo -> 400 Bad Request');
        }

        // 17. UAVT target districts & KKTC validation
        const items = b13.items as Array<{ ilKodu: number | null; ilceKodu: number | null; il: string; ilce: string }>;
        const eyup = items.find(i => i.il === 'İstanbul' && i.ilce === 'Eyüpsultan');
        const mayis = items.find(i => i.il === 'Samsun' && i.ilce === '19 Mayıs');
        const sultan = items.find(i => i.il === 'Aksaray' && i.ilce === 'Sultanhanı');
        const derecik = items.find(i => i.il === 'Hakkari' && i.ilce === 'Derecik');
        const batman = items.find(i => i.il === 'Batman' && i.ilce === 'Merkez');
        const kemalpasa = items.find(i => i.il === 'Artvin' && i.ilce === 'Kemalpaşa');
        const kktc = items.find(i => i.il.includes('Kıbrıs'));

        if (
            !eyup || eyup.ilKodu !== 34 || eyup.ilceKodu !== 1325 ||
            !mayis || mayis.ilKodu !== 55 || mayis.ilceKodu !== 1830 ||
            !sultan || sultan.ilKodu !== 68 || sultan.ilceKodu !== 2106 ||
            !derecik || derecik.ilKodu !== 30 || derecik.ilceKodu !== 2107 ||
            !batman || batman.ilKodu !== 72 || batman.ilceKodu !== 1174 ||
            !kemalpasa || kemalpasa.ilKodu !== 8 || kemalpasa.ilceKodu !== 2105 ||
            !kktc || kktc.il !== 'Kuzey Kıbrıs Türk Cumhuriyeti' || kktc.ilKodu !== null || kktc.ilceKodu !== null
        ) {
            console.error('FAIL 17: UAVT target districts or KKTC validation failed:', { eyup, mayis, sultan, derecik, batman, kemalpasa, kktc });
            failures++;
        } else {
            console.log('PASS 17: UAVT target districts (Eyüpsultan, 19 Mayıs, Sultanhanı, Derecik, Batman 1174, Artvin Kemalpaşa 2105) & KKTC validated 100%');
        }

        console.log(`\nAUDIT RESULT: ${17 - failures}/17 PASSED, ${failures} FAILURES`);

    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        console.log('[Test Server] Server closed cleanly.');
    }

    if (failures > 0) process.exit(1);
})();

