import assert from "node:assert/strict";
import { GameEngine } from "../prototype/js/engine.js";
import { Parser } from "../prototype/js/parser.js";
import { ITEMS } from "../prototype/js/data/items.js";
import { CHAPTERS, PROLOGUE_TIMERS } from "./chapters.mjs";

export function stubUi(output) {
  return Object.fromEntries(["text", "system", "location", "userInput", "inventory"]
    .map((type) => [type, (...args) => output.push({ type, text: args.join(" / ") })]));
}

// 即使以后恢复语义兜底，测试也只能依靠 parser。
export const stubEmbedding = {
  async findMatch() { return { event: null, score: 0, trigger: null, topMatches: [] }; },
};

export function createGame(options = {}) {
  const output = [];
  const eng = new GameEngine({
    rooms: { ...CHAPTERS[0].rooms }, items: ITEMS, parser: new Parser(),
    preloadedChapters: ["prologue"],
    chapterLoader: async (id) => {
      const chapter = CHAPTERS.find((entry) => entry.id === id);
      if (!chapter) return null;
      if (chapter.rooms) return chapter.rooms;
      const mod = await chapter.loader();
      eng.registerTimerHandlers(mod.TIMERS);
      return mod.ROOMS;
    },
    ...options,
    embedding: stubEmbedding, ui: stubUi(output),
  });
  eng.registerTimerHandlers(PROLOGUE_TIMERS);
  eng.moveTo(eng.state.room);
  return { eng, get state() { return eng.state; }, output };
}

export async function command(game, input) {
  const { eng, state, output } = game;
  const start = output.length;
  assert.equal(state.dead, false, `不能在死亡后继续：${input}`);
  await eng.processInput(input);
  const response = output.slice(start).filter((entry) => entry.type !== "userInput")
    .map((entry) => entry.text).join("\n");
  assert.equal(state.dead, false, `${input} 导致死亡：\n${response}`);
  assert.doesNotMatch(response, /错误：|尚未开放|没有可进入的起始房间|这句话无法识别|暂时无法确定你的意思|没有消耗回合/,
    `${state.room}: ${input}`);
  return response;
}

export function exitsAt(eng, roomId) {
  const room = eng.rooms[roomId];
  if (!room) return {};
  // 只读的候选房间视图：不改活的 state，也不执行出口 act / onEnter。
  const view = Object.create(eng.state);
  Object.defineProperty(view, "room", { value: roomId });
  const exits = typeof room.exits === "function" ? room.exits(view) : room.exits;
  return Object.fromEntries(Object.entries(exits || {}).filter(([, exit]) =>
    exit && (typeof exit === "string" || !exit.when || exit.when(view))));
}

export function findRoute(eng, targetRoom) {
  const queue = [{ room: eng.state.room, steps: [] }];
  const seen = new Set([eng.state.room]);
  for (let index = 0; index < queue.length; index++) {
    const { room, steps } = queue[index];
    if (room === targetRoom) return steps;
    for (const [dir, exit] of Object.entries(exitsAt(eng, room))) {
      const to = typeof exit === "string" ? exit : exit.to;
      if (!to || seen.has(to)) continue;
      seen.add(to);
      // 未加载目标只能作为边界终点；真正行走时由出口 act 懒加载。
      queue.push({ room: to, steps: [...steps, { from: room, dir, to }] });
    }
  }
  return null;
}

export async function go(game, targetRoom) {
  const { eng, state } = game;
  for (let moves = 0; state.room !== targetRoom; moves++) {
    assert.ok(moves < 200, `前往 ${targetRoom} 超过 200 步，可能陷入循环`);
    const route = findRoute(eng, targetRoom);
    assert.ok(route?.length, `${state.room} → ${targetRoom} 没有满足条件的出口路径`);
    const step = route[0];
    assert.deepEqual(eng.parser.parse(step.dir), { type: "direction", dir: step.dir },
      `parser 不识别出口方向 ${step.dir}`);
    await command(game, step.dir);
    assert.equal(state.room, step.to, `${step.from} --${step.dir}--> ${step.to} 未真正到达`);
    // 每走一步重新寻路，纳入 act/onEnter/onTurn 改变的条件及翻转状态。
  }
}
