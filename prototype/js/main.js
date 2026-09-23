// ═══════════════════════════════════════════════════
//  Trinity Relit — 入口文件
// ═══════════════════════════════════════════════════

import { GameEngine, SAVE_VERSION } from "./engine.js";
import { Parser } from "./parser.js";
import { ui } from "./ui.js";
import { ITEMS } from "./data/items.js";
import { ROOMS as PROLOGUE } from "./data/prologue.js";

// 按章节注册房间。preload: true 的章节随首屏加载；
// 其余章节通过 loader 函数懒加载（动态 import）。
const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },
  { id: "wabe", loader: () => import("./data/wabe.js") },
  { id: "japan", loader: () => import("./data/japan.js") },
  { id: "underground", loader: () => import("./data/underground.js") },
  { id: "orbit", loader: () => import("./data/orbit.js") },
  { id: "pacific", loader: () => import("./data/pacific.js") },
  { id: "tundra", loader: () => import("./data/tundra.js") },
  { id: "islet", loader: () => import("./data/islet.js") },
  { id: "desert", loader: () => import("./data/desert.js") },
  { id: "ranch", loader: () => import("./data/ranch.js") },
  { id: "finale", loader: () => import("./data/finale.js") },
];

const CHAPTER_REGISTRY = new Map(CHAPTERS.map((c) => [c.id, c]));

// 判定必须是 preload === true，不能写成 preload !== false。
// 懒加载章节根本没有 preload 字段，undefined !== false 为真，会把 11 章全部
// 算进 PRELOADED_CHAPTERS；引擎据此认为它们都已装载，activateChapter 于是
// 直接返回 true、loader 一次都不调用，章节房间永远进不到 rooms 里。
const PRELOADED = CHAPTERS.filter((c) => c.preload === true);
const PRELOADED_CHAPTERS = PRELOADED.map((c) => c.id);

const ALL_ROOMS = PRELOADED.reduce((acc, chapter) => {
  if (chapter.rooms) Object.assign(acc, chapter.rooms);
  return acc;
}, {});

// ═══════════════════════════════════════════════════
//  存档层
// ═══════════════════════════════════════════════════
//
// 引擎只负责产出/吃进纯对象，落盘在这里。localStorage 天然按来源隔离，
// 线上版（github.io）、本地 dev 版（localhost）的存档互不干扰，不需要
// 额外做什么。key 带版本号，将来格式不兼容时旧档自然失效而不是读出错误状态。

const SAVE_KEY = `trinity-relit:save:v${SAVE_VERSION}`;

// 隐私模式、磁盘配额、被禁用的存储都会让这些调用直接抛异常，
// 一律降级为「没有存档」而不是让游戏打不开。
const saveStore = {
  read() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("读取存档失败，按无存档处理", err);
      return null;
    }
  },
  write(save) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      return true;
    } catch (err) {
      console.warn("写入存档失败", err);
      return false;
    }
  },
  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* 无所谓 */ }
  },
};

const CHAPTER_CN = {
  prologue: "序章", wabe: "The Wabe", japan: "广岛", underground: "地下",
  orbit: "轨道", pacific: "太平洋", tundra: "苔原", islet: "小岛",
  desert: "沙漠", ranch: "牧场", finale: "终章",
};

function describeSave(save) {
  const st = save?.state || {};
  const chapter = CHAPTER_CN[st.chapter] || st.chapter || "未知章节";
  const when = save?.savedAt ? new Date(save.savedAt).toLocaleString() : "时间未知";
  return `${chapter}，第 ${st.turns ?? 0} 回合，${st.score ?? 0} 分（${when}）`;
}

// 导入的文件可能是任意东西。只在这里做浅校验，深校验交给 engine.deserialize。
function parseSaveFile(text) {
  let save;
  try {
    save = JSON.parse(text);
  } catch {
    throw new Error("这不是一个有效的 JSON 文件");
  }
  if (!save || typeof save !== "object" || !save.state) {
    throw new Error("文件里没有存档数据");
  }
  if (save.version !== SAVE_VERSION) {
    throw new Error(`存档版本为 ${save.version}，当前游戏只能读 ${SAVE_VERSION}`);
  }
  return save;
}

async function boot() {
  ui.setLoading("正在载入…", 0);

  const parser = new Parser();
  const engine = new GameEngine({
    rooms: ALL_ROOMS,
    items: ITEMS,
    parser,
    // 语义兜底目前未启用：engine.processInput 只走 parser 结构化匹配，
    // 事件靠 ev.match 命中，不再调用 embedding.findMatch。
    //
    // 因此启动时不加载嵌入模型。此前 boot 会 await 一个约 130MB 的下载，
    // 而模型没有任何调用方——实测下行仅 40KB/s（官方源与国内镜像一样），
    // 下载要近一小时且必然中途失败，游戏根本打不开。
    //
    // embedding.js / embedding-worker.js 保留完好。若要恢复语义兜底，
    // 改成命中失败时按需懒加载，不要放回启动路径。
    embedding: null,
    ui,
    chapterLoader: async (id) => {
      const ch = CHAPTER_REGISTRY.get(id);
      if (!ch) return null;
      if (ch.rooms) return ch.rooms;
      if (ch.loader) {
        const mod = await ch.loader();
        ch.rooms = mod.ROOMS || null;
        return ch.rooms;
      }
      return null;
    },
    preloadedChapters: PRELOADED_CHAPTERS,
    // 每回合结束由引擎回调，引擎自己不认识 localStorage。
    onAutosave: (save) => saveStore.write(save),
  });

  ui.hideLoading();

  ui.system(
    "欢迎来到 Trinity Relit — 经典 Infocom 文字冒险的中文重现。\n" +
    "你可以用中文或英文输入指令。输入「帮助」查看指令提示。\n" +
    "进度每回合自动保存，可随时关掉页面。\n"
  );

  await resumeOrStart(engine);

  ui.setSaveControls({
    onExport: () => {
      const save = engine.serialize();
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      ui.downloadJSON(`trinity-save-${stamp}-${engine.state.turns}turns.json`,
                      JSON.stringify(save, null, 2));
      ui.system("已导出存档文件。");
    },

    onImport: async () => {
      const text = await ui.pickJSONFile();
      if (text == null) return;
      let save;
      try {
        save = parseSaveFile(text);
      } catch (err) {
        ui.system(`导入失败：${err.message}`);
        return;
      }
      if (!ui.confirm(`导入这个存档会覆盖当前进度。\n\n${describeSave(save)}\n\n确定吗？`)) return;
      if (!saveStore.write(save)) {
        ui.system("导入失败：无法写入本地存储。");
        return;
      }
      // 直接重载而不是就地读档：否则屏幕上还留着上一局的文字，
      // 玩家分不清哪些是当前进度的。
      ui.reload();
    },

    onRestart: () => {
      if (!ui.confirm("重新开始会清除当前存档，且无法撤销。\n如果想留着，请先导出存档。\n\n确定吗？")) return;
      saveStore.clear();
      ui.reload();
    },
  });

  ui.enableInput((input) => engine.processInput(input));
}

// 有存档就问，没有就直接开局。
async function resumeOrStart(engine) {
  const save = saveStore.read();
  if (!save) { engine.describeRoom(); return; }

  const choice = await ui.askResume(describeSave(save));
  if (choice !== "continue") {
    saveStore.clear();
    engine.describeRoom();
    return;
  }

  try {
    await engine.deserialize(save);
  } catch (err) {
    // 存档读不了就说清楚原因并从头开始，不要卡在半截状态里。
    console.error("读档失败", err);
    ui.system(`存档无法读取（${err.message}），只能从头开始。`);
    saveStore.clear();
    engine.describeRoom();
    return;
  }

  ui.system("—— 已回到上次离开的地方 ——");
  // 用 describeRoom 而非 moveTo：读档只还原状态，不重放 onEnter 的副作用。
  engine.describeRoom();
}

boot().catch((err) => {
  ui.setLoading(`启动失败: ${err.message}`, 0);
  console.error(err);
});
