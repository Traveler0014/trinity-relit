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

  intentProgress(cancel) {
    const box = document.createElement("div");
    box.className = "intent-panel system-msg";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    status.textContent = "正在理解你的意思…首次使用需下载语言模型，可取消并使用标准指令。";
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = "取消识别";
    button.addEventListener("click", cancel, { once: true });
    box.append(status, button);
    this._appendEl(box);
    return {
      update: (progress) => {
        if (progress.status === "recognizing") status.textContent = "正在理解你的意思…";
        else if (progress.status === "progress" && Number.isFinite(progress.progress)) {
          status.textContent = `正在准备${progress.language === "zh" ? "中文" : "英文"}识别 · 当前文件 ${Math.round(progress.progress)}%（可取消）`;
        }
      },
      close: () => box.remove(),
    };
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
