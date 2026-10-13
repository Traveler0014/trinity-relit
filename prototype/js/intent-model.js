// 按需 Worker；不在构造时下载模型或依赖。
// 失败的阶段与原始信息会跟错误一起回传，供上层区分
// 「网络下载失败 / 初始化失败 / 推理失败 / Worker 起不来」。
export class LocalIntentResolver {
  constructor({ workerFactory = () => new Worker(new URL('./intent-worker.js', import.meta.url), { type: 'module' }), onDebug, onFailure } = {}) {
    this.workerFactory = workerFactory;
    this.onDebug = onDebug;
    this.onFailure = onFailure;
    this.worker = null;
    this.readyLanguages = new Set();
    this.pending = new Map();
    this.sequence = 0;
  }

  resolve(request, { signal, onProgress } = {}) {
    if (signal?.aborted) return Promise.reject(new Error('Cancelled'));
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = ({ data }) => {
        // 库内部的非致命错误走调试通道，不影响正在进行或待决的请求。
        if (data.type === 'debug') { this.onDebug?.(data.message); return; }
        // 初始化可能在某次请求超时后完成，就绪状态不依赖该请求仍在等待。
        if (data.type === 'ready') { this.readyLanguages.add(data.language); return; }
        const entry = this.pending.get(data.id);
        if (!entry) return;
        if (data.type === 'progress') { entry.progress?.(data.progress); return; }
        this.pending.delete(data.id);
        entry.cleanup();
        if (data.type === 'result') entry.resolve(data.result);
        else {
          // 带上失败阶段与原始信息，既交给上层兜底，也上报给诊断通道。
          const failure = { stage: data.stage, message: data.message || 'Model unavailable' };
          this.onFailure?.(failure);
          entry.reject(Object.assign(new Error(failure.message), {
            name: 'IntentModelError', stage: failure.stage,
          }));
        }
      };
      // Worker 自身起不来（脚本/资源/线程级错误）也算「识别组件」问题，
      // 不能退化成没有阶段的通用错误。
      this.worker.onerror = (event) => {
        this.onFailure?.({ stage: 'worker', message: event?.message || 'Worker failed to start' });
        this.dispose('worker');
      };
      this.worker.onmessageerror = () => {
        this.onFailure?.({ stage: 'worker', message: 'Worker message could not be read' });
        this.dispose('worker');
      };
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (!['timeout', 'request-cancelled'].includes(signal.reason)) { this.dispose(); return; }
        // 超时只放弃本次输入；保留正在下载的模型，避免慢网每次从头开始。
        this.pending.delete(id);
        cleanup();
        reject(new Error(signal.reason === 'timeout'
          ? 'Recognition timed out; model preparation continues'
          : 'Recognition request cancelled; model retained'));
      };
      const cleanup = () => signal?.removeEventListener('abort', abort);
      this.pending.set(id, { resolve, reject, progress: onProgress, cleanup });
      signal?.addEventListener('abort', abort, { once: true });
      try { this.worker.postMessage({ id, request }); }
      catch { this.dispose('worker'); }
    });
  }

  dispose(reason) {
    this.worker?.terminate();
    this.worker = null;
    this.readyLanguages.clear();
    for (const entry of this.pending.values()) {
      entry.cleanup();
      entry.reject(Object.assign(new Error('Model unavailable or cancelled'), {
        name: 'IntentModelError', stage: reason,
      }));
    }
    this.pending.clear();
  }
}
