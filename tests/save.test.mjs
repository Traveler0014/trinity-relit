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
