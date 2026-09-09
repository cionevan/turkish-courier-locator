import { chromium, Page, Response } from 'playwright';

async function checkUI(page: Page, il: string, ilce: string) {
    console.log(`\n=== Testing UI for ${il} - ${ilce} ===`);
    await page.goto('https://www.araskargo.com.tr/subelerimiz', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
        const els = document.querySelectorAll('efilli-layout-dynamic, [id^="efilli"]');
        els.forEach(el => el.remove());
    });

    const searchInput = page.getByPlaceholder('Şehir veya ilçe giriniz').first();
    await searchInput.click();
    await searchInput.fill(ilce);
    await page.waitForTimeout(1000);

    // Dropdown format is "Aydın - Bozdoğan"
    const dropdownItem = page.locator('li', { hasText: `${il} - ${ilce}` }).first();
    const count = await dropdownItem.count();
    
    if (count > 0) {
        console.log(`Found dropdown item: "${await dropdownItem.textContent()}"`);
        await dropdownItem.click();
    } else {
        console.log(`Searching with "${il}" instead...`);
        await searchInput.fill(il);
        await page.waitForTimeout(1000);
        const itemAlt = page.locator('li', { hasText: `${il} - ${ilce}` }).first();
        if (await itemAlt.count() > 0) {
            console.log(`Found dropdown item: "${await itemAlt.textContent()}"`);
            await itemAlt.click();
        } else {
            console.log(`Still not found! Listing available li items:`);
            const allLi = await page.locator('li').allTextContents();
            console.log(allLi.filter((t: string) => t.includes(il)).slice(0, 10));
            return;
        }
    }

    await page.waitForTimeout(500);

    // Intercept network when clicking Ara
    const [response] = await Promise.all([
        page.waitForResponse((res: Response) => res.url().includes('/api/') || res.url().includes('unit'), { timeout: 5000 }).catch(() => null),
        page.getByRole('button', { name: 'Ara' }).first().click()
    ]);

    if (response) {
        console.log(`Network request on "Ara": ${response.url()} (Status: ${response.status()})`);
        try {
            const body = await response.json();
            console.log(`Response body:`, JSON.stringify(body).substring(0, 300));
        } catch {}
    } else {
        console.log(`No network request triggered on "Ara"`);
    }

    await page.waitForTimeout(2000);

    // Check UI for result count
    const bodyText = await page.innerText('body');
    const match = bodyText.match(/(\d+)\s+Sonuç\s+bulundu/i);
    if (match) {
        console.log(`UI Result: "${match[0]}" => subeVar = ${parseInt(match[1], 10) > 0}`);
    } else {
        console.log(`Checking if "0 Sonuç" or empty state is shown...`);
        const subeTexts = bodyText.split('\n').filter((t: string) => t.includes('Sonuç') || t.includes('şube') || t.includes('Şube'));
        console.log(`Relevant UI lines:`, subeTexts.slice(0, 5));
    }
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await checkUI(page, 'Afyonkarahisar', 'Bolvadin');
    await checkUI(page, 'İstanbul', 'Kadıköy');

    await browser.close();
})();
