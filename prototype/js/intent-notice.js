// ═══════════════════════════════════════════════════
//  语义识别的决策与说明层
//  · 用户偏好由 settings.semantic（ask / on / off）裁决，
//    引擎与 UI 都不直接读写设置；将来设置面板消费同一份。
//  · 首次需要时先征求同意（本地运行、体积、低配设备风险），
//    同意才下载模型，拒绝写回 off；
//  · 「用户显式取消」＝不想在本地运行模型：停止下载、写回 off；
//    引擎超时只放弃当次请求（底层按 abort reason 区分，Worker 保留）；
//  · 失败按阶段给出可排查的归因，挂在失败提示后面；「更多」
//    菜单承载完整说明、开关与重试。
// ═══════════════════════════════════════════════════

import { settings } from "./settings.js";

const HAN = /[\u3400-\u9fff]/;
const languageOf = (input) => (HAN.test(input) ? "zh" : "en");
const MODEL_SIZE_HINT = "约 25–35 MB";

const CAUSES = {
  runtime: { cause: "识别组件加载失败（网络或离线）", detail: "浏览器没能加载语义识别所需的运行时文件，通常是网络问题或离线" },
  worker: { cause: "识别组件加载失败（网络或离线）", detail: "语义识别的工作线程没能启动，通常是页面资源加载失败或离线" },
  download: { cause: "模型下载失败（网络或离线）", detail: "语义识别模型没能下载完整，通常是网络中断、离线或源站不可达" },
  initializing: { cause: "模型初始化失败（设备可能不支持）", detail: "模型文件已下载，但初始化推理会话失败，可能是设备或浏览器不支持所需能力" },
  infer: { cause: "识别推理出错", detail: "模型已加载，但本次推理出错" },
};
const UNAVAILABLE = { cause: "模型不可用", detail: "语义识别模型不可用" };
const NO_CLOSE_MATCH = { cause: "没有足够接近的动作可选", detail: "语义识别已执行，但当前房间里没有足够接近的可执行动作" };
const NOT_ENABLED = { cause: "语义识别已关闭", detail: "语义识别当前是关闭的，自然语言只按标准指令解析" };

export function createIntentNotice({ ui, processInput } = {}) {
  let ready = new Set();   // 本次会话已就绪的语言（决定取消时丢不丢模型）
  let disposeResolver = () => {};
  let lastQuestion = null;   // 最近一条未得到模型判定的输入
  let lastOutcome = null;    // 最近一次失败的归因
  let questionIsCurrent = () => true;
  let retryable = false;     // 只有失败（而非模型判定为不接近）才值得重试

  async function rerun() {
    if (!processInput || !lastQuestion) return;
    const input = lastQuestion;
    lastQuestion = null;
    retryable = false;
    if (!questionIsCurrent()) {
      ui.system?.('游戏状态已经改变，请重新输入想执行的动作。没有消耗回合。');
      return;
    }
    await processInput(input);
  }

  function standDown(input) {
    lastQuestion = input;
    lastOutcome = NOT_ENABLED;
    retryable = false;
    return { kind: "none" };
  }

  // 失败提示后的小字归因；没有归因时返回 null（只显示入口）。
  const causeText = () => lastOutcome?.cause || null;

  const consentDialog = () => ({
    title: "启用语义识别？",
    body:
      "这句话没有对应的标准指令。可以下载一个本地语言模型来理解更自然的表达，" +
      "模型完全在浏览器内运行，不会向任何服务器发送你的输入。\n" +
      `需要下载 ${MODEL_SIZE_HINT} 的模型文件；首次使用需要等待，低配置或移动设备可能体验不佳。` +
      (typeof caches === "undefined" ? "\n当前页面无法持久缓存模型，每次打开都要重新下载。" : ""),
    actions: [
      { label: "下载并启用", value: "enable", primary: true, done: "已启用语义识别" },
      { label: "只用标准指令", value: "decline", done: "已选择只用标准指令" },
    ],
  });

  async function openMenu() {
    if (!ui.semanticDialog) return;
    const action = await ui.semanticDialog(settings.get("semantic") === "on"
      ? {
        title: "语义识别",
        body:
          (ready.size ? "语义识别已开启，模型已就绪。" : "语义识别已开启，模型尚未就绪。") +
          (lastOutcome ? `\n上次识别：${lastOutcome.detail}。` : "") +
          "\n语义识别只能从当前场景已实现的动作中提出建议。尚未实现的互动无法通过换一种表达补全，" +
          "这不代表原版 Trinity 没有该动作。" +
          "\n关闭后将只解析标准指令，随时可以重新开启。",
        actions: [
          ...(retryable && lastQuestion ? [{ label: "重试刚才的输入", value: "retry", primary: true, done: "正在重试" }] : []),
          { label: "关闭语义识别", value: "disable", done: "已关闭语义识别" },
          { label: "关闭", value: null, done: "已关闭" },
        ],
      }
      : consentDialog());
    if (action === "enable") {
      settings.set("semantic", "on");
      await rerun();
    } else if (action === "decline") {
      settings.set("semantic", "off");
    } else if (action === "disable") {
      settings.set("semantic", "off");
      ready.clear();
      disposeResolver();   // 关闭即释放模型与运行时内存
    } else if (action === "retry") {
      await rerun();
    }
  }

  // 包在底层 resolver 外面：同意门控、取消语义、失败归因都在这里裁决。
  function wrap(resolver) {
    disposeResolver = (reason) => resolver.dispose(reason);
    // 与真实 resolver 共用就绪状态；线程被释放时也会同步清空。
    ready = resolver.readyLanguages || new Set();

    return {
      async resolve(request, options = {}) {
        const input = request.input;
        const language = languageOf(input);
        if (options.signal?.aborted) return { kind: "none" };
        const isCurrent = options.isCurrent || (() => true);
        questionIsCurrent = isCurrent;
        lastQuestion = input;   // 重试前仍须核对创建请求时的游戏状态
        lastOutcome = null;
        retryable = false;
        if (settings.get("semantic") === "off") return standDown(input);

        if (settings.get("semantic") === "ask") {
          const consent = ui.semanticDialog ? await ui.semanticDialog({ ...consentDialog(), signal: options.signal }) : null;
          // 超时、取消或读档之后，旧窗口的点击不得重放输入或开启下载。
          if (options.signal?.aborted || !isCurrent()) return { kind: "none" };
          if (consent === "enable") settings.set("semantic", "on");
          else {
            if (consent === "decline") settings.set("semantic", "off");
            return standDown(input);
          }
        }

        let userCancelled = false;
        const inner = new AbortController();
        // 引擎的中止要带着 reason 转发，底层才能区分「超时保留下载」与「取消停掉」。
        const forward = () => inner.abort(options.signal?.reason);
        options.signal?.addEventListener("abort", forward, { once: true });
        const panel = ui.semanticProgress?.(() => {
          userCancelled = true;
          if (!ready.has(language)) {
            ui.system?.("已停止下载，语义识别已关闭。需要时可以点「更多」重新开启。");
          }
          inner.abort(ready.has(language) ? "request-cancelled" : undefined);
        });
        try {
          const response = await resolver.resolve(request, {
            ...options,
            signal: inner.signal,
            onProgress: (value) => { panel?.update?.(value); options.onProgress?.(value); },
          });
          ready.add(language);
          if (response?.kind === "suggest") lastQuestion = null;
          else lastOutcome = NO_CLOSE_MATCH;
          return response;
        } catch (error) {
          if (userCancelled) {
            // 下载中取消＝用户不想在本地运行模型：停止下载、关闭功能。
            // 模型已就绪时的取消只是放弃当次请求，不该把已加载的模型一起丢掉。
            if (!ready.has(language)) {
              settings.set("semantic", "off");
              disposeResolver();
              ready.clear();
            }
            lastOutcome = null;
            return { kind: "none" };
          }
          if (inner.signal.aborted || options.signal?.aborted) {
            // 引擎超时：只放弃当次，模型在后台继续准备；超时文案由引擎给出。
            if (!ready.has(language)) lastQuestion = input;
            return { kind: "none" };
          }
          if (error?.stage) {
            lastOutcome = CAUSES[error.stage] || UNAVAILABLE;
            retryable = true;
          }
          throw error;
        } finally {
          options.signal?.removeEventListener("abort", forward);
          panel?.close?.();
        }
      },
      dispose: (reason) => resolver.dispose(reason),
    };
  }

  return { wrap, openMenu, causeText };
}
