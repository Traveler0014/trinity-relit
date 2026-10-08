// 用 dfrotz 跑原版，抓取房间描述作为 §0 审查的真值。
//
// 为什么不用 zparse 的串表：extract_print_strings 逐字节扫描 0xB2/0xB3
// 找 print 操作码，绝大多数命中是碰巧等于该值的数据字节，从那里解码出
// 的是乱码。实测 5847 条里只有约 798 条形似英文，且多为碎片——已知的
// 序章原文三句只能找回一句。解码器本身没问题（缩写展开是对的），问题
// 是扫描器不知道字符串从哪里开始，要修得做真正的反汇编。
//
// 跑解释器则是逐字正确的，CHAPTER_RULES 的工作流本来就是这么写的。
//
// 原版数据受版权保护，永不入库：.DAT 路径由参数传入，产物写到 .gitignore
// 覆盖的位置或仓库外。
//
// 用法:
//   node scripts/capture_original_text.mjs --dat "/path/TRINITY.DAT" \
//        --commands scripts/commands_prologue_to_wabe.txt --json /tmp/truth.json

import { readFile, writeFile } from "node:fs/promises";
import { openSync, closeSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const DAT = arg("dat");
const CMDS = arg("commands", "scripts/commands_prologue_to_wabe.txt");
const OUT = arg("json");
const FROTZ = arg("dfrotz", "dfrotz");

if (!DAT) {
  console.error("必须用 --dat 指定 TRINITY.DAT 路径（受版权保护，不在本仓库中）。");
  process.exit(2);
}

// 指令文件里的注释与空行不能喂给解释器
const script = (await readFile(CMDS, "utf8"))
  .split("\n").map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .concat(["quit", "y"]).join("\n") + "\n";

// 必须用文件描述符喂 stdin。把指令写进管道（child_process 的 input 选项）
// 会让 dfrotz 挂起不退出——它要的是一个可读到 EOF 的真实输入流。
const scriptPath = join(tmpdir(), `trinity_cmds_${process.pid}.txt`);
writeFileSync(scriptPath, script);
let stdout = "";
let fd;
try {
  fd = openSync(scriptPath, "r");
  // -p 纯文本、-q 去掉启动信息；宽度开大避免描述被硬换行切断
  const r = spawnSync(FROTZ, ["-q", "-p", "-h", "200", "-w", "200", DAT],
    { stdio: [fd, "pipe", "pipe"], encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error) { console.error(`dfrotz 运行失败：${r.error.message}`); process.exit(1); }
  stdout = r.stdout || "";   // quit 可能让解释器以非零码退出，输出仍然完整
} finally {
  if (fd !== undefined) closeSync(fd);
  try { unlinkSync(scriptPath); } catch { /* 清理失败无妨 */ }
}
if (!stdout.trim()) { console.error("dfrotz 没有产生输出。检查 --dat 路径与 dfrotz 是否可用。"); process.exit(1); }

// dfrotz 的状态行把房间名右对齐推到行尾；房间描述前另有一行纯房间名。
// 以「独占一行、不以 > 开头、后面跟空行再跟正文」作为房间块的起点。
const lines = stdout.split("\n").map((l) => l.replace(/\s+$/, ""));
const rooms = new Map();
for (let i = 0; i < lines.length; i++) {
  const name = lines[i].trim();
  if (!name || name.startsWith(">") || name.startsWith("[")) continue;
  if (name.length > 40 || !/^[A-Z]/.test(name)) continue;
  if (lines[i].startsWith(" ")) continue;                 // 右对齐的状态行，跳过
  if (lines[i + 1] !== "" ) continue;                     // 房间名后必有空行
  const body = [];
  for (let j = i + 2; j < lines.length; j++) {
    const l = lines[j];
    if (l.startsWith(">") || (l.trim() && l.startsWith(" ") && l.trim().length < 40)) break;
    if (!l.trim() && body.length && !lines[j + 1]?.trim()) break;
    body.push(l);
  }
  const text = body.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 20) continue;
  if (!rooms.has(name)) rooms.set(name, text);            // 首次进入的描述最完整
}

console.log(`采集到 ${rooms.size} 个房间的原版描述：`);
for (const [n, t] of rooms) console.log(`  ${n.padEnd(26)} ${t.length} 字符`);

if (OUT) {
  await writeFile(OUT, JSON.stringify(Object.fromEntries(rooms), null, 1));
  console.log(`\n已写入 ${OUT}`);
  console.log("注意：该文件含原版受版权文本，不得提交入库。");
}
