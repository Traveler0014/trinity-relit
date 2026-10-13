// ═══════════════════════════════════════════════════
//  UI 渲染层
// ═══════════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);
const MAX_LOG_NODES = 500;

// 场景文本里英文原文和中文译文是同一个字符串，以空行分段。站点上两者
// 用亮暗区分（原文亮，译文暗），这里按段落还原同一层次：含汉字的段落
// 视作译文。中文段里夹着 "BBC"、"Broad Walk" 这类拉丁词不影响判断，
// 英文段则不含汉字。
const HAS_CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

// 只由本模块生成布局标签；任何外部文本都不得作为 HTML 解释。
const escapeText = (value) => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);

// 进度文案里给文件起个中文名字，玩家才知道百分比变化是换了文件。
const FILE_LABELS = [
  [/onnx\/.*\.onnx$/, "模型权重"],
  [/^tokenizer(_config)?\.json$/, "分词器"],
  [/^config\.json$/, "模型配置"],
];
function fileLabel(file) {
  return FILE_LABELS.find(([pattern]) => pattern.test(file))?.[1] || String(file).split("/").pop() || "识别资源";
}

function splitByLanguage(t) {
  return String(t)
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const lang = HAS_CJK.test(para) ? "zh" : "en";
      return `<div class="scene-text lang-${lang}">${escapeText(para)}</div>`;
    })
    .join("");
}

export const ui = {
  _appendEl(el) {
    const out = $("#output");
    out.appendChild(el);

    // 防止长时间游玩后日志 DOM 过大导致滚动和输入卡顿。
    while (out.childNodes.length > MAX_LOG_NODES) {
      out.removeChild(out.firstChild);
    }
    out.scrollTop = out.scrollHeight;
    return el;
  },

  _append(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    return this._appendEl(el);
  },

  location(name, cn) {
    this._append(`<div class="location">${escapeText(name)}（${escapeText(cn)}）</div>`);
  },

  text(t) {
    this._append(splitByLanguage(t));
  },

  userInput(t) {
    this._append(`<div class="user-input">${escapeText(t)}</div>`);
  },

  system(t) {
    this._append(`<div class="system-msg">${escapeText(t)}</div>`);
  },

  inventory(t) {
    this._append(`<div class="inventory-display">${escapeText(t)}</div>`);
  },

  debug(topMatches) {
    if (!topMatches || topMatches.length === 0) return;
    const lines = topMatches
      .map(m => `${escapeText(m.id)}: ${m.score.toFixed(3)} (← "${escapeText(m.trigger)}")`)
      .join("<br>");
    const vis = ($("#debug-toggle")?.textContent || "").includes("开");
    this._append(`<div class="debug-info ${vis ? "visible" : ""}">${lines}</div>`);
  },

  setLoading(status, pct) {
    const s = $("#loading-status");
    const p = $("#loading-progress");
    if (s) s.textContent = status;
    if (p && pct != null) p.style.width = `${pct}%`;
  },

  hideLoading() {
    const el = $("#loading");
    if (el) el.style.display = "none";
  },

  // ── 存档相关 ──

  // 开局询问是否续玩。返回 "continue" | "restart"。
  askResume(summary) {
    return new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "resume-prompt";

      const line = document.createElement("div");
      line.className = "resume-summary";
      // 用 textContent 而非 innerHTML：摘要的内容来自存档文件，
      // 导入的存档可能是别人给的，不能让它往页面里注入标记。
      line.textContent = `发现上次的存档 —— ${summary}`;
      box.appendChild(line);

      const row = document.createElement("div");
      row.className = "resume-actions";

      const choose = (label, value) => {
        const b = document.createElement("button");
        b.className = "btn" + (value === "continue" ? " btn-primary" : "");
        b.textContent = label;
        b.addEventListener("click", () => {
          row.replaceWith(Object.assign(document.createElement("div"), {
            className: "resume-chosen",
            textContent: `· ${label}`,
          }));
          resolve(value);
        });
        return b;
      };

      row.appendChild(choose("继续上次冒险", "continue"));
      row.appendChild(choose("重新开始", "restart"));
      box.appendChild(row);
      this._appendEl(box);
    });
  },

  // 把存档存成文件交给玩家。浏览器不允许直接写磁盘，走 Blob 下载。
  downloadJSON(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 立刻 revoke 在部分浏览器上会打断下载，延后释放。
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // 让玩家挑一个存档文件，返回文件内容文本；取消则返回 null。
  pickJSONFile() {
    return new Promise((resolve) => {
      const inp = $("#save-file-input");
      if (!inp) { resolve(null); return; }
      // 选同一个文件两次也要能触发 change，先清空。
      inp.value = "";
      const onChange = () => {
        inp.removeEventListener("change", onChange);
        const file = inp.files && inp.files[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      inp.addEventListener("change", onChange);
      inp.click();
    });
  },

  setSaveControls({ onExport, onImport, onRestart }) {
    const bind = (sel, fn) => {
      const el = $(sel);
      if (el && fn) el.addEventListener("click", fn);
    };
    bind("#btn-export", onExport);
    bind("#btn-import", onImport);
    bind("#btn-restart", onRestart);
  },

  confirm(msg) {
    return window.confirm(msg);
  },

  reload() {
    window.location.reload();
  },

  // 决策层接管进度呈现（同意门控与取消语义都在它那里）后，这里不再自建面板。
  intentProgress(cancel) {
    return this._semantic ? null : this.intentPanel(cancel);
  },

  // 决策层自己制面板时用（同意开启后、或已开启时的每一次识别）。
  semanticProgress(cancel) {
    return this.intentPanel(cancel);
  },

  intentPanel(cancel) {
    const box = document.createElement("div");
    box.className = "intent-panel system-msg";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    status.textContent = "正在理解你的意思…可取消并使用标准指令。";
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = "取消识别";
    button.addEventListener("click", cancel, { once: true });
    box.append(status, button);
    this._appendEl(box);
    return {
      update: (progress) => {
        if (progress.status === "recognizing") status.textContent = "正在理解你的意思…";
        else if (progress.status === "loading") status.textContent = "首次使用正在准备语言模型，慢网可能需要几分钟；可以取消并使用标准指令。";
        else if (progress.status === "preparing") status.textContent = "正在复用已加载或正在准备的语言模型…";
        else if (progress.status === "initializing") status.textContent = "资源已接收，正在初始化语言模型（首次较慢），可取消…";
        else if (progress.status === "mirror") status.textContent = "模型源站不可用，正在切换镜像下载…";
        else if (progress.status === "progress") {
          // 库按 loaded/total 算百分比：响应头长度缺失（gzip 分块）或只是压缩长度时，
          // total 会被顶成当前 loaded，百分比提前变 100%。只展示已接收量，
          // 完成与否以 done / initializing / recognizing 事件为准。
          const received = Number.isFinite(progress.loaded) ? ` · 已接收 ${(progress.loaded / 1048576).toFixed(1)} MB` : "";
          status.textContent = `正在下载${progress.language === "zh" ? "中文" : "英文"}识别资源：${fileLabel(progress.file)}${received}（可取消）`;
        }
      },
      close: () => box.remove(),
    };
  },

  // 仅调试面板可见的技术明细（失败阶段 + 原始错误），玩家默认看不到。
  semanticDebug(text) {
    const el = document.createElement("div");
    const visible = ($("#debug-toggle")?.textContent || "").includes("开");
    el.className = `debug-info${visible ? " visible" : ""}`;
    el.textContent = text;
    this._appendEl(el);
  },

  // 失败提示后的轻量入口：归因小字 + 一个小链接，详细说明在弹窗里。
  semanticHint() {
    if (!this._semantic) return;
    const line = document.createElement("div");
    line.className = "hint-line";
    const cause = this._semantic.cause?.();
    if (cause) {
      const note = document.createElement("span");
      note.className = "hint-cause";
      note.textContent = cause;
      line.append(note, document.createTextNode(" · "));
    }
    const link = document.createElement("button");
    link.type = "button";
    link.className = "hint-link";
    link.textContent = "更多";
    // 不设 once：关掉菜单后同一条目还能再点开。
    link.addEventListener("click", () => this._semantic.onMore());
    line.appendChild(link);
    this._appendEl(line);
  },

  // 通用确认菜单：标题 + 说明 + 动作按钮，右上角 × 关闭，Escape 视为取消。
  // 同时只允许一个，避免旧日志里的「更多」叠加出多个面板。
  semanticDialog({ title, body, actions, signal }) {
    if (signal?.aborted || this._dialogOpen) return Promise.resolve(null);
    return new Promise(resolve => {
      this._dialogOpen = true;
      const box = document.createElement("div");
      box.className = "intent-panel system-msg";
      const head = document.createElement("div");
      head.className = "dialog-head";
      const heading = document.createElement("div");
      heading.className = "dialog-title";
      heading.textContent = title;
      const close = document.createElement("button");
      close.type = "button";
      close.className = "dialog-close";
      close.textContent = "×";
      close.setAttribute("aria-label", "关闭");
      head.append(heading, close);
      const content = document.createElement("div");
      content.className = "dialog-body";
      content.textContent = body;
      const row = document.createElement("div");
      row.className = "dialog-actions";
      let finished = false;
      const abort = () => finish(null);
      const finish = (action) => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener("abort", abort);
        this._dialogOpen = false;
        box.replaceChildren(Object.assign(document.createElement("div"), {
          className: "resume-chosen",
          textContent: `· ${action?.done || "已关闭"}`,
        }));
        resolve(action ? action.value : null);
      };
      signal?.addEventListener("abort", abort, { once: true });
      close.addEventListener("click", () => finish(null), { once: true });
      for (const action of actions) {
        const button = document.createElement("button");
        button.className = "btn" + (action.primary ? " btn-primary" : "");
        button.textContent = action.label;
        button.addEventListener("click", () => finish(action), { once: true });
        row.appendChild(button);
      }
      box.append(head, content, row);
      this._appendEl(box);
      box.addEventListener("keydown", event => { if (event.key === "Escape") finish(null); });
      // 不聚焦主按钮：提交命令的回车尚未抬起时对话框已出现，
      // 焦点在主按钮上会被同一/下一次回车误触发送动作。
      // 聚焦容器本身：Escape 直接可用，按钮用 Tab 到达。
      box.tabIndex = -1;
      box.focus();
    });
  },

  // 语义层注入：失败提示找得到弹菜单的回调与归因。
  setSemanticControls({ onMore, cause }) {
    this._semantic = { onMore, cause };
  },

  chooseIntent(choices) {
    return new Promise(resolve => {
      const box = document.createElement("div");
      box.className = "intent-panel system-msg";
      const title = document.createElement("div");
      title.textContent = choices.length === 1 ? "你是想这样做吗？" : "你想做哪一个动作？";
      box.appendChild(title);
      const finish = (id, label) => {
        box.replaceChildren(document.createTextNode(label));
        resolve(id);
      };
      for (const { id, label } of choices) {
        const button = document.createElement("button");
        button.className = "btn";
        button.textContent = label;
        button.addEventListener("click", () => finish(id, `已选择：${label}`), { once: true });
        box.appendChild(button);
      }
      const cancel = document.createElement("button");
      cancel.className = "btn";
      cancel.textContent = "都不是，重新输入";
      cancel.addEventListener("click", () => finish(null, "已取消识别"), { once: true });
      box.appendChild(cancel);
      this._appendEl(box);
      box.addEventListener("keydown", event => { if (event.key === "Escape") finish(null, "已取消识别"); });
      box.querySelector("button")?.focus();
    });
  },

  enableInput(handler) {
    const inp = $("#input");
    inp.disabled = false;
    inp.focus();
    inp.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const val = inp.value.trim();
      if (!val) return;
      inp.value = "";
      inp.disabled = true;
      try { await handler(val); }
      catch (error) {
        console.error("指令处理失败", error);
        this.system("处理指令时遇到问题，请重试。");
      } finally { inp.disabled = false; inp.focus(); }
    });
  },
};
