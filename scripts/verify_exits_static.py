#!/usr/bin/env python3
"""用反汇编构造与状态无关的真机出口表，与章节实现逐章比对。

为什么需要它：verify_exits_vs_zmachine.js 对非直连出口一律宽容跳过，而这类出口
占全库约 84%（717 条中的 575 条为例程）。本脚本读出每个例程的逻辑，把它们也纳入
比对。实测偏差约为该脚本报告值的 2.2 倍。

出口编码由属性字节长度决定（已在 wabe 上用真机爬行结果逐条核对）：
  2 字节  直连，值即房间号
  3 字节  纯提示阻挡，指向一个字符串（wabe 上 27/27 均不通）
  4 字节  例程。无条件分支 → 固定阻挡或固定送往 RET 的房间；有分支 → 依赖状态

方法在 wabe 上验证：与真机爬行比对 89 条一致、6 条正确识别为条件，其余差异全部是
爬虫或命名假象（黑暗房间显示 Darkness、Halfway 的方向相关显示名、同名房间）。

几个容易踩的坑，均已处理：
  · 打包地址在 v4 是 4P（Z-machine 规范 §1.2.3）。zparse.packed_addr 误用了 2P。
  · CHAPTER_PLAN 的章节概览表也是「| 序号 | `id` |」形状，序号会被误当成 obj#。
  · 同名房间（desert×9、tundra×8 等）只能按 obj# 精确映射，不能按名字。
  · 「无分支 + 调用 + 返回假」的例程须确认被调用者不移动玩家。已核对 ranch 的五个，
    调用的都是打印消息的例程。44740000/44770000 是全局通用的
    "[Which way do you want to go in/out?]" 提示。

依赖（均受版权保护，不在本仓库中，由参数传入）：
  · TRINITY.DAT 经 ztools 的 txd 反汇编得到的文本（txd -n TRINITY.DAT > trinity.dis）
  · scripts/extract_exit_truth.py 生成的 exit_truth.json

用法:
  python3 scripts/verify_exits_static.py --disasm trinity.dis \
          --truth scripts/exit_truth.json [--json out.json]

局限：
  · CHAPTER_PLAN 没有序章房间的 obj# 行，desert 的 18 个通配房间也映射不到，二者
    无法比对。序章已用 scripts/crawl_real_map.mjs 真机验证为完全一致。
  · 实现侧出口用「全部 flag 为真」的宽容探针展开，条件出口会全部显现。
"""
import argparse
import json, re, subprocess, os
ap = argparse.ArgumentParser()
ap.add_argument("--disasm", required=True, help="txd 反汇编输出")
ap.add_argument("--truth", required=True, help="extract_exit_truth.py 生成的 exit_truth.json")
ap.add_argument("--json", help="明细输出路径（只含房间 id，不含原版文字）")
args = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_URL = "file://" + os.path.join(ROOT, "prototype", "js", "data") + "/"
CH = ["prologue","wabe","japan","underground","orbit","pacific","tundra","islet","desert","ranch","finale"]
t = json.load(open(args.truth))
dis = open(args.disasm, encoding='latin-1').read().split('\n')
starts = {int(m.group(1),16): i for i,l in enumerate(dis) for m in [re.match(r'^Routine ([0-9a-f]+),', l)] if m}
BR = re.compile(r'\b(JZ|JL|JG|JE|DEC_CHK|INC_CHK|JIN|TEST|TEST_ATTR|GET_CHILD|GET_SIBLING|SCAN_TABLE)\b')
_cache = {}
def routine(hx):
    if hx in _cache: return _cache[hx]
    i = starts.get(4*int(hx[:4],16))
    if i is None: _cache[hx] = ('未知', []); return _cache[hx]
    j = i+1
    while j < len(dis) and not dis[j].startswith('Routine '): j += 1
    code = [l for l in dis[i+1:j] if l.strip()]
    rets = [int(m.group(1),16) for l in code for m in [re.search(r'\bRET\s+#([0-9a-f]+)', l)] if m]
    r = ('条件', rets) if any(BR.search(l) for l in code) else (('放行', rets) if rets else ('阻挡', []))
    _cache[hx] = r; return r

# obj# ↔ id：只取 CHAPTER_PLAN 的单值行，排除章节概览表（序号会被误当 obj#）与通配行
plan = open(os.path.join(ROOT, 'prototype', 'CHAPTER_PLAN.md'), encoding='utf-8').read()
id2obj = {}
for m in re.finditer(r'^\s*\|\s*([0-9,\s]+?)\s*\|\s*`([^`]+)`\s*\|', plan, re.M):
    objs, rid = m.group(1), m.group(2)
    if rid in CH or ',' in objs or '*' in rid: continue
    id2obj[rid] = int(objs)
obj2id = {v: k for k, v in id2obj.items()}
ND = {'up':'u','down':'d'}

# 全部章节的实现出口装进一张表，跨章目标才能对上
impl, room_ch = {}, {}
for ch in CH:
    out = subprocess.run(['node','-e',f'''
import("{DATA_URL}{ch}.js").then(m=>{{
 const p=new Proxy({{room:"",flags:new Set()}},{{get:(t,k)=>k in t?t[k]:["has","carrying","inPocket","wearing","inRoom","hasFlag"].includes(k)?()=>true:k==="cnt"?()=>1:()=>undefined}});
 const o={{}};for(const [id,r] of Object.entries(m.ROOMS)){{p.room=id;let e={{}};try{{e=(typeof r.exits==="function"?r.exits(p):r.exits)||{{}}}}catch{{}}
 o[id]={{}};for(const [d,x] of Object.entries(e)){{const to=typeof x==="object"?x.to:x;if(to&&to!==id)o[id][d]=to;}}}}
 console.log(JSON.stringify(o));}});'''], capture_output=True, text=True).stdout
    for rid, ex in json.loads(out).items(): impl[rid] = ex; room_ch[rid] = ch

def real_exits(o):
    r, res = t[str(o)], {}
    for d, tg in r.get('exits', {}).items(): res[ND.get(d,d)] = ('通往', tg)
    for d, hx in r.get('opaque', {}).items():
        dd = ND.get(d,d)
        if len(hx)//2 == 3: res[dd] = ('阻挡',)
        else:
            k, rets = routine(hx)
            res[dd] = ('通往', rets[0]) if k=='放行' else ('阻挡',) if k=='阻挡' else ('条件', rets) if k=='条件' else ('未知',)
    return res

rows, details = [], {}
tot = dict(房间=0,已映射=0,一致=0,缺失=0,目标不同=0,凭空=0,条件=0,无法比对=0)
for ch in CH:
    ids = [r for r, c in room_ch.items() if c == ch]
    mapped = [r for r in ids if r in id2obj and str(id2obj[r]) in t]
    s = dict(房间=len(ids),已映射=len(mapped),一致=0,缺失=0,目标不同=0,凭空=0,条件=0,无法比对=0)
    det = {'目标不同': [], '缺失': [], '凭空': [], '未映射目标': []}
    for rid in mapped:
        real, im = real_exits(id2obj[rid]), impl.get(rid, {})
        for d, v in real.items():
            iv = im.get(d)
            if v[0] == '条件': s['条件'] += 1; continue
            if v[0] in ('阻挡','未知'):
                if iv: s['凭空'] += 1; det['凭空'].append(f"{rid} --{d}--> {iv}")
                continue
            tgt = obj2id.get(v[1])
            if tgt is None:
                # 目标没有实现 ID 时（例如 Ranch 的 Front Deck #6 和 Desert
                # 通配房间），无法判断缺失的是出口还是目标房间；单列为无法比对。
                s['无法比对'] += 1
                det['未映射目标'].append(
                    f"{rid} --{d}--> #{v[1]} {t.get(str(v[1]), {}).get('name', 'unknown')}"
                )
            elif not iv: s['缺失'] += 1; det['缺失'].append(f"{rid} --{d}--> {tgt}")
            elif iv == tgt: s['一致'] += 1
            else: s['目标不同'] += 1; det['目标不同'].append(f"{rid} --{d}--> 真机 {tgt} / 实现 {iv}")
        for d, iv in im.items():
            if d not in real: s['凭空'] += 1; det['凭空'].append(f"{rid} --{d}--> {iv}")
    rows.append((ch, s)); details[ch] = det
    for k in tot: tot[k] += s[k]

if args.json: json.dump({'rows': rows, 'details': details}, open(args.json, 'w'), ensure_ascii=False, indent=1)
print(f"{'章节':<12}{'房间':>4}{'已映射':>6} │{'一致':>5}{'缺失':>5}{'目标错':>6}{'凭空':>5} │{'条件':>4}{'无法比':>6} │ 可比出口一致率")
print('─'*84)
for ch, s in rows + [('合计', tot)]:
    denom = s['一致'] + s['缺失'] + s['目标不同']
    rate = f"{s['一致']/denom*100:>5.0f}%" if denom else '    —'
    if ch == '合计': print('─'*84)
    print(f"{ch:<12}{s['房间']:>4}{s['已映射']:>6} │{s['一致']:>5}{s['缺失']:>5}{s['目标不同']:>6}{s['凭空']:>5} │{s['条件']:>4}{s['无法比对']:>6} │ {rate}")
