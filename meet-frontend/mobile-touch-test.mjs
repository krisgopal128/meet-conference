import { chromium } from 'playwright-core';

const BASE = 'https://meet.livekit.phuket-tourist.com';
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148',
  });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(1000);
  await page.fill('input[type="email"]', 'admin@meet.local');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await sleep(3000);

  const pagesToCheck = [
    { name: 'Home', path: '/' },
    { name: 'History', path: '/history' },
    { name: 'Schedule', path: '/schedule' },
    { name: 'Admin Dashboard', path: '/admin' },
    { name: 'Admin Users', path: '/admin/users' },
    { name: 'Admin Meetings', path: '/admin/meetings' },
    { name: 'Recordings', path: '/recordings' },
    { name: 'API Keys', path: '/api-keys' },
  ];

  for (const p of pagesToCheck) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' });
    await sleep(2000);

    // Check touch target sizes (buttons, links, interactive elements under 40px)
    const smallTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a, [role="button"], input[type="checkbox"], input[type="radio"], select');
      const small = [];
      interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        // Check minimum touch target size (40px recommended, 44px ideal)
        if (rect.height < 36 && rect.width < 36) {
          small.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          });
        }
      });
      return small.slice(0, 10); // limit output
    });

    // Check for text overflow (elements with scrollWidth > clientWidth)
    const textOverflow = await page.evaluate(() => {
      const els = document.querySelectorAll('h1, h2, h3, p, span, td, th, label');
      const overflowing = [];
      els.forEach(el => {
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 50) { // only meaningful elements
            overflowing.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 50),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            });
          }
        }
      });
      return overflowing.slice(0, 5);
    });

    if (smallTargets.length > 0 || textOverflow.length > 0) {
      console.log(`\n--- ${p.name} (${p.path}) ---`);
      if (smallTargets.length > 0) {
        console.log(`  Small touch targets (${smallTargets.length}):`);
        smallTargets.forEach(t => console.log(`    ${t.tag} [${t.size}] "${t.text}"`));
      }
      if (textOverflow.length > 0) {
        console.log(`  Text overflow elements (${textOverflow.length}):`);
        textOverflow.forEach(t => console.log(`    ${t.tag} "${t.text}" (${t.scrollWidth}>${t.clientWidth})`));
      }
    } else {
      console.log(`${p.name}: OK`);
    }
  }

  // Check room page (pre-join to avoid LiveKit connection)
  console.log('\n--- PreJoin Page ---');
  await page.goto(`${BASE}/join/test-audit-room`, { waitUntil: 'networkidle' });
  await sleep(2000);
  const prejoinTargets = await page.evaluate(() => {
    const interactive = document.querySelectorAll('button, a, [role="button"]');
    const small = [];
    interactive.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (rect.height < 36 && rect.width < 36) {
        small.push({ text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), size: `${Math.round(rect.width)}x${Math.round(rect.height)}` });
      }
    });
    return small.slice(0, 5);
  });
  if (prejoinTargets.length > 0) {
    console.log(`  Small touch targets:`);
    prejoinTargets.forEach(t => console.log(`    [${t.size}] "${t.text}"`));
  } else {
    console.log('  OK');
  }

  await browser.close();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
