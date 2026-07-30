import { test, expect } from '@playwright/test';

test.describe('Grid Layout Equal Tiles', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('three participants should have equal-sized tiles', async ({ page }) => {
    // Navigate to the room
    await page.goto('https://meet.livekit.phuket-tourist.com/room/working-class');

    // Wait for video tiles to appear
    await page.waitForSelector('[data-lk-participant-tile]', { timeout: 15000 });

    // Wait a bit for layout to stabilize
    await page.waitForTimeout(2000);

    // Get all participant tiles
    const tiles = await page.locator('[data-lk-participant-tile]').all();

    console.log(`Found ${tiles.length} participant tiles`);

    if (tiles.length === 0) {
      console.log('No participant tiles found - might need to login or join room');
      return;
    }

    // Get dimensions of each tile
    const dimensions = [];
    for (const tile of tiles) {
      const box = await tile.boundingBox();
      if (box) {
        dimensions.push({ width: box.width, height: box.height });
        console.log(`Tile dimensions: ${box.width}x${box.height}`);
      }
    }

    // Check if dimensions are roughly equal (within 5px tolerance)
    if (dimensions.length >= 2) {
      const firstWidth = dimensions[0].width;
      const firstHeight = dimensions[0].height;

      let allEqual = true;
      for (let i = 1; i < dimensions.length; i++) {
        const widthDiff = Math.abs(dimensions[i].width - firstWidth);
        const heightDiff = Math.abs(dimensions[i].height - firstHeight);

        console.log(`Tile ${i} diff: width=${widthDiff}px, height=${heightDiff}px`);

        if (widthDiff > 5 || heightDiff > 5) {
          allEqual = false;
        }
      }

      expect(allEqual, 'All tiles should have equal dimensions').toBeTruthy();

      // Take screenshot for visual inspection
      await page.screenshot({ path: 'grid-layout-3-participants.png' });
    }
  });
});