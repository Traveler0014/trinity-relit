// 从真机爬出地图：BFS，每次从头重放路径再试一个方向，用 dfrotz 的回答
// 作为出口真值。
//
// 为什么需要它：scripts/verify_exits_vs_zmachine.js 依赖 extract_exit_truth.py
// 解析出的真值表，而那张表对「纯 routine」出口一律宽容跳过，desert 的同名
// 房间也因 obj# 对应关系不明而未比对。跑真机不受这两项限制——游戏怎么答
// 就是怎样。
//
// 局限：只能走到无前置条件的出口。需要道具或 flag 的门（例如序章 Lancaster
// Walk 往东要先坐进婴儿车并撑开伞）爬不到，这类出口不会出现在结果里，
// 不代表它不存在。
//
// 实测序章：9 个房间 38 条出口，与 prototype/js/data/prologue.js 逐条一致，
// 唯一差异是上面那条带前置条件的 lancaster_walk -> long_water。
//
// 原版数据受版权保护，.DAT 路径由 --dat 传入，产物含原版房间名不得入库。
//
// 用法:
//   node scripts/crawl_real_map.mjs --dat "/path/TRINITY.DAT" [--json out.json]
//   node scripts/crawl_real_map.mjs --dat "..." --prefix scripts/commands_prologue.txt
//
// --prefix 指定一份先于爬行重放的指令（例如序章通关指令），用来爬后续章节。
// 每次探测都会完整重放它，所以 prefix 越长单次越慢，但保证每次探测的起点一致。
import { writeFileSync, readFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i+1] : undefined; };
const DAT = arg("dat");
const DIRS = ["n","s","e","w","ne","nw","se","sw","u","d"];
const OUT = arg("json");
const PREFIX_FILE = arg("prefix");
const PREFIX = PREFIX_FILE
  ? readFileSync(PREFIX_FILE, "utf8").split("\n").map(l => l.trim())
      .filter(l => l && !l.startsWith("#"))
  : [];
if (!DAT) { console.error("必须用 --dat 指定 TRINITY.DAT 路径（受版权保护，不在本仓库中）。"); process.exit(2); }

let runs = 0;
function play(cmds) {
  runs++;
  const f = join(tmpdir(), `cr_${process.pid}_${runs}.txt`);
  writeFileSync(f, ["verbose", ...PREFIX, ...cmds, "quit", "y"].join("\n") + "\n");
  const fd = openSync(f, "r");
  try {
    const r = spawnSync("dfrotz", ["-q","-p","-h","200","-w","200", DAT],
      { stdio:[fd,"pipe","pipe"], encoding:"utf8", maxBuffer: 16*1024*1024 });
    return r.stdout || "";
  } finally { closeSync(fd); try { unlinkSync(f); } catch {} }
}
// 状态行把房间名右对齐推到行尾，且只在房间变化时出现。
// 取整个序列，才能分辨「第一步被打断、第二步才成功」。
function roomSeq(out) {
  return [...out.matchAll(/^>?\s{20,}([A-Z][A-Za-z' ]{2,30})\s*$/gm)]
    .map(m => m[1].trim())
    .filter(n => !/\s{2,}/.test(n));   // 排除 "T  R  I  N  I  T  Y" 这类标题画面
}
const roomOf = (out) => { const s = roomSeq(out); return s.length ? s[s.length-1] : null; };

const start = roomOf(play([]));
console.log(`起点: ${start}`);
const pathTo = new Map([[start, []]]);
const edges = [];
const queue = [start];

while (queue.length) {
  const room = queue.shift();
  const base = pathTo.get(room);
  // 基准路径自身产生的房间序列，用作对齐基线（每个房间只算一次）
  const baseSeq = roomSeq(play(base));
  for (const d of DIRS) {
    // 发两次：从 The Wabe 出去的第一步必被「A noise makes you hesitate.」
    // 打断，只试一次会把所有方向都误判为不通。
    const seq = roomSeq(play([...base, d, d]));
    if (seq.length <= baseSeq.length) continue;    // 一步没动 = 此路不通
    const dest = seq[baseSeq.length];              // 基线之后的第一个新房间
    if (!dest || dest === room) continue;
    edges.push({ from: room, dir: d, to: dest });
    if (!pathTo.has(dest)) {
      pathTo.set(dest, [...base, d]);
      queue.push(dest);
      console.log(`  发现 ${dest.padEnd(20)} ← ${room} --${d}-->`);
    }
  }
}

console.log(`\n房间 ${pathTo.size} 个，出口 ${edges.length} 条，dfrotz 运行 ${runs} 次\n`);
console.log("真机出口表：");
for (const r of pathTo.keys()) {
  const es = edges.filter(e => e.from === r);
  console.log(`  ${r.padEnd(20)} ${es.map(e => `${e.dir}->${e.to}`).join("  ")}`);
}
if (OUT) {
  writeFileSync(OUT, JSON.stringify({ start, edges, paths: Object.fromEntries(pathTo) }, null, 1));
  console.log(`\n已写入 ${OUT}（含原版房间名，不得入库）`);
}
