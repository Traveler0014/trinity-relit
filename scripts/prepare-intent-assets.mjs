// 固定依赖版本的静态资源准备；模型只在部署/开发机下载，不进 Git 历史。
import { mkdir, stat, rename, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const root = resolve('prototype/vendor/intent');
const hostArg = process.argv.indexOf('--model-host');
const modelHost = hostArg < 0 ? 'https://huggingface.co' : process.argv[hostArg + 1];
if (!['https://huggingface.co', 'https://hf-mirror.com'].includes(modelHost)) throw new Error('Unsupported model host');
const base = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const modelNames = { 'bge-small-zh-v1.5': '75c43b069aac4d136ba6bc1122f995fedcfd2781', 'bge-small-en-v1.5': 'ea104dacec62c0de699686887e3f920caeb4f3e3' };
const files = [
  ['transformers.min.js', `${base}/dist/transformers.min.js`],
  ['ort-wasm-simd.wasm', `${base}/dist/ort-wasm-simd.wasm`],
  ['ort-wasm.wasm', `${base}/dist/ort-wasm.wasm`],
  ['TRANSFORMERS-LICENSE', `${base}/LICENSE`],
  ['ONNX-LICENSE', 'https://raw.githubusercontent.com/microsoft/onnxruntime/v1.14.0/LICENSE'],
];
for (const [model, revision] of Object.entries(modelNames)) {
  for (const name of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']) {
    files.push([`models/Xenova/${model}/${name}`, `${modelHost}/Xenova/${model}/resolve/${revision}/${name}`]);
  }
  files.push([`models/Xenova/${model}/README.md`, `${modelHost}/Xenova/${model}/resolve/${revision}/README.md`]);
}
files.push(['BGE-LICENSE', 'https://raw.githubusercontent.com/FlagOpen/FlagEmbedding/master/LICENSE']);

const previous = await readFile(resolve(root, 'sources.json'), 'utf8').then(JSON.parse).catch(() => ({files:[]}));
const priorSources = new Map(previous.files);
const actualSources = new Map();
const canonical = url => url?.replace('https://hf-mirror.com/', 'https://huggingface.co/');

async function download([relative, url]) {
  const target = resolve(root, relative);
  const oldUrl = priorSources.get(relative);
  if (canonical(oldUrl) === canonical(url) && await stat(target).then(s => s.size > 0).catch(() => false)) {
    actualSources.set(relative, oldUrl);
    return;
  }
  await mkdir(dirname(target), { recursive:true });
  await new Promise((done, fail) => {
    const child = spawn('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--connect-timeout', '20', '--max-time', '600', '--output', `${target}.partial`, url], { stdio:'inherit' });
    child.on('error',fail);
    child.on('exit',code => code === 0 ? done() : fail(new Error(`${relative}: download failed (${code})`)));
  });
  await rename(`${target}.partial`,target);
  actualSources.set(relative, url);
  console.log(`Ready: ${relative}`);
}
// 避免一次发出十多个模型下载请求；失败时保留成功文件供重试。
for (let i=0;i<files.length;i+=3) await Promise.all(files.slice(i,i+3).map(download));
await writeFile(resolve(root,'sources.json'),JSON.stringify({preparedAt:new Date().toISOString(),files:[...actualSources]},null,2));
console.log('Intent assets ready. The game remains a static site.');
