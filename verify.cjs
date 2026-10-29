const { chromium } = require('C:/Users/q4444/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('C:/Users/q4444/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function checkCanvasPixels(canvas, label) {
  const image = await canvas.screenshot();
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  let dark = 0, water = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r < 170 && g < 190 && b < 200) dark++;
    if (g - r > 18 && b - r > 18 && g > 100) water++;
  }
  console.log('PIXELS', label, { dark, water });
  assert.ok(dark > 250, `${label}: model is blank or outside the camera`);
  assert.ok(water > 300, `${label}: water geometry is missing`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5173/?scene=ring', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__flume?.ready, { timeout: 60000 });
  await page.waitForTimeout(1000);
  fs.mkdirSync('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/desktop.png', fullPage: true });
  console.log('MODEL', await page.evaluate(() => window.__flume.scene.diagnostics()));
  console.log('ERRORS', errors);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.ok((await page.evaluate(() => window.__flume.scene.diagnostics().triangles)) > 1000);
  const canvas = page.locator('#scene-host > canvas');
  await checkCanvasPixels(canvas, 'desktop');
  const frame1 = await canvas.screenshot();
  await page.waitForTimeout(1200);
  const frame2 = await canvas.screenshot();
  assert.notEqual(Buffer.compare(frame1, frame2), 0, 'Water animation must change canvas pixels');
  await page.locator('[data-device="equipment"]').click();
  await page.locator('[data-point="G2"]').click();
  assert.equal(await page.locator('#detail-id').textContent(), 'G2');
  await page.locator('#focus-selected').click();
  await page.waitForTimeout(700);
  await page.locator('#reset-camera').click();
  await page.locator('#scenario').selectOption('alarm');
  assert.equal(await page.locator('#detail-id').textContent(), 'LT-03');
  assert.ok((await page.locator('#detail-state').textContent()).includes('高水位'));
  await page.screenshot({ path: 'screenshots/alarm.png', fullPage: true });
  await page.locator('#scenario').selectOption('offline');
  const frozen = await page.locator('#detail-value').textContent();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#detail-value').textContent(), frozen);
  assert.equal(await page.locator('#detail-state').textContent(), '离线');
  await page.locator('#scenario').selectOption('steady');
  await page.locator('#pause').click();
  const paused = await page.locator('#detail-value').textContent();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#detail-value').textContent(), paused);
  await page.locator('#pause').click();
  await page.locator('[data-view="data"]').click();
  assert.equal(await page.locator('#data-table tr').count(), 15);
  await page.locator('[data-open="FT-01"]').click();
  assert.equal(await page.locator('#detail-id').textContent(), 'FT-01');
  await page.waitForTimeout(800);
  await checkCanvasPixels(canvas, 'after-tab-switch');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  await download.saveAs('screenshots/export-check.csv');
  assert.ok(fs.readFileSync('screenshots/export-check.csv', 'utf8').includes('simulation'));
  await page.locator('[data-camera="top"]').click();
  await page.waitForTimeout(700);
  await checkCanvasPixels(canvas, 'top-view');
  await page.screenshot({ path: 'screenshots/top-view.png', fullPage: true });
  await page.locator('#reset-camera').click();
  await page.locator('[data-device="sensor"]').click();
  await page.locator('[data-point="LT-03"]').click();
  await page.locator('#search').fill('missing');
  assert.equal(await page.locator('.empty').textContent(), '没有匹配的测点');
  await page.locator('#search').fill('');
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `screenshots/mobile-${width}.png`, fullPage: true });
    await checkCanvasPixels(canvas, `mobile-${width}`);
    const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(size.scroll <= size.width, `Horizontal overflow at ${width}: ${JSON.stringify(size)}`);
    assert.ok((await page.evaluate(() => window.__flume.scene.diagnostics().triangles)) > 1000);
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  await browser.close();
  console.log('PASS: model, animation, selection, alarm, offline, pause, table, export, search, responsive sizes');
})().catch(e => { console.error(e); process.exit(1); });
