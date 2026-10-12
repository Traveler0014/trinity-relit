// 真实模型慢下载、超时重试与页面重载缓存回归；独立浏览器上下文。
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const modulePath = option('--playwright', 'playwright');
const { chromium } = await import(modulePath === 'playwright' ? modulePath : pathToFileURL(resolve(modulePath)).href);
const output = option('--output-dir', '/tmp/trinity-intent-lifecycle');
mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1280, height: 960}});
  let downloads = 0, workers = 0;
  // 路由本身关闭 HTTP cache；Cache Storage 仍可用，接近开发者工具禁用缓存的场景。
  await context.route('**/model_quantized.onnx', async route => {
    downloads++;
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', () => workers++);
  await page.goto(option('--url', 'http://127.0.0.1:8081/'));
  async function capture(name) {
    await page.locator('#output').evaluate(log => log.scrollTo({top: log.scrollHeight, behavior: 'instant'}));
    await page.waitForFunction(() => { const log = document.querySelector('#output'); return log.scrollHeight - log.clientHeight - log.scrollTop < 2; });
    await page.screenshot({path: `${output}/${name}.png`});
  }
  async function init(timeout = 15000) {
    await page.evaluate(async timeout => {
      const {GameEngine} = await import('./js/engine.js');
      const {Parser} = await import('./js/parser.js');
      const {LocalIntentResolver} = await import('./js/intent-model.js');
      const {ROOMS} = await import('./js/data/prologue.js');
      const {ITEMS} = await import('./js/data/items.js');
      const {ui} = await import('./js/ui.js');
      window.probe = new GameEngine({rooms: ROOMS, items: ITEMS, parser: new Parser(), ui,
        intentResolver: new LocalIntentResolver(), intentTimeoutMs: timeout});
      window.probe.moveTo('round_pond');
    }, timeout);
  }
  await page.evaluate(async () => {
    const {ui} = await import('./js/ui.js');
    const progress = ui.intentProgress(() => {});
    progress.update({status: 'progress', progress: 100, loaded: 18000000, total: 16000000, language: 'zh'});
    window.progressProbe = {text: document.querySelector('[role="status"]').textContent};
    progress.close();
  });
  const progressText = await page.evaluate(() => window.progressProbe.text);
  assert.match(progressText, /已接收.*MB/);
  assert.doesNotMatch(progressText, /100%|下载完成/);
  await init(300);
  await page.evaluate(() => window.probe.processInput('把水面上那只折出来的小鸟捞起来'));
  assert.match(await page.locator('#output').innerText(), /语义识别等待超时/);
  assert.equal(await page.evaluate(() => window.probe.state.turns), 0);
  await capture('timeout');
  await page.evaluate(() => { window.probe.intentTimeoutMs = 15000; });
  async function requestAndCancel() {
    const pending = page.evaluate(() => window.probe.processInput('把水面上那只折出来的小鸟捞起来'));
    await page.getByRole('button', {name: '拿纸鸟', exact: true}).waitFor({timeout: 20000});
    await capture('options');
    await page.getByRole('button', {name: '都不是，重新输入', exact: true}).click();
    await pending;
    assert.equal(await page.evaluate(() => window.probe.state.turns), 0);
  }
  await requestAndCancel();
  await requestAndCancel();
  assert.equal(workers, 1, '超时和多次输入必须复用一个 Worker');
  assert.equal(downloads, 1, '超时重试不得重复下载模型');
  await page.reload();
  await init();
  await requestAndCancel();
  assert.equal(workers, 2, '重载页面建立一个新的 Worker');
  assert.equal(downloads, 1, '新页面从 Cache Storage 读模型，不再下载');
  await page.evaluate(() => window.probe.moveTo('broad_walk'));
  await page.evaluate(() => window.probe.processInput('喂鸟'));
  assert.match(await page.locator('#output').innerText(), /条件还不满足/);
  const buy = page.evaluate(() => window.probe.processInput('买'));
  await page.getByRole('button', {name: '买面包屑', exact: true}).waitFor();
  await capture('buy-options');
  await page.getByRole('button', {name: '买面包屑', exact: true}).click();
  await buy;
  await page.evaluate(() => window.probe.processInput('喂鸟'));
  assert.equal(await page.evaluate(() => window.probe.state.hasFlag('birds_fed')), true);
  assert.equal(await page.evaluate(() => window.probe.state.turns), 2);
  assert.deepEqual(errors, []);
  const result = {passed: true, downloads, workers, timeoutPreservesState: true,
    retryReusesWorker: true, reloadUsesCacheStorage: true, buyThenFeed: true, errors};
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
