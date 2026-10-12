import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, stubUi } from './harness.mjs';
import { createIntentNotice } from '../prototype/js/intent-notice.js';

function makeUi(dialogResult = null) {
  const ui = {
    said: [],
    dialogs: [],
    dialogResult,
    system: text => ui.said.push(text),
    semanticDialog: (dialog) => { ui.dialogs.push(dialog); return Promise.resolve(ui.dialogResult); },
  };
  return ui;
}

function makeResolver(behaviour) {
  return {
    disposed: [],
    resolve(request, options) { return behaviour(request, options); },
    dispose(reason) { this.disposed.push(reason); },
  };
}

test('命中候选后不留下归因，也不再提示重试', async () => {
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const wrapped = notice.wrap(makeResolver(async () => ({ kind: 'suggest', candidateIds: ['event:x'] })));
  assert.deepEqual(await wrapped.resolve({ input: '看雕像' }), { kind: 'suggest', candidateIds: ['event:x'] });
  assert.equal(notice.causeText(), null);
  await notice.openMenu();
  assert.equal(ui.dialogs[0].actions.some(a => a.value === 'retry'), false);
});

test('模型判定为不接近：给出归因，但不提供重试（重跑同一句没有意义）', async () => {
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const wrapped = notice.wrap(makeResolver(async () => ({ kind: 'none' })));
  assert.deepEqual(await wrapped.resolve({ input: '问妇人' }), { kind: 'none' });
  assert.equal(notice.causeText(), '没有足够接近的动作可选');
  await notice.openMenu();
  assert.equal(ui.dialogs[0].actions.some(a => a.value === 'retry'), false);
});

test('下载失败：按阶段给归因，重试会重跑刚才那句', async () => {
  for (const [stage, cause] of [
    ['download', '模型下载失败（网络或离线）'],
    ['runtime', '识别组件加载失败（网络或离线）'],
    ['worker', '识别组件加载失败（网络或离线）'],
    ['initializing', '模型初始化失败（设备可能不支持）'],
    ['infer', '识别推理出错'],
  ]) {
    const ui = makeUi('retry');
    const ran = [];
    const notice = createIntentNotice({ ui, processInput: input => ran.push(input) });
    const wrapped = notice.wrap(makeResolver(async () => {
      throw Object.assign(new Error('boom'), { name: 'IntentModelError', stage });
    }));
    await assert.rejects(wrapped.resolve({ input: '看雕像' }));
    assert.equal(notice.causeText(), cause, `${stage} 阶段要有对应归因`);
    await notice.openMenu();
    assert.equal(ui.dialogs[0].actions.some(a => a.value === 'retry'), true);
    assert.deepEqual(ran, ['看雕像']);
  }
});

test('超时与用户取消不重复播报：留给引擎自己的文案', async () => {
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const wrapped = notice.wrap(makeResolver(async () => {
    throw new Error('Recognition timed out; model preparation continues');
  }));
  await assert.rejects(wrapped.resolve({ input: '看雕像' }));
  assert.equal(notice.causeText(), null);
});

test('「更多」菜单说明原版动词表的限制，并可从 x 关闭', async () => {
  const ui = makeUi(null);
  const notice = createIntentNotice({ ui });
  notice.wrap(makeResolver(async () => ({ kind: 'none' })));
  await notice.openMenu();
  const dialog = ui.dialogs[0];
  assert.match(dialog.body, /原版 Trinity 的动词表/);
  assert.match(dialog.body, /问.*搭话/);
  assert.equal(dialog.actions.at(-1).done, '已关闭');
});

test('引擎：失败提示后调用语义入口（离线时不改回合）', async () => {
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const wrapped = notice.wrap(makeResolver(async () => ({ kind: 'none' })));
  const game = createGame({ intentResolver: wrapped });
  let hints = 0;
  game.eng.ui.semanticHint = () => { hints++; };
  await game.eng.processInput('凑近瞧瞧那位女王像');
  assert.equal(hints, 1);
  assert.match(game.output.map(x => x.text).join('\n'), /暂时无法确定你的意思/);
  assert.equal(game.state.turns, 0);
});

test('引擎：语义不可用时也调用入口', async () => {
  const ui = makeUi();
  const notice = createIntentNotice({ ui });
  const wrapped = notice.wrap(makeResolver(async () => {
    throw Object.assign(new Error('Failed to fetch'), { stage: 'download' });
  }));
  const game = createGame({ intentResolver: wrapped });
  let hints = 0;
  game.eng.ui.semanticHint = () => { hints++; };
  await game.eng.processInput('凑近瞧瞧那位女王像');
  assert.equal(hints, 1);
  assert.match(game.output.map(x => x.text).join('\n'), /语义识别暂时不可用/);
  assert.equal(notice.causeText(), '模型下载失败（网络或离线）');
});

test('dispose 透传给底层 resolver', () => {
  const resolver = makeResolver(async () => ({ kind: 'none' }));
  const notice = createIntentNotice({ ui: makeUi() });
  notice.wrap(resolver).dispose('worker');
  assert.deepEqual(resolver.disposed, ['worker']);
});
