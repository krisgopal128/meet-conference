// Performance profiling for meet-conference frontend pages.
// Uses the bot-simulator's Playwright install.
// Profiles against the production URL: https://meet.livekit.phuket-tourist.com
import { createRequire } from 'module';
const require = createRequire('/home/joker/Projects/meet-conference/bot-simulator/node_modules/');
const { chromium } = require('playwright');

const BASE = 'https://meet.livekit.phuket-tourist.com';

// Routes to profile. / and /history require auth — we still measure initial
// load (the SPA shell + login redirect) since that's what an anonymous user
// experiences. Authenticated measurement would require real credentials.
const ROUTES = [
  { path: '/login', label: 'LoginPage', auth: false },
  { path: '/', label: 'Home/Dashboard (redirects to login if unauth)', auth: false },
  { path: '/history', label: 'HistoryPage', auth: false },
  { path: '/schedule', label: 'SchedulePage', auth: false },
  { path: '/join/test-room', label: 'PreJoinPage', auth: false },
  { path: '/404', label: 'NotFoundPage', auth: false },
];

function pct(p) {
  // Convert a PerformanceEntry timing to ms relative to navigation start.
  return Number(p.startTime != null ? p.startTime : 0);
}

async function profileRoute(browser, route) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (perf-profiler) Chrome/120',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const result = {
    route: route.path,
    label: route.label,
    metrics: null,
    requests: 0,
    transferBytes: 0,
    jsBytes: 0,
    jsGzipBytes: 0,
    cssBytes: 0,
    imgBytes: 0,
    fontBytes: 0,
    otherBytes: 0,
    status: 'ok',
    error: null,
    pageErrors: [],
  };

  const requests = [];
  page.on('requestfinished', async (req) => {
    try {
      const res = req.response();
      if (!res) return;
      requests.push({ url: req.url(), status: res.status(), resourceType: req.resourceType() });
    } catch {}
  });
  page.on('pageerror', (e) => result.pageErrors.push(String(e.message || e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') result.pageErrors.push('console: ' + m.text().slice(0, 150)); });

  try {
    const navResponse = await page.goto(BASE + route.path, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });

    // Give React + lazy chunks a moment to hydrate / paint.
    await page.waitForTimeout(2500);

    // Navigation timing
    const nt = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation');
      if (!nav) return null;
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadEvent: nav.loadEventEnd - nav.startTime,
        ttfb: nav.responseStart - nav.startTime,
        domInteractive: nav.domInteractive - nav.startTime,
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
      };
    });

    // TTI approximation: largest contentful paint + 5s quiet window fallback
    const paintMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint');
      const fcp = entries.find((e) => e.name === 'first-contentful-paint');
      const lcpList = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpList.length ? lcpList[lcpList.length - 1] : null;
      return {
        fcp: fcp ? fcp.startTime : null,
        lcp: lcp ? lcp.startTime : null,
      };
    });

    // TTI approximation via long task + FCP
    const tti = await page.evaluate(() => {
      // Use PerformanceObserver-tracked long tasks; approximate TTI as FCP + 5s quiet
      return new Promise((resolve) => {
        const longTasks = [];
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longTasks.push(e);
        });
        try { obs.observe({ type: 'longtask', buffered: true }); } catch {}
        // give it a brief sample
        setTimeout(() => {
          obs.disconnect();
          const paint = performance.getEntriesByType('paint');
          const fcp = paint.find((e) => e.name === 'first-contentful-paint');
          const nav = performance.getEntriesByType('navigation')[0];
          resolve({
            fcp: fcp ? fcp.startTime : null,
            loadEventEnd: nav ? nav.loadEventEnd - nav.startTime : null,
            longTaskCount: longTasks.length,
            longestTaskMs: longTasks.length ? Math.max(...longTasks.map((t) => t.duration)) : 0,
            domNodes: document.querySelectorAll('*').length,
          });
        }, 1200);
      });
    });

    result.metrics = { ...nt, ...paintMetrics, ...tti };
    result.httpStatus = navResponse ? navResponse.status() : null;

    // Sum transfer sizes from responses
    for (const r of requests) {
      // re-fetch size via response (cached from earlier event)
    }

    // Better: collect actual encoded sizes from the Resource Timing API
    const resSizes = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((e) => ({
        name: e.name,
        type: e.initiatorType,
        transferSize: e.transferSize,
        encodedBodySize: e.encodedBodySize,
        duration: e.duration,
      }));
    });

    result.requests = resSizes.length;
    for (const r of resSizes) {
      const t = r.transferSize || 0;
      result.transferBytes += t;
      if (r.name.endsWith('.js') || r.type === 'script') result.jsBytes += t;
      else if (r.name.endsWith('.css') || r.type === 'css') result.cssBytes += t;
      else if (r.name.endsWith('.woff2') || r.name.endsWith('.woff') || r.name.endsWith('.ttf')) result.fontBytes += t;
      else if (/\.(png|jpg|jpeg|svg|gif|webp|avif)/.test(r.name)) result.imgBytes += t;
      else result.otherBytes += t;
    }
  } catch (e) {
    result.status = 'error';
    result.error = String(e.message || e).slice(0, 300);
  } finally {
    await context.close();
  }
  return result;
}

async function main() {
  console.log(`# Profiling ${ROUTES.length} routes against ${BASE}\n`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const all = [];
  for (const route of ROUTES) {
    process.stdout.write(`  ${route.label} ... `);
    const r = await profileRoute(browser, route);
    process.stdout.write('done\n');
    all.push(r);
  }
  await browser.close();

  console.log('\n========================= RESULTS =========================');
  const fmt = (b) => {
    if (!b) return '0 B';
    if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
  };
  const ms = (n) => (n == null ? '—' : n.toFixed(0) + ' ms');

  for (const r of all) {
    console.log(`\n## ${r.label}  (${r.route})`);
    if (r.status === 'error') {
      console.log(`   ERROR: ${r.error}`);
      continue;
    }
    const m = r.metrics || {};
    console.log(`   HTTP status:        ${r.httpStatus}`);
    console.log(`   TTFB:               ${ms(m.ttfb)}`);
    console.log(`   DOM Interactive:    ${ms(m.domInteractive)}`);
    console.log(`   DOM Content Loaded: ${ms(m.domContentLoaded)}`);
    console.log(`   Load event end:     ${ms(m.loadEventEnd ?? m.loadEvent)}`);
    console.log(`   FCP:                ${ms(m.fcp)}`);
    console.log(`   LCP:                ${ms(m.lcp)}`);
    console.log(`   Long tasks:         ${m.longTaskCount ?? '—'} (longest ${ms(m.longestTaskMs)})`);
    console.log(`   DOM nodes:          ${m.domNodes ?? '—'}`);
    console.log(`   Requests:           ${r.requests}`);
    console.log(`   Transfer total:     ${fmt(r.transferBytes)}`);
    console.log(`     JS:               ${fmt(r.jsBytes)}`);
    console.log(`     CSS:              ${fmt(r.cssBytes)}`);
    console.log(`     Fonts:            ${fmt(r.fontBytes)}`);
    console.log(`     Images:           ${fmt(r.imgBytes)}`);
    console.log(`     Other:            ${fmt(r.otherBytes)}`);
    if (r.pageErrors.length) {
      console.log(`   Page errors:        ${r.pageErrors.length}`);
      r.pageErrors.slice(0, 3).forEach((e) => console.log(`     - ${e}`));
    }
  }

  // Write JSON for the parent agent to consume.
  const fs = await import('fs');
  fs.writeFileSync('/home/joker/Projects/meet-conference/perf-profile-results.json', JSON.stringify(all, null, 2));
  console.log('\n(JSON results written to perf-profile-results.json)');
}

main().catch((e) => { console.error(e); process.exit(1); });
