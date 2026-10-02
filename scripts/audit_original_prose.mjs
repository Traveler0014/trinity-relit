// 审查章节数据里的英文是否来自 1986 原版（CHAPTER_RULES §0）。
//
// 为什么需要它：§0 是项目第一条规则「所有英文文本必须来自原版，绝不自创」，
// 但 verify_chapters_rules.js 查不到违规——它只检查中文是否存在。占位英文
// （"You are in a spare room."）能通过全部既有校验。
//
// 两段式：
//   1. 确定性预筛——模板句式、极短英文。零依赖，无需 API key，CI 可跑。
//   2. 判断裁决——预筛命中的交给 TypeSafe Jev 判定「原版内文 / 占位文字」。
//      可选，需 TYPESAFE_API_KEY。
//
// 预筛只负责缩小范围，不下结论；判断只处理预筛的残余。
// 报告只输出房间 id 与判定，不复制原版文字。
//
// 用法:
//   node scripts/audit_original_prose.mjs --offline          # 只跑预筛
//   node scripts/audit_original_prose.mjs                    # 预筛 + Jev 裁决
//   node scripts/audit_original_prose.mjs --chapter ranch
//   node scripts/audit_original_prose.mjs --json out.json
//   node scripts/audit_original_prose.mjs --proof-dir /path/to/extracted   # 加确定性闸门
//
// 关于 --proof-dir：指向存放原版提取产物的目录（trinity_prologue_text.txt、
// trinity_print_strings.json、trinity_strings.json）。这些是 .DAT 的派生数据，
// 按 §3 版权隔离永不入库，所以只能由本地路径传入。
// 用法是「正向证据」：提取出的片段若原样出现在章节英文里，该段即为原版，
// 直接排除、不再送审。注意反向不成立——提取并不完整（ZSCII 缩写未展开，
// 片段多被截断，且目前偏重序章），没有片段命中不等于不是原版。

import { readFile, writeFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = pathToFileURL(join(HERE, "..", "prototype", "js", "data") + "/").href;

const CHAPTERS = ["prologue","wabe","japan","underground","orbit","pacific",
                  "tundra","islet","desert","ranch","finale"];

// 正对照：SHIP_PLAN 记载序章已据 dfrotz transcript 还原并线上验证。
// 每轮随 batch 一起发出，用来发现模型或提示词漂移——正对照若被判为占位，
// 本轮全部结果都不可信。
const CONTROLS = ["round_pond", "flower_walk", "broad_walk"];

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? true) : dflt;
};
const OFFLINE = process.argv.includes("--offline");
const ONLY = arg("chapter", null);
const LIMIT = Number(arg("limit", 0)) || 0;
const CONC = Math.max(1, Number(arg("concurrency", 4)) || 4);
const JSON_OUT = arg("json", null);
const PROOF_DIR = arg("proof-dir", process.env.TRINITY_EXTRACT_DIR || null);
const JEV = process.env.JEV_SCRIPT ||
  join(process.env.HOME || "", ".claude", "skills", "jev", "scripts", "jev.py");

// ── 取英文：章节文本格式是 "English\n\n中文"，按段落分离 ──
const probe = new Proxy({ room: "", flags: new Set() }, {
  get: (t, p) => p in t ? t[p]
    : ["has","carrying","inPocket","wearing","inRoom","hasFlag"].includes(p) ? () => false
    : p === "cnt" ? () => 0 : () => undefined,
});
function englishOf(room, id) {
  probe.room = id;
  let d = "";
  try { d = (typeof room.desc === "function" ? room.desc(probe) : room.desc) || ""; } catch { /* desc 依赖未模拟的状态 */ }
  return String(d).split(/\n{2,}/).filter((p) => !/[一-鿿]/.test(p)).join(" ").trim();
}

// ── 1. 确定性预筛 ──
const TEMPLATE = /^You are (?:in|at|on) (?:a|an|the) [\w\s'-]+\.$/i;
const SHORT = 100;
function prefilter(en) {
  if (!en) return { suspect: true, why: "无英文" };
  const first = (en.split(/(?<=\.)\s/)[0] || "").trim();
  if (TEMPLATE.test(first)) return { suspect: true, why: "模板首句" };
  if (en.length < SHORT) return { suspect: true, why: `英文仅 ${en.length} 字符` };
  return { suspect: false, why: "" };
}

// ── 1.5 确定性闸门：原版片段正向证据 ──
async function loadFragments(dir) {
  const frags = new Set();
  const add = (t) => { const v = String(t || "").replace(/\s+/g, " ").trim();
    if (v.length >= 25) frags.add(v); };
  try {
    for (const line of (await readFile(join(dir, "trinity_prologue_text.txt"), "utf8")).split("\n")) {
      const t = line.trim();
      if (t && !t.startsWith("---") && !t.startsWith("Extracted")) add(t);
    }
  } catch { /* 该文件可选 */ }
  for (const f of ["trinity_print_strings.json", "trinity_strings.json"]) {
    try {
      const parsed = JSON.parse(await readFile(join(dir, f), "utf8"));
      const list = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed.strings) ? parsed.strings
        : Object.values(parsed).find(Array.isArray) || [];
      // 提取产物大多是乱码片段，只留形似正常英文的
      for (const it of list) {
        const t = String(it?.text || "").replace(/\s+/g, " ").trim();
        if (/^[A-Z"\u2018\u2019'][a-zA-Z ,'"-]{20,}/.test(t)) add(t);
      }
    } catch { /* 该文件可选 */ }
  }
  return frags;
}

// ── 2. Jev 裁决 ──
function buildRequest(name, en) {
  return {
    model: "typesafe/jev-1.13",
    state: {
      任务: "这是一个复刻 Infocom 文字冒险 Trinity (1986) 的项目。项目规则要求所有英文逐字取自 1986 年原版，禁止自行撰写。请判断下面这段房间描述属于哪一类。",
      房间名: name,
      待判断的英文: en,
      判断要点: [
        "Trinity 的作者是 Brian Moriarty，原版散文有具体感官细节、特定专有名词、文学性措辞与节奏。",
        "占位文字的特征：泛化模板句，只陈述房间名与方位，换成任何房间都成立。",
        "原版中确实存在少数简短描述，长度本身不是决定性依据，关键看是否有不可替换的具体内容。",
      ],
    },
    questions: {
      来源: { type: "choice",
        instructions: "这段英文更可能是 1986 原版游戏的内文，还是复刻时写的占位文字？",
        criteria: {
          原版内文: "有具体感官细节、专有名词或文学性措辞，是某个特定地点不可替换的描述。",
          占位文字: "泛化模板句，只陈述房间名与方位，换成任何房间都成立。",
          无法判断: "两种可能都讲得通，仅凭这段文字无法区分。" } },
    },
  };
}

async function adjudicate(id, name, en) {
  const p = join(tmpdir(), `prose_${id}_${process.pid}.json`);
  await writeFile(p, JSON.stringify(buildRequest(name, en)));
  try {
    // jev.py 对 needs_review 返回退出码 2，execFile 会当成错误抛出，
    // 但 stdout 仍是完整 JSON，所以从异常里取。
    let stdout;
    try { ({ stdout } = await execFileP("python3", [JEV, "decide", p, "--provider", "typesafe"])); }
    catch (e) { if (!e.stdout) throw e; stdout = e.stdout; }
    const d = JSON.parse(stdout).decisions["来源"];
    return { verdict: d.value, prob: d.probability, status: d.status };
  } catch (e) {
    return { verdict: null, prob: null, status: "error", error: String(e.message || e).slice(0, 120) };
  }
}

// 有界并发：逐个发请求会白白串行等待，但也不能一次全发出去压垮配额。
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ── 主流程 ──
const rooms = [];
for (const ch of CHAPTERS) {
  if (ONLY && ch !== ONLY) continue;
  const { ROOMS } = await import(`${DATA}${ch}.js`);
  for (const [id, room] of Object.entries(ROOMS || {})) {
    rooms.push({ ch, id, name: room.name || id, en: englishOf(room, id) });
  }
}

for (const r of rooms) Object.assign(r, prefilter(r.en));

let proven = [];
if (PROOF_DIR) {
  const frags = await loadFragments(PROOF_DIR);
  for (const r of rooms) {
    if (!r.en) continue;
    for (const f of frags) if (r.en.includes(f)) { r.proven = true; break; }
  }
  proven = rooms.filter((r) => r.proven);
}
const suspects = rooms.filter((r) => r.suspect && !r.proven);

console.log("=== CHAPTER_RULES §0 英文来源审查 ===\n");
console.log(`房间 ${rooms.length} 个，预筛疑似 ${rooms.filter(r=>r.suspect).length} 个`);
if (PROOF_DIR) {
  console.log(`其中 ${rooms.filter(r=>r.suspect&&r.proven).length} 个被原版片段证实，已排除；` +
              `全库证实 ${proven.length} 个`);
}
console.log(`待裁决 ${suspects.length} 个\n`);
const byCh = {};
for (const r of suspects) (byCh[r.ch] ||= []).push(r);
for (const [ch, list] of Object.entries(byCh).sort((a, b) => b[1].length - a[1].length)) {
  const tot = rooms.filter((r) => r.ch === ch).length;
  console.log(`  ${ch.padEnd(13)} ${String(list.length).padStart(3)}/${String(tot).padEnd(3)}`);
}

if (OFFLINE) {
  console.log("\n--offline：只跑预筛。预筛不下结论，仅缩小人工或 Jev 的复核范围。");
  if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify({ rooms, suspects }, null, 1));
  process.exit(0);
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error("\n缺少 TYPESAFE_API_KEY。用 --offline 只跑预筛，或配置 key 后重试。");
  process.exit(2);
}
try { await access(JEV); } catch {
  console.error(`\n找不到 jev.py（${JEV}）。可用 JEV_SCRIPT 指定路径，或用 --offline。`);
  process.exit(2);
}

// 正对照与待查项一起送审
const controls = rooms.filter((r) => CONTROLS.includes(r.id) && r.en);
let targets = suspects.filter((r) => r.en);
if (LIMIT) targets = targets.slice(0, LIMIT);
const batch = [...controls.map((r) => ({ ...r, isControl: true })), ...targets];

console.log(`\n送审 ${batch.length} 条（含 ${controls.length} 条正对照），并发 ${CONC}…\n`);
const t0 = Date.now();
const results = await mapLimit(batch, CONC, async (r) => ({ ...r, ...(await adjudicate(r.id, r.name, r.en)) }));
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

// 正对照先判：它若失守，本轮结果一律不可信
const ctl = results.filter((r) => r.isControl);
const ctlBad = ctl.filter((r) => r.verdict !== "原版内文");
console.log("正对照：");
for (const r of ctl) {
  const ok = r.verdict === "原版内文" ? "✓" : "✗";
  console.log(`  ${ok} ${r.id.padEnd(16)} ${String(r.verdict).padEnd(8)} ${r.prob?.toFixed(2) ?? "—"}`);
}
if (ctlBad.length) {
  console.log("\n⚠ 正对照失守：已知的原版文字被判为非原版。本轮判定结果不可采信。");
}

const judged = results.filter((r) => !r.isControl);
const group = (v) => judged.filter((r) => r.verdict === v);
console.log(`\n判定（${elapsed}s）：`);
console.log(`  占位文字  ${group("占位文字").length}`);
console.log(`  原版内文  ${group("原版内文").length}`);
console.log(`  无法判断  ${group("无法判断").length}`);
const errs = judged.filter((r) => r.status === "error");
if (errs.length) console.log(`  调用失败  ${errs.length}`);

const flagged = group("占位文字").sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0));
if (flagged.length) {
  console.log(`\n判为占位文字（按概率降序；needs_review 表示弃权，不是结论）：`);
  for (const r of flagged) {
    console.log(`  ${(r.prob?.toFixed(2) ?? "—").padStart(5)}  ${r.ch.padEnd(12)} ${r.id.padEnd(22)} ${r.status === "selected" ? "" : r.status}`);
  }
}

if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify({ generatedAt: new Date().toISOString(),
    controlsPassed: ctlBad.length === 0, rooms: rooms.length, suspects: suspects.length,
    results: results.map(({ en, ...rest }) => rest) }, null, 1));   // 不写入原版文字
  console.log(`\n明细已写入 ${JSON_OUT}（不含原版文字）`);
}
console.log("\n判定是建议而非定论。needs_review 为弃权，应由人工复核。");
