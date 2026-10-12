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
    ...stubUi(output), setLoading() {}, hideLoading() {}, setSaveControls() {}, setSemanticControls() {}, semanticDebug() {},
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

test('真实新开局启动一次首房间事件；续玩保持计时器，不重放开场', async () => {
  const priorStorage = globalThis.localStorage;
  let stored = null;
  globalThis.localStorage = {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
    removeItem: () => { stored = null; },
  };
  try {
    const url = new URL('../prototype/js/main.js', import.meta.url);
    let source = await readFile(url, 'utf8');
    source = source.replace('import { ui } from "./ui.js";', 'const ui = globalThis.__trinityTestUi;');
    source = source.replace(/(["'])(\.\/[^"']+)\1/g, (_match, quote, path) => quote + new URL(path, url).href + quote);
    source = source.replace('boot().catch(', 'await boot().catch(');
    for (const phase of ['new', 'resume']) {
      const output = [];
      let input;
      globalThis.__trinityTestUi = {
        ...stubUi(output), setLoading() {}, hideLoading() {}, setSaveControls() {}, setSemanticControls() {}, semanticDebug() {},
        askResume: async () => 'continue', enableInput: handler => { input = handler; },
      };
      await import(`data:text/javascript;base64,${Buffer.from(source + '\n// ' + phase).toString('base64')}`);
      assert.equal(typeof input, 'function');
      const text = output.map(line => line.text).join('\n');
      if (phase === 'new') assert.match(text, /Sharp words between the superpowers/);
      else assert.doesNotMatch(text, /Sharp words between the superpowers/);
      await input('wait');
      const state = JSON.parse(stored).state;
      assert.equal(state.timer.id, 'doomsday');
      assert.equal(state.timer.remaining, phase === 'new' ? 79 : 78);
      assert.ok(state.flags.includes('palace_gate_visited'));
    }
  } finally {
    if (priorStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = priorStorage;
    delete globalThis.__trinityTestUi;
  }
});
