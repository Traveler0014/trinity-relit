# TASKS.md — 并行任务看板

两个 agent 开工前都先读本文件。只改自己任务「涉及文件」内的文件。
状态：⬜ 未开始 / 🔨 进行中 / 👀 待审查 / ✅ 已合并

## 文件锁

同一时间只允许一个任务修改以下共享核心文件。改之前在这里登记，合并后清除。

| 文件 | 当前持有者 |
|---|---|
| `prototype/js/engine.js` | Claude（阶段 3） |
| `prototype/js/parser.js` | — |
| `prototype/js/data/items.js` | — |

## 进行中

### T1 阶段 2：通关测试 — Codex
- 分支：`codex/walkthrough-test`
- 状态：⬜
- 涉及文件：新建 `tests/`（`harness.js`、`walkthrough.test.js`、`graph.test.js`）、`package.json`（仅添加 `test` 脚本）、`.github/workflows/deploy.yml`（仅在 check job 中添加 `npm test` 一步）
- **不得修改**：`prototype/` 下任何文件。测试暴露出的缺陷记录在下方「发现的问题」，不要顺手修。
- 说明：CI 已存在于 `deploy.yml` 的 check job，扩展它即可，不要另建 `check.yml`。详见 `SHIP_PLAN.md` 阶段 2。
- 验收：`npm test` 通过；故意删掉 wabe 的一扇蘑菇门时测试失败。

**2026-10-08 人类裁决：`codex/phase-2-walkthrough-ci` 先拆分，不按现状合并。**

该分支实际改动 35 个文件，超出上方「涉及文件」范围，其中包含 `prototype/js/engine.js`
（文件锁持有者为 Claude）、`parser.js`、`main.js`、`data/prologue.js`，并新建了运行时模块
`contextual-intent.js`（256 行）与 `chapters.mjs`，以及 `.github/workflows/check.yml`。

拆法：
1. **范围内的测试与 CI 单独成支**，可独立评审合并。
2. **越界的运行时改动另作提案**，由人类逐项判断。其中 `contextual-intent.js` 对应
   `SHIP_PLAN.md` 阶段 1 末尾那条尚未拍板的待决事项「语义兜底是否恢复」，属产品决策。

合并时务必注意（否则会静默损坏）：`chapters.mjs` 的 `chapterLoader` 只返回 `.ROOMS`，
丢掉了 T2 在 `main.js` 里做的 `registerTimerHandlers(mod.TIMERS)` 登记。若该侧胜出，
计时器回调在读档后不会被装回——不报错、无测试失败、`npm run verify` 也抓不到，
只有玩家刷新页面后才暴露。必须把登记补进 `chapters.mjs` 的 loader。

衔接：T1 的通关测试落地后，可直接驱动 `scripts/capture_original_text.mjs` 取全部 129 个
房间的原版描述真值，用于 `scripts/audit_original_prose.mjs` 的 §0 审查。

### T2 阶段 3：存档 — Claude
- 分支：`claude/save-system`
- 状态：👀（已自测通过，等人类审查开 PR）
- 涉及文件：`prototype/js/engine.js`（仅新增 `serialize()` / `deserialize()` 及每回合自动存档钩子）、`prototype/js/ui.js`、`prototype/js/main.js`、`prototype/index.html`
- 说明：存档须带 `version` 字段；`flags` / `visited` 为 Set，存为数组；读档前先 `activateChapter(state.chapter)`。详见 `SHIP_PLAN.md` 阶段 3。
- 验收：中途刷新后进度、物品、日晷符号、flag 全部保留；导出存档可在另一浏览器导入继续。

## 排队中

### T3 阶段 4：提示与日志 — 待分配
- 依赖：T2 合并后（同样要改 `engine.js`）。有 T1 的通关测试兜底会更安全。
- 可拆分：`hints` 数据写进章节文件（可并行），`hint` / `journal` 指令写进 `engine.js`（须持有文件锁）。

### T4 阶段 0.5：115 项真值偏差评估 — 待分配
- 依赖：T1 合并后，用通关测试判断哪些偏差真正阻塞主线。

### T5 阶段 6：自动地图 — 待分配
- 依赖：T1（阶段 2）与 T2（阶段 3）都合并之后。地图状态取自 `visited`，需要存档先能持久化。
- 背景：2026-09-23 人类决定不做 3D 化，改做自动地图作为对症替代。理由见 `SHIP_PLAN.md` 第 8 节与 8.5 节。
- 涉及文件（预估）：新建 `prototype/js/map.js`、`prototype/js/ui.js`、`prototype/index.html`。**不需要改 `engine.js`**，数据全部从 `state.visited` + `room.exits()` 读。
- 关键约束：只画走过的房间；不能用刚性网格布局（真值只有 68.9% 双向自洽，且 Klein 瓶翻转会改方向关系），用力导向；按章节分图。

## 发现的问题

（任一 agent 在工作中发现的、超出自己任务范围的问题记在这里，由人类决定如何处理）

- **T1 分支已远超其「涉及文件」范围，且与 T2 有实质冲突**（2026-09-24 由 Claude 在 T2 收尾时发现，供人类裁决）。
  `origin/codex/phase-2-walkthrough-ci` 共 4 个提交、改动 35 个文件。T1 在本看板上的范围是「新建 `tests/`、`package.json` 仅加 test 脚本、`deploy.yml` 仅加一步」，并注明**不得修改 `prototype/` 下任何文件**。实际改动包含 `engine.js`（本表登记的文件锁持有者是 Claude）、`main.js`、`parser.js`、`prologue.js`，并新建了运行时模块 `prototype/js/contextual-intent.js`（256 行）与 `prototype/js/chapters.mjs`；另外新建了 `.github/workflows/check.yml`，而任务卡写的是「不要另建 check.yml，扩展 deploy.yml 即可」。**若这些是你后来另行授权的，忽略本条。**
  试合并（`git merge-tree`，未改动任何分支）结果：`SHIP_PLAN.md`、`engine.js`、`main.js` 三个文件共 4 处冲突，`prologue.js` 可自动合并。冲突本身不大，但有一处**必须人工判断，否则会静默坏掉**：
  Codex 把章节注册表抽到了新的 `chapters.mjs`，其 `chapterLoader` 只返回 `chapter.rooms || (await chapter.loader()).ROOMS`，**丢掉了 T2 在 `main.js` 里做的 `registerTimerHandlers(mod.TIMERS)` 登记**。如果合并时这一侧胜出，计时器回调在读档后不会被装回——不报错、不影响当前这局、`npm run verify` 也抓不到（该检查只管章节数据的写法，管不到 loader 的接线），只有玩家刷新页面后才暴露。合并 `chapters.mjs` 时必须把 TIMERS 登记补进它的 `chapterLoader`。
  另外 Codex 在 `engine.js` 的 `processInput` 里接入了 `ContextualIntentBoundary` 子系统。这与 `SHIP_PLAN.md` 阶段 1 末尾**尚未拍板的待决事项「语义兜底是否恢复」**相邻，属于产品决策，建议合并前先确认那是不是你要的方向。
- ~~**计时器回调跨不过读档**~~（T2 发现，**已于 2026-09-23 经人类授权修复**）。`state.timer.perTurn` 是闭包，JSON 存不下。解法：章节模块用 `export const TIMERS` 在模块层导出回调，引擎用 `registerTimerHandlers()` 按 id 登记，读档时装回。`prologue.js` / `pacific.js` 已改（超出 T2 原定「涉及文件」范围，已获授权）。
  **新章节若要用计时器，回调必须写进该章的 `TIMERS` 导出**，不能再写成 `startTimer` 的内联闭包，否则读档后失效。已写进 `CHAPTER_RULES.md`（§2、§4、§6、§10），并已在 `verify_chapters_rules.js` 加静态检查，CI 会拦（覆盖：内联闭包、键名与 id 不一致、TIMERS 缺键、跨章节 id 重复）。
- **开局房间的 `onEnter` 从不触发**（T2 发现，既有行为）。`main.js` 的 boot 用 `describeRoom()` 而非 `moveTo()` 进入首个房间，因此 `palace_gate.onEnter` 里启动 doomsday 计时器的那段，只有在玩家离开 Palace Gate 后再走回来时才会执行。读档路径沿用了同样的语义（读档只还原状态、不重放 `onEnter` 副作用）。若这是 bug，修它会改变开局节奏，需要通关测试兜底后再动。
- **死亡后没有重启逻辑**（T2 发现，既有缺陷）。`engine.js` 里「输入任意内容重新开始」是空头支票，全仓库没有任何重启实现。T2 绕开的方式是：死亡状态不写存档（刷新即回到死前一回合）+ 头部提供「重新开始」按钮。引擎层的缺口仍在。
- **存档往返自检应补进 `tests/`**（T2 发现）。T2 期间用 scratchpad 里的临时脚本验证了 7 项（往返一致、读档后可继续、懒加载章节可读档、4 类坏存档被拒、死亡不写档），但 `tests/` 是 T1 的范围，没有入库。T1 合并后建议补一个 `tests/save.test.js`。
