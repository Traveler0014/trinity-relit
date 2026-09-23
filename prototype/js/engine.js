// ═══════════════════════════════════════════════════
//  存档格式版本
// ═══════════════════════════════════════════════════
//
// 存档一旦发布就要向后兼容。任何会让旧存档读出错误状态的改动
// （字段改名、语义变化、Set/Array 结构调整）都必须递增此值，
// 并在 deserialize 里补一条迁移分支。
// 单纯新增字段不必递增：deserialize 对缺失字段一律回落到默认值。

export const SAVE_VERSION = 1;

// ═══════════════════════════════════════════════════
//  GameState — 游戏全局状态
// ═══════════════════════════════════════════════════

export class GameState {
  constructor() {
    this.room = "palace_gate";
    this.itemLoc = {};       // itemId → roomId | "inventory" | "pocket" | "worn" | "destroyed"
    this.flags = new Set();
    this.counters = {};
    this.score = 0;
    this.maxScore = 100;
    this.turns = 0;
    this.chapter = "prologue";
    this.timer = null;       // { remaining, id, perTurn }
    this.visited = new Set(["palace_gate"]);
    this.flipped = false;    // Arboretum Klein bottle
    this.sundialSymbol = 2;  // current symbol the ring points to (1-7)
    this.leverPulled = false;
    this.dead = false;
  }

  // ── Item queries ──
  has(id)       { const l = this.itemLoc[id]; return l === "inventory" || l === "pocket" || l === "worn"; }
  carrying(id)  { return this.itemLoc[id] === "inventory"; }
  inPocket(id)  { return this.itemLoc[id] === "pocket"; }
  wearing(id)   { return this.itemLoc[id] === "worn"; }
  inRoom(id)    { return this.itemLoc[id] === this.room; }
  itemAt(id)    { return this.itemLoc[id]; }

  // ── Item mutations ──
  take(id)      { this.itemLoc[id] = "inventory"; }
  toPocket(id)  { this.itemLoc[id] = "pocket"; }
  wear(id)      { this.itemLoc[id] = "worn"; }
  drop(id)      { this.itemLoc[id] = this.room; }
  destroy(id)   { this.itemLoc[id] = "destroyed"; }
  moveItem(id, loc) { this.itemLoc[id] = loc; }
  placeItem(id, roomId) { this.itemLoc[id] = roomId; }

  roomItems() {
    return Object.entries(this.itemLoc)
      .filter(([, loc]) => loc === this.room)
      .map(([id]) => id);
  }

  inventoryList() {
    return Object.entries(this.itemLoc)
      .filter(([, l]) => l === "inventory" || l === "pocket" || l === "worn")
      .map(([id, l]) => ({ id, loc: l }));
  }

  carryCount() {
    return Object.values(this.itemLoc).filter(l => l === "inventory").length;
  }

  // ── Flags ──
  setFlag(f)    { this.flags.add(f); }
  hasFlag(f)    { return this.flags.has(f); }
  clearFlag(f)  { this.flags.delete(f); }

  // ── Counters ──
  cnt(n)        { return this.counters[n] || 0; }
  setCnt(n, v)  { this.counters[n] = v; }
  inc(n)        { this.counters[n] = (this.counters[n] || 0) + 1; }

  // ── Score ──
  addScore(pts) { this.score += pts; }

  // ── Timer ──
  startTimer(turns, id, perTurn) { this.timer = { remaining: turns, id, perTurn }; }
  tickTimer() {
    if (!this.timer) return null;
    this.timer.remaining--;
    return this.timer;
  }
  clearTimer() { this.timer = null; }

  // ── 序列化 ──
  // flags / visited 是 Set，JSON 存不下，转数组。
  // 其余字段都是原始值或纯对象，可直接带走。
  serialize() {
    return {
      room: this.room,
      itemLoc: { ...this.itemLoc },
      flags: [...this.flags],
      counters: { ...this.counters },
      score: this.score,
      maxScore: this.maxScore,
      turns: this.turns,
      chapter: this.chapter,
      // timer.perTurn 是章节数据里的闭包，无法序列化，只带走倒数和 id。
      // 后果：读档后计时器照常倒数，但每回合回调不再触发（doomsday 的
      // 临近警告、太平洋七分钟的超时提示）。要修复需要章节文件按 id
      // 注册回调，那超出了本次改动的文件范围，已登记在 TASKS.md。
      timer: this.timer ? { remaining: this.timer.remaining, id: this.timer.id } : null,
      visited: [...this.visited],
      flipped: this.flipped,
      sundialSymbol: this.sundialSymbol,
      leverPulled: this.leverPulled,
      dead: this.dead,
    };
  }

  // 缺失字段一律回落到构造函数给的默认值，这样旧存档遇上新字段不会崩。
  static deserialize(data) {
    const s = new GameState();
    if (!data || typeof data !== "object") return s;

    if (typeof data.room === "string") s.room = data.room;
    if (data.itemLoc && typeof data.itemLoc === "object") s.itemLoc = { ...data.itemLoc };
    if (Array.isArray(data.flags)) s.flags = new Set(data.flags);
    if (data.counters && typeof data.counters === "object") s.counters = { ...data.counters };
    if (typeof data.score === "number") s.score = data.score;
    if (typeof data.maxScore === "number") s.maxScore = data.maxScore;
    if (typeof data.turns === "number") s.turns = data.turns;
    if (typeof data.chapter === "string") s.chapter = data.chapter;
    if (Array.isArray(data.visited)) s.visited = new Set(data.visited);
    if (typeof data.flipped === "boolean") s.flipped = data.flipped;
    if (typeof data.sundialSymbol === "number") s.sundialSymbol = data.sundialSymbol;
    if (typeof data.leverPulled === "boolean") s.leverPulled = data.leverPulled;
    if (typeof data.dead === "boolean") s.dead = data.dead;

    // perTurn 置空，_postTurn 里对它有判空保护。
    s.timer = data.timer && typeof data.timer.remaining === "number"
      ? { remaining: data.timer.remaining, id: data.timer.id, perTurn: null }
      : null;

    // 当前房间必须在 visited 里，否则地图/统计会漏掉它。
    s.visited.add(s.room);
    return s;
  }
}

// ═══════════════════════════════════════════════════
//  GameEngine — 游戏逻辑核心
// ═══════════════════════════════════════════════════

const MAX_CARRY = 8;
const PRAM_NOUNS = new Set(["pram", "perambulator", "carriage", "婴儿车", "推车", "车"]);

export class GameEngine {
  constructor({ rooms, items, parser, embedding, ui, chapterLoader, preloadedChapters, onAutosave }) {
    this.rooms = rooms;
    this.items = items;
    this.parser = parser;
    this.embedding = embedding;
    this.ui = ui;
    this.chapterLoader = chapterLoader || null;
    this.loadedChapters = new Set(preloadedChapters || ["prologue"]);
    // 存档落盘由调用方注入。引擎自己不碰 localStorage，否则就有了 window
    // 依赖，Node 下的通关测试会跑不起来（见 SHIP_PLAN 关键技术前提 2）。
    this.onAutosave = typeof onAutosave === "function" ? onAutosave : null;
    // 计时器回调按 id 登记。存档存不下函数，读档时靠这张表把 perTurn 装回去。
    this.timerHandlers = new Map();
    this.state = new GameState();
    this._initItems();
  }

  // 章节模块通过 export const TIMERS 提供回调，装载时登记进来。
  registerTimerHandlers(timers) {
    for (const [id, fn] of Object.entries(timers || {})) {
      if (typeof fn === "function") this.timerHandlers.set(id, fn);
    }
  }

  // ── 存档 ──
  serialize() {
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state: this.state.serialize(),
    };
  }

  // 读档。抛错即表示存档不可用，调用方应提示玩家并从头开始。
  async deserialize(save) {
    if (!save || typeof save !== "object" || !save.state) {
      throw new Error("存档格式无法识别");
    }
    if (save.version !== SAVE_VERSION) {
      throw new Error(`存档版本 ${save.version} 与当前版本 ${SAVE_VERSION} 不兼容`);
    }
    const data = save.state;
    if (typeof data.room !== "string" || !data.room) {
      throw new Error("存档缺少房间信息");
    }

    // 懒加载的章节必须先装载，否则读档后找不到房间。
    // 不只装当前章节：chapter_<id>_entered 标志记录了走过的每一章，
    // 全部装回来，跨章出口才不会指向空房间。
    const chapters = new Set([data.chapter || "prologue"]);
    for (const f of Array.isArray(data.flags) ? data.flags : []) {
      const m = /^chapter_(.+)_entered$/.exec(f);
      if (m) chapters.add(m[1]);
    }
    for (const id of chapters) {
      const ok = await this.activateChapter(id);
      if (!ok && !this.loadedChapters.has(id)) {
        throw new Error(`章节「${id}」加载失败`);
      }
    }

    if (!this.rooms[data.room]) {
      throw new Error(`存档中的房间「${data.room}」不存在`);
    }

    const restored = GameState.deserialize(data);

    // 存档之后 items.js 若新增了物品，旧存档里没有它们。用初始位置补齐，
    // 存档里已有的位置优先，避免把玩家已拿到的东西塞回原处。
    const base = {};
    for (const [id, item] of Object.entries(this.items)) {
      if (item.start) base[id] = item.start;
    }
    restored.itemLoc = { ...base, ...restored.itemLoc };

    // 把计时器回调装回去。章节已在上面装载完毕，注册表这时才是全的。
    // 找不到对应 id 时 perTurn 保持 null，_postTurn 里有判空保护：
    // 计时器照常倒数，只是不再有每回合的副作用。
    if (restored.timer && this.timerHandlers.has(restored.timer.id)) {
      restored.timer.perTurn = this.timerHandlers.get(restored.timer.id);
    }

    this.state = restored;
    return true;
  }

  // 每回合结束调用。注意不走 moveTo/onEnter，读档只还原状态不重放副作用。
  _autosave() {
    if (!this.onAutosave) return;
    // 死亡状态不写档。引擎目前没有重启逻辑（"输入任意内容重新开始" 是空头
    // 支票），存下死局会让刷新后永远卡死。不写档 = 刷新回到死前一回合。
    if (this.state.dead) return;
    try {
      this.onAutosave(this.serialize());
    } catch (err) {
      console.error("自动存档失败", err);
    }
  }

  _initItems() {
    for (const [id, item] of Object.entries(this.items)) {
      if (item.start) this.state.itemLoc[id] = item.start;
    }
  }

  currentRoom() {
    return this.rooms[this.state.room];
  }

  // ── Room display ──
  describeRoom() {
    const room = this.currentRoom();
    if (!room) { this.ui.system(`错误：找不到房间 ${this.state.room}`); return; }

    const name = room.name;
    const cn = room.cn;
    this.ui.location(name, cn);

    const desc = typeof room.desc === "function" ? room.desc(this.state) : room.desc;
    this.ui.text(desc);

    const loose = this.state.roomItems();
    for (const id of loose) {
      const item = this.items[id];
      if (item && item.roomDesc) {
        const rd = typeof item.roomDesc === "function" ? item.roomDesc(this.state) : item.roomDesc;
        if (rd) this.ui.text(rd);
      }
    }
  }

  moveTo(roomId, silent) {
    if (!this.rooms[roomId]) { this.ui.system(`错误：房间 ${roomId} 不存在。`); return; }
    this.state.room = roomId;
    this.state.visited.add(roomId);
    if (!silent) this.describeRoom();
    const room = this.rooms[roomId];
    if (room.onEnter) room.onEnter(this.state, this);
  }

  async activateChapter(chapterId) {
    if (!chapterId) return false;
    if (this.loadedChapters.has(chapterId)) return true;
    if (!this.chapterLoader) return false;
    const rooms = await this.chapterLoader(chapterId);
    if (!rooms) return false;
    Object.assign(this.rooms, rooms);
    this.loadedChapters.add(chapterId);
    return true;
  }

  async transitionChapter({ to, roomCandidates = [], fallbackRoom = null }) {
    if (!to) return false;

    const loaded = await this.activateChapter(to);
    if (!loaded && !this.loadedChapters.has(to)) {
      this.ui.system(
        `\n—— 章节「${to}」尚未开放，敬请期待。——\n` +
        "当前进度已保留，后续更新后可继续游戏。"
      );
      return false;
    }

    this.state.chapter = to;
    this.state.setFlag(`chapter_${to}_entered`);

    const target = [...roomCandidates, fallbackRoom].find((id) => id && this.rooms[id]);
    if (!target) {
      this.ui.system(`章节「${to}」已加载，但没有可进入的起始房间。`);
      return false;
    }
    this.moveTo(target);
    return true;
  }

  // ── Input processing ──
  async processInput(raw) {
    const input = raw.trim();
    if (!input) return;

    this.ui.userInput(input);
    this.state.turns++;

    // 1. Meta commands
    const meta = this._handleMeta(input);
    if (meta) return;

    // 2. Parser (structured matching)
    const cmd = this.parser.parse(input);
    if (cmd) {
      const handled = await this._handleParsed(cmd);
      if (handled) { this._postTurn(); return; }
    }

    // 解析返回 null：不进行语义猜测，直接提示无法识别
    this.ui.system("这句话无法识别。输入「帮助」查看指令提示。");
    this._postTurn();
  }

  _handleMeta(input) {
    const low = input.toLowerCase();
    if (["帮助", "help", "?", "？"].includes(low)) {
      this.ui.system(
        "方向：北(n) 南(s) 东(e) 西(w) 东北(ne) 西北(nw) 东南(se) 西南(sw) 上(u) 下(d)\n" +
        "动作：看(look) 拿(take) 放(drop) 检查(examine) 打开(open) 关(close)\n" +
        "复合：扔X向Y 把X放进Y 给X给Y 用Y切X\n" +
        "系统：背包(i) 分数(score) 等待(wait/z) 帮助(help)"
      );
      return true;
    }
    if (["背包", "物品", "inventory", "i"].includes(low)) {
      this._showInventory(); return true;
    }
    if (["分数", "score"].includes(low)) {
      this.ui.system(`当前分数：${this.state.score} / ${this.state.maxScore}，共 ${this.state.turns} 回合。`);
      return true;
    }
    return false;
  }

  async _handleParsed(cmd) {
    if (cmd.type === "direction") return await this._handleDirection(cmd.dir);
    if (cmd.type === "meta") return this._handleMetaCmd(cmd.cmd);
    if (cmd.type === "simple" || cmd.type === "compound") return await this._handleAction(cmd);
    return false;
  }

  async _handleDirection(dir) {
    const room = this.currentRoom();
    const exits = typeof room.exits === "function" ? room.exits(this.state) : room.exits;
    if (!exits || !exits[dir]) {
      this.ui.system("你不能往那个方向走。");
      return true;
    }
    const target = exits[dir];
    if (typeof target === "object") {
      if (target.when && !target.when(this.state)) {
        const failMsg = typeof target.fail === "function" ? target.fail(this.state) : target.fail;
        this.ui.text(failMsg || "你不能往那个方向走。");
        return true;
      }
      if (target.text) this.ui.text(target.text);
      if (target.act) await target.act(this.state, this);
      this.moveTo(target.to);
    } else {
      this.moveTo(target);
    }
    return true;
  }

  _handleMetaCmd(cmd) {
    if (cmd === "look") { this.describeRoom(); return true; }
    if (cmd === "wait") {
      this.ui.text("时间流逝。");
      const room = this.currentRoom();
      if (room.onWait) room.onWait(this.state, this);
      return true;
    }
    return false;
  }

  async _handleAction(cmd) {
    const room = this.currentRoom();
    const events = room.events || [];

    for (const ev of events) {
      if (ev.when && !ev.when(this.state)) continue;
      if (!ev.match) continue;
      if (this._matchCommand(cmd, ev.match)) {
        await this._executeEvent(ev);
        return true;
      }
    }

    // Generic take/drop/examine if no specific event matched
    if (cmd.verb === "take") return this._genericTake(cmd.noun);
    if (cmd.verb === "drop") return this._genericDrop(cmd.noun);
    if (cmd.verb === "examine") return this._genericExamine(cmd.noun);
    if ((cmd.verb === "push" || cmd.verb === "move") && this._looksLikePram(cmd.noun)) {
      this.ui.system("这里没有可推动的婴儿车。");
      return true;
    }
    if (cmd.verb === "climb") {
      if (!cmd.noun) {
        this.ui.system("你想爬什么？");
      } else {
        this.ui.system("你在这里爬不上去。");
      }
      return true;
    }

    return false;
  }

  _matchCommand(cmd, match) {
    if (!match.verb) return false;
    const verbs = Array.isArray(match.verb) ? match.verb : [match.verb];
    if (!verbs.includes(cmd.verb)) return false;

    if (match.noun) {
      const nouns = Array.isArray(match.noun) ? match.noun : [match.noun];
      if (!cmd.noun || !this._nounMatch(cmd.noun, nouns)) return false;
    }

    if (match.noun2) {
      const nouns2 = Array.isArray(match.noun2) ? match.noun2 : [match.noun2];
      if (!cmd.noun2 || !this._nounMatch(cmd.noun2, nouns2)) return false;
    }

    return true;
  }

  _nounMatch(input, candidates) {
    const low = input.toLowerCase();
    for (const c of candidates) {
      if (low === c.toLowerCase()) return true;
      // Also check item aliases
      const item = this.items[c];
      if (item && item.aliases) {
        for (const a of item.aliases) {
          if (low === a.toLowerCase()) return true;
        }
      }
    }
    return false;
  }

  _looksLikePram(noun) {
    if (!noun) return false;
    return PRAM_NOUNS.has(noun.toLowerCase());
  }

  async _executeEvent(ev) {
    if (ev.act) await ev.act(this.state, this);
    if (ev.text) {
      const t = typeof ev.text === "function" ? ev.text(this.state) : ev.text;
      if (t) this.ui.text(t);
    }
  }

  _postTurn() {
    const room = this.currentRoom();
    if (room.onTurn) room.onTurn(this.state, this);

    if (this.state.timer) {
      const t = this.state.tickTimer();
      if (t && t.perTurn) t.perTurn(this.state, this);
      if (t && t.remaining <= 0) {
        this.state.clearTimer();
      }
    }

    if (this.state.dead) {
      this.ui.system("\n你死了。\n\n输入任意内容重新开始。");
    }

    this._autosave();
  }

  // ── Generic actions ──
  _genericTake(noun) {
    if (!noun) { this.ui.system("拿什么？"); return true; }
    const itemId = this._resolveItem(noun);
    if (!itemId) return false;
    if (this.state.inPocket(itemId)) {
      this.state.take(itemId);
      const item = this.items[itemId];
      this.ui.text(item?.takeTxt || `You take the ${item?.cn || noun} out of your pocket.\n你从口袋里取出了${item?.cn || noun}。`);
      return true;
    }
    if (!this.state.inRoom(itemId)) { this.ui.system("这里没有那个东西。"); return true; }
    const item = this.items[itemId];
    if (item && item.fixed) { this.ui.system(item.fixedMsg || "你拿不动它。"); return true; }
    if (this.state.carryCount() >= MAX_CARRY) { this.ui.system("你拿不下更多东西了。"); return true; }
    this.state.take(itemId);
    this.ui.text(item?.takeTxt || `你拿起了${item?.cn || noun}。`);
    return true;
  }

  _genericDrop(noun) {
    if (!noun) { this.ui.system("放下什么？"); return true; }
    const itemId = this._resolveItem(noun);
    if (!itemId || !this.state.has(itemId)) { this.ui.system("你没有那个东西。"); return true; }
    this.state.drop(itemId);
    const item = this.items[itemId];
    this.ui.text(`你放下了${item?.cn || noun}。`);
    return true;
  }

  _genericExamine(noun) {
    if (!noun) { this.describeRoom(); return true; }
    const itemId = this._resolveItem(noun);
    if (itemId) {
      const item = this.items[itemId];
      if (this.state.has(itemId) || this.state.inRoom(itemId)) {
        const desc = typeof item.desc === "function" ? item.desc(this.state) : item.desc;
        this.ui.text(desc || `${item.cn}看起来没什么特别的。`);
        return true;
      }
    }
    // 这里曾返回 false，最终显示成「这句话无法识别」，让玩家以为是语法
    // 不对而反复换说法。指令其实读懂了，只是那样东西不在这里。
    this.ui.system("你没有看到那样东西。");
    return true;
  }

  _resolveItem(noun) {
    const low = noun.toLowerCase();
    for (const [id, item] of Object.entries(this.items)) {
      if (id === low) return id;
      if (item.aliases) {
        for (const a of item.aliases) {
          if (a.toLowerCase() === low) return id;
        }
      }
    }
    return null;
  }

  _showInventory() {
    const list = this.state.inventoryList();
    if (list.length === 0) {
      this.ui.system("你两手空空。");
      return;
    }
    const lines = list.map(({ id, loc }) => {
      const item = this.items[id];
      const cn = item?.cn || id;
      const tag = loc === "pocket" ? "（口袋里）" : loc === "worn" ? "（穿戴中）" : "";
      return `  · ${cn}${tag}`;
    });
    this.ui.inventory("随身物品：\n" + lines.join("\n"));
  }

  die(msg) {
    this.ui.text(msg);
    this.state.dead = true;
  }

  print(text) {
    this.ui.text(text);
  }
}
