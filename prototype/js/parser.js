// ═══════════════════════════════════════════════════
//  混合命令解析器
//  第一层：结构化模板匹配
//  第二层：嵌入模型语义匹配（由 engine 调用 embedding）
// ═══════════════════════════════════════════════════

const DIR_CORE = {
  n: ["n","north","北"],
  s: ["s","south","南"],
  e: ["e","east","东"],
  w: ["w","west","西"],
  ne: ["ne","northeast","东北"],
  nw: ["nw","northwest","西北"],
  se: ["se","southeast","东南"],
  sw: ["sw","southwest","西南"],
  u: ["u","up","上"],
  d: ["d","down","下"],
  in: ["in","inside","里","里面","进入"],
  out: ["out","outside","外","外面","出去"],
};

const DIR_MAP = {};
for (const [dir, cores] of Object.entries(DIR_CORE)) {
  for (const c of cores) {
    DIR_MAP[c] = dir;
  }
  const cn = cores[2];
  for (const prefix of ["往","向","去"]) {
    DIR_MAP[prefix + cn] = dir;
    DIR_MAP[prefix + cn + "走"] = dir;
    DIR_MAP[prefix + cn + "边"] = dir;
    DIR_MAP[prefix + cn + "方"] = dir;
    DIR_MAP[prefix + cn + "方" + "走"] = dir;  // 向西方走、往东方走 等
  }
  DIR_MAP[cn + "走"] = dir;
  DIR_MAP[cn + "边"] = dir;
  DIR_MAP[cn + "方"] = dir;
  DIR_MAP[cn + "方" + "走"] = dir;  // 西方走、东方走 等
  DIR_MAP["走" + cn] = dir;
  DIR_MAP["走" + cn + "边"] = dir;
  DIR_MAP["走" + cn + "方"] = dir;
  DIR_MAP["走" + cn + "方" + "走"] = dir;  // 走西方走 等
}

const VERB_CN = {
  看:"examine", 检查:"examine", 观察:"examine", 仔细看:"examine",
  查看:"examine", 瞧:"examine",
  拿:"take", 取:"take", 捡:"take", 拿起:"take", 捡起:"take", 拾:"take",
  放:"drop", 放下:"drop", 丢:"drop", 丢掉:"drop",
  打开:"open", 开:"open",
  关:"close", 关闭:"close", 关上:"close",
  推:"push", 拉:"pull",
  转:"turn", 旋转:"turn", 拧:"turn", 拧开:"unscrew",
  读:"read", 阅读:"read",
  穿:"wear", 穿上:"wear", 戴:"wear", 戴上:"wear",
  扔:"throw", 投:"throw", 抛:"throw",
  给:"give", 交给:"give",
  切:"cut", 割:"cut", 剪:"cut",
  设:"set", 设置:"set",
  进:"enter", 进入:"enter", 走进:"enter",
  爬上:"climb", 爬到:"climb", 爬:"climb", 攀:"climb", 攀爬:"climb",
  骑:"ride", 坐:"ride", 坐上:"ride",
  搜:"search", 搜索:"search", 搜查:"search",
  喂:"feed", 买:"buy", 购买:"buy",
  折:"fold", 折叠:"fold",
  指:"point", 指向:"point",
  解锁:"unlock", 倒:"pour", 倒入:"pour",
  展示:"show", 出示:"show",
};

const VERB_EN = new Set([
  "look","examine","take","get","pick","drop","put","open","close",
  "push","pull","turn","read","wear","remove","throw","give","cut",
  "set","enter","climb","ride","search","feed","buy","fold","point",
  "unscrew","unlock","pour","show","hit","break","chop","kill",
  "wait","sit","enter","exit","wave","blow","smell",
]);

const PREPS = new Set([
  "at","to","in","into","on","onto","with","from","about","under","through",
  "向","给","到","进","在","用","往",
]);

// 注意：这些必须精确匹配。漏掉一种说法时，输入会落到中文动词前缀匹配
// 被拆成「看」+「四周」，再当作 examine 一个不存在的物品处理。
const META = {
  look:"look", l:"look", 看:"look", 看看:"look", 瞧瞧:"look",
  环顾:"look", 环视:"look", 环顾四周:"look", 环视四周:"look",
  看四周:"look", 看看四周:"look", 四周:"look",
  四处看看:"look", 四下看看:"look", 看看周围:"look", 观察四周:"look",
  wait:"wait", z:"wait", 等:"wait", 等待:"wait", 等一等:"wait",
};

export class Parser {
  parse(input) {
    const raw = input.trim();
    if (!raw) return null;
    const low = raw.toLowerCase();

    // Meta commands
    if (META[low]) return { type: "meta", cmd: META[low] };

    // Direction (exact)
    if (DIR_MAP[low]) return { type: "direction", dir: DIR_MAP[low] };

    // "go <direction>"
    const goMatch = low.match(/^(?:go|走|走向|前往)\s+(.+)$/);
    if (goMatch && DIR_MAP[goMatch[1]]) return { type: "direction", dir: DIR_MAP[goMatch[1]] };

    // Try English verb-noun parsing
    const enResult = this._parseEnglish(low);
    if (enResult) return enResult;

    // Try Chinese pattern matching
    const cnResult = this._parseChinese(raw);
    if (cnResult) return cnResult;

    return null; // Fall through to embedding
  }

  _parseEnglish(low) {
    const words = low.split(/\s+/);
    if (words.length === 0) return null;

    let verb = words[0];
    if (verb === "pick" && words[1] === "up") { verb = "take"; words.splice(1, 1); }
    if (verb === "look" && words[1] === "at") { verb = "examine"; words.splice(1, 1); }
    if (verb === "get" && words[1] === "in") { verb = "enter"; words.splice(1, 1); }
    if (verb === "get" && words[1] === "out") { verb = "exit"; words.splice(1, 1); }
    if (verb === "get") verb = "take";

    if (!VERB_EN.has(verb)) return null;
    if (words.length === 1) return { type: "simple", verb, noun: null };

    // Find preposition
    let prepIdx = -1;
    for (let i = 2; i < words.length; i++) {
      if (PREPS.has(words[i])) { prepIdx = i; break; }
    }

    if (prepIdx > 0) {
      const noun = words.slice(1, prepIdx).join(" ");
      const prep = words[prepIdx];
      const noun2 = words.slice(prepIdx + 1).join(" ");
      return { type: "compound", verb, noun, prep, noun2: noun2 || null };
    }

    const noun = words.slice(1).join(" ");
    return { type: "simple", verb, noun };
  }

  _parseChinese(raw) {
    // 把X扔向Y / 把X放进Y / 把X给Y
    const ba = raw.match(/^把(.+?)(?:扔向|扔到|投向|投到)(.+)$/);
    if (ba) return { type: "compound", verb: "throw", noun: ba[1], prep: "at", noun2: ba[2] };

    const baPut = raw.match(/^把(.+?)(?:放进|放入|放到|放在)(.+)$/);
    if (baPut) return { type: "compound", verb: "put", noun: baPut[1], prep: "in", noun2: baPut[2] };

    const baGive = raw.match(/^把(.+?)(?:给|交给)(.+)$/);
    if (baGive) return { type: "compound", verb: "give", noun: baGive[1], prep: "to", noun2: baGive[2] };

    // 用Y切X / 用Y打X / 用Y砸X
    const yong = raw.match(/^用(.+?)(?:切|割|剪|砍)(.+)$/);
    if (yong) return { type: "compound", verb: "cut", noun: yong[2], prep: "with", noun2: yong[1] };

    const yongHit = raw.match(/^用(.+?)(?:打|砸|敲|击)(.+)$/);
    if (yongHit) return { type: "compound", verb: "hit", noun: yongHit[2], prep: "with", noun2: yongHit[1] };

    // 设置X为Y / 把X设为Y
    const setMatch = raw.match(/^(?:设置?|把)(.+?)(?:设?为|调到|设到|设成)(.+)$/);
    if (setMatch) return { type: "compound", verb: "set", noun: setMatch[1], prep: "to", noun2: setMatch[2] };

    // 指向X / 指着X
    const point = raw.match(/^指(?:向|着)(.+)$/);
    if (point) return { type: "simple", verb: "point", noun: point[1] };

    // Simple Chinese verb+noun: try longest verb prefix
    const sortedVerbs = Object.keys(VERB_CN).sort((a, b) => b.length - a.length);
    for (const cv of sortedVerbs) {
      if (raw.startsWith(cv)) {
        const noun = raw.slice(cv.length).trim();
        const verb = VERB_CN[cv];
        if (noun) return { type: "simple", verb, noun };
        // Bare verb without noun
        return { type: "simple", verb, noun: null };
      }
    }

    return null;
  }
}
