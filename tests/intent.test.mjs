import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './harness.mjs';
import { buildIntentCandidates, needsClarification } from '../prototype/js/intent.js';
import { LocalIntentResolver } from '../prototype/js/intent-model.js';
import { rankIntentScores, INTENT_MIN_SCORE } from '../prototype/js/intent-ranking.js';

const action = id => ({ kind:'suggest', candidateIds:[id] });
function setup(resolve, choose = choices => choices[0].id) {
  let saves = 0;
  const game = createGame({ intentResolver: { resolve }, onAutosave: () => saves++ });
  game.eng.moveTo('round_pond');
  game.eng.ui.chooseIntent = choose;
  return { ...game, get saves() { return saves; } };
}

test('纸鸟自然表达经确认走原版动作，物品、分数、回合和存档只结算一次', async () => {
  let calls = 0;
  const g = setup(async request => {
    calls++;
    assert.ok(request.candidates.some(c => c.id === 'event:take_paper_bird'));
    assert.equal(g.state.turns, 0, '推理期间导出不能多一回合');
    return action('event:take_paper_bird');
  }, choices => {
    assert.equal(g.state.turns, 0);
    assert.equal(g.state.has('paper_bird'), false);
    return choices[0].id;
  });
  await g.eng.processInput('把水面上那只折出来的小鸟捞起来');
  assert.equal(calls, 1);
  assert.equal(g.state.has('paper_bird'), true);
  assert.equal(g.state.score, 3);
  assert.equal(g.state.turns, 1);
  assert.equal(g.saves, 1);
});

test('认识查看动词但不认识目标时，不被通用examine吞掉', async () => {
  let calls = 0;
  const g = setup(async () => { calls++; return action('item:examine:paper_bird'); });
  await g.eng.processInput('看看那只漂着的折纸小动物');
  assert.equal(calls, 1);
  assert.equal(g.state.turns, 1);
  assert.equal(g.state.has('paper_bird'), false);
});

test('标准命令保持即时解析，不触发模型或确认', async () => {
  const g = setup(() => assert.fail('标准命令不能访问模型'), () => assert.fail('不能确认'));
  await g.eng.processInput('take paper bird');
  assert.equal(g.state.has('paper_bird'), true);
});

test('候选继承事件先后次序和when，不提供凭空砸伞或隐藏纸鸟打开动作', () => {
  const g = setup(async () => ({kind:'none'}));
  assert.equal(buildIntentCandidates(g.eng).some(c => c.id === 'event:open_paper_bird'), false);
  g.eng.moveTo('lancaster_gate');
  const ids = buildIntentCandidates(g.eng).map(c => c.id);
  assert.ok(ids.includes('event:help_umbrella_woman'));
  assert.equal(ids.includes('event:take_umbrella_tree'), false, '先被老妇人手中雨伞分支拦截');
  assert.equal(ids.includes('event:throw_ball_tree'), false, '没有足球');
  g.state.setFlag('umbrella_woman_done');
  assert.ok(buildIntentCandidates(g.eng).some(c => c.id === 'event:take_umbrella_tree'));
});

test('取消、拒识、畸形结果、假ID、异常和否定均不更改状态或保存', async () => {
  for (const result of [{kind:'none'}, null, action('fake'), {...action('event:take_paper_bird'), state:{score:100}}, {kind:'suggest',candidateIds:['event:take_paper_bird','fake']}]) {
    const g = setup(async () => result);
    const before=g.eng.serialize().state;
    await g.eng.processInput('替我把小纸鸟捞上来');
    assert.deepEqual(g.eng.serialize().state,before);
    assert.equal(g.saves,0);
  }
  const cancelled = setup(async () => action('event:take_paper_bird'), () => null);
  await cancelled.eng.processInput('捞那只小鸟');
  assert.equal(cancelled.state.turns,0);
  const failed = setup(async () => { throw new Error('network'); });
  await failed.eng.processInput('捞那只小鸟');
  assert.equal(failed.state.turns,0);
  assert.equal(failed.eng._inputBusy,false);
  const negated = setup(() => assert.fail('不能调用模型'));
  for (const input of ['不要拿纸鸟','拿了纸鸟会怎样？','拿纸鸟还是看看树','do not take the bird']) {
    assert.ok(needsClarification(input));
    await negated.eng.processInput(input);
  }
  assert.equal(negated.state.turns,0);
});

test('模型超时和UI取消均释放输入、不运行计时器', async () => {
  const g=setup(() => new Promise(() => {}));
  g.eng.intentTimeoutMs=5;
  let ticks=0;
  g.state.startTimer(2,'regression',()=>ticks++);
  await g.eng.processInput('捞那只小鸟');
  assert.equal(g.state.turns,0);
  assert.equal(ticks,0);
  assert.equal(g.eng._inputBusy,false);
  assert.match(g.output.at(-1).text, /超时/);
  assert.doesNotMatch(g.output.at(-1).text, /无法确定/);
  g.eng.intentTimeoutMs=1000;
  g.eng.ui.intentProgress=cancel=>{queueMicrotask(cancel);return {close(){}}};
  await g.eng.processInput('捞那只小鸟');
  assert.equal(g.eng._inputBusy,false);
  assert.equal(g.state.turns,0);
});

test('等待模型时读入另一存档，旧响应不执行；确认时也重验状态', async () => {
  for (const during of ['resolve','choose']) {
    let g;
    const change=async()=>{
      const saved=g.eng.serialize(); saved.state.room='palace_gate';
      await g.eng.deserialize(saved);
    };
    g=setup(async()=>{if(during==='resolve')await change();return action('event:take_paper_bird')},async choices=>{await change();return choices[0].id});
    await g.eng.processInput('捞那只小鸟');
    assert.equal(g.eng.state.room,'palace_gate');
    assert.equal(g.eng.state.has('paper_bird'),false);
    assert.equal(g.eng.state.turns,0);
  }
});

test('并发输入不会重复执行或抢先结算', async () => {
  let release;
  const g=setup(()=>new Promise(resolve=>{release=resolve}));
  const first=g.eng.processInput('捞那只小鸟');
  await g.eng.processInput('wait');
  assert.equal(g.state.turns,0);
  release(action('event:take_paper_bird'));
  await first;
  assert.equal(g.state.turns,1);
  assert.equal(g.saves,1);
});

test('近分数给多候选、低分拒绝，不把cosine作为执行授权', () => {
  assert.deepEqual(rankIntentScores([{id:'a',score:0.2}]),{kind:'none'});
  assert.deepEqual(rankIntentScores([{id:'a',score:0.8},{id:'b',score:0.78},{id:'c',score:0.3}]),{kind:'suggest',candidateIds:['a','b']});
});

test('Worker懒创建，取消拒绝未决请求，重试创建新Worker', async () => {
  let created=0;
  const workers=[];
  const resolver=new LocalIntentResolver({workerFactory:()=>{
    created++;
    const w={postMessage(message){this.message=message},terminate(){this.terminated=true}};
    workers.push(w);return w;
  }});
  assert.equal(created,0);
  const controller=new AbortController();
  const pending=resolver.resolve({input:'x',candidates:[]},{signal:controller.signal});
  controller.abort();
  await assert.rejects(pending);
  assert.equal(workers[0].terminated,true);
  const retry=resolver.resolve({input:'x',candidates:[]});
  workers[1].onmessage({data:{id:workers[1].message.id,type:'result',result:{kind:'none'}}});
  assert.deepEqual(await retry,{kind:'none'});
  assert.equal(created,2);
  resolver.dispose();
});

test('已知但拿不到的日晷指针沿用失败事件，不进入模型', async () => {
  const g=setup(() => assert.fail('失败动作不能被模型替换'));
  g.eng.moveTo('the_wabe');
  await g.eng.processInput('take gnomon');
  assert.equal(g.state.has('gnomon'),false);
  assert.equal(g.state.turns,1);
});

test('帮她撑伞由候选确认进入原版帮助剧情，不持有伞、不重复推进', async () => {
  const g=setup(async request => {
    assert.ok(request.candidates.some(c => c.id==='event:help_umbrella_woman'));
    return action('event:help_umbrella_woman');
  });
  g.eng.moveTo('lancaster_gate');
  await g.eng.processInput('帮她撑伞');
  assert.equal(g.state.hasFlag('umbrella_woman_done'),true);
  assert.equal(g.state.has('umbrella'),false);
  assert.equal(g.state.turns,1);
  assert.equal(g.saves,1);
  assert.match(g.output.map(x=>x.text).join('\n'),/You begin to approach the old woman/);
});

// 来自首次真实英文模型评测：乱码最高余弦为 0.594，不能展示执行候选。
test('英文拒识门槛覆盖真实模型乱码回归', () => {
  assert.deepEqual(rankIntentScores([{id:'item:take:coin',score:0.594195}], {minScore:INTENT_MIN_SCORE.en}), {kind:'none'});
});

test('慢加载超时只取消本次请求，重试复用Worker，过期结果不串到新输入', async () => {
  const workers = [];
  const resolver = new LocalIntentResolver({workerFactory: () => {
    const w = {messages: [], postMessage(message) { this.messages.push(message); }, terminate() { this.terminated = true; }};
    workers.push(w); return w;
  }});
  const controller = new AbortController();
  const first = resolver.resolve({input: '第一次', candidates: []}, {signal: controller.signal});
  controller.abort('timeout');
  await assert.rejects(first, /timed out/);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].terminated, undefined);
  assert.equal(resolver.pending.size, 0);
  const second = resolver.resolve({input: '第二次', candidates: []});
  const worker = workers[0];
  worker.onmessage({data: {id: worker.messages[0].id, type: 'result', result: action('old')}});
  assert.equal(resolver.pending.size, 1, '过期结果不得完成新请求');
  worker.onmessage({data: {id: worker.messages[1].id, type: 'result', result: action('new')}});
  assert.deepEqual(await second, action('new'));
  assert.equal(workers.length, 1);
  resolver.dispose();
});

test('正常结果后的控制器清理不销毁已加载Worker', async () => {
  let worker, count = 0;
  const resolver = new LocalIntentResolver({workerFactory: () => {
    count++; return worker = {postMessage(message) { this.message = message; }, terminate() { assert.fail('不应销毁'); }};
  }});
  for (let i = 0; i < 2; i++) {
    const controller = new AbortController();
    const result = resolver.resolve({input: '表达', candidates: []}, {signal: controller.signal});
    worker.onmessage({data: {id: worker.message.id, type: 'result', result: {kind: 'none'}}});
    await result;
    controller.abort();
  }
  assert.equal(count, 1);
});

test('失败带阶段与原始信息，供上层区分网络/初始化/推理失败', async () => {
  const workers = [];
  const failures = [];
  const resolver = new LocalIntentResolver({
    onFailure: failure => failures.push(failure),
    workerFactory: () => {
      const w = {messages: [], postMessage(message) { this.messages.push(message); }, terminate() { this.terminated = true; }};
      workers.push(w); return w;
    },
  });
  const pending = resolver.resolve({input: '表达', candidates: []});
  const worker = workers[0];
  worker.onmessage({data: {id: worker.messages[0].id, type: 'error', stage: 'download', message: 'Failed to fetch'}});
  await assert.rejects(pending, (error) => {
    assert.equal(error.stage, 'download');
    assert.equal(error.message, 'Failed to fetch');
    return true;
  });
  assert.deepEqual(failures, [{stage: 'download', message: 'Failed to fetch'}], '诊断通道要拿到阶段与原始信息');
  resolver.dispose();
});

test('Worker 自身起不来时归为识别组件失败，不退化成无阶段错误', async () => {
  const workers = [];
  const failures = [];
  const resolver = new LocalIntentResolver({
    onFailure: failure => failures.push(failure),
    workerFactory: () => {
      const w = {messages: [], postMessage(message) { this.messages.push(message); }, terminate() { this.terminated = true; }};
      workers.push(w); return w;
    },
  });
  const pending = resolver.resolve({input: '表达', candidates: []});
  workers[0].onerror({message: 'boom'});
  await assert.rejects(pending, (error) => {
    assert.equal(error.stage, 'worker');
    return true;
  });
  assert.equal(failures[0].stage, 'worker');
  assert.equal(workers[0].terminated, true);
});

test('用户取消不是失败：诊断通道不得把它当错误上报', async () => {
  const failures = [];
  const workers = [];
  const resolver = new LocalIntentResolver({
    onFailure: failure => failures.push(failure),
    workerFactory: () => {
      const w = {messages: [], postMessage(message) { this.messages.push(message); }, terminate() { this.terminated = true; }};
      workers.push(w); return w;
    },
  });
  const controller = new AbortController();
  const pending = resolver.resolve({input: '表达', candidates: []}, {signal: controller.signal});
  controller.abort();
  await assert.rejects(pending);
  assert.deepEqual(failures, []);
});

test('库内部非致命错误走调试通道，不完成也不拒绝待决请求', async () => {
  const debug = [];
  const workers = [];
  const resolver = new LocalIntentResolver({
    onDebug: message => debug.push(message),
    workerFactory: () => {
      const w = {messages: [], postMessage(message) { this.messages.push(message); }, terminate() { this.terminated = true; }};
      workers.push(w); return w;
    },
  });
  const pending = resolver.resolve({input: '表达', candidates: []});
  const worker = workers[0];
  worker.onmessage({data: {type: 'debug', message: '未处理的 Promise 拒绝：Failed to fetch'}});
  assert.deepEqual(debug, ['未处理的 Promise 拒绝：Failed to fetch']);
  assert.equal(resolver.pending.size, 1, '调试消息不得动到待决请求');
  worker.onmessage({data: {id: worker.messages[0].id, type: 'result', result: {kind: 'none'}}});
  assert.deepEqual(await pending, {kind: 'none'});
  resolver.dispose();
});

test('买缺宾语时列购买候选，确认前不消耗回合，确认后执行原事件', async () => {
  const g = createGame({intentResolver: {resolve() { assert.fail('缺宾语不必下载模型'); }}});
  g.eng.moveTo('broad_walk');
  const before = g.eng.serialize().state;
  g.eng.ui.chooseIntent = choices => {
    assert.deepEqual(choices.map(c => c.id), ['event:buy_bag']);
    assert.deepEqual(g.eng.serialize().state, before);
    return choices[0].id;
  };
  await g.eng.processInput('买');
  assert.ok(g.state.has('bag'));
  assert.equal(g.state.turns, 1);
  assert.equal(g.state.score, 1);
  assert.match(g.output.map(x => x.text).join('\n'), /Bless yer/);
  await g.eng.processInput('喂鸟');
  assert.ok(g.state.hasFlag('birds_fed'));
  assert.equal(g.state.turns, 2);
});

test('喂鸟缺少鸟食反馈条件不满足；取消购买不推进', async () => {
  const g = createGame({intentResolver: {resolve() { assert.fail('已识别动作不应改猜其他动作'); }}});
  g.eng.moveTo('broad_walk');
  const before = g.eng.serialize().state;
  await g.eng.processInput('喂鸟');
  assert.match(g.output.at(-1).text, /条件还不满足/);
  assert.deepEqual(g.eng.serialize().state, before);
  g.eng.ui.chooseIntent = () => null;
  await g.eng.processInput('买');
  assert.deepEqual(g.eng.serialize().state, before);
});


test('原本无需宾语的明确事件保持直接执行，不被补全层拦截', async () => {
  const g = setup(() => assert.fail('明确事件不调用模型'), () => assert.fail('明确事件不要求确认'));
  g.eng.rooms = {...g.eng.rooms, round_pond: {...g.eng.currentRoom(), events: [{
    id: 'bare_verb_fixture', match: {verb: ['wave']}, triggers: ['wave'],
    act(s) { s.setFlag('bare_verb_executed'); },
  }]}};
  await g.eng.processInput('wave');
  assert.ok(g.state.hasFlag('bare_verb_executed'));
  assert.equal(g.state.turns, 1);
});
