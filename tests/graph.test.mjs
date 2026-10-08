import assert from "node:assert/strict";
import test from "node:test";
import { CHAPTERS } from "./chapters.mjs";
import { ITEMS } from "../prototype/js/data/items.js";

const chapters = await Promise.all(CHAPTERS.map(async (chapter) => ({
  id: chapter.id,
  rooms: chapter.rooms || (await chapter.loader()).ROOMS,
})));
const allRooms = Object.assign({}, ...chapters.map((chapter) => chapter.rooms));
const directions = new Set(["n", "ne", "e", "se", "s", "sw", "w", "nw", "u", "d", "in", "out"]);

// 纯静态图检查的状态视图，不接触通关测试的 GameState。
// 覆盖全部日晷符号、翻转、物品有无及 flag 开关，包含平时关闭的出口。
function* graphStates(room, chapter) {
  for (const sundialSymbol of [1, 2, 3, 4, 5, 6, 7]) {
    for (const flipped of [false, true]) {
      for (const inventory of [false, true]) {
        for (const flags of [false, true]) {
          yield { room, chapter, sundialSymbol, flipped, has: () => inventory, hasFlag: () => flags };
        }
      }
    }
  }
}

function* functionSources(value) {
  if (typeof value === "function") yield value.toString();
  else if (value && typeof value === "object") {
    for (const child of Object.values(value)) yield* functionSources(child);
  }
}

test("章节和房间 ID 全局唯一，所有章节通过真实 import 加载", () => {
  assert.equal(new Set(chapters.map((chapter) => chapter.id)).size, chapters.length);
  const seen = new Set();
  for (const { id, rooms } of chapters) {
    assert.ok(Object.keys(rooms).length, `${id} 没有房间`);
    for (const [rid, room] of Object.entries(rooms)) {
      assert.ok(!seen.has(rid), `${id} 重复定义房间 ${rid}`);
      seen.add(rid);
      assert.ok(room.name && room.cn && room.desc && room.exits, `${id}/${rid} 缺少必填字段`);
    }
  }
});

test("所有状态分支的出口方向合法，目标存在于已注册章节", () => {
  for (const { id, rooms } of chapters) {
    for (const [rid, room] of Object.entries(rooms)) {
      for (const state of graphStates(rid, id)) {
        const exits = typeof room.exits === "function" ? room.exits(state) : room.exits;
        for (const [dir, exit] of Object.entries(exits)) {
          const label = `${id}/${rid}.${dir}（符号 ${state.sundialSymbol}，翻转 ${state.flipped}）`;
          assert.ok(directions.has(dir), `${label} 不是 parser 的标准方向键`);
          const to = typeof exit === "string" ? exit : exit?.to;
          assert.ok(to && allRooms[to], `${label} 指向不存在的房间 ${to}`);
        }
      }
    }
  }
});

test("同一房间中的事件 ID 必填且唯一", () => {
  for (const { id, rooms } of chapters) {
    for (const [rid, room] of Object.entries(rooms)) {
      const seen = new Set();
      for (const event of room.events || []) {
        assert.ok(event.id, `${id}/${rid} 事件没有 ID`);
        assert.ok(!seen.has(event.id), `${id}/${rid} 重复事件 ${event.id}`);
        seen.add(event.id);
      }
    }
  }
});

test("事件函数中引用的物品均已定义（不能用 JSON.stringify 丢弃函数）", () => {
  let checked = 0;
  const itemCall = /\b\w+\.(?:has|carrying|inPocket|wearing|inRoom|itemAt|take|toPocket|wear|drop|destroy|placeItem|moveItem)\s*\(\s*["']([^"']+)["']/g;
  for (const { id, rooms } of chapters) {
    for (const [rid, room] of Object.entries(rooms)) {
      // 同时检查生命周期和出口函数中的物品引用。
      for (const source of functionSources(room)) {
        for (const [, item] of source.matchAll(itemCall)) {
          checked++;
          assert.ok(Object.hasOwn(ITEMS, item), `${id}/${rid} 引用了未知物品 ${item}`);
        }
      }
    }
  }
  assert.ok(checked > 0, "物品引用扫描没有实际检查任何函数");
});

test("每个 onTurn 的首条语句是本房间守卫", () => {
  let checked = 0;
  for (const { id, rooms } of chapters) {
    for (const [rid, room] of Object.entries(rooms)) {
      if (!room.onTurn) continue;
      checked++;
      const source = room.onTurn.toString();
      const guard = source.match(/^onTurn\s*\(\s*(\w+)[^)]*\)\s*\{\s*if\s*\(\s*\1\.room\s*!==\s*["']([^"']+)["']\s*(?:\|\|[\s\S]*?)?\)\s*return\s*;/);
      assert.ok(guard, `${id}/${rid}.onTurn 缺少开头守卫`);
      assert.equal(guard[2], rid, `${id}/${rid}.onTurn 守卫指向其他房间`);
      // 允许与其他提前返回条件做 || 组合，但离开房间后必须立即返回。
      assert.doesNotThrow(() => room.onTurn(Object.freeze({ room: "__outside__" }), {}));
    }
  }
  assert.ok(checked > 0, "没有检查到任何 onTurn");
});
