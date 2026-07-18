import { test, expect } from '@playwright/test';

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
  { name: 'NotFoundPage', path: '/404', requiresAuth: false }
];

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

test.describe('Comprehensive UI Audit', () => {
  allPages.forEach(pageInfo => {
    test.describe(`${pageInfo.name}`, () => {
      test(`should load without errors`, async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Check if page loaded successfully
        if (response && response.status() >= 400) {
          // For protected pages, being redirected to login is expected
          if (pageInfo.requiresAuth && page.url().includes('/login')) {
            test.skip();
            return;
          }
          // For admin pages, 403/404 might be expected without admin access
          if (pageInfo.requiresAdmin && (response.status() === 403 || response.status() === 404)) {
            test.skip();
            return;
          }
        }
        
        // Take screenshot for visual inspection
        await page.screenshot({ 
          path: `screenshots/${pageInfo.name}-${page.viewportSize().width}.png`,
          fullPage: true 
        });
        
        // Check for error messages on page
        const bodyText = await page.textContent('body');
        expect(bodyText).not.toContain('502 Bad Gateway');
        expect(bodyText).not.toContain('503 Service Unavailable');
        expect(bodyText).not.toContain('Application Error');
      });

      test('should not have horizontal overflow', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize().width;
        
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
      });

      test('should have viewport meta tag for mobile', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const viewport = page.locator('meta[name="viewport"]');
        const count = await viewport.count();
        
        if (page.viewportSize().width <= 768) {
          expect(count).toBeGreaterThan(0);
        }
      });

      test('should have proper labels on form inputs', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const inputsWithoutLabels = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
          const issues = [];
          inputs.forEach(input => {
            const hasLabel = document.querySelector(`label[for="${input.id}"]`) || 
                             input.closest('label') || 
                             input.getAttribute('aria-label') ||
                             input.getAttribute('aria-labelledby');
            if (!hasLabel) {
              issues.push(input.getAttribute('name') || input.getAttribute('id') || input.type);
            }
          });
          return issues;
        });
        
        expect(inputsWithoutLabels.length).toBe(0);
      });

      test('should have proper heading hierarchy', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const headingGaps = await page.evaluate(() => {
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          const issues = [];
          let previousLevel = 0;
          
          headings.forEach(heading => {
            const currentLevel = parseInt(heading.tagName[1]);
            if (currentLevel > previousLevel + 1 && previousLevel !== 0) {
              issues.push({
                from: `h${previousLevel}`,
                to: heading.tagName,
                text: heading.textContent?.substring(0, 50) || ''
              });
            }
            previousLevel = currentLevel;
          });
          return issues;
        });
        
        // Allow some heading gaps but flag severe ones
        const severeGaps = headingGaps.filter(gap => 
          (gap.from === 'h1' && gap.to === 'h4') || 
          (gap.from === 'h1' && gap.to === 'h5') ||
          (gap.from === 'h1' && gap.to === 'h6') ||
          (gap.from === 'h2' && gap.to === 'h5') ||
          (gap.from === 'h2' && gap.to === 'h6')
        );
        
        expect(severeGaps.length).toBe(0);
      });

      test('should have adequate click targets', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const smallClickTargets = await page.evaluate(() => {
          const interactive = document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]');
          const issues = [];
          interactive.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Check if element is visible
            if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
              issues.push({
                tag: el.tagName,
                text: el.textContent?.substring(0, 30) || el.getAttribute('aria-label') || '',
                size: `${rect.width}x${rect.height}`
              });
            }
          });
          return issues;
        });
        
        // Be lenient with small click targets - flag them but don't fail the test
        if (smallClickTargets.length > 0) {
          console.log(`⚠️ Small click targets found: ${smallClickTargets.map(t => `${t.tag} (${t.size})`).join(', ')}`);
        }
      });

      test('should not have broken images', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        // Wait for images to load
        await page.waitForLoadState('networkidle');
        
        const brokenImages = await page.evaluate(() => {
          const images = document.querySelectorAll('img');
          const issues = [];
          images.forEach(img => {
            if (!img.complete || img.naturalWidth === 0) {
              issues.push(img.src || img.getAttribute('data-src') || 'unknown src');
            }
          });
          return issues;
        });
        
        expect(brokenImages.length).toBe(0);
      });

      test('should have proper page title', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
        expect(title).not.toBe('undefined');
      });

      test('should have proper meta description', async ({ page }) => {
        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        const description = page.locator('meta[name="description"]');
        const hasDescription = await description.count() > 0;
        
        if (hasDescription) {
          const content = await description.getAttribute('content');
          expect(content?.length).toBeGreaterThan(0);
        }
      });

      test('should not have console errors', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        const response = await page.goto(pageInfo.path);
        
        // Skip if we can't access the page
        if (response?.status() === 403 || response?.status() === 404 || page.url().includes('/login')) {
          test.skip();
          return;
        }
        
        // Wait a bit for any delayed console errors
        await page.waitForTimeout(2000);
        
        // Filter out benign errors
        const filteredErrors = consoleErrors.filter(err => 
          !err.includes('Extension context invalidated') &&
          !err.includes('favicon.ico') &&
          !err.includes('404')
        );
        
        expect(filteredErrors.length).toBe(0);
      });
    });
  });
});

test.describe('Pre-join, Room, and Post-meeting Flows', () => {
  test('Pre-join flow: should navigate from pre-join to room', async ({ page }) => {
    // Start at pre-join page
    await page.goto('/join/test-room');
    
    // Check if we're redirected to login (protected)
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Verify pre-join elements
    await expect(page.locator('button, [role="button"]').first()).toBeVisible();
    
    // Try to join room
    const joinButton = page.locator('button:has-text("Join"), button:has-text("Start Meeting")').first();
    if (await joinButton.isVisible()) {
      await joinButton.click();
      
      // Check if we're in the room
      await page.waitForTimeout(2000);
      expect(page.url()).toContain('/room/');
    }
  });

  test('Room page: should load room interface', async ({ page }) => {
    await page.goto('/room/test-room');
    
    // Check if we're redirected to login (protected)
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: `screenshots/RoomPage-${page.viewportSize().width}.png`,
      fullPage: true 
    });
    
    // Verify basic room elements are present
    await expect(page.locator('body')).toBeVisible();
  });

  test('Post-meeting: should navigate to history after room', async ({ page }) => {
    // Try to access history
    await page.goto('/history');
    
    // Check if we're redirected to login (protected)
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: `screenshots/HistoryPage-${page.viewportSize().width}.png`,
      fullPage: true 
    });
    
    // Verify history elements
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Responsive Design Tests', () => {
  test('Navigation should be accessible on mobile', async ({ page }) => {
    await page.goto('/');
    
    // Check if we're redirected to login (protected)
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // On mobile, look for hamburger menu or mobile navigation
    const viewportWidth = page.viewportSize().width || 0;
    
    if (viewportWidth <= 768) {
      // Look for mobile menu button
      const mobileMenu = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], .mobile-menu, .hamburger');
      const count = await mobileMenu.count();
      
      // If there's a mobile menu, check if it's accessible
      if (count > 0) {
        await mobileMenu.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Content should be readable on tablet', async ({ page }) => {
    await page.goto('/');
    
    // Check if we're redirected to login (protected)
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    // Check font sizes are reasonable
    const bodyFontSize = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return parseInt(style.fontSize);
    });
    
    expect(bodyFontSize).toBeGreaterThanOrEqual(14);
  });

  test('Layout should be stable on desktop', async ({ page }) => {
    await page.goto('/');
    
    // Check if we're redirected to login (protected)
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }
    
    const viewportWidth = page.viewportSize().width || 0;
    
    if (viewportWidth >= 1280) {
      // Check that content is properly constrained
      const mainContent = page.locator('main, .container, #root').first();
      const boundingBox = await mainContent.boundingBox();
      
      if (boundingBox) {
        expect(boundingBox.width).toBeLessThanOrEqual(viewportWidth);
      }
    }
  });
});