import { chromium } from 'playwright-core';

const BASE = 'https://meet.livekit.phuket-tourist.com';
const SHOTS = '/tmp/mobile-audit';
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13 Pro

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    executablePath: undefined, // let playwright find the headless shell
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  const issues = [];

  // 1. Login first
  console.log('=== 1. Login Page ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(1500);
  await page.screenshot({ path: `${SHOTS}/01-login.png`, fullPage: true });
  console.log('Login page screenshot saved');

  // Fill login
  await page.fill('input[type="email"]', 'admin@meet.local');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await sleep(3000);
  console.log('Logged in, current URL:', page.url());

  // 2. Home Page (Dashboard)
  console.log('\n=== 2. Home/Dashboard Page ===');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/02-home.png`, fullPage: true });
  console.log('Home page screenshot saved');

  // Check for horizontal overflow
  const homeOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (homeOverflow) issues.push('Home page: horizontal scroll overflow detected');
  console.log('Horizontal overflow:', homeOverflow);

  // 3. History Page
  console.log('\n=== 3. History Page ===');
  await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/03-history.png`, fullPage: true });
  const histOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (histOverflow) issues.push('History page: horizontal scroll overflow');
  console.log('History screenshot saved, overflow:', histOverflow);

  // 4. Schedule Page
  console.log('\n=== 4. Schedule Page ===');
  await page.goto(`${BASE}/schedule`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/04-schedule.png`, fullPage: true });
  const schedOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (schedOverflow) issues.push('Schedule page: horizontal scroll overflow');
  console.log('Schedule screenshot saved, overflow:', schedOverflow);

  // 5. Admin Panel - Dashboard
  console.log('\n=== 5. Admin Dashboard ===');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/05-admin-dashboard.png`, fullPage: true });
  const adminOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (adminOverflow) issues.push('Admin dashboard: horizontal scroll overflow');
  console.log('Admin dashboard screenshot saved, overflow:', adminOverflow);

  // 6. Admin - Users table
  console.log('\n=== 6. Admin Users ===');
  await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/06-admin-users.png`, fullPage: true });
  console.log('Admin users screenshot saved');

  // 7. Admin - Meetings table
  console.log('\n=== 7. Admin Meetings ===');
  await page.goto(`${BASE}/admin/meetings`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/07-admin-meetings.png`, fullPage: true });
  console.log('Admin meetings screenshot saved');

  // 8. PreJoin Page (mobile camera preview)
  console.log('\n=== 8. PreJoin Page ===');
  await page.goto(`${BASE}/join/test-audit-room`, { waitUntil: 'networkidle' });
  await sleep(3000);
  await page.screenshot({ path: `${SHOTS}/08-prejoin.png`, fullPage: true });
  console.log('PreJoin screenshot saved');

  // 9. Room Page - Control Bar (More menu)
  console.log('\n=== 9. Room Page Control Bar ===');
  await page.goto(`${BASE}/room/test-audit-room`, { waitUntil: 'networkidle' });
  await sleep(3000);
  await page.screenshot({ path: `${SHOTS}/09-room-initial.png`, fullPage: true });
  console.log('Room initial screenshot saved');

  // Try to open the More menu
  const moreButton = page.locator('[aria-label="More options"], button:has-text("More")').last();
  if (await moreButton.count() > 0) {
    await moreButton.click();
    await sleep(1000);
    await page.screenshot({ path: `${SHOTS}/10-room-more-menu.png`, fullPage: true });
    console.log('More menu screenshot saved');
  } else {
    issues.push('Room page: could not find More button on mobile');
    console.log('Could not find More button');
  }

  // 10. Recordings page
  console.log('\n=== 10. Recordings Page ===');
  await page.goto(`${BASE}/recordings`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/11-recordings.png`, fullPage: true });
  const recOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (recOverflow) issues.push('Recordings page: horizontal scroll overflow');
  console.log('Recordings screenshot saved, overflow:', recOverflow);

  // 11. API Keys page
  console.log('\n=== 11. API Keys ===');
  await page.goto(`${BASE}/api-keys`, { waitUntil: 'networkidle' });
  await sleep(2000);
  await page.screenshot({ path: `${SHOTS}/12-api-keys.png`, fullPage: true });
  console.log('API Keys screenshot saved');

  console.log('\n=== AUDIT SUMMARY ===');
  if (issues.length === 0) {
    console.log('No issues detected!');
  } else {
    console.log(`${issues.length} issue(s) found:`);
    issues.forEach((i, idx) => console.log(`  ${idx + 1}. ${i}`));
  }

  await browser.close();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
