import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '320px', width: 320, height: 568 },
  { name: '360px', width: 360, height: 740 },
  { name: '390px', width: 390, height: 844 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1280px', width: 1280, height: 800 },
  { name: '1536px', width: 1536, height: 864 },
  { name: '1920px', width: 1920, height: 1080 },
  { name: 'landscape-844x390', width: 844, height: 390 },
  { name: 'short-laptop-1366x640', width: 1366, height: 640 },
];

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

for (const vp of VIEWPORTS) {
  test(`no horizontal overflow on /login and /signup at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of ['/login', '/signup']) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(overflow, `Horizontal overflow detected on ${route} at ${vp.name}`).toBe(false);
    }
  });
}
