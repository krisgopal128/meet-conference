const { chromium } = require('/home/jspace/meet-conference/meet-frontend/node_modules/playwright-core');

const BASE_URL = 'https://meet.livekit.phuket-tourist.com';

// Viewports to test
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 }
];

// All main pages (11)
const mainPages = [
  { name: 'HomePage', path: '/', requiresAuth: true },
  { name: 'LoginPage', path: '/login', requiresAuth: false },
  { name: 'RegisterPage', path: '/register', requiresAuth: false },
  { name: 'ForgotPasswordPage', path: '/forgot-password', requiresAuth: false },
  { name: 'ResetPasswordPage', path: '/reset-password/test-token', requiresAuth: false },
  { name: 'ThankYouPage', path: '/thank-you', requiresAuth: false },
  { name: 'SchedulePage', path: '/schedule', requiresAuth: true },
  { name: 'HistoryPage', path: '/history', requiresAuth: true },
  { name: 'MeetingDetailPage', path: '/history/123', requiresAuth: true },
  { name: 'RecordingsPage', path: '/recordings', requiresAuth: true },
  { name: 'ApiKeysPage', path: '/api-keys', requiresAuth: true },
  { name: 'PreJoinPage', path: '/join/test-room', requiresAuth: false },
  { name: 'RoomPage', path: '/room/test-room', requiresAuth: false },
  { name: 'NotFoundPage', path: '/404', requiresAuth: false }
];

// Admin pages (7)
const adminPages = [
  { name: 'AdminDashboard', path: '/prashasakah', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminUsers', path: '/prashasakah/users', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminUserDetail', path: '/prashasakah/users/1', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminMeetings', path: '/prashasakah/meetings', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminMeetingDetail', path: '/prashasakah/meetings/1', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminAuditLogs', path: '/prashasakah/audit-logs', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminAlerts', path: '/prashasakah/alerts', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminApiKeys', path: '/prashasakah/api-keys', requiresAuth: true, requiresAdmin: true },
  { name: 'AdminSettings', path: '/prashasakah/settings', requiresAuth: true, requiresAdmin: true }
];

const allPages = [...mainPages, ...adminPages];

// Audit checks
function runAccessibilityChecks(page) {
  const issues = [];
  
  // Check for horizontal overflow
  const bodyWidth = page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = page.viewportSize().width;
  if (bodyWidth > viewportWidth) {
    issues.push({
      type: 'overflow',
      severity: 'high',
      message: `Horizontal overflow detected: body width ${bodyWidth}px exceeds viewport ${viewportWidth}px`
    });
  }
  
  // Check for missing labels on form inputs
  const inputsWithoutLabels = page.evaluate(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    const issues = [];
    inputs.forEach(input => {
      if (input.type !== 'hidden' && input.type !== 'submit' && input.type !== 'button') {
        const hasLabel = document.querySelector(`label[for="${input.id}"]`) || 
                         input.closest('label') || 
                         input.getAttribute('aria-label') ||
                         input.getAttribute('aria-labelledby');
        if (!hasLabel) {
          issues.push(input.getAttribute('name') || input.getAttribute('id') || input.type);
        }
      }
    });
    return issues;
  });
  
  if (inputsWithoutLabels.length > 0) {
    issues.push({
      type: 'accessibility',
      severity: 'medium',
      message: `Form inputs without labels: ${inputsWithoutLabels.join(', ')}`
    });
  }
  
  // Check for heading hierarchy gaps
  const headingIssues = page.evaluate(() => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const issues = [];
    let previousLevel = 0;
    
    headings.forEach(heading => {
      const currentLevel = parseInt(heading.tagName[1]);
      if (currentLevel > previousLevel + 1) {
        issues.push({
          from: `h${previousLevel}`,
          to: heading.tagName,
          text: heading.textContent.substring(0, 50)
        });
      }
      previousLevel = currentLevel;
    });
    return issues;
  });
  
  if (headingIssues.length > 0) {
    headingIssues.forEach(issue => {
      issues.push({
        type: 'hierarchy',
        severity: 'low',
        message: `Heading hierarchy gap: ${issue.from} → ${issue.to} ("${issue.text}...")`
      });
    });
  }
  
  // Check for undersized click targets (< 44px)
  const smallClickTargets = page.evaluate(() => {
    const interactive = document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]');
    const issues = [];
    interactive.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        issues.push({
          tag: el.tagName,
          text: el.textContent?.substring(0, 30) || el.getAttribute('aria-label') || '',
          size: `${rect.width}x${rect.height}`
        });
      }
    });
    return issues;
  });
  
  if (smallClickTargets.length > 0) {
    smallClickTargets.forEach(target => {
      issues.push({
        type: 'usability',
        severity: 'medium',
        message: `Undersized click target: ${target.tag} (${target.size}) - "${target.text}..."`
      });
    });
  }
  
  // Check for broken images
  const brokenImages = page.evaluate(() => {
    const images = document.querySelectorAll('img');
    const issues = [];
    images.forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        issues.push(img.src || img.getAttribute('data-src') || 'unknown src');
      }
    });
    return issues;
  });
  
  if (brokenImages.length > 0) {
    issues.push({
      type: 'visual',
      severity: 'high',
      message: `Broken images detected: ${brokenImages.join(', ')}`
    });
  }
  
  // Check for viewport meta tag
  const hasViewportMeta = page.evaluate(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    return !!viewport;
  });
  
  if (!hasViewportMeta) {
    issues.push({
      type: 'mobile',
      severity: 'high',
      message: 'Missing viewport meta tag - mobile responsiveness may be broken'
    });
  }
  
  return issues;
}

async function auditPage(browser, pageInfo, viewport) {
  const context = await browser.newContext({ 
    ignoreHTTPSErrors: true,
    viewport: { width: viewport.width, height: viewport.height }
  });
  const page = await context.newPage();

  const errors = [];
  const consoleErrors = [];
  
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const result = {
    pageName: pageInfo.name,
    path: pageInfo.path,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    status: null,
    title: '',
    accessible: true,
    loadTime: 0,
    errors: [],
    consoleErrors: [],
    accessibilityIssues: [],
    screenshot: null,
    requiresAuth: pageInfo.requiresAuth,
    requiresAdmin: pageInfo.requiresAdmin || false
  };

  try {
    const startTime = Date.now();
    const response = await page.goto(`${BASE_URL}${pageInfo.path}`, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
    result.loadTime = Date.now() - startTime;
    result.status = response ? response.status() : 'no response';
    result.title = await page.title();
    
    // Check for visible error text on page
    const bodyText = await page.textContent('body').catch(() => '');
    result.hasErrorText = bodyText.includes('502 Bad Gateway') || 
                        bodyText.includes('503 Service') ||
                        bodyText.includes('Application Error') ||
                        bodyText.includes('500 Internal Server Error');
    
    result.pageErrors = [...errors];
    result.consoleErrors = [...consoleErrors].slice(0, 10); // Limit console errors
    
    // Run accessibility checks
    result.accessibilityIssues = runAccessibilityChecks(page);
    if (result.accessibilityIssues.some(i => i.severity === 'high')) {
      result.accessible = false;
    }
    
    // Take screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotFilename = `audit-${pageInfo.name}-${viewport.name}-${timestamp}.png`;
    result.screenshot = screenshotFilename;
    
  } catch (err) {
    result.error = err.message;
    result.accessible = false;
  }

  await context.close();
  return result;
}

async function runAudit() {
  console.log('🚀 Starting comprehensive UI audit for meet-conference');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📱 Viewports: ${viewports.map(v => v.name).join(', ')}`);
  console.log(`📄 Total pages: ${allPages.length}`);
  console.log(`\n---\n`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  
  // Test all pages at all viewports
  for (const pageInfo of allPages) {
    console.log(`📄 Testing: ${pageInfo.name} (${pageInfo.path})`);
    
    for (const viewport of viewports) {
      console.log(`   📱 Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
      const result = await auditPage(browser, pageInfo, viewport);
      results.push(result);
      
      const statusIcon = result.status === 200 && !result.hasErrorText && result.accessible ? '✅' : '❌';
      console.log(`      ${statusIcon} Status: ${result.status}, Accessible: ${result.accessible}, Load time: ${result.loadTime}ms`);
      
      if (result.accessibilityIssues.length > 0) {
        result.accessibilityIssues.forEach(issue => {
          console.log(`         ⚠️ [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}`);
        });
      }
      
      if (result.pageErrors.length > 0) {
        result.pageErrors.forEach(e => console.log(`         🔴 Page Error: ${e.substring(0, 100)}`));
      }
      
      if (result.consoleErrors.length > 0) {
        result.consoleErrors.forEach(e => console.log(`         🟡 Console Error: ${e.substring(0, 100)}`));
      }
    }
    
    console.log('');
  }

  // Generate summary report
  console.log('--- SUMMARY ---');
  const totalTests = results.length;
  const passed = results.filter(r => r.status === 200 && !r.hasErrorText && r.accessible).length;
  const failed = totalTests - passed;
  
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passed} (${((passed/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed/totalTests)*100).toFixed(1)}%)`);
  
  // Count issues by type
  const issueCounts = {};
  results.forEach(r => {
    r.accessibilityIssues.forEach(issue => {
      issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
    });
  });
  
  console.log('\n--- ISSUES BY TYPE ---');
  Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`${type}: ${count}`);
  });
  
  // Count issues by severity
  const severityCounts = { high: 0, medium: 0, low: 0 };
  results.forEach(r => {
    r.accessibilityIssues.forEach(issue => {
      severityCounts[issue.severity]++;
    });
  });
  
  console.log('\n--- ISSUES BY SEVERITY ---');
  console.log(`High: ${severityCounts.high}`);
  console.log(`Medium: ${severityCounts.medium}`);
  console.log(`Low: ${severityCounts.low}`);
  
  // Save results to JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFilename = `/home/jspace/.nanobot/workspace/meet-conference-ui-audit-results-${timestamp}.json`;
  const fs = require('fs');
  fs.writeFileSync(reportFilename, JSON.stringify(results, null, 2));
  console.log(`\n📊 Detailed results saved to: ${reportFilename}`);
  
  await browser.close();
  
  return {
    totalTests,
    passed,
    failed,
    issueCounts,
    severityCounts,
    results
  };
}

(async () => {
  try {
    const summary = await runAudit();
    process.exit((summary.failed > 0) ? 1 : 0);
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    process.exit(1);
  }
})();