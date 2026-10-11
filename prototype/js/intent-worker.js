import { rankIntentScores, INTENT_MIN_SCORE } from './intent-ranking.js';

const MODELS = { zh: 'Xenova/bge-small-zh-v1.5', en: 'Xenova/bge-small-en-v1.5' };
const HAN = /[\u3400-\u9fff]/;
const models = new Map();
const vectors = new Map();
let runtime;

async function loadModel(language, progress) {
  if (models.has(language)) return models.get(language);
  // 固定版本，初次语义请求才 import；首页与标准命令不等待 CDN。
  runtime ||= import('../vendor/intent/transformers.min.js').then(module => ({ module, local:true }))
    .catch(() => import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js').then(module => ({ module, local:false })))
    .catch(() => import('https://unpkg.com/@xenova/transformers@2.17.2/dist/transformers.min.js').then(module => ({ module, local:false })));
  const { module: { pipeline, env }, local } = await runtime.catch(error => { runtime = null; throw error; });
  env.allowLocalModels = local;
  if (local) {
    env.localModelPath = new URL('../vendor/intent/models/', import.meta.url).href;
    env.backends.onnx.wasm.wasmPaths = new URL('../vendor/intent/', import.meta.url).href;
  }
  env.backends.onnx.wasm.numThreads = 1;
  const model = await pipeline('feature-extraction', MODELS[language], {
    quantized: true, progress_callback: progress,
  });
  models.set(language, model);
  return model;
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
    progress({ status: 'loading' });
    const model = await loadModel(language, progress);
    progress({ status: 'recognizing' });
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
  } catch {
    self.postMessage({ id, type: 'error' });
  }
};
