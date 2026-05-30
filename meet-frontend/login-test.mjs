import { chromium } from '@playwright/test';

const USERS = [
  { email: 'admin@meet.com', password: 'admin1234', role: 'admin', name: 'Admin User' },
  { email: 'moderator@meet.com', password: 'mod12345', role: 'moderator', name: 'Moderator User' },
  { email: 'user@meet.com', password: 'user12345', role: 'participant', name: 'Regular User' },
];

const BASE_URL = 'http://localhost:5173';

async function testLogin(browser, user) {
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing login: ${user.name} (${user.role})`);
  console.log(`${'='.repeat(60)}`);

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`  [1/5] Navigated to /login`);

    await page.fill('#email', user.email);
    console.log(`  [2/5] Filled email: ${user.email}`);

    await page.fill('#password', user.password);
    console.log(`  [3/5] Filled password`);

    const submitBtn = page.getByRole('button', { name: /sign in/i });
    await submitBtn.click();
    console.log(`  [4/5] Clicked "Sign In"`);

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    const currentUrl = page.url();
    console.log(`  [5/5] Redirected to: ${currentUrl}`);

    const localStorage = await page.evaluate(() => {
      const authState = localStorage.getItem('auth-storage');
      return authState ? JSON.parse(authState) : null;
    });

    if (localStorage?.state?.user) {
      const loggedInUser = localStorage.state.user;
      console.log(`\n  SUCCESS`);
      console.log(`    Name:  ${loggedInUser.name}`);
      console.log(`    Email: ${loggedInUser.email}`);
      console.log(`    Role:  ${loggedInUser.role}`);
    } else {
      console.log(`\n  FAILED - No user found in localStorage`);
    }

    await page.screenshot({ path: `/tmp/login-${user.role}.png`, fullPage: true });
    console.log(`  Screenshot saved: /tmp/login-${user.role}.png`);

  } catch (err) {
    console.log(`\n  FAILED: ${err.message}`);

    const alertText = await page.getByRole('alert').textContent().catch(() => null);
    if (alertText) console.log(`  Alert: ${alertText}`);

    await page.screenshot({ path: `/tmp/login-${user.role}-error.png`, fullPage: true });
    console.log(`  Error screenshot saved: /tmp/login-${user.role}-error.png`);
  } finally {
    await context.close();
  }
}

(async () => {
  console.log('Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });

  let passed = 0;
  let failed = 0;

  for (const user of USERS) {
    try {
      const result = await testLogin(browser, user);
      if (result === false) failed++;
      else passed++;
    } catch {
      failed++;
    }
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${USERS.length} users`);
  console.log(`${'='.repeat(60)}`);

  process.exit(failed > 0 ? 1 : 0);
})();
