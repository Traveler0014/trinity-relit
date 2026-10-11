import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOMS } from '../prototype/js/data/ranch.js';
import { createGame, command, go } from './harness.mjs';

const LEGACY_IDS = [
  'nw_ranch', 'front_yard', 'hallway', 'assembly_room', 'closet', 'kitchen',
  'spare_room', 'nw_room', 'se_room', 'sw_yard', 'ne_yard', 'back_yard',
  'bathroom', 'bedroom', 'se_yard', 'icehouse', 'se_ranch', 'sw_ranch',
  'ne_ranch', 'under_windmill', 'south_reservoir', 'north_reservoir',
  'edge_reservoir', 'reservoir', 'underwater', 'windmill',
];

// 本章独立夹具跳过序章，必须同时还原已离开序章的状态。
function createRanchGame() {
  const game = createGame();
  game.state.setFlag('prologue_done');
  game.state.clearTimer();
  return game;
}

test('保留原有 26 个 ID，并沿玩家方向命令访问全部 27 间', async () => {
  assert.deepEqual(new Set(Object.keys(ROOMS)), new Set([...LEGACY_IDS, 'front_deck']));
  const game = createRanchGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  const visited = new Set();
  for (const id of [...LEGACY_IDS, 'front_deck']) {
    await go(game, id);
    const response = await command(game, 'look');
    assert.match(response, /[A-Za-z].*\n\n.*[\u3400-\u9fff]/s, `${id} 缺少中英双语房间描述`);
    visited.add(game.state.room);
  }
  assert.equal(visited.size, 27);
});

test('九条原版入口都能实际抵达 Front Deck', async () => {
  const game = createRanchGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  for (const [from, dir] of [
    ['front_yard', 'w'], ['front_yard', 'u'], ['front_yard', 'in'],
    ['assembly_room', 'e'], ['se_room', 'e'],
    ['ne_yard', 's'], ['ne_yard', 'u'], ['se_yard', 'n'], ['se_yard', 'u'],
  ]) {
    await go(game, from);
    await command(game, dir);
    assert.equal(game.state.room, 'front_deck', `${from}.${dir}`);
  }
});

test('Front Deck 的坡道、两侧院子和石墙方向符合原版', async () => {
  const game = createRanchGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  for (const [dir, target] of [
    ['n', 'ne_yard'], ['s', 'se_yard'], ['e', 'front_yard'], ['d', 'front_yard'],
  ]) {
    await go(game, 'front_deck');
    await command(game, dir);
    assert.equal(game.state.room, target, `front_deck.${dir}`);
  }
  await go(game, 'front_deck');
  assert.match(await command(game, 'ne'), /The stone wall blocks your path/);
  assert.match(await command(game, 'se'), /The stone wall blocks your path/);
  assert.equal(game.state.room, 'front_deck');
});

test('Front Deck 两扇门的初态、单开、双开、阻挡与存档恢复', async () => {
  const game = createRanchGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  await go(game, 'front_deck');
  assert.match(await command(game, 'look'), /Two closed doors, one at the deck's left corner and one at the right/);
  assert.match(await command(game, 'in'), /Both of the doors are closed/);
  assert.match(await command(game, 'sw'), /The left door is closed/);
  assert.match(await command(game, 'nw'), /The right door is closed/);
  assert.equal(game.state.room, 'front_deck');

  assert.match(await command(game, '打开左门'), /You open the left door/);
  assert.match(await command(game, 'look'), /Two doors, an open one at the deck's left corner and a closed one at the right/);
  await command(game, 'in');
  assert.equal(game.state.room, 'se_room');
  assert.match(await command(game, 'look'), /front door in the east wall is wide open/);
  await command(game, 'e');
  await command(game, 'close left door');
  await command(game, 'open right door');
  assert.match(await command(game, 'look'), /Two doors, a closed one at the deck's left corner and an open one at the right/);
  await command(game, 'w');
  assert.equal(game.state.room, 'assembly_room');
  assert.match(await command(game, 'look'), /An open front door leads east/);
  await command(game, 'e');
  await command(game, 'open left door');
  assert.match(await command(game, 'look'), /Two open doors, one at the deck's left corner and one at the right/);
  assert.match(await command(game, 'in'), /Which way do you want to go in, northwest or southwest/);
  const save = JSON.parse(JSON.stringify(game.eng.serialize()));
  const restored = createGame();
  await restored.eng.deserialize(save);
  assert.equal(restored.state.room, 'front_deck');
  assert.match(await command(restored, 'look'), /Two open doors/);
  await command(restored, 'sw');
  assert.equal(restored.state.room, 'se_room');
  await command(restored, 'e');
  await command(restored, 'nw');
  assert.equal(restored.state.room, 'assembly_room');
});

test('从两间室内房操作前门会同步平台左右门状态', async () => {
  const game = createRanchGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  await go(game, 'assembly_room');
  await command(game, 'open front door');
  assert.match(await command(game, 'look'), /An open front door leads east/);
  await command(game, 'e');
  assert.match(await command(game, 'look'), /a closed one at the deck's left corner and an open one at the right/);
  await command(game, 'e');
  await go(game, 'se_room');
  await command(game, '打开前门');
  assert.match(await command(game, 'look'), /front door in the east wall is wide open/);
  await command(game, 'e');
  assert.match(await command(game, 'look'), /Two open doors/);
  await command(game, 'nw');
  assert.equal(game.state.room, 'assembly_room');
  await command(game, 'close front door');
  await command(game, 'e');
  assert.match(await command(game, 'look'), /an open one at the deck's left corner and a closed one at the right/);
});

test('原版阻挡消息和壁橱门状态反映在玩家输出中', async () => {
  const game = createRanchGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  await go(game, 'underwater');
  assert.match(await command(game, 'n'), /You hit your head against the side of the reservoir/);
  await go(game, 'closet');
  assert.match(await command(game, 'look'), /single open door/);
  await command(game, 'close door');
  assert.match(await command(game, 'look'), /single closed door/);
  await go(game, 'assembly_room');
  assert.match(await command(game, 'look'), /there's a closed door in the north wall/);
  await go(game, 'se_yard');
  assert.match(await command(game, 'look'), /an open iron gate/);
});
