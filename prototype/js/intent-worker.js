import { rankIntentScores, INTENT_MIN_SCORE } from './intent-ranking.js';

const MODELS = { zh: 'Xenova/bge-small-zh-v1.5', en: 'Xenova/bge-small-en-v1.5' };
// 远程回退顺序：官方源不可达时换镜像；切过一次后本次会话优先用镜像。
const REMOTE_HOSTS = ['https://huggingface.co', 'https://hf-mirror.com'];
const HAN = /[\u3400-\u9fff]/;
const models = new Map();
const ready = new Set();   // 已就绪的语言；models 里可能只是加载中的 Promise
const vectors = new Map();
let runtime;
let hostIndex = 0;
// 失败阶段，随错误一起回传主线程，用于区分网络失败 / 初始化失败 / 推理失败。
let stage = 'idle';

// 库内部（如 transformers 自己的 fetch）偶发的未处理 rejection 不应被浏览器升级成
// Worker 级 error 事件：那会让主线程丢掉已捕获的失败阶段，并把整个 Worker 一起回收
// ——正在进行的模型下载也随之作废。这里拦下来，转交调试通道。
self.addEventListener('unhandledrejection', event => {
  event.preventDefault();
  self.postMessage({ type: 'debug', message: `未处理的 Promise 拒绝：${String(event.reason?.message || event.reason).slice(0, 200)}` });
});

// 模型缓存包含进行中的 Promise；超时后重试也共用同一次初始化。
const progressListeners = new Map();
const latestProgress = new Map();

async function createPipeline(pipeline, env, local, language, onProgress) {
  if (local) {
    stage = 'download';
    return pipeline('feature-extraction', MODELS[language], { quantized: true, progress_callback: onProgress });
  }
  const hosts = [...REMOTE_HOSTS.slice(hostIndex), ...REMOTE_HOSTS.slice(0, hostIndex)];
  let lastError;
  for (let i = 0; i < hosts.length; i++) {
    env.remoteHost = hosts[i];
    stage = 'download';
    try {
      return await pipeline('feature-extraction', MODELS[language], { quantized: true, progress_callback: onProgress });
    } catch (error) {
      lastError = error;
      hostIndex = (hostIndex + 1) % REMOTE_HOSTS.length;
      if (i < hosts.length - 1) onProgress({ status: 'mirror' });
    }
  }
  throw lastError;
}

async function loadModel(language, progress) {
  const listeners = progressListeners.get(language) || new Set();
  progressListeners.set(language, listeners);
  listeners.add(progress);
  if (latestProgress.has(language)) progress(latestProgress.get(language));
  if (!models.has(language)) {
    const emit = value => {
      latestProgress.set(language, value);
      for (const listener of listeners) listener(value);
    };
    const loading = (async () => {
      if (!runtime) {
        stage = 'runtime';
        runtime ||= import('../vendor/intent/transformers.min.js').then(module => ({ module, local:true }))
          .catch(() => import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js').then(module => ({ module, local:false })))
          .catch(() => import('https://unpkg.com/@xenova/transformers@2.17.2/dist/transformers.min.js').then(module => ({ module, local:false })));
      }
      const { module: { pipeline, env }, local } = await runtime.catch(error => { runtime = null; throw error; });
      env.allowLocalModels = local;
      if (local) {
        env.localModelPath = new URL('../vendor/intent/models/', import.meta.url).href;
        env.backends.onnx.wasm.wasmPaths = new URL('../vendor/intent/', import.meta.url).href;
      }
      env.backends.onnx.wasm.numThreads = 1;
      // 权重下完到推理会话建好之间没有任何进度事件（界面会停在最后一个百分比），
      // 用 onnx 文件的 done 当分界补发一个「正在初始化」阶段，而不是让每个小文件
      // 的 done 都去改写状态。
      const onProgress = value => {
        if (value.status === 'done' && typeof value.file === 'string' && value.file.endsWith('.onnx')) {
          stage = 'initializing';
          emit({ status: 'initializing' });
        }
        emit(value);
      };
      const model = await createPipeline(pipeline, env, local, language, onProgress);
      ready.add(language);
      self.postMessage({ type: 'ready', language });
      return model;
    })();
    models.set(language, loading);
    // 失败时允许后续明确重试；已成功的模型和下载中的模型均保留。
    loading.catch(() => { models.delete(language); latestProgress.delete(language); });
  }
  try { return await models.get(language); }
  finally { listeners.delete(progress); }
}

async function embedBatch(model, language, texts) {
  const missing = [...new Set(texts)].filter(t => !vectors.has(`${language}:${t}`));
  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    const output = await model(batch, { pooling: 'cls', normalize: true });
    const rows = output.tolist();
    batch.forEach((t, j) => vectors.set(`${language}:${t}`, rows[j]));
  }
  return texts.map(t => vectors.get(`${language}:${t}`));
}

self.onmessage = async ({ data: { id, request } }) => {
  try {
    const language = HAN.test(request.input) ? 'zh' : 'en';
    const progress = value => self.postMessage({ id, type: 'progress', progress: { ...value, language } });
    // 已就绪的模型直接进入识别；只有首次加载/正在加载才提示准备状态。
    if (!ready.has(language)) progress({ status: models.has(language) ? 'preparing' : 'loading' });
    const model = await loadModel(language, progress);
    progress({ status: 'recognizing' });
    stage = 'infer';
    const entries = request.candidates.flatMap(candidate => {
      const examples = candidate.examples.filter(t => HAN.test(t) === (language === 'zh'));
      return examples.slice(0, 16).map(text => ({ id: candidate.id, text }));
    });
    const embedded = await embedBatch(model, language, [request.input, ...entries.map(x => x.text)]);
    const query = embedded[0];
    const scores = new Map();
    entries.forEach((entry, i) => {
      const score = embedded[i + 1].reduce((sum, x, j) => sum + x * query[j], 0);
      scores.set(entry.id, Math.max(scores.get(entry.id) ?? -1, score));
    });
    const ranked = [...scores].map(([candidateId, score]) => ({ id: candidateId, score }));
    self.postMessage({ id, type: 'result', result: rankIntentScores(ranked, { minScore: INTENT_MIN_SCORE[language] }), scores: ranked.sort((a, b) => b.score - a.score).slice(0, 5) });
    // 长游戏不无限缓存输入和章节示例。
    if (vectors.size > 2048) vectors.clear();
  } catch (error) {
    // 不能把原因吞掉：主线程要能区分加载 / 下载 / 初始化 / 推理失败。
    self.postMessage({ id, type: 'error', stage, message: String(error?.message || error).slice(0, 200) });
  }
};
