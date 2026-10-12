// ═══════════════════════════════════════════════════
//  语义识别的失败说明层
//  · 记住最近一条未得到判定的输入，供「重试刚才的输入」使用；
//  · 把失败阶段翻成玩家能懂的一句话，挂在失败提示后面；
//  · 「更多」菜单承载完整说明与重试（设置面板落地前的过渡形态）。
//  只观察与说明，不改变执行行为：超时与用户取消由引擎自己的
//  文案负责，这里不重复播报。
// ═══════════════════════════════════════════════════

const CAUSES = {
  runtime: { cause: "识别组件加载失败（网络或离线）", detail: "浏览器没能加载语义识别所需的运行时文件，通常是网络问题或离线" },
  worker: { cause: "识别组件加载失败（网络或离线）", detail: "语义识别的工作线程没能启动，通常是页面资源加载失败或离线" },
  download: { cause: "模型下载失败（网络或离线）", detail: "语义识别模型没能下载完整，通常是网络中断、离线或源站不可达" },
  initializing: { cause: "模型初始化失败（设备可能不支持）", detail: "模型文件已下载，但初始化推理会话失败，可能是设备或浏览器不支持所需能力" },
  infer: { cause: "识别推理出错", detail: "模型已加载，但本次推理出错" },
};
const UNAVAILABLE = { cause: "模型不可用", detail: "语义识别模型不可用" };
const NO_CLOSE_MATCH = { cause: "没有足够接近的动作可选", detail: "语义识别已执行，但当前房间里没有足够接近的可执行动作" };

export function createIntentNotice({ ui, processInput } = {}) {
  let lastQuestion = null;   // 最近一条未得到模型判定的输入
  let lastOutcome = null;    // 最近一次失败的归因
  let retryable = false;     // 只有失败（而非模型判定为不接近）才值得重试

  function rerun() {
    if (!processInput || !lastQuestion) return;
    const input = lastQuestion;
    lastQuestion = null;
    retryable = false;
    processInput(input);
  }

  // 失败提示后的小字归因；没有归因时返回 null（只显示入口）。
  const causeText = () => lastOutcome?.cause || null;

  async function openMenu() {
    if (!ui.semanticDialog) return;
    const action = await ui.semanticDialog({
      title: "语义识别",
      body:
        "语义识别只在当前房间的可执行动作里挑最接近的一个，确认后才执行。" +
        (lastOutcome ? `\n上次识别：${lastOutcome.detail}。` : "") +
        "\n本作只还原原版 Trinity 的动词表与互动——像「问」「搭话」这类动作原版里没有，" +
        "无论怎么表达都不会有回应；能做什么以房间里实际存在的事件为准。",
      actions: [
        ...(retryable && lastQuestion
          ? [{ label: "重试刚才的输入", value: "retry", primary: true, done: "正在重试" }]
          : []),
        { label: "关闭", value: null, done: "已关闭" },
      ],
    });
    if (action === "retry") rerun();
  }

  // 包在底层 resolver 外面：只记录输入与判定结果，不改变行为。
  function wrap(resolver) {
    return {
      async resolve(request, options) {
        lastQuestion = request.input;
        lastOutcome = null;
        retryable = false;
        try {
          const response = await resolver.resolve(request, options);
          if (response?.kind === "suggest") lastQuestion = null;
          else lastOutcome = NO_CLOSE_MATCH;
          return response;
        } catch (error) {
          // 超时与用户取消没有阶段，引擎已有专门文案，这里不重复。
          if (error?.stage) {
            lastOutcome = CAUSES[error.stage] || UNAVAILABLE;
            retryable = true;
          }
          throw error;
        }
      },
      dispose: (reason) => resolver.dispose(reason),
    };
  }

  return { wrap, openMenu, causeText };
}
