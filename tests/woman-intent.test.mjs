import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from './harness.mjs';

for (const input of ['help woman','open umbrella','take umbrella','hold umbrella']) {
  test(`老妇人原版互动 ${input}，只播放一次且不凭空持有伞`, async () => {
    const {eng,state,output}=createGame();
    eng.moveTo('lancaster_gate');
    await eng.processInput(input);
    const response=output.map(x=>x.text).join('\n');
    assert.match(response,input==='help woman' ? /You begin to approach the old woman/ : /You approach the umbrella in the old woman's hands/);
    assert.equal(response.match(/Her face is wrong/g)?.length,1);
    assert.equal(response.match(/A strong gust of wind/g)?.length,1);
    assert.equal(state.has('umbrella'),false);
    assert.equal(state.itemAt('umbrella'),'lancaster_gate_tree');
    assert.equal(state.turns,1);
    const start=output.length;
    await eng.processInput('wait');
    assert.doesNotMatch(output.slice(start).map(x=>x.text).join('\n'),/Her face is wrong|A strong gust/);
  });
}
