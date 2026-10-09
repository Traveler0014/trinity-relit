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

test('沿玩家方向命令访问并显示全部 26 个原有牧场房间', async () => {
  assert.deepEqual(new Set(Object.keys(ROOMS)), new Set(LEGACY_IDS));
  const game = createGame();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: ['nw_ranch'] });
  const visited = new Set();
  for (const id of LEGACY_IDS) {
    await go(game, id);
    const response = await command(game, 'look');
    assert.match(response, /[A-Za-z].*\n\n.*[\u3400-\u9fff]/s, `${id} 缺少中英双语房间描述`);
    visited.add(game.state.room);
  }
  assert.equal(visited.size, LEGACY_IDS.length);
});

test('原版阻挡消息和壁橱门状态反映在玩家输出中', async () => {
  const game = createGame();
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
