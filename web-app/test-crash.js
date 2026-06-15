const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if (!response.ok()) console.log('PAGE RESPONSE ERROR:', response.status(), response.url());
  });
  page.on('requestfailed', request => {
    console.log('PAGE REQUEST FAILED:', request.failure().errorText, request.url());
  });

  try {
    await page.goto('http://localhost:3000/campaigns/17/listing', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log("Page loaded. Waiting 5s for any async React errors...");
    await new Promise(r => setTimeout(r, 5000));
  } catch (err) {
    console.error("Navigation error:", err);
  }

  await browser.close();
})();
