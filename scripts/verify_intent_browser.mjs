// 可选真实模型验收；先 prepare:models 并启动开发服务器。需安装 Playwright，或 --playwright 指向已有模块。
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const playwright = option('--playwright', 'playwright');
const { chromium } = await import(playwright === 'playwright' ? playwright : pathToFileURL(resolve(playwright)).href);
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({headless:true});
try {
const page=await browser.newPage({viewport:{width:1250,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(option('--url', 'http://127.0.0.1:8081/'));
const results=await page.evaluate(async()=>{
 const local = name => new URL(`js/${name}`, location.href).href;
 const {GameEngine}=await import(local('engine.js'));
 const {Parser}=await import(local('parser.js'));
 const {ITEMS}=await import(local('data/items.js'));
 const {ROOMS}=await import(local('data/prologue.js'));
 const {buildIntentCandidates,needsClarification}=await import(local('intent.js'));
 const noop=()=>{};const ui=Object.fromEntries(['text','location','userInput','system','inventory'].map(k=>[k,noop]));
 const cases=[
  ['round_pond','把水面上那只折出来的小鸟捞起来','event:take_paper_bird'],
  ['round_pond','把漂在水里的纸鹤捞上岸','event:take_paper_bird'],
  ['round_pond','看看那只漂着的折纸小动物','item:examine:paper_bird'],
  ['lancaster_gate','帮她撑伞','event:help_umbrella_woman'],
  ['lancaster_gate','老太太开伞挺费劲，我想帮一把','event:help_umbrella_woman'],
  ['lancaster_gate','去帮那位老人把伞打开','event:help_umbrella_woman'],
  ['round_pond','Could you scoop that folded bird out of the pond','event:take_paper_bird'],
  ['lancaster_gate','Lend the elderly lady a hand with her umbrella','event:help_umbrella_woman'],
  ['round_pond','不要拿纸鸟',null],
  ['round_pond','拿了纸鸟会怎样？',null],
  ['round_pond','拿纸鸟还是看看池塘',null],
  ['round_pond','asdfqwerty123',null],
  ['round_pond','今天股票涨了吗',null],
 ];
 const worker=new Worker(local('intent-worker.js'),{type:'module'});
 const output=[];
 for(let i=0;i<cases.length;i++){
  const [room,input,expected]=cases[i];const start=performance.now();
  if(needsClarification(input)){output.push({input,expected,result:'clarify',pass:expected===null});continue}
  const eng=new GameEngine({rooms:ROOMS,items:ITEMS,parser:new Parser(),ui});eng.moveTo(room);
  const candidates=buildIntentCandidates(eng).map(({id,examples})=>({id,examples}));
  const response=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('model timeout')),90000);
   worker.onmessage=({data})=>{if(data.type==='result'||data.type==='error'){clearTimeout(timer);resolve(data)}};
   worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message))};
   worker.postMessage({id:i,request:{input,candidates}});
  });
  output.push({input,expected,response,ms:Math.round(performance.now()-start),pass:expected ? response.result?.candidateIds?.includes(expected)===true : response.result?.kind==='none'});
 }
 worker.terminate();return output;
});
writeFileSync(option('--output', '/tmp/trinity-semantic-eval.json'),JSON.stringify({results,errors},null,2));
console.log(`Intent corpus: ${results.filter(r => r.pass).length}/${results.length}; page errors: ${errors.length}`);
for(const r of results.filter(r => !r.pass)) console.log(JSON.stringify(r));
if (errors.length || results.some(r => !r.pass)) process.exitCode = 1;
} finally { await browser.close(); }
