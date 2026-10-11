# Trinity Relit — 章节编写规范

本文档是编写 Trinity Relit 游戏章节的**权威参考**。
所有 subagent 和开发者必须严格遵循此规范。

---

## 0. 核心原则

1. **原文至上**：所有英文文本必须来自原版 Infocom Trinity (1986)。禁止原创英文内容。
2. **Z-machine 权威**：地图结构（出口方向、房间连通性、物品层级）以 Z-machine 解析数据为准。
3. **中文伴随**：中文翻译紧跟英文原文，用 `\n\n` 分隔。
4. **防御性编码**：每一步都可验证——语法检查、出口联通、API 兼容。

---

## 1. 工作流（必须按序执行）

### Phase 1 — 数据提取

```bash
# 从 TRINITY.DAT 提取目标章节的房间数据
python3 zparse.py "Trinity 1986/TRINITY.DAT" --objects > trinity_objects.json

# 提取内联文本
python3 -c "
from zparse import ZMachineParser
with open('Trinity 1986/TRINITY.DAT','rb') as f: data=f.read()
zm = ZMachineParser(data)
for s in zm.extract_print_strings():
    if '关键词' in s['text'].lower():
        print(s['text'][:200])
"
```

**关键参数**：
- 房间对象 = `parent==88 且 attrs 包含 44`（共 134 个）
  - 属性 `37` 是「有光照」，**不是**房间标志。曾把它当作判定条件，
    导致 Top of Arbor、Underground ×3、Underwater 这 5 个黑暗房间被漏掉。
- 方向属性映射：`63=N 62=NE 61=E 60=SE 59=S 58=SW 57=W 56=NW 55=UP 54=DOWN 53=IN 52=OUT`
- 属性值 2 字节 = 目标房间对象号（直接出口）
- 属性值 ≥3 字节 = routine 地址（条件出口或阻挡消息）

### Phase 2 — 文本提取

用 dfrotz 对目标章节做系统性游玩，记录：
1. 每个房间的 verbose 描述
2. 每个可交互对象的 examine 输出
3. 关键动作的响应文本
4. 失败/错误情况的提示

### Phase 3 — 编码

按本文 §2-§5 的规则编写 JS 模块。

### Phase 4 — 验证（必须全部通过）

```bash
# 1. 语法检查
node -e "const fs=require('fs'); const c=fs.readFileSync('js/data/CHAPTER.js','utf8'); try{new Function(c.replace(/export const/g,'const').replace(/import.*/g,''));console.log('OK')}catch(e){console.error(e.message)}"

# 2. 出口联通性检查（使用 node --input-type=module）
# 3. 双向出口验证
# 4. 物品交叉引用
```

### Phase 5 — 冲突检测与反思

当验证失败时：
1. **语法错误** → 检查引号转义（见 §6 常见陷阱）
2. **出口不通** → 回查 Z-machine 数据，确认目标房间 ID 存在
3. **逻辑冲突** → 对比 Z-machine 数据和 dfrotz 文本，以 Z-machine 为准
4. **API 不存在** → 查阅 §4 引擎 API 列表
5. **文本不匹配** → 重新用 dfrotz 验证原文

---

## 2. 文件结构

每个章节是 `prototype/js/data/` 下的一个 ES Module：

```javascript
// prototype/js/data/chapter_name.js
export const ROOMS = {
  room_id_1: { /* ... */ },
  room_id_2: { /* ... */ },
};

// 可选。只有本章用到计时器时才需要，见 §6「计时器回调必须模块层导出」。
export const TIMERS = {
  timer_id(s, eng) { /* ... */ },
};
```

**命名规则**：
- 文件名：小写下划线，如 `wabe.js`、`white_house.js`
- 房间 ID：小写下划线，如 `north_arbor`、`front_deck`
- ID 必须在整个游戏中唯一（跨章节不能重复）

---

## 3. 房间定义模板

```javascript
room_id: {
  name: "English Room Name",       // 必填：原版英文名
  cn: "中文房间名",                  // 必填：中文翻译

  // ── 描述 ──
  // 可以是静态字符串或函数（根据状态动态变化）
  desc(s) {
    let d = "English description from original.\n\n中文翻译。";
    if (s.hasFlag("some_condition")) {
      d += "\n\nAdditional text.\n\n额外文本。";
    }
    return d;
  },

  // ── 出口 ──
  // 可以是对象或函数
  exits(s) {
    return {
      n: "other_room",           // 简单出口：字符串
      e: {                       // 条件出口：对象
        to: "target_room",
        when: (s2) => s2.hasFlag("door_open"),
        fail: "The door is locked.\n\n门锁着。",
        // fail 也可以是函数：fail(s2) { return "..."; }
        act(s2, eng) { /* 通过时执行 */ },
        text: "You walk through the door.\n\n你穿过了门。",
      },
    };
  },

  // ── 生命周期钩子（均可选）──
  onEnter(s, eng) { /* 进入房间时 */ },
  onTurn(s, eng)  { /* 每回合结束时（仅当前房间） */ },
  onWait(s, eng)  { /* 玩家输入 wait 时 */ },

  // ── 事件列表 ──
  events: [
    {
      id: "unique_event_id",              // 必填：唯一标识
      match: {                            // 结构化匹配（parser 层）
        verb: ["take", "get"],
        noun: ["key", "钥匙"],
        // noun2: ["door", "门"],         // 可选：复合命令
      },
      triggers: [                         // 语义匹配（embedding 层）
        "拿钥匙", "捡起钥匙",
        "take the key", "pick up key",
      ],
      when: (s) => s.inRoom("key"),       // 可选：前置条件
      act(s, eng) {                       // 可选：执行逻辑
        s.take("key");
      },
      text: "You pick up the key.\n\n你捡起了钥匙。",
      // text 也可以是函数：text(s) { return "..."; }
    },
  ],
},
```

---

## 4. 引擎 API 参考

### GameState (参数名：s)

**物品查询**：
| 方法 | 返回 | 说明 |
|------|------|------|
| `s.has(id)` | bool | 物品在身上（inventory/pocket/worn） |
| `s.carrying(id)` | bool | 物品在 inventory |
| `s.inPocket(id)` | bool | 物品在 pocket |
| `s.wearing(id)` | bool | 物品在 worn |
| `s.inRoom(id)` | bool | 物品在当前房间 |
| `s.itemAt(id)` | string | 物品位置字符串 |
| `s.roomItems()` | [id] | 当前房间所有物品 |
| `s.inventoryList()` | [{id,loc}] | 所有随身物品 |
| `s.carryCount()` | number | inventory 中物品数 |

**物品变更**：
| 方法 | 效果 |
|------|------|
| `s.take(id)` | → "inventory" |
| `s.toPocket(id)` | → "pocket" |
| `s.wear(id)` | → "worn" |
| `s.drop(id)` | → 当前房间 |
| `s.destroy(id)` | → "destroyed" |
| `s.placeItem(id, roomId)` | → 指定房间 |
| `s.moveItem(id, loc)` | → 任意位置 |

**标志**：`s.setFlag(f)` / `s.hasFlag(f)` / `s.clearFlag(f)`

**计数器**：`s.cnt(n)` / `s.setCnt(n, v)` / `s.inc(n)`

**分数**：`s.addScore(pts)`

**计时器**：`s.startTimer(turns, id, perTurnCb)` / `s.tickTimer()` / `s.clearTimer()`

> `perTurnCb` **必须**取自本章的 `TIMERS` 导出，不能写成内联闭包。原因见 §6。

**属性**：`s.room`（当前房间ID）/ `s.turns`（回合数）/ `s.dead`（是否死亡）/ `s.chapter`（当前章节）

### GameEngine (参数名：eng)

| 方法 | 说明 |
|------|------|
| `eng.print(text)` | 输出文本 |
| `eng.moveTo(roomId)` | 移动到房间（自动描述+onEnter） |
| `eng.moveTo(roomId, true)` | 静默移动（不描述） |
| `eng.die(msg)` | 输出消息并标记死亡 |
| `eng.transitionChapter({to, roomCandidates, fallbackRoom})` | 章节过渡（async） |
| `eng.describeRoom()` | 重新描述当前房间 |

---

## 5. 事件处理规则

### 执行顺序

```
用户输入 → parser 结构化解析 → match 匹配 → _executeEvent
                              ↓ 无匹配
                          generic take/drop/examine
                              ↓ 无匹配
                          embedding 语义匹配 → triggers 匹配 → _executeEvent
```

### _executeEvent 的执行顺序

```
1. 调用 ev.act(s, eng)     ← 先执行逻辑
2. 输出 ev.text(s) 或 ev.text  ← 后输出文本
```

**关键规则**：
- 如果 `act` 中已用 `eng.print()` 输出文本，`text` 应为 `""` 避免重复
- 如果 `act` 中调用 `eng.moveTo()`，注意 moveTo 会触发目标房间的 onEnter
- `act` 可以是 `async` 函数（用于 `await eng.transitionChapter()`）

### 事件优先级

events 数组中**靠前的事件优先匹配**。规则：
1. 有 `when` 条件的特殊事件放在前面
2. 通用 fallback 事件放在后面
3. 同一个动词/名词组合的事件，更具体的 `when` 在前

### 仅语义匹配的事件

不提供 `match`，只提供 `triggers`。结构化 parser 会跳过（`if (!ev.match) continue`），仅由 embedding 引擎匹配。

---

## 6. 常见陷阱与防御

### 引号转义（最常见的错误）

```javascript
// ❌ 错误：中文引号 "" 在 JS 双引号字符串内会提前终止字符串
text: "底部镌刻着"TEMPUS EDAX RERUM"的铭文"
//                ^ JS 认为字符串在这里结束了

// ✅ 正确：外层改用单引号
text: '底部镌刻着"TEMPUS EDAX RERUM"的铭文'

// ✅ 正确：转义内部双引号
text: "底部镌刻着\"TEMPUS EDAX RERUM\"的铭文"
```

**规则**：当字符串内容包含 `"` 字符（无论中英文引号），外层必须用单引号 `'...'`。

### act 中的 moveTo 与条件出口重复

```javascript
// ❌ 错误：act 中 moveTo + 条件出口的 _handleDirection 也会 moveTo → 移动两次
exits: { e: { to: "room_b", act(s, eng) { eng.moveTo("room_b"); } } }

// ✅ 正确：act 只做状态变更，让引擎处理移动
exits: { e: { to: "room_b", act(s, eng) { s.setFlag("entered_b"); } } }

// ✅ 正确：如果需要在事件中直接移动（如雨伞吹飞），不要通过出口
// 在 events 数组中处理，不走出口系统
```

### onTurn 的房间检查

```javascript
// ❌ 错误：onTurn 在玩家离开后可能仍被调用（如果 room 对象被缓存）
onTurn(s, eng) {
  eng.print("你听到了声音");  // 玩家可能已不在这个房间！
}

// ✅ 正确：始终检查当前房间
onTurn(s, eng) {
  if (s.room !== "this_room_id") return;
  eng.print("你听到了声音");
}
```

### exits 函数 vs 对象

```javascript
// 当出口不依赖状态时，可以用静态返回
exits() { return { n: "room_a", s: "room_b" }; }

// 当出口依赖状态时，必须接收 s 参数
exits(s) {
  const exits = { n: "room_a" };
  if (s.hasFlag("door_open")) exits.e = "room_c";
  return exits;
}
```

### 计时器回调必须模块层导出

存档存不下函数。`state.timer` 落盘时只带走 `{ remaining, id }`，读档时引擎
按 `id` 去该章的 `TIMERS` 导出里把回调取回来（`engine.registerTimerHandlers`）。

写成内联闭包不会报错，玩家刷新页面之前也一切正常，刷新之后计时器照常倒数，
但每回合的副作用**静默消失**。正因为它只在读档后才暴露，
`npm run verify` 专门加了一条静态检查来拦：第 3 个参数不是 `TIMERS.<id>`、
键名与 id 不一致、`TIMERS` 导出里缺该键、id 跨章节重复，四种都会报错。

```javascript
// ❌ 错误：内联闭包。刷新页面后这段再也不会执行
onEnter(s, eng) {
  s.startTimer(80, "doomsday", (st, en) => {
    if (st.timer && st.timer.remaining <= 10) doomTick(st, en);
  });
}

// ✅ 正确：回调放进模块层的 TIMERS，startTimer 只引用它
export const TIMERS = {
  doomsday(s, eng) {
    if (s.timer && s.timer.remaining <= 10) doomTick(s, eng);
  },
};

onEnter(s, eng) {
  s.startTimer(80, "doomsday", TIMERS.doomsday);
}
```

`TIMERS` 的键名必须与 `startTimer` 的第二个参数一致，引擎就是靠它配对的。
键名在整个游戏中唯一（同房间 ID 一样跨章节不能重复）。

新章节除了导出 `TIMERS`，不需要做别的：预加载章节由 `main.js` 在启动时登记，
懒加载章节由 `chapterLoader` 在装载时登记，两条路径都已接好。

### 物品引用

```javascript
// ❌ 错误：直接引用不存在的物品 ID
s.has("magic_sword")  // items.js 中没有这个 ID

// ✅ 正确：确保 items.js 中定义了该物品
// 如果是新物品，先在 items.js 中添加定义
```

---

## 7. 物品定义规范（items.js）

```javascript
item_id: {
  cn: "中文名",
  aliases: ["english name", "alias", "中文别名"],
  desc: "English description.\n\n中文描述。",
  // desc 也可以是函数：desc(s) { return "..."; }
  start: "room_id",     // 起始位置：房间ID / "pocket" / "worn" / "inventory" / null
  fixed: false,         // true = 不可拿起
  fixedMsg: "...",       // 不可拿起时的提示
  takeTxt: "...",        // 拿起时的自定义文本
  roomDesc: "...",       // 在房间中的额外描述
}
```

---

## 8. 章节过渡协议

```javascript
// 在当前章节的最终事件中触发过渡
async act(s, eng) {
  s.setFlag("chapter_name_done");
  eng.print("过渡文本...");
  await eng.transitionChapter({
    to: "next_chapter",
    roomCandidates: ["entry_room_1", "entry_room_2"],
    fallbackRoom: null,
  });
}
```

**规则**：
- 过渡前必须设置 `chapter_done` 标志
- roomCandidates 按优先级排列
- transitionChapter 是 async，act 必须是 async 并 await
- 如果目标章节未实现，引擎自动显示 "章节尚未开放" 提示

---

## 9. Z-machine 属性速查

| 属性号 | 方向 |
|--------|------|
| 63 | North |
| 62 | Northeast |
| 61 | East |
| 60 | Southeast |
| 59 | South |
| 58 | Southwest |
| 57 | West |
| 56 | Northwest |
| 55 | Up |
| 54 | Down |
| 53 | In |
| 52 | Out |

| 属性值长度 | 含义 |
|-----------|------|
| 2 bytes | 目标房间对象号（直接出口） |
| 3+ bytes | routine 地址（条件出口/阻挡文本） |

---

## 10. 验证检查清单

每个章节完成后必须全部通过：

- [ ] **语法检查**：`node -e` 无错误
- [ ] **出口联通**：所有 exit 目标房间 ID 存在于 ROOMS 中
- [ ] **双向出口**：A→B 的反方向 B→A 必须存在（除有意设计的单向出口）
- [ ] **出口与 Z-machine 一致**：对比 zparse.py 提取的方向属性
- [ ] **物品交叉引用**：events 中引用的 item ID 必须在 items.js 中定义
- [ ] **API 兼容**：所有 `s.xxx()` 和 `eng.xxx()` 调用必须在 §4 API 列表中
- [ ] **引号安全**：不存在未转义的中文引号在 JS 双引号字符串内
- [ ] **onTurn 房间守卫**：所有 onTurn 都以 `if (s.room !== "xxx") return;` 开头
- [ ] **事件 ID 唯一**：同一房间内所有事件 ID 不重复
- [ ] **计时器回调已导出**：若本章用了 `startTimer`，回调必须取自本章 `TIMERS` 导出，不是内联闭包（§6）
