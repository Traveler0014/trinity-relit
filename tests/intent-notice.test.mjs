import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './harness.mjs';
import { createIntentNotice } from '../prototype/js/intent-notice.js';
import { settings } from '../prototype/js/settings.js';

// Node 环境没有 localStorage，settings 仅内存生效；每个用例前显式复位。
const reset = (mode = 'on') => settings.set('semantic', mode);
const tick = () => new Promise(resolve => setImmediate(resolve));

function makeUi(dialogResult = null) {
  const ui = {
    said: [],
    dialogs: [],
    dialogResult,
    cancel: null,
    system: text => ui.said.push(text),
    semanticDialog: (dialog) => { ui.dialogs.push(dialog); return Promise.resolve(ui.dialogResult); },
    semanticProgress: cancel => { ui.cancel = cancel; return { update: () => {}, close: () => {} }; },
  };
  return ui;
}

// 隔离说明层的轻量替身；真实 resolver 的取消契约另有集成回归。
function makeResolver(behaviour) {
  return {
    disposed: [],
    resolve(request, options = {}) {
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        behaviour(request, resolve, reject);
      });
    },
    dispose(reason) { this.disposed.push(reason); },
  };
}

const suggest = () => makeResolver((request, resolve) => resolve({ kind: 'suggest', candidateIds: ['event:x'] }));
const noMatch = () => makeResolver((request, resolve) => resolve({ kind: 'none' }));
const failing = stage => makeResolver((request, resolve, reject) => reject(Object.assign(new Error('boom'), { stage })));
const hanging = () => makeResolver(() => {});

test('命中候选后不留下归因，也不再提示重试', async () => {
  reset();
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  assert.deepEqual(await notice.wrap(suggest()).resolve({ input: '看雕像' }), { kind: 'suggest', candidateIds: ['event:x'] });
  assert.equal(notice.causeText(), null);
  await notice.openMenu();
  assert.equal(ui.dialogs[0].actions.some(a => a.value === 'retry'), false);
});

test('模型判定为不接近：给出归因，但不提供重试（重跑同一句没有意义）', async () => {
  reset();
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  assert.deepEqual(await notice.wrap(noMatch()).resolve({ input: '问妇人' }), { kind: 'none' });
  assert.equal(notice.causeText(), '没有足够接近的动作可选');
  await notice.openMenu();
  assert.equal(ui.dialogs[0].actions.some(a => a.value === 'retry'), false);
});

test('下载/加载失败：按阶段给归因，重试会重跑刚才那句', async () => {
  for (const [stage, cause] of [
    ['download', '模型下载失败（网络或离线）'],
    ['runtime', '识别组件加载失败（网络或离线）'],
    ['worker', '识别组件加载失败（网络或离线）'],
    ['initializing', '模型初始化失败（设备可能不支持）'],
    ['infer', '识别推理出错'],
  ]) {
    reset();
    const ui = makeUi('retry');
    const ran = [];
    const notice = createIntentNotice({ ui, processInput: input => ran.push(input) });
    await assert.rejects(notice.wrap(failing(stage)).resolve({ input: '看雕像' }));
    assert.equal(notice.causeText(), cause, `${stage} 阶段要有对应归因`);
    await notice.openMenu();
    assert.equal(ui.dialogs[0].actions.some(a => a.value === 'retry'), true);
    assert.deepEqual(ran, ['看雕像']);
  }
});

test('默认先征求同意：不碰底层 resolver，同意才转发并记住已启用', async () => {
  reset('ask');
  const ui = makeUi('enable');
  let calls = 0;
  const resolver = makeResolver((request, resolve) => { calls++; resolve({ kind: 'none' }); });
  const notice = createIntentNotice({ ui });
  await notice.wrap(resolver).resolve({ input: '看雕像' });
  assert.equal(calls, 1);
  assert.equal(settings.get('semantic'), 'on');
  assert.match(ui.dialogs[0].body, /约 25–35 MB/);
  assert.match(ui.dialogs[0].body, /不会向任何服务器发送/);
});

test('拒绝征求：写回 off、不下载、给出「已关闭」归因', async () => {
  reset('ask');
  const ui = makeUi('decline');
  let calls = 0;
  const resolver = makeResolver((request, resolve) => { calls++; resolve({ kind: 'none' }); });
  const notice = createIntentNotice({ ui });
  assert.deepEqual(await notice.wrap(resolver).resolve({ input: '看雕像' }), { kind: 'none' });
  assert.equal(calls, 0);
  assert.equal(settings.get('semantic'), 'off');
  assert.equal(notice.causeText(), '语义识别已关闭');
});

test('关闭状态下不建 Worker：直接拒识并说明已关闭', async () => {
  reset('off');
  const ui = makeUi();
  let calls = 0;
  const resolver = makeResolver((request, resolve) => { calls++; resolve({ kind: 'none' }); });
  const notice = createIntentNotice({ ui });
  assert.deepEqual(await notice.wrap(resolver).resolve({ input: '看雕像' }), { kind: 'none' });
  assert.equal(calls, 0);
  assert.equal(notice.causeText(), '语义识别已关闭');
});

test('下载中用户显式取消：停止下载、写回 off、给出提示', async () => {
  reset();
  const ui = makeUi();
  const resolver = hanging();
  const notice = createIntentNotice({ ui });
  const pending = notice.wrap(resolver).resolve({ input: '看雕像' });
  await tick();
  ui.cancel();
  assert.deepEqual(await pending, { kind: 'none' });
  assert.equal(settings.get('semantic'), 'off');
  assert.deepEqual(resolver.disposed, [undefined], '取消要真的停掉下载');
  assert.ok(ui.said.some(t => t.includes('已停止下载')));
});

test('模型就绪后的取消只放弃当次请求：不改设置、不丢模型', async () => {
  reset();
  const ui = makeUi();
  const resolver = makeResolver((request, resolve) => resolve({ kind: 'suggest', candidateIds: ['event:x'] }));
  const notice = createIntentNotice({ ui });
  const wrapped = notice.wrap(resolver);
  await wrapped.resolve({ input: '看雕像' });           // 先让模型就绪
  resolver.resolve = makeResolver(() => {}).resolve;   // 之后挂起
  const pending = wrapped.resolve({ input: '看硬币' });
  await tick();
  ui.cancel();
  assert.deepEqual(await pending, { kind: 'none' });
  assert.equal(settings.get('semantic'), 'on');
  assert.deepEqual(resolver.disposed, []);
});

test('引擎超时（abort reason=timeout）：不改设置、不销毁 Worker，交给引擎文案', async () => {
  reset();
  const ui = makeUi();
  const resolver = hanging();
  const notice = createIntentNotice({ ui });
  const controller = new AbortController();
  const pending = notice.wrap(resolver).resolve({ input: '看雕像' }, { signal: controller.signal });
  await tick();
  controller.abort('timeout');
  assert.deepEqual(await pending, { kind: 'none' });
  assert.equal(settings.get('semantic'), 'on');
  assert.deepEqual(resolver.disposed, []);
  assert.equal(notice.causeText(), null);
});

test('「更多」菜单：开启态是状态菜单，关闭态是征求；说明当前实现的限制', async () => {
  reset();
  const ui = makeUi(null);
  const notice = createIntentNotice({ ui });
  notice.wrap(noMatch());
  await notice.openMenu();
  assert.equal(ui.dialogs[0].title, '语义识别');
  assert.ok(ui.dialogs[0].actions.some(a => a.value === 'disable'));
  assert.match(ui.dialogs[0].body, /当前场景已实现的动作/);

  reset('off');
  await notice.openMenu();
  assert.equal(ui.dialogs[1].title, '启用语义识别？');
  assert.ok(ui.dialogs[1].actions.some(a => a.value === 'enable'));
});

test('从「更多」启用后自动重跑上一条未判定的输入', async () => {
  reset('off');
  const ui = makeUi('enable');
  const ran = [];
  const notice = createIntentNotice({ ui, processInput: input => ran.push(input) });
  await notice.wrap(noMatch()).resolve({ input: '问妇人' });
  await notice.openMenu();
  assert.equal(settings.get('semantic'), 'on');
  assert.deepEqual(ran, ['问妇人']);
});

test('引擎：失败提示后调用语义入口（离线时不改回合）', async () => {
  reset();
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const game = createGame({ intentResolver: notice.wrap(noMatch()) });
  let hints = 0;
  game.eng.ui.semanticHint = () => { hints++; };
  await game.eng.processInput('凑近瞧瞧那位女王像');
  assert.equal(hints, 1);
  assert.match(game.output.map(x => x.text).join('\n'), /暂时无法确定你的意思/);
  assert.equal(game.state.turns, 0);
});

test('引擎：语义不可用时也调用入口', async () => {
  reset();
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const game = createGame({ intentResolver: notice.wrap(failing('download')) });
  let hints = 0;
  game.eng.ui.semanticHint = () => { hints++; };
  await game.eng.processInput('凑近瞧瞧那位女王像');
  assert.equal(hints, 1);
  assert.match(game.output.map(x => x.text).join('\n'), /语义识别暂时不可用/);
  assert.equal(notice.causeText(), '模型下载失败（网络或离线）');
});

test('dispose 透传给底层 resolver', () => {
  reset();
  const resolver = noMatch();
  const notice = createIntentNotice({ ui: makeUi() });
  notice.wrap(resolver).dispose('worker');
  assert.deepEqual(resolver.disposed, ['worker']);
});
