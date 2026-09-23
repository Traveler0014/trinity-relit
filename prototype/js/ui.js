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

function splitByLanguage(t) {
  return String(t)
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const lang = HAS_CJK.test(para) ? "zh" : "en";
      return `<div class="scene-text lang-${lang}">${para}</div>`;
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
    this._append(`<div class="location">${name}（${cn}）</div>`);
  },

  text(t) {
    this._append(splitByLanguage(t));
  },

  userInput(t) {
    this._append(`<div class="user-input">${t}</div>`);
  },

  system(t) {
    this._append(`<div class="system-msg">${t}</div>`);
  },

  inventory(t) {
    this._append(`<div class="inventory-display">${t}</div>`);
  },

  debug(topMatches) {
    if (!topMatches || topMatches.length === 0) return;
    const lines = topMatches
      .map(m => `${m.id}: ${m.score.toFixed(3)} (← "${m.trigger}")`)
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
      await handler(val);
      inp.disabled = false;
      inp.focus();
    });
  },
};
