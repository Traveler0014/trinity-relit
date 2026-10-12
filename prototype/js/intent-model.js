// 按需 Worker；不在构造时下载模型或依赖。
export class LocalIntentResolver {
  constructor({ workerFactory = () => new Worker(new URL('./intent-worker.js', import.meta.url), { type: 'module' }) } = {}) {
    this.workerFactory = workerFactory;
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
  }

  resolve(request, { signal, onProgress } = {}) {
    if (signal?.aborted) return Promise.reject(new Error('Cancelled'));
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = ({ data }) => {
        const entry = this.pending.get(data.id);
        if (!entry) return;
        if (data.type === 'progress') { entry.progress?.(data.progress); return; }
        this.pending.delete(data.id);
        entry.cleanup();
        if (data.type === 'result') entry.resolve(data.result);
        else entry.reject(new Error('Model unavailable'));
      };
      this.worker.onerror = () => this.dispose();
      this.worker.onmessageerror = () => this.dispose();
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (signal.reason !== 'timeout') { this.dispose(); return; }
        // 超时只放弃本次输入；保留正在下载的模型，避免慢网每次从头开始。
        this.pending.delete(id);
        cleanup();
        reject(new Error('Recognition timed out; model preparation continues'));
      };
      const cleanup = () => signal?.removeEventListener('abort', abort);
      this.pending.set(id, { resolve, reject, progress: onProgress, cleanup });
      signal?.addEventListener('abort', abort, { once: true });
      try { this.worker.postMessage({ id, request }); }
      catch { this.dispose(); }
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    for (const entry of this.pending.values()) {
      entry.cleanup();
      entry.reject(new Error('Model unavailable or cancelled'));
    }
    this.pending.clear();
  }
}
