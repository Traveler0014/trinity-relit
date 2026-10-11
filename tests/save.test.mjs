import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, command, go } from './harness.mjs';

const jsonSave = eng => JSON.parse(JSON.stringify(eng.serialize()));

test('存档 JSON 往返保留进度、物品、Set，恢复后可继续', async () => {
  const original = createGame();
  await go(original, 'flower_walk');
  await command(original, 'take ball');
  const save = jsonSave(original.eng);
  const restored = createGame();
  await restored.eng.deserialize(save);
  assert.deepEqual(restored.eng.serialize().state, save.state);
  assert.ok(restored.state.flags instanceof Set);
  assert.ok(restored.state.visited instanceof Set);
  assert.ok(restored.state.has('ball'));
  await command(restored, 'wait');
  assert.equal(restored.state.turns, save.state.turns + 1);
});

test('Pacific 懒加载存档恢复真实计时器回调，到期仍触发副作用', async () => {
  const original = createGame();
  // 测试夹具直接进入章节；不把这条路径计作玩家通关。
  await original.eng.transitionChapter({ to: 'pacific', roomCandidates: ['mesa'] });
  await go(original, 'bottom_scaffold');
  await command(original, 'open box');
  await command(original, 'push switch');
  const save = jsonSave(original.eng);
  const restored = createGame();
  assert.equal(restored.eng.rooms.mesa, undefined);
  await restored.eng.deserialize(save);
  assert.equal(typeof restored.state.timer.perTurn, 'function');
  assert.deepEqual(restored.eng.serialize().state, save.state);
  for (let i = 0; i < save.state.timer.remaining; i++) await command(restored, 'wait');
  assert.ok(restored.state.hasFlag('pacific_timer_expired'));
});

test('坏存档被拒绝且当前进度保持不变', async () => {
  const game = createGame();
  const before = jsonSave(game.eng);
  for (const save of [null, { ...before, version: -1 },
    { ...before, state: { ...before.state, room: '' } },
    { ...before, state: { ...before.state, room: '__missing__' } },
    { ...before, state: { ...before.state, chapter: '__missing__' } }]) {
    await assert.rejects(game.eng.deserialize(save));
    assert.deepEqual(game.eng.serialize().state, before.state);
  }
});

test('每回合自动存档；死亡不覆盖最后活着的进度', async () => {
  const saves = [];
  const game = createGame({ onAutosave: save => saves.push(save) });
  await command(game, 'wait');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].state.turns, game.state.turns);
  game.state.dead = true;
  await game.eng.processInput('wait');
  assert.equal(saves.length, 1);
});

test('坏字段和未知计时器拒绝恢复，不覆盖活进度或自动存档', async () => {
  let writes = 0;
  const game = createGame({onAutosave: () => writes++});
  await command(game, 'wait');
  const before = jsonSave(game.eng);
  const priorWrites = writes;
  for (const patch of [
    {flags: 'bad'}, {flags: [{}]}, {visited: [12]}, {itemLoc: []},
    {itemLoc: {ball: 42}}, {counters: {turns: '1'}}, {counters: {x: Infinity}},
    {turns: -1}, {turns: 1.5}, {score: NaN}, {maxScore: 0}, {flipped: 'false'},
    {dead: 'false'}, {sundialSymbol: 8}, {chapter: 12},
    {timer: {id: 'doomsday', remaining: '10'}},
    {timer: {id: '__unknown__', remaining: 10}}, {timer: {}},
    {room: 'constructor'},
  ]) {
    await assert.rejects(game.eng.deserialize({...before, state: {...before.state, ...patch}}));
    assert.deepEqual(game.eng.serialize().state, before.state, JSON.stringify(patch));
    assert.equal(writes, priorWrites);
  }
});

test('旧存档缺少可选字段时仍能恢复默认值并继续', async () => {
  const game = createGame();
  await game.eng.deserialize({version: 1, state: {room: 'flower_walk', chapter: 'prologue'}});
  assert.equal(game.state.turns, 0);
  assert.equal(game.state.sundialSymbol, 2);
  assert.equal(game.state.itemAt('ball'), 'flower_walk');
  assert.ok(game.state.visited.has('flower_walk'));
  await command(game, 'take the ball');
  assert.ok(game.state.has('ball'));
});

test('章节没有有效落点时不改变当前章节、标志或房间', async () => {
  const game = createGame();
  const before = jsonSave(game.eng).state;
  assert.equal(await game.eng.transitionChapter({to: 'ranch', roomCandidates: ['__missing__']}), false);
  assert.deepEqual(game.eng.serialize().state, before);
  assert.equal(await game.eng.transitionChapter({to: 'ranch', roomCandidates: ['nw_ranch']}), true);
  assert.equal(game.state.chapter, 'ranch');
  assert.ok(game.state.hasFlag('chapter_ranch_entered'));
});

test('导入预检不会提前替换当前状态', async () => {
  const game = createGame();
  const other = createGame();
  await go(other, 'flower_walk');
  await command(other, 'take ball');
  const before = jsonSave(game.eng).state;
  assert.equal(await game.eng.validateSave(jsonSave(other.eng)), true);
  assert.deepEqual(game.eng.serialize().state, before);
  const bad = jsonSave(other.eng);
  bad.state.timer.id = '__unknown__';
  await assert.rejects(game.eng.validateSave(bad));
  assert.deepEqual(game.eng.serialize().state, before);
});
