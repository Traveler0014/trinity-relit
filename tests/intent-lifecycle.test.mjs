import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './harness.mjs';
import { LocalIntentResolver } from '../prototype/js/intent-model.js';
import { createIntentNotice } from '../prototype/js/intent-notice.js';
import { settings } from '../prototype/js/settings.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  settings.set('semantic', 'on');
  const workers = [];
  const resolver = new LocalIntentResolver({ workerFactory: () => {
    const worker = { messages: [], terminated: false,
      postMessage(message) { this.messages.push(message); },
      terminate() { this.terminated = true; },
      emit(data) { this.onmessage({ data }); },
    };
    workers.push(worker);
    return worker;
  } });
  const ui = { cancel: null, messages: [], system(text) { this.messages.push(text); },
    semanticProgress(cancel) { this.cancel = cancel; return {}; },
  };
  const notice = createIntentNotice({ ui });
  return { ui, workers, resolver, notice, wrapped: notice.wrap(resolver) };
}

test('真实 resolver：首次推理前已就绪，取消并再次输入复用同一线程', async () => {
  const g = setup();
  const pending = g.wrapped.resolve({ input: '帮她撑伞', candidates: [] });
  const worker = g.workers[0];
  worker.emit({ type: 'ready', language: 'zh' });
  g.ui.cancel();
  await pending;
  assert.equal(worker.terminated, false);
  assert.equal(settings.get('semantic'), 'on');
  assert.equal(g.resolver.pending.size, 0);
  const next = g.wrapped.resolve({ input: '瞧瞧那位女王像', candidates: [] });
  const id = worker.messages.at(-1).id;
  worker.emit({ id: id - 1, type: 'result', result: { kind: 'suggest', candidateIds: ['stale'] } });
  assert.equal(g.resolver.pending.size, 1, '取消请求的旧结果不得串入下一请求');
  worker.emit({ id, type: 'result', result: { kind: 'none' } });
  assert.deepEqual(await next, { kind: 'none' });
  assert.equal(g.workers.length, 1);
  g.resolver.dispose();
  assert.equal(g.resolver.readyLanguages.size, 0);
});

test('真实 resolver：下载中取消关闭功能；超时后就绪通知仍可接收', async () => {
  const cold = setup();
  const pending = cold.wrapped.resolve({ input: '帮她撑伞', candidates: [] });
  cold.ui.cancel();
  await pending;
  assert.equal(cold.workers[0].terminated, true);
  assert.equal(settings.get('semantic'), 'off');
  const warm = setup();
  const controller = new AbortController();
  const timed = warm.wrapped.resolve({ input: '帮她撑伞', candidates: [] }, { signal: controller.signal });
  controller.abort('timeout');
  await timed;
  const worker = warm.workers[0];
  worker.emit({ type: 'ready', language: 'zh' });
  assert.equal(warm.resolver.readyLanguages.has('zh'), true);
  const retry = warm.wrapped.resolve({ input: '帮她撑伞', candidates: [] });
  warm.ui.cancel();
  await retry;
  assert.equal(worker.terminated, false);
  assert.equal(settings.get('semantic'), 'on');
  warm.resolver.dispose();
});

test('过期同意窗口不能在换房间后重放 help woman 或推进回合', async () => {
  settings.set('semantic', 'ask');
  let consent, game, calls = 0, reruns = 0;
  const notice = createIntentNotice({
    ui: { semanticDialog: () => new Promise(resolve => { consent = resolve; }) },
    processInput: input => { reruns++; return game.eng.processInput(input); },
  });
  game = createGame({ intentResolver: notice.wrap({
    resolve: async () => { calls++; return { kind: 'none' }; }, dispose() {},
  }), intentTimeoutMs: 5 });
  await game.eng.processInput('help woman');
  game.eng.moveTo('lancaster_gate');
  const before = game.eng.serialize().state;
  consent('enable');
  await tick();
  assert.deepEqual(game.eng.serialize().state, before);
  assert.equal(reruns, 0);
  assert.equal(calls, 0);
  assert.equal(settings.get('semantic'), 'ask');
});

test('同意等待期间读档：相同房间的新状态对象也不得开启下载', async () => {
  settings.set('semantic', 'ask');
  let consent, calls = 0;
  const notice = createIntentNotice({ ui: { semanticDialog: () => new Promise(r => { consent = r; }) } });
  const game = createGame({ intentResolver: notice.wrap({
    resolve: async () => { calls++; return { kind: 'none' }; }, dispose() {},
  }) });
  const pending = game.eng.processInput('help woman');
  await game.eng.deserialize(game.eng.serialize());
  consent('enable');
  await pending;
  assert.equal(calls, 0);
  assert.equal(settings.get('semantic'), 'ask');
  assert.equal(game.state.turns, 0);
});

test('菜单重试或重新启用都不得重放旧场景输入', async () => {
  for (const mode of ['on', 'off']) {
    settings.set('semantic', mode);
    let game, reruns = 0;
    const said = [];
    const notice = createIntentNotice({
      ui: { semanticDialog: async () => mode === 'on' ? 'retry' : 'enable', system: text => said.push(text) },
      processInput: input => { reruns++; return game.eng.processInput(input); },
    });
    game = createGame({ intentResolver: notice.wrap({
      resolve: async () => { throw Object.assign(new Error('offline'), { stage: 'download' }); }, dispose() {},
    }) });
    await game.eng.processInput('help woman');
    game.eng.moveTo('lancaster_gate');
    const before = game.eng.serialize().state;
    await notice.openMenu();
    assert.deepEqual(game.eng.serialize().state, before);
    assert.equal(reruns, 0);
    assert.match(said.join(''), /状态已经改变/);
  }
});
