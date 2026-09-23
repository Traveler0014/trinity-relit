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

- **计时器回调跨不过读档**（T2 发现，已知限制）。`state.timer.perTurn` 是章节数据里的闭包，JSON 存不下。存档只带走 `{remaining, id}`，读档后计时器照常倒数但回调不再触发——影响 `prologue.js` 的 doomsday 临近警告与 `pacific.js` 的七分钟超时提示。
  修法：engine 加 `registerTimerHandler(id, fn)` 注册表，`prologue.js` / `pacific.js` 各加约 4 行按 id 注册回调。约 8 行增量改动，但要动两个章节文件，超出 T2 的「涉及文件」范围，故未做。
- **开局房间的 `onEnter` 从不触发**（T2 发现，既有行为）。`main.js` 的 boot 用 `describeRoom()` 而非 `moveTo()` 进入首个房间，因此 `palace_gate.onEnter` 里启动 doomsday 计时器的那段，只有在玩家离开 Palace Gate 后再走回来时才会执行。读档路径沿用了同样的语义（读档只还原状态、不重放 `onEnter` 副作用）。若这是 bug，修它会改变开局节奏，需要通关测试兜底后再动。
- **死亡后没有重启逻辑**（T2 发现，既有缺陷）。`engine.js` 里「输入任意内容重新开始」是空头支票，全仓库没有任何重启实现。T2 绕开的方式是：死亡状态不写存档（刷新即回到死前一回合）+ 头部提供「重新开始」按钮。引擎层的缺口仍在。
- **存档往返自检应补进 `tests/`**（T2 发现）。T2 期间用 scratchpad 里的临时脚本验证了 7 项（往返一致、读档后可继续、懒加载章节可读档、4 类坏存档被拒、死亡不写档），但 `tests/` 是 T1 的范围，没有入库。T1 合并后建议补一个 `tests/save.test.js`。
