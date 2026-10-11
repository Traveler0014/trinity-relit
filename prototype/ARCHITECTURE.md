# Trinity Relit 架构梳理

2026-10-11 更新；当前验收与未完成项见根目录 `PROJECT_REVIEW.md`。

## 1. 运行入口
- `prototype/index.html`
  - 负责页面结构、样式、调试开关。
  - 加载模块入口 `prototype/js/main.js`。
- `prototype/js/main.js`
  - 组装 `rooms + items + parser + intentResolver + ui`，初始化存档和计时器回调注册表。
  - 首屏只创建轻量语义包装器，不下载模型；新游戏调用 `moveTo` 执行首房间事件，续玩只还原状态和描述。
  - 通过 `CHAPTERS` 注册章节数据，支持 `preload` 控制首屏预加载章节。

## 2. 分层结构
- 数据层
  - 房间/事件: `prototype/js/data/prologue.js`
  - 物品定义: `prototype/js/data/items.js`
  - 章节模板: `prototype/js/data/_chapter_template.js`
- 规则层
  - `prototype/js/parser.js`: 中英混合命令解析（方向、动词、复合句）
  - `prototype/js/engine.js`: GameState、移动、事件执行、通用 take/drop/examine、回合后处理
- 语义层
  - `intent.js`：从当前房间、物品与条件生成可执行的标准命令候选，并检查明确性。
  - `intent-model.js`：管理 Worker、进度、超时与取消。
  - `intent-worker.js` / `intent-ranking.js`：按语言懒加载 BGE Small ZH/EN，对候选排序和拒识。
  - 只返回候选 ID，不生成剧情或修改状态；玩家确认后重新校验候选并交回标准命令执行。
  - `embedding*.js` 是未启用的历史实现，不在启动路径。
- 展示层
  - `prototype/js/ui.js`: 文本输出、系统消息、背包、调试分数、输入控制
  - 外部文本统一转义后展示，只有 UI 自身生成布局标签。
  - 输出日志节点上限裁剪，避免超长会话导致前端卡顿

## 3. 事件执行路径
1. 玩家输入进入 `engine.processInput()`，输入期间加忙锁，UI 在 finally 恢复输入框。
2. 精确 parser 和事件/物品目标匹配成功时，执行标准动作。
3. 无法明确匹配时，语义层仅提供当前候选；否定、多动作等先要求澄清。
4. 玩家确认后，引擎检查状态未过期、候选仍有效，再调用 `_handleParsed`。
5. 只有成功处理的动作结算回合及 `_postTurn()`：onTurn、计时器、死亡与自动保存。
6. 未知、拒识、取消、超时均不消耗回合，不执行 `_postTurn()`；旧的帮助/背包/分数命令计数语义暂保留，尚待原版核查。

整条调用链支持 async/await：
```
processInput → _handleParsed → _handleAction → _executeEvent → event.act
```
事件的 `act` 函数可以是同步或 async，引擎会自动 await。

## 4. 章节切换协议

### 4.1 章节注册
在 `main.js` 的 `CHAPTERS` 数组中注册章节：
```js
const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },       // 预加载
  { id: "wabe",     loader: () => import("./data/wabe.js") }, // 懒加载
];
```
- `preload: true`：随首屏加载，合并进 `ALL_ROOMS`，不预计算向量。
- `loader`：返回 `{ ROOMS, TIMERS? }` 的动态 import 函数，首次进入或恢复存档时调用；main 的 chapterLoader 必须登记 TIMERS，再返回 ROOMS。

### 4.2 异步加载流程
```
event.act() → await eng.transitionChapter()
  → await eng.activateChapter()
    → await chapterLoader(id)     // 动态 import
      → Object.assign(rooms)      // 新房间合并到全局 rooms
  → 确认有效目标房间
  → state.chapter = to            // 加载与目标检查都成功后修改 state
  → eng.moveTo(startRoom)         // 显示新房间描述
```

### 4.3 状态变更时机
`transitionChapter` **先加载章节、确认目标房间存在后**才修改 state：
- `state.chapter = to`
- `state.setFlag("chapter_<id>_entered")`

加载失败或没有有效目标时 state 不变，玩家保留在当前房间。成功加载的模块可留在缓存中。

### 4.4 未实现章节的 fallback
当目标章节尚未开发时，`transitionChapter` 返回 `false` 并输出系统提示：
```
—— 章节「wabe」尚未开放，敬请期待。——
当前进度已保留，后续更新后可继续游戏。
```
调用方（event.act）可根据返回值决定是否做额外处理。

### 4.5 物品系统与章节的关系
`items.js` 统一定义全部物品，`start` 字段指定初始位置：
- 位于已加载房间的物品立即可见。
- 位于未加载房间的物品在 `itemLoc` 中存在但不可达，章节加载后自动可见。
- `start: null` 的物品通过事件 `act` 在游戏过程中放置。

不需要按章节拆分物品初始化逻辑。

### 4.6 语义资源与 Worker

模型候选来自场景中的真实动作和 aliases/triggers；新增章节不需要启动时预计算全部场景。Worker 分批计算候选向量，缓存有上限；推理期间允许取消。默认尝试部署准备好的同源资源，再回退公共源，详见 `SEMANTIC_PLAN.md`。

### 4.7 存档边界

`serialize()` 保存版本与纯状态；计时器只存 id/remaining，读档按注册表恢复函数。`_restoreSave()` 检查字段类型、房间和已登记计时器并构造新状态。`validateSave()` 可预检而不替换活状态；导入通过预检、玩家确认后才覆盖本地存档。`deserialize()` 在还原全部成功后一次性替换状态。

缺失的兼容字段采用默认值；已出现但错误的字段拒绝恢复。读档不会重放 onEnter；死亡不覆盖最后的活存档。坏档预检可能加载模块缓存，但不得改进度、计时器或物品。

## 5. 章节扩展步骤
新增一个章节的标准流程：
1. 复制 `prototype/js/data/_chapter_template.js` 到 `prototype/js/data/<chapter>.js`
2. 在 dfrotz 中用 `script` 命令记录该章节的所有原版文本
3. 将原版文本填入 `ROOMS` 的 `desc` / `events.text` 字段，添加中文翻译
4. 为每个事件编写明确 `match`；为语义候选补有代表性的中英文 `triggers`，用实际语料验证，不用条数代替质量
5. 导出 `ROOMS`，每个 room 至少包含：`name`、`cn`、`desc`、`exits`、`events`
6. 在 `main.js` 的 `CHAPTERS` 中注册：`{ id: "<id>", loader: () => import("./data/<id>.js") }`
7. 如有新物品，在 `items.js` 中添加定义并设置 `start`
8. 为关键解谜链添加 `state.flags` 和分数点，避免重复加分
9. 在切章事件中调用 `await eng.transitionChapter({ to, roomCandidates })`

## 6. 当前状态与下一步

11 章、130 个房间已有实现；主线测试覆盖 77 间，不能代表所有原版机制已还原。基础修复与验收见 `PROJECT_REVIEW.md`；优先补地图映射、条件状态与原文证据，再扩展提示和地图界面。

## 7. 旧版实现说明
- `prototype/game.js` 是历史单文件原型（可运行，但不再作为主入口）。
- 后续开发集中在 `prototype/js/*` 模块化代码上，避免双轨维护。
