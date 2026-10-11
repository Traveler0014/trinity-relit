// 本地浏览器回归：使用独立上下文，不读取或覆盖玩家正在使用的浏览器存档。
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const modulePath = option('--playwright', 'playwright');
const { chromium } = await import(modulePath === 'playwright' ? modulePath : pathToFileURL(resolve(modulePath)).href);
const output = option('--output-dir', '/tmp/trinity-runtime-review');
mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 960}});
  const errors = [], modelRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/vendor\/intent|huggingface/.test(request.url())) modelRequests.push(request.url()); });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(option('--url', 'http://127.0.0.1:8081/'));
  const ready = () => page.waitForFunction(() => !document.querySelector('#input').disabled);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('trinity-relit:save:v1')));
  async function submit(text) {
    await page.locator('#input').fill(text);
    await page.locator('#input').press('Enter');
    await ready();
  }
  await ready();
  await submit('wait');
  assert.equal((await saved()).state.timer.remaining, 79);
  await page.reload();
  await page.getByRole('button', {name: '继续上次冒险', exact: true}).click();
  await ready();
  assert.doesNotMatch(await page.locator('#output').innerText(), /Sharp words between the superpowers/);
  await submit('wait');
  assert.equal((await saved()).state.timer.remaining, 78);

  // 用户输入和所有显示通道均应把 HTML 视为字面文本。
  const payload = '?<img src=x onerror="window.__injected=1"> & <b>测试</b>';
  const beforeUnknown = await saved();
  await submit(payload);
  assert.deepEqual(await saved(), beforeUnknown);
  assert.ok((await page.locator('.user-input').last().textContent()).includes(payload));
  await page.evaluate(async text => {
    const {ui} = await import('./js/ui.js');
    ui.location(text, text); ui.text(text + '\n\n中文 ' + text);
    ui.system(text); ui.inventory(text); ui.debug([{id: text, trigger: text, score: 1}]);
  }, payload);
  assert.equal(await page.locator('#output img, #output b').count(), 0);
  assert.equal(await page.evaluate(() => window.__injected), undefined);
  await page.screenshot({path: `${output}/literal-text.png`});

  // 标准英文指令不加载模型。
  await submit('e'); await submit('take the ball');
  assert.equal((await saved()).state.itemLoc.ball, 'inventory');
  const downloadReady = page.waitForEvent('download');
  await page.locator('#btn-export').click();
  const download = await downloadReady;
  const exportPath = `${output}/export.json`;
  await download.saveAs(exportPath);
  const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
  assert.deepEqual(exported.state, (await saved()).state);
  const beforeImport = await saved();
  const bad = structuredClone(exported);
  bad.state.timer.id = '__unknown__';
  async function importFile(save) {
    const choosing = page.waitForEvent('filechooser');
    await page.locator('#btn-import').click();
    await (await choosing).setFiles({name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save))});
  }
  await importFile(bad);
  await page.getByText('导入失败：存档中的计时器「__unknown__」无法恢复', {exact: true}).waitFor();
  assert.deepEqual(await saved(), beforeImport, '坏文件不得覆盖磁盘存档');
  await submit('wait');
  assert.equal((await saved()).state.turns, beforeImport.state.turns + 1, '坏文件不得损坏活状态');
  await importFile(exported);
  await page.getByRole('button', {name: '继续上次冒险', exact: true}).click();
  await ready();
  assert.deepEqual((await saved()).state, exported.state);
  await submit('wait');
  assert.equal((await saved()).state.timer.remaining, exported.state.timer.remaining - 1);
  await page.screenshot({path: `${output}/desktop-resumed.png`});
  await page.setViewportSize({width: 390, height: 844});
  await submit('inventory');
  assert.ok(await page.locator('#input').isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '窄屏不得横向溢出');
  await page.waitForFunction(() => { const log = document.querySelector('#output'); return log.scrollHeight - log.clientHeight - log.scrollTop < 2; });
  assert.ok(await page.locator('.inventory-display').last().isVisible());
  await page.screenshot({path: `${output}/mobile-inventory.png`});
  await page.locator('#btn-restart').click();
  await ready();
  await submit('wait');
  assert.equal((await saved()).state.turns, 1);
  assert.equal((await saved()).state.timer.remaining, 79);
  assert.deepEqual(modelRequests, [], '确定性命令不下载模型');
  assert.deepEqual(errors, []);
  const result = {passed: true, startupTimer: true, resumeTimer: true, literalText: true,
    articlesOffline: true, exportImport: true, invalidImportPreservesSave: true,
    mobileNoOverflow: true, restart: true, pageErrors: errors.length, modelRequests: modelRequests.length};
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
