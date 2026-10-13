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
- 分支：`codex/integrate-claude-tests`
- 状态：👀（本地整合与验证完成，尚未合并 main）
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
- ~~**开局房间的 `onEnter` 从不触发**~~（T9 已修复，新开局进入房间、续玩不重放事件）（T2 发现，既有行为）。`main.js` 的 boot 用 `describeRoom()` 而非 `moveTo()` 进入首个房间，因此 `palace_gate.onEnter` 里启动 doomsday 计时器的那段，只有在玩家离开 Palace Gate 后再走回来时才会执行。读档路径沿用了同样的语义（读档只还原状态、不重放 `onEnter` 副作用）。若这是 bug，修它会改变开局节奏，需要通关测试兜底后再动。
- ~~**死亡提示宣称任意输入可重启**~~（T9 已修正提示，使用真实的页头重启按钮）（T2 发现，既有缺陷）。`engine.js` 里「输入任意内容重新开始」是空头支票，全仓库没有任何重启实现。T2 绕开的方式是：死亡状态不写存档（刷新即回到死前一回合）+ 头部提供「重新开始」按钮。引擎层的缺口仍在。
- ~~**存档往返自检应补进 `tests/`**~~（T1/T9 已覆盖往返、计时器、坏字段与浏览器导入导出）（T2 发现）。T2 期间用 scratchpad 里的临时脚本验证了 7 项（往返一致、读档后可继续、懒加载章节可读档、4 类坏存档被拒、死亡不写档），但 `tests/` 是 T1 的范围，没有入库。T1 合并后建议补一个 `tests/save.test.js`。

## 2026-10-08 Codex 整合验收

- 新分支以 `claude/cleanup-and-decisions` 为基础，合入 `claude/save-system`；旧 Codex 分支完整保留，没有整体合入。
- T1 拆入测试与既有 deploy.yml 的测试步骤；测试装配留在 tests/，没有引入 chapters.mjs 或 contextual-intent.js 到运行时。
- 人类本轮明确授权：修复 parser 的 in/out 及中文别名。首次测试在 Wabe 复现阻断，补两条 DIR_CORE 后完整通关。
- `npm test`：22/22，199 回合、73 房间、21/100 分；`npm run verify` 通过。
- 存档测试覆盖 JSON 往返、继续输入、懒加载、坏档拒绝、自动保存和死亡保护；另执行真实 main.js（只替换 UI 边界），验证 Pacific 续玩后的回调登记与到期副作用。尚未做本轮浏览器导出/导入交互验收。
- 临时副本中断开 Japan 蘑菇门，通关测试按预期失败。出口旧检查仍为 115 项；章节出口未改动。Claude 静态反汇编的更完整偏差统计仍应作为后续地图修复依据。
- 旧分支待单独提案：情境意图模块及 engine 接线；parser 其他语义与事件匹配改动；双语审查/转录/旧 CLI 改动。不因本次整合自动恢复。
- 本地完成不等于远端验收：尚未推送、开 PR 或部署，T2 文件锁保持原登记。

### T6 Ranch 出口与描述重写 — Codex（2026-10-09）
- 分支：`claude/rewrite-ranch`（沿用现有独立工作树）
- 状态：👀 本地计划与验证完成，待人类审查；未合并 `main`
- 涉及文件：保留 26 个原有房间 ID；在 `prototype/js/data/ranch.js` 补原版 `front_deck`、静态出口、描述与可在本章表达的门状态；`tests/ranch-rewrite.test.mjs`、`scripts/verify_chapters_rules.js`（仅原版不对称出口白名单）、`prototype/CHAPTER_PLAN.md`、`prototype/RANCH_REWRITE_PLAN.md`、`prototype/RANCH_REWRITE_GAPS.md`、本文件和 `SHIP_PLAN.md`。
- 当前：27/27 房间由玩家方向命令可达；静态出口已映射项 98/98 一致；9 条条件方向与 28 条跨章未映射目标单列。两扇平台门与室内前门同步并经存档测试。逐项证据与未完成条件见 `prototype/RANCH_REWRITE_PLAN.md`，不把 98/98 解释为全章机制已还原。

### T7 未知输入回合修复 — Codex（2026-10-09）
- 人类明确授权修改 `engine.js`，并核对帮助老妇人的原版响应。
- 范围：`prototype/js/engine.js`、`tests/input-turns.test.mjs`、TASKS/SHIP_PLAN/progress 文档。
- 状态：👀 本地修复与验证完成；沿用当前试玩工作树；2026-10-11 随本次进度提交交付。
- 计划：原版真机核对 → 修复未知输入回合结算 → 覆盖房间事件、计时器与自动存档 → 全套及浏览器验证。
- 验收：30/30 测试、verify 通过；出口仍为既有 43 项偏差（本次无章节/出口改动）。浏览器确认未知输入不推进，wait 正常触发事件，无页面异常。

### T8 小模型意图识别 — Codex（2026-10-10）
- 人类要求接入语义识别小模型并继续开发；本轮授权覆盖所需运行时接线。
- 范围：新建 `prototype/js/intent*.js`；`engine.js`、`main.js`、`ui.js`、`parser.js`、`data/prologue.js`（仅已核实的老妇人互动）、`prototype/index.html`；相关 `tests/`、验证脚本与开发文档。
- engine.js 本轮文件锁：Codex（T2 原改动保留）。
- 状态：👀 本地功能与验证完成；47/47自动测试、13条真实模型语料、真实页面交互通过。远端CI/部署未执行。详细阶段与限制见 `prototype/SEMANTIC_PLAN.md`。
- 加载实测暴露公共CDN不可用/慢下载；范围补充资源准备脚本、package.json、.gitignore、README.md、deploy.yml。部署时下载已开源模型资源到忽略目录，静态站同源分发，不提交模型二进制。

### T9 全项目评估与稳定性优化 — Codex（2026-10-11）
- 授权：人类要求“全面评估整个项目，继续优化”，延续已授权的运行时修复与语义接线；保留全部既有工作。
- 分支：沿用试玩工作树 `claude/rewrite-ranch`；已 fetch，当前包含 origin/main，工作区有未提交改动，不重写历史。
- 范围：`prototype/js/{engine,parser,main,ui}.js`、相关 `tests/` 与浏览器回归脚本；`PROJECT_REVIEW.md`、README、ARCHITECTURE、TASKS/SHIP_PLAN/progress。本轮不改章节、物品、房间 ID 或地图，不引入新服务。
- 状态：👀 本轮评估与限定稳定性优化已验证；54/54 测试、规范校验、浏览器存档/安全渲染/窄屏、13 条真实模型回归通过。旧出口偏差仍为 43，严格报告 129 条待核偏差未改；2026-10-11 随本次进度提交交付，未部署。
- 具体计划、证据与后续验收条件：见 `PROJECT_REVIEW.md`。

### 2026-10-11 进度提交
- 人类要求推送当前进度；交付分支为 `claude/rewrite-ranch`，包含 Ranch 整合、T7/T8/T9 和相关验收文档，不合并或推送 main。
- 提交前重新执行 `npm test`（54/54）和 `npm run verify`（通过）；原版数据、模型资源与浏览器验收产物不纳入提交。

### T10 线上语义加载与短指令反馈 — Codex（2026-10-12）
- 人类报告重复下载、没有选项，并要求继续；延续语义/运行时修复授权。
- 分支 `codex/fix-intent-loading`，基于已部署 main `5581f48`；开工 fetch 遇网络连接失败，提交前重试已成功，主线仍为 5581f48。
- 范围：`prototype/js/{engine,intent,intent-model,intent-worker,ui}.js`、相关 tests / 浏览器回归脚本；TASKS、SHIP_PLAN、progress、SEMANTIC_PLAN。
- 计划：复现超时销毁 Worker 与短指令失败 → 复用未完成下载、区分超时/取消/拒识 → 缺宾语列合法候选、条件不满足明确反馈 → 慢下载/重复请求/页面重载缓存与原有通关回归。
- 不新增原版对话、不改地图、物品或英文剧情。状态：本地修复与验证完成，59/59 测试、规范、13 条真实模型语料、慢下载/重试/刷新缓存和买→喂鸟交互通过；按此前人类的合并部署授权进入发布流程。

- T10 线上闭环：PR #4 已合并部署，公开站实际验证模型只下载一次、超时重试/刷新缓存/候选确认/买→喂鸟通过；59/59 远端测试。线上进一步发现“压缩传输提前显示 100%”，PR #5 修正为已接收字节量，并提供线上长等待验收参数。

### T11 语义失败可诊断与下载稳健性 — pi（2026-10-12，待审查）
- 背景：试玩反馈“模型加载失败时重试也无法恢复，也没有报错码可以辅助排查”，与上游 PR #4/#5 属于同一问题域，但上游只改了超时复用与进度文案，失败仍是无阶段的通用错误。
- 范围：`prototype/js/{intent-worker,intent-model,main,ui}.js`、`tests/intent.test.mjs`、`prototype/SEMANTIC_PLAN.md`。**不动 `engine.js`，不引入设置层/同意流程**（设置层见 T13）。
- 内容：失败阶段（runtime/download/initializing/infer/worker）+ 原始 message 经 `onFailure` 进调试面板；库内部未处理 rejection 不再升级成 Worker 死亡事件（否则会作废正在进行的下载，与 PR #4 目标相冲）；运行时 huggingface.co → hf-mirror.com 回退；进度补文件名与 initializing 阶段（替换按小文件 done 闪烁的写法，已就绪不再多闪“复用”）。
- 验收：`npm test` 63/63、`npm run verify` 通过；浏览器实测冷启动无假 100%、初始化阶段可见、不可达源时镜像提示与 `stage=download` 诊断可见。

### T12 语义失败归因与「更多」入口 — pi（2026-10-12，待审查）
- 范围：新建 `prototype/js/intent-notice.js`、`tests/intent-notice.test.mjs`；修改 `ui.js`、`engine.js`（仅两行 `semanticHint?.()` 钩子）、`main.js`、`index.html`、`tests/boot-save.test.mjs`（stub 补 `setSemanticControls`/`semanticDebug`）、文档。
- 内容：失败提示后的小字归因 + 「更多」弹窗（× 可关、可重复点开、失败类提供重试）；超时/取消不重复播报；弹窗里说明原版动词表限制。不改执行行为、不动设置层。
- 验收：`npm test` 71/71、`npm run verify` 通过；浏览器实测归因小字、弹窗内容与 ×/重开交互。

### T13 同意流程、设置层与取消语义 — pi（2026-10-12，待审查）
- 范围：新建 `prototype/js/settings.js`；修改 `prototype/js/intent-notice.js`、`prototype/js/ui.js`、`tests/intent-notice.test.mjs`、文档。**不需要再改 engine.js**（钩子 T12 已加）。
- 内容：设备级设置（默认 `ask`，与存档分离）；首次需要时先征求同意才下载；取消下载＝停止并写回 `off`；就绪后的取消只放弃当次；超时不改设置、不毁 Worker；「更多」菜单在开启态可关闭/重试。
- 产品影响：首次自然语言输入不再自动开始下载模型，需玩家确认；其他行为不变。
- 验收：`npm test` 77/77、`npm run verify` 通过；浏览器实测征求→拒绝→「更多」启用→自动重跑→候选确认执行。

### T14 PR #6 审查修复 — Codex（2026-10-13）
- 授权：人类要求“修复问题，再合并”，允许更新 Traveler0014 的 PR 并经检查合并部署。
- 范围：`prototype/js/{intent,intent-model,intent-worker,intent-notice,ui}.js`、相关 tests / 浏览器验证脚本；TASKS、SHIP_PLAN、SEMANTIC_PLAN、progress。
- 计划：取消保留已就绪模型与真实就绪通知 → 过期同意窗口失效、重试核对状态 → 修正原版动词说明 → 集成与浏览器回归 → CI → 合并部署。
- 状态：👀 修复与本地验收完成，82/82 测试、规范及真实模型浏览器回归通过；出口无新增偏差。待远端 CI 后合并 PR #6；不改章节、地图、物品或原版英文剧情。
