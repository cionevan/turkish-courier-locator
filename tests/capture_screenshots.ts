import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
    const assetsDir = path.resolve(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });

    // 1. Capture Light Mode with Bolvadin query (Main Hero Banner)
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Ensure Light mode
    await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('apple-theme', 'light');
    });

    // Query Afyon / Bolvadin
    await page.getByRole('button', { name: 'Afyon / Bolvadin' }).click();
    await page.waitForSelector('#resultBox:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(500);

    const bolvadinPath = path.join(assetsDir, 'dashboard_bolvadin.png');
    await page.screenshot({ path: bolvadinPath, fullPage: false });
    console.log('Saved:', bolvadinPath);

    const lightPath = path.join(assetsDir, 'dashboard_light.png');
    await page.screenshot({ path: lightPath, fullPage: false });
    console.log('Saved:', lightPath);

    // 2. Capture Dark Mode with Multi-Province Disambiguation (e.g. Yenişehir or Gölbaşı)
    await page.evaluate(() => {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('apple-theme', 'dark');
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    });

    // Query Yenişehir to show the new multi-province alternatives UI in dark mode
    await page.fill('#ilInput', '');
    await page.fill('#ilceInput', 'Yenişehir');
    await page.click('#searchBtn');
    await page.waitForSelector('#alternativesBox:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(500);

    const darkPath = path.join(assetsDir, 'dashboard_dark.png');
    await page.screenshot({ path: darkPath, fullPage: false });
    console.log('Saved:', darkPath);

    await browser.close();
    console.log('All screenshots captured successfully in 2x Retina quality!');
})();
