// CHAPTER_RULES.md §10 + 关键规则 检查所有章节
// 从仓库根目录运行: node scripts/verify_chapters_rules.js [章节名...]
// 若传入章节名则仅报告这些章节的问题，例如: node scripts/verify_chapters_rules.js japan underground orbit pacific tundra

const fs = require("fs");
const path = require("path");

const PROTO = path.join(__dirname, "..", "prototype");
const DATA = path.join(PROTO, "js", "data");

const filterChapters = process.argv.slice(2)
  .map((c) => (c.endsWith(".js") ? c : c + ".js"))
  .filter(Boolean);

const API_STATE = new Set([
  "has", "carrying", "inPocket", "wearing", "inRoom", "itemAt", "roomItems",
  "inventoryList", "carryCount", "take", "toPocket", "wear", "drop", "destroy",
  "placeItem", "moveItem", "setFlag", "hasFlag", "clearFlag", "cnt", "setCnt", "inc",
  "addScore", "startTimer", "tickTimer", "clearTimer",
  "room", "turns", "dead", "chapter", "flipped", "sundialSymbol"
]);
const API_ENG = new Set([
  "print", "moveTo", "die", "transitionChapter", "describeRoom", "activateChapter"
]);

const issues = [];
function fail(check, msg, file, line) {
  if (filterChapters.length && !filterChapters.includes(file)) return;
  issues.push({ check, msg, file, line });
}

// 加载所有章节 ROOMS（需 strip export）
function loadChapterRooms(filename) {
  const filepath = path.join(DATA, filename);
  if (!fs.existsSync(filepath)) return null;
  let code = fs.readFileSync(filepath, "utf8");
  if (filename.endsWith(".js") && !filename.startsWith("_") && filename !== "items.js") {
    code = code.replace(/export const ROOMS\s*=\s*/g, "const ROOMS = ");
    code = code.replace(/^const SUNDIAL_/gm, "const SUNDIAL_");
    code = code.replace(/^export\s+/gm, "");
    try {
      const fn = new Function(code + " return typeof ROOMS !== 'undefined' ? ROOMS : {};");
      return fn();
    } catch (e) {
      fail("语法检查", e.message, filename);
      return {};
    }
  }
  return null;
}

// 收集所有房间 ID（含 main 预加载 + 懒加载章节）
const chapterFiles = ["prologue.js", "wabe.js", "japan.js", "underground.js", "orbit.js", "pacific.js", "tundra.js", "islet.js", "desert.js", "ranch.js", "finale.js"];
const allRooms = {};
for (const f of chapterFiles) {
  const ROOMS = loadChapterRooms(f);
  if (ROOMS && typeof ROOMS === "object") Object.assign(allRooms, ROOMS);
}

// 加载 items
let ITEMS = {};
try {
  let itemsCode = fs.readFileSync(path.join(DATA, "items.js"), "utf8");
  itemsCode = itemsCode.replace("export const ITEMS", "const ITEMS");
  const fn = new Function(itemsCode + " return ITEMS;");
  ITEMS = fn();
} catch (e) {
  fail("items.js", e.message, "items.js");
}
const itemIds = new Set(Object.keys(ITEMS));

// 方向反向映射
const REVERSE = { n: "s", s: "n", e: "w", w: "e", ne: "sw", sw: "ne", nw: "se", se: "nw", u: "d", d: "u", in: "out", out: "in" };

// 合法出口键 —— 必须与 parser.js 的 DIRECTIONS 归一化结果一致。
// 写成 "up"/"down" 之类的别名时 parser 不会产出该键，出口静默失效。
const VALID_DIRS = new Set(Object.keys(REVERSE));

// 有意设计的单向出口（不要求反方向存在），格式 "roomA:dir:roomB"
const ONE_WAY_EXITS = new Set([
  "round_pond:e:long_water",           // 婴儿车被风吹入长水湖
  "lancaster_walk:e:long_water",       // 同上
  "long_water:s:wading",               // 下水后到 wading，剧情单向
  "wading:w:long_water",               // 与上成对
  // The Wabe（中央枢纽 / 蘑菇门起点）：与 Z-machine 数据一致的单向出口
  "meadow:s:south_bog", "meadow:e:bottom_of_stairs", "meadow:w:north_bog",
  "summit:e:forest_clearing", "summit:ne:south_bog",
  "vertex:ne:arboretum", "vertex:sw:moor", "vertex:w:the_bend", "vertex:nw:craters_edge",
  "crater:n:craters_edge",
  // Pacific：mesa 多向入 scaffold、海滩/脚手架多向互通，按设计保留单向
  "mesa:s:scaffold", "mesa:n:scaffold", "mesa:u:scaffold",
  "bottom_scaffold:nw:west_beach", "bottom_scaffold:s:south_beach",
  "north_beach:w:west_beach", "north_beach:e:east_beach",
  "west_beach:se:south_beach", "west_beach:n:north_beach", "west_beach:u:scaffold",
  "east_beach:n:north_beach", "east_beach:s:south_beach",
  "south_beach:w:west_beach", "south_beach:e:east_beach",
  // Desert（主线）：塔区/十字路口/道路/沙漠/山麓单向或多向简化
  "base_of_tower:se:crossroads", "nw_of_tower:w:west_of_tower", "west_of_tower:n:nw_of_tower",
  "east_of_tower:e:crossroads", "north_of_tower:n:paved_road_6", "ne_of_tower:ne:paved_road_1",
  "sw_of_tower:sw:outside_blockhouse", "crossroads:s:paved_road_1", "crossroads:e:east_of_tower",
  "paved_road_1:n:paved_road_2", "paved_road_1:s:crossroads", "paved_road_1:nw:behind_shed",
  "paved_road_6:n:north_of_tower", "north_of_tower:n:paved_road_6", "foothills_2:e:desert_4", "foothills_3:e:desert_7",
  "desert_4:s:foothills_2", "desert_7:s:foothills_3",
  "tower_landing:u:tower_platform",
  "outside_blockhouse:w:sw_of_tower", "behind_shed:n:paved_road_1",
  // Ranch（主线）：前院/走廊/组装室/厨房/后院单向或骨架简化；风车下仅上通
  "front_yard:in:hallway", "hallway:n:nw_ranch", "assembly_room:e:front_yard",
  "kitchen:n:assembly_room", "back_yard:n:hallway", "edge_reservoir:u:windmill",
  // Cemetery 在原版里没有任何已解析出口指向它，入口藏在未反汇编的 routine 中。
  // 这对出口是补救路径，否则 Barrow 与 Ossuary 蘑菇门（Underground 章节入口）
  // 完全不可达。几何上不自洽（南进南出），定位到真实入口后应一并替换。
  "cottage:s:cemetery", "cemetery:s:cottage",
]);

function getExits(room, fromRoomId) {
  if (!room || !room.exits) return {};
  const state = {
    room: fromRoomId,
    flipped: false,
    sundialSymbol: 2,
    has: () => false,
    hasFlag: () => false,
    chapter: "wabe",
  };
  return typeof room.exits === "function" ? room.exits(state) : room.exits;
}

function exitTarget(exits, dir) {
  const v = exits[dir];
  if (v == null) return null;
  return typeof v === "object" ? v.to : v;
}

for (const filename of chapterFiles) {
  const ROOMS = loadChapterRooms(filename);
  if (!ROOMS || Object.keys(ROOMS).length === 0) continue;

  const state = { room: "meadow", flipped: false, sundialSymbol: 2, has: () => false, hasFlag: () => false };

  for (const [rid, room] of Object.entries(ROOMS)) {
    if (!room.name || !room.cn) fail("name/cn", `缺少 name 或 cn: ${rid}`, filename, null);
    if (!room.desc) fail("desc", `缺少 desc: ${rid}`, filename, null);
    if (!room.exits) fail("exits", `缺少 exits: ${rid}`, filename, null);

    const exits = typeof room.exits === "function" ? room.exits(state) : room.exits;
    for (const [dir, t] of Object.entries(exits || {})) {
      if (!VALID_DIRS.has(dir)) {
        fail("方向键名", `${rid} 的出口键 "${dir}" 不是合法方向，parser 永远不会产出它`, filename, null);
      }
      const to = typeof t === "object" ? t.to : t;
      if (!to) continue;
      if (!allRooms[to]) fail("出口联通", `${rid} ${dir} -> ${to} 目标不存在`, filename, null);
    }

    // onTurn 守卫
    if (room.onTurn) {
      const src = fs.readFileSync(path.join(DATA, filename), "utf8");
      const roomBlock = src.indexOf(rid + ":");
      if (roomBlock >= 0) {
        const snippet = src.slice(roomBlock, roomBlock + 800);
        const onTurnMatch = snippet.match(/onTurn\s*\([^)]*\)\s*\{([^}]{0,120})/);
        if (onTurnMatch && !/if\s*\(\s*s\.room\s*!==\s*[\"']/.test(onTurnMatch[1])) {
          fail("onTurn守卫", `${rid} 的 onTurn 未以 if (s.room !== '...') return 开头`, filename, null);
        }
      }
    }

    // 事件 ID 唯一 + 物品引用
    const eventIds = new Set();
    for (const ev of room.events || []) {
      if (ev.id) {
        if (eventIds.has(ev.id)) fail("事件ID唯一", `${rid} 重复事件 id: ${ev.id}`, filename, null);
        eventIds.add(ev.id);
      }
      const evStr = JSON.stringify(ev);
      const itemRefs = evStr.match(/(?:has|inRoom|take|drop|carrying|itemAt)\s*\(\s*["']([^"']+)["']/g) || [];
      for (const ref of itemRefs) {
        const id = ref.replace(/.*["']([^"']+)["'].*/, "$1");
        if (!itemIds.has(id)) fail("物品交叉引用", `events 引用物品 ${id} 不在 items.js`, filename, null);
      }
    }
  }
}

// 双向出口（§10）：A --dir--> B 则 B 必须有 REVERSE[dir] --> A。
// 仅检查同章节；跨章节出口不要求严格反向；有意单向出口加入 ONE_WAY_EXITS。
const roomToFile = {};
for (const filename of chapterFiles) {
  const ROOMS = loadChapterRooms(filename);
  if (ROOMS) for (const id of Object.keys(ROOMS)) roomToFile[id] = filename;
}
for (const [roomAId, roomA] of Object.entries(allRooms)) {
  const exitsA = getExits(roomA, roomAId);
  const fileA = roomToFile[roomAId];
  for (const [dir, t] of Object.entries(exitsA || {})) {
    const roomBId = exitTarget(exitsA, dir);
    if (!roomBId || !allRooms[roomBId]) continue;
    if (roomBId === roomAId) continue; // 条件出口未满足时指向自身，跳过
    if (ONE_WAY_EXITS.has(`${roomAId}:${dir}:${roomBId}`)) continue;
    const fileB = roomToFile[roomBId];
    if (fileA !== fileB) continue; // 跨章节出口不要求严格双向（返回可能到不同房间）
    const revDir = REVERSE[dir];
    if (!revDir) continue;
    const roomB = allRooms[roomBId];
    const exitsB = getExits(roomB, roomBId);
    const backTo = exitTarget(exitsB, revDir);
    if (backTo !== roomAId) {
      fail(
        "双向出口",
        `${roomAId} --${dir}--> ${roomBId}，但 ${roomBId} 缺少反方向 ${revDir} --> ${roomAId}（当前 ${revDir}=${backTo || "无"}）`,
        fileB || "?",
        null
      );
    }
  }
}

// 引号安全：双引号字符串内不能有未转义的 "
for (const filename of chapterFiles) {
  const filepath = path.join(DATA, filename);
  const code = fs.readFileSync(filepath, "utf8");
  const regex = /"(?:[^"\\]|\\.)*"/g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    const inner = m[0].slice(1, -1);
    if (inner.includes('"') && !inner.includes('\\"')) {
      fail("引号安全", `双引号字符串内含未转义 ": ${m[0].slice(0, 50)}...`, filename, null);
      break;
    }
  }
}

// 出口 act 中不应 eng.moveTo（仅检查 exits 内 to: "..." 同块的 act）
for (const filename of chapterFiles) {
  const code = fs.readFileSync(path.join(DATA, filename), "utf8");
  // 匹配出口项：to: "room_id" ... act(...) { ... eng.moveTo
  const badExitAct = /to\s*:\s*["'][^"']+["'][\s\S]{0,500}?act\s*\([^)]*\)\s*\{[\s\S]{0,400}?eng\.moveTo\s*\(/;
  if (badExitAct.test(code)) fail("出口act", "条件出口的 act 中不应调用 eng.moveTo（由引擎统一 moveTo）", filename, null);
}

// 描述格式：含中文（§0 核心原则）
for (const filename of chapterFiles) {
  const code = fs.readFileSync(path.join(DATA, filename), "utf8");
  const hasChinese = /[\u4e00-\u9fff]/.test(code);
  const hasDesc = /desc\s*\(\s*s\s*\)\s*\{/.test(code) || /desc\s*\(\s*\)\s*\{/.test(code);
  if (!hasChinese || !hasDesc) fail("描述格式", "章节应有 desc 且含中文翻译", filename, null);
}

// 计时器回调必须取自本章的 TIMERS 导出（CHAPTER_RULES §6）。
// 内联闭包不会报错、也不影响当前这局游戏，但存档存不下函数：玩家刷新
// 页面后计时器照常倒数，每回合的副作用却静默消失。这类只在读档后才暴露
// 的问题正是静态检查该拦的。

// 从 "startTimer(" 之后按顶层逗号切出参数，括号、花括号与字符串内的逗号不算。
function splitArgs(code, start) {
  const args = [];
  let depth = 0, quote = null, cur = "", i = start;
  for (; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      cur += c;
      if (c === "\\") { cur += code[++i] || ""; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; cur += c; continue; }
    if ("([{".includes(c)) { depth++; cur += c; continue; }
    if (")]}".includes(c)) {
      if (c === ")" && depth === 0) { args.push(cur.trim()); return args; }
      depth--; cur += c; continue;
    }
    if (c === "," && depth === 0) { args.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  return null; // 括号没闭合
}

const timerIdOwner = new Map();
for (const filename of chapterFiles) {
  const code = fs.readFileSync(path.join(DATA, filename), "utf8");

  // 本章 TIMERS 导出里声明了哪些键
  const exported = new Set();
  const exportBlock = /export\s+const\s+TIMERS\s*=\s*\{/.exec(code);
  if (exportBlock) {
    const region = code.slice(exportBlock.index, code.indexOf("\n};", exportBlock.index) + 3);
    for (const km of region.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*[(:]/gm)) exported.add(km[1]);
  }

  const re = /startTimer\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const line = code.slice(0, m.index).split("\n").length;
    const args = splitArgs(code, m.index + m[0].length);
    if (!args || args.length < 3) {
      fail("计时器回调", `startTimer 参数解析失败或不足 3 个`, filename, line);
      continue;
    }
    const idLit = /^(["'])([^"']+)\1$/.exec(args[1]);
    if (!idLit) {
      fail("计时器回调", `startTimer 的 id 必须是字符串字面量，当前为 ${args[1]}`, filename, line);
      continue;
    }
    const id = idLit[2];

    // id 全局唯一：引擎的回调注册表是跨章节共用的一张表
    const owner = timerIdOwner.get(id);
    if (owner && owner !== filename) {
      fail("计时器回调", `计时器 id "${id}" 在 ${owner} 中已被使用，跨章节不能重复`, filename, line);
    } else {
      timerIdOwner.set(id, filename);
    }

    const ref = /^TIMERS\.([A-Za-z_$][\w$]*)$/.exec(args[2]);
    if (!ref) {
      fail(
        "计时器回调",
        `第 3 个参数必须写成 TIMERS.${id}（回调要能在读档后按 id 取回），当前为 ${args[2].split("\n")[0].slice(0, 40)}…`,
        filename,
        line
      );
      continue;
    }
    if (ref[1] !== id) {
      fail("计时器回调", `TIMERS.${ref[1]} 与 id "${id}" 不一致，引擎靠这两者配对`, filename, line);
      continue;
    }
    if (!exported.has(id)) {
      fail("计时器回调", `本章的 export const TIMERS 中没有 ${id}`, filename, line);
    }
  }
}

// 报告
console.log("=== CHAPTER_RULES 符合性检查 ===\n");
if (issues.length === 0) {
  console.log("全部检查通过。");
  console.log("\n§10 清单: 语法、出口联通、双向出口、物品交叉引用、引号安全、onTurn守卫、事件ID唯一、计时器回调 均已通过。");
  console.log("说明: 单向出口白名单见脚本内 ONE_WAY_EXITS；Z-machine 一致性需结合 zparse 数据人工核对。");
  process.exit(0);
}
console.log(`共 ${issues.length} 项不符合:\n`);
issues.forEach(({ check, msg, file }) => console.log(`  [${check}] ${file}: ${msg}`));
process.exit(1);
