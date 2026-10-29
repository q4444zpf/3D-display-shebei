import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire('C:/Users/q4444/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
await mkdir('verification', { recursive: true });

async function ready() {
  await page.waitForFunction(() => window.__flume?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1000);
}
async function pixels() {
  return page.evaluate(() => {
    const source = document.querySelector('#scene-host canvas');
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext('2d');
    context.drawImage(source, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    const colors = new Set();
    let hash = 0;
    for (let i = 0; i < data.length; i += 28) {
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      hash = (hash * 31 + data[i] + data[i + 1] * 3 + data[i + 2] * 7) | 0;
    }
    return { colors: colors.size, hash };
  });
}

try {
  await page.goto('http://127.0.0.1:5173/');
  await ready();
  assert.equal(await page.title(), '水槽沙盘 · 三维感知');
  assert.equal(await page.evaluate(() => window.__flume.sim.points.length), 14);
  assert.equal(await page.locator('.device-row').count(), 6);
  assert.ok((await pixels()).colors > 100);
  assert.equal(await page.evaluate(() => window.__flume.scene.diagnostics().inFrame), true);
  results.push({ desktop: await page.evaluate(() => window.__flume.scene.diagnostics()), pixels: await pixels() });
  await page.screenshot({ path: 'verification/desktop.png', fullPage: true });
  const initial = await page.locator('#detail-value').textContent();
  await page.waitForTimeout(1300);
  const samples = await page.evaluate(() => window.__flume.sim.points[2].history.length);
  assert.ok(samples > 120);
  await page.locator('#pause').click();
  const frozen = await page.locator('#detail-value').textContent();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('#detail-value').textContent(), frozen);
  await page.locator('#pause').click();
  await page.locator('#scenario').selectOption('alarm');
  assert.equal(await page.locator('#detail-state').textContent(), '高水位');
  await page.screenshot({ path: 'verification/alarm.png', fullPage: true });
  await page.locator('#scenario').selectOption('offline');
  const lastSample = await page.evaluate(() => window.__flume.sim.points[2].updated);
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('#detail-state').textContent(), '离线');
  assert.equal(await page.evaluate(() => window.__flume.sim.points[2].updated), lastSample);
  await page.locator('#scenario').selectOption('steady');
  await page.locator('[data-device="equipment"]').click();
  assert.equal(await page.locator('.device-row').count(), 8);
  await page.locator('[data-point="G2"]').click();
  assert.equal(await page.locator('#detail-id').textContent(), 'G2');
  await page.locator('[data-layer="equipment"]').click();
  await page.screenshot({ path: 'verification/equipment.png', fullPage: true });
  await page.locator('[data-camera="top"]').click();
  await page.waitForTimeout(1000);
  const topPixels = await pixels();
  await page.locator('[data-camera="perspective"]').click();
  await page.waitForTimeout(1200);
  assert.notEqual((await pixels()).hash, topPixels.hash);
  await page.locator('#rotate').click();
  const before = await pixels();
  await page.waitForTimeout(1100);
  assert.notEqual((await pixels()).hash, before.hash);
  await page.locator('#rotate').click();
  await page.locator('#reset-camera').click();
  await page.locator('[data-view="data"]').click();
  assert.equal(await page.locator('#data-table tr').count(), 14);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.csv'));
  await download.saveAs('verification/simulated-samples.csv');
  await page.locator('[data-open="LT-03"]').click();
  await page.locator('[data-layer="level"]').click();
  await page.locator('[data-device="sensor"]').click();
  await page.locator('#reset-camera').click();
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(1100);
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(layout.scroll <= width, JSON.stringify(layout));
    assert.ok((await pixels()).colors > 100);
    assert.equal(await page.evaluate(() => window.__flume.scene.diagnostics().inFrame), true, `Model clipped at ${width}px`);
    await page.screenshot({ path: `verification/mobile-${width}.png`, fullPage: true });
    results.push({ viewport: width, layout, pixels: await pixels() });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173/?scene=ring');
  await ready();
  assert.equal(await page.evaluate(() => window.__flume.sim.points.length), 15);
  assert.ok((await pixels()).colors > 100);
  assert.deepEqual(errors, []);
  results.push({ checks: 'live samples, pause, alarm, offline, selection, layers, camera, rotation, CSV, responsive layout, ring scene', errors });
  await writeFile('verification/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
