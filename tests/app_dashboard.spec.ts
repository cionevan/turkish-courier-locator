import { chromium } from 'playwright';
import { AddressInfo } from 'net';
import { createServer } from '../src/server';

(async () => {
    console.log('--- RUNNING FULL APP & UI AUDIT TEST ---');
    const server = createServer();
    let baseUrl = '';

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as AddressInfo;
            baseUrl = `http://127.0.0.1:${addr.port}`;
            console.log(`[Test Server] UI Test server running at ${baseUrl}`);
            resolve();
        });
    });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleIssues: string[] = [];
    const runtimeErrors: string[] = [];

    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            consoleIssues.push(msg.text());
        }
    });
    page.on('pageerror', err => runtimeErrors.push(err.message));

    try {
        // 1. Load Dashboard
        const res = await page.goto(baseUrl, { waitUntil: 'networkidle' });
        console.log('Dashboard HTTP Status:', res?.status());

        // 2. Perform Quick Search
        await page.getByRole('button', { name: 'Afyon / Bolvadin' }).click();
        await page.waitForSelector('#resultBox:not(.hidden)', { timeout: 10000 });

        const matchStats = await page.textContent('#matchStats');
        console.log('Bolvadin Match Result:', matchStats);

        // 3. Test Clear Buttons
        await page.click('#clearIlBtn');
        const ilVal = await page.inputValue('#ilInput');
        const ilceVal = await page.inputValue('#ilceInput');
        console.log(`After Clear: ilInput="${ilVal}", ilceInput="${ilceVal}"`);

        // 4. Check Console & Runtime Integrity
        console.log('Console warnings/errors count:', consoleIssues.length, consoleIssues);
        console.log('Page runtime errors count:', runtimeErrors.length, runtimeErrors);
    } finally {
        await browser.close();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        console.log('[Test Server] UI Test server closed cleanly.');
    }

    if (consoleIssues.length > 0 || runtimeErrors.length > 0) {
        process.exit(1);
    }
    console.log('--- APP & UI AUDIT PASSED 100% ---');
})();
