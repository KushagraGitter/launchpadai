const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    const response = await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 15000 });
    if (!response || response.status() >= 400) {
      console.error('Page failed to load:', response?.status());
      process.exit(1);
    }
    
    await page.waitForTimeout(1500);
    
    // Screenshot 1: Hero (top)
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-hero.png'), fullPage: false });
    
    // Scroll to phases
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-phases.png'), fullPage: false });
    
    // Scroll to features
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-features.png'), fullPage: false });
    
    // Scroll to how it works
    await page.evaluate(() => window.scrollTo(0, 2200));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-how-it-works.png'), fullPage: false });
    
    // Scroll to pricing
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-pricing.png'), fullPage: false });
    
    // Scroll to CTA and footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06-cta-footer.png'), fullPage: false });
    
    // Full page screenshot
    await page.screenshot({ path: path.join(OUTPUT_DIR, '07-full-page.png'), fullPage: true });
    
    console.log('Screenshots saved to', OUTPUT_DIR);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
