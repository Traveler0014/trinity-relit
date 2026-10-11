import assert from 'node:assert/strict';
import test from 'node:test';
import { Parser } from '../prototype/js/parser.js';
import { createGame } from './harness.mjs';

test('英文冠词只在名词短语开头消除，复合指令两侧同样处理', () => {
  const parser = new Parser();
  for (const article of ['the', 'a', 'an']) {
    assert.equal(parser.parse(`take ${article} paper bird`).noun, 'paper bird');
  }
  assert.deepEqual(parser.parse('throw the ball at the umbrella'), {
    type: 'compound', verb: 'throw', noun: 'ball', prep: 'at', noun2: 'umbrella',
  });
  assert.equal(parser.parse('examine the sign of the times').noun, 'sign of the times');
});

test('含冠词的纸鸟和老妇人指令直接执行，离线也不需要模型确认', async () => {
  for (const [room, input, flag] of [
    ['round_pond', 'pick up the paper bird', 'paper_bird_taken'],
    ['lancaster_gate', 'help the old woman', 'umbrella_woman_done'],
  ]) {
    const game = createGame({intentResolver: {resolve() { assert.fail('明确命令不得调用模型'); }}});
    game.eng.moveTo(room);
    await game.eng.processInput(input);
    assert.equal(game.state.turns, 1);
    if (room === 'round_pond') assert.ok(game.state.has('paper_bird'));
    else assert.ok(game.state.hasFlag(flag));
  }
});
