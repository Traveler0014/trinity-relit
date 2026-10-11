import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './harness.mjs';

test('未知输入不改变状态、不触发老妇人剧情、计时器或自动存档', async () => {
  let saves = 0;
  const { eng, state, output } = createGame({ onAutosave: () => saves++ });
  eng.moveTo('lancaster_gate');
  state.setCnt('umbrella_woman_turns', 1);
  let ticks = 0;
  state.startTimer(3, 'regression', () => ticks++);
  const before = eng.serialize();
  const beforeSaves = saves;
  for (const input of ['帮她撑伞', 'xyzzyblah', 'open nonexistent', 'take nonexistent', '   ']) {
    const start = output.length;
    await eng.processInput(input);
    assert.deepEqual(eng.serialize().state, before.state, input);
    assert.equal(saves, beforeSaves);
    assert.equal(ticks, 0);
    assert.doesNotMatch(output.slice(start).map(x => x.text).join('\n'), /Her face is wrong|strong gust/);
  }
  await eng.processInput('wait');
  assert.equal(state.turns, before.state.turns + 1);
  assert.equal(state.cnt('umbrella_woman_turns'), 2);
  assert.equal(state.hasFlag('umbrella_woman_done'), true);
  assert.equal(state.timer.remaining, 2);
  assert.equal(ticks, 1);
  assert.equal(saves, beforeSaves + 1);
});
