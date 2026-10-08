import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createGame, command, go, stubUi } from './harness.mjs';

// 执行真实 main.js，只替换 DOM 展示边界并把相对 import 转成绝对 URL。
// 不替换 chapterLoader 或 GameEngine，能抓到浏览器入口漏登记 TIMERS。
test('真实启动入口续玩 Pacific 后计时器仍会到期，自动保存有效', async () => {
  const original = createGame();
  await original.eng.transitionChapter({ to: 'pacific', roomCandidates: ['mesa'] });
  await go(original, 'bottom_scaffold');
  await command(original, 'open box');
  await command(original, 'push switch');
  let stored = JSON.stringify(original.eng.serialize());
  const output = [];
  let input;
  const priorStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
    removeItem: () => { stored = null; },
  };
  globalThis.__trinityTestUi = {
    ...stubUi(output), setLoading() {}, hideLoading() {}, setSaveControls() {},
    askResume: async () => 'continue', enableInput: handler => { input = handler; },
  };
  try {
    const url = new URL('../prototype/js/main.js', import.meta.url);
    let source = await readFile(url, 'utf8');
    assert.ok(source.includes('import { ui } from "./ui.js";'));
    source = source.replace('import { ui } from "./ui.js";', 'const ui = globalThis.__trinityTestUi;');
    source = source.replace(/(["'])(\.\/[^"']+)\1/g, (_match, quote, path) => quote + new URL(path, url).href + quote);
    assert.ok(source.includes('boot().catch('));
    source = source.replace('boot().catch(', 'await boot().catch(');
    await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    assert.equal(typeof input, 'function', '启动必须完成并启用输入');
    assert.ok(output.some(entry => entry.text.includes('已回到上次离开的地方')));
    for (let i = 0; i < original.state.timer.remaining; i++) await input('wait');
    assert.ok(JSON.parse(stored).state.flags.includes('pacific_timer_expired'));
  } finally {
    if (priorStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = priorStorage;
    delete globalThis.__trinityTestUi;
  }
});
