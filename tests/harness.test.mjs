import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "./harness.mjs";

test("开局仅预加载序章，其他章节保留真实动态 import", () => {
  const { eng } = createGame();
  assert.deepEqual([...eng.loadedChapters], ["prologue"]);
  assert.ok(eng.rooms.palace_gate);
  assert.equal(eng.rooms.meadow, undefined);
});

test("所有出口方向都能被 parser 识别", () => {
  const { eng } = createGame();
  for (const dir of ["n", "ne", "e", "se", "s", "sw", "w", "nw", "u", "d", "in", "out"]) {
    assert.deepEqual(eng.parser.parse(dir), { type: "direction", dir });
  }
});

 test("进入和出去的中英文方向别名", () => {
  const { eng } = createGame();
  for (const input of ["in", "inside", "里", "里面", "进入", "向里走"]) {
    assert.deepEqual(eng.parser.parse(input), { type: "direction", dir: "in" });
  }
  for (const input of ["out", "outside", "外", "外面", "出去", "向外走"]) {
    assert.deepEqual(eng.parser.parse(input), { type: "direction", dir: "out" });
  }
});
