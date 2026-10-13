// PR #6：真实 DOM、说明层、resolver 和本地模型联调；不使用玩家存档。
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const modulePath = option('--playwright', 'playwright');
const { chromium } = await import(modulePath === 'playwright' ? modulePath : pathToFileURL(resolve(modulePath)).href);
const output = option('--output-dir', '/tmp/trinity-pr6-browser');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  let workers = 0, downloads = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', () => workers++);
  page.on('request', request => { if (request.url().endsWith('/model_quantized.onnx')) downloads++; });
  await page.goto(option('--url', 'http://127.0.0.1:8082/'));
  await page.locator('#input').waitFor();
  await page.evaluate(async () => {
    const { GameEngine } = await import('./js/engine.js');
    const { Parser } = await import('./js/parser.js');
    const { LocalIntentResolver } = await import('./js/intent-model.js');
    const { createIntentNotice } = await import('./js/intent-notice.js');
    const { settings } = await import('./js/settings.js');
    const { ROOMS } = await import('./js/data/prologue.js');
    const { ITEMS } = await import('./js/data/items.js');
    const { ui } = await import('./js/ui.js');
    settings.set('semantic', 'ask');
    const resolver = new LocalIntentResolver();
    const notice = createIntentNotice({ ui, processInput: input => window.probe.processInput(input) });
    ui.setSemanticControls({ onMore: () => notice.openMenu(), cause: () => notice.causeText() });
    window.probe = new GameEngine({ rooms: ROOMS, items: ITEMS, parser: new Parser(), ui,
      intentResolver: notice.wrap(resolver), intentTimeoutMs: 200 });
    window.resolver = resolver;
    window.notice = notice;
    window.render_game_to_text = () => JSON.stringify(window.probe.serialize().state);
    window.pending = window.probe.processInput('help woman');
    window.oldEnable = [...document.querySelectorAll('button')].find(b => b.textContent === '下载并启用');
  });
  async function capture(name) {
    await page.locator('#output').evaluate(log => log.scrollTo({ top: log.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  await page.evaluate(() => window.pending);
  assert.equal(await page.getByRole('button', { name: '下载并启用', exact: true }).count(), 0);
  await page.evaluate(async () => {
    window.probe.moveTo('lancaster_gate');
    window.oldEnable.click();
    const { ui } = await import('./js/ui.js');
    if (ui._dialogOpen) throw new Error('Expired dialog still open');
  });
  assert.equal(await page.evaluate(() => window.probe.state.turns), 0);
  assert.equal(workers, 0);
  await capture('expired-consent');
  await page.evaluate(() => {
    window.probe.moveTo('round_pond');
    window.probe.intentTimeoutMs = 60000;
    window.pending = window.probe.processInput('把水面上那只折出来的小鸟捞起来');
  });
  await capture('consent');
  await page.getByRole('button', { name: '下载并启用', exact: true }).click();
  await page.getByRole('button', { name: '拿纸鸟', exact: true }).waitFor({ timeout: 60000 });
  await capture('suggestion');
  await page.getByRole('button', { name: '都不是，重新输入', exact: true }).click();
  await page.evaluate(() => window.pending);
  assert.equal(await page.evaluate(() => window.resolver.readyLanguages.has('zh')), true);
  // 同一 JS 任务内点取消，保证模型再快也能覆盖“就绪后取消”的请求边界。
  await page.evaluate(async () => {
    const pending = window.probe.processInput('把水面上那只折出来的小鸟捞起来');
    [...document.querySelectorAll('button')].find(b => b.textContent === '取消识别').click();
    await pending;
    if (!window.resolver.worker) throw new Error('Warm cancellation disposed Worker');
  });
  assert.equal(await page.evaluate(() => window.probe.state.turns), 0);
  await page.evaluate(() => { window.pending = window.probe.processInput('把水面上那只折出来的小鸟捞起来'); });
  await page.getByRole('button', { name: '拿纸鸟', exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: '拿纸鸟', exact: true }).click();
  await page.evaluate(() => window.pending);
  assert.equal(await page.evaluate(() => window.probe.state.turns), 1);
  assert.equal(await page.evaluate(() => window.probe.state.has('paper_bird')), true);
  assert.equal(workers, 1);
  assert.equal(downloads, 1);
  const menu = page.evaluate(() => window.notice.openMenu());
  await page.getByRole('button', { name: '关闭语义识别', exact: true }).waitFor();
  assert.match(await page.locator('.dialog-body').last().innerText(), /当前场景已实现/);
  await capture('menu');
  await page.getByRole('button', { name: '关闭语义识别', exact: true }).click();
  await menu;
  assert.equal(await page.evaluate(() => window.resolver.worker), null);
  assert.equal(await page.evaluate(() => window.resolver.readyLanguages.size), 0);
  assert.deepEqual(errors, []);
  const result = { workers, downloads, errors, state: JSON.parse(await page.evaluate(() => window.render_game_to_text())) };
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ workers, downloads, errors, turns: result.state.turns }));
} finally { await browser.close(); }
