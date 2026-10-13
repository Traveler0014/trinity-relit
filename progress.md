Original prompt: 这里卡关了（Round Pond 场景中“捡起折纸鸟”和“拿折纸鸟”均无法识别）

## 2026-10-09

- 已复现：parser 正确产出 `{ verb: "take", noun: "折纸鸟" }`。
- 根因：`paper_bird` 的 aliases 有“纸鸟”“纸鹤”“折纸”，但缺少场景正文使用的完整名称“折纸鸟”，事件和通用拿取均无法解析到物品。
- 已补 `paper_bird` 的“折纸鸟”别名；通关路径改用用户原话“捡起折纸鸟”。
- 已增加独立回归，分别验证“捡起折纸鸟”和“拿折纸鸟”都能取得物品。
- 专项测试通过：`harness.test.mjs` 与 `walkthrough.test.mjs` 覆盖两条用户输入及完整序章路径。
- 全套验证通过：`npm run verify` 0 项不符合；`npm test` 29/29，通关 202 回合、77 间、21/100 分。
- 按技能要求运行 Playwright 客户端并检查截图 `/private/tmp/trinity-paper-bird-check/shot-0.png`，页面布局正常且无控制台错误。
- 在用户当前浏览器存档恢复到 Round Pond，实际输入“捡起折纸鸟”：显示原版拿取文本与 `[+3分]`，已越过卡点。
- TODO：无；用户可从当前页面继续试玩。

## 2026-10-09 未知输入与老妇人原版核对

- 人类明确授权修复 engine.js；修改仅撤销未被处理输入的预增回合并跳过 _postTurn，保留有效动作执行时的回合编号和已有系统命令行为。
- 新回归覆盖 parser 返回 null、已解析但无处理器、未知物品与空输入；断言完整持久状态、计时器回调、自动存档不变；有效 wait 仍推进剧情。
- 原版 dfrotz 每次从新局重放 scripts/commands_prologue.txt 到首次进入 Lancaster Gate，再分别测试 help woman/open umbrella/take umbrella/hold umbrella/xyzzyblah。原文仅保存 /tmp/trinity-woman-{0..4}.txt，不入库。
- 原版 help woman 有走近老妇人并停住的响应；open/take/hold umbrella 有走近她手中雨伞并停住的响应，随后揭示伤疤与风吹走雨伞。未知词只有词汇错误，不推进场景。反汇编相关例程 0x2c6b8（雨伞在老妇人手中），0x22788（试图走过）。不能把当前中文版不支持帮助句式误说成原版无响应。
- 本次按要求核对原版，尚未添加“帮她撑伞”的中文映射或改写章节事件。
- npm test 30/30；npm run verify 全过；verify:exits 既有 43 项偏差，本次只改引擎，没有地图变更。
- 技能 Playwright 客户端运行通过；独立浏览器使用本地真实模块验证：未知输入后 turns=0/counter=1/done=false，wait 后 turns=1/done=true；无 pageerror。截图 /tmp/trinity-input-browser/regression.png 已检查。
- 生效方式：刷新试玩页载入新模块；已有存档中已发生的剧情不会自动回滚。

## 2026-10-10 小模型语义识别

- 用户要求接入小模型，后续两次要求继续。未选择托管方式；按既有静态部署落地本地量化 BGE zh/en，按语言懒加载；第一次所有建议需玩家点击确认。
- 新增 intent 候选/提供方/Worker/排序模块；精确命令先走 parser；未识别目标允许模型处理，模型只返回候选ID。
- 推理与确认期间不增加回合；取消/超时/错误/旧状态响应不推进；确认后再次生成候选验证再调用正常处理器。输入忙保护和 UI finally 恢复已接入。
- 已补原版 help woman 和 open/take/hold umbrella 的两个事件，共用伤疤/风吹场景，按原版停止帮助，无凭空持伞。
- 原有+新增测试目前46项，最近一轮旧全套44项及新增2专项均通过；最终待统一重跑。
- 真实浏览器：jsDelivr根入口连接失败；直接dist+unpkg成功载入库，但模型权重85秒未完成。不可把该结果称为模型可用。
- 正在准备同源模型资源与许可证，通过 prepare:models 下载到Git忽略目录；Pages流程准备静态资产。不提交原版或派生数据。

## 2026-10-11 语义识别完成本地验收

- 从自动审批额度故障中续跑；修正ONNX许可证来源，固定BGE仓库commit。官方源连接超时，使用同commit的hf-mirror完成下载。资源在Git忽略的prototype/vendor/intent，约79.3MB。
- 新增scripts/verify_intent_browser.mjs，可复跑13条真实模型样例。8条有效动作包含正确候选（top1为7/8），3条先澄清，2条拒识；初始英文乱码误列候选已通过独立英文0.65门槛修复。样例用于校准，不是全游戏识别率。
- 中文模型冷启动约475ms，英文283ms，后续约7–92ms（本机同源）；UI首个候选802ms。真实纸鸟拿取+3分、帮她撑伞原版响应、取消与否定不计回合，浏览器pageerror为空。
- 已运行技能Playwright客户端并查看截图；另查看/tmp/trinity-semantic-final/woman-suggestion.png、paper-taken.png、cancelled.png，布局和按钮正常。
- npm test 47/47，verify全过，verify:exits仍43项旧偏差；没有地图改动。
- 已更新SEMANTIC_PLAN逐项验收、README、TASKS、SHIP_PLAN和现行架构说明。开发服务器8081已重启，用户原浏览器存档未被测试修改。
- 剩余限制：公开网络下载与移动端未实测；向量模型存在歧义，首版所有建议均需确认；模型只覆盖已有合法动作。尚未提交/推送或部署。


## 2026-10-11 全项目评估与基础稳定性

- 用户要求“全面评估整个项目，继续优化”。先 fetch 并确认 HEAD 包含主线，保留脏工作区；未提交/推送。
- 新增 `PROJECT_REVIEW.md`：11 章 / 130 房间 / 39 物品 / 125 房间事件；严格静态出口 262 一致、65 缺失、11 错目标、53 额外，另列 102 条条件与 79 条无法比对；58 间描述预筛待核（不是不合规裁决）。
- 修复 UI 文本注入、坏档字段及未知计时器、导入先校验后覆盖、首房间初始化、失败切章进度变动、英文冠词与死亡提示。没有改章节原文或地图。
- 54/54 测试；完整主线仍 202 回合 / 77 间 / 21 分；章节规范通过；旧出口仍 43 项；真实模型 13/13；浏览器首局/续玩/导入导出/坏档保护/文本转义/离线标准命令/390px 窄屏通过，页面异常 0。
- 独立 Ranch 测试现在显式模拟序章完成，不能携带序章倒计时直接跳章；真实主线不绕过开局计时器。
- 浏览器产物 `/tmp/trinity-runtime-review/`；技能截图 `/tmp/trinity-review-skill/shot-0.png`；真实模型 `/tmp/trinity-review-intent.json`。检查截图并补等待滚动结束的截图断言。
- 已校正 README / SHIP_PLAN / ARCHITECTURE 的当前状态；下一步按 PROJECT_REVIEW 的地图证据→条件机制→全文来源→跨章输入语料→发布验收顺序推进，保留旧文件名/ID。

## 2026-10-11 进度交付

- 人类要求先推送当前进度；将 T7/T8/T9 未提交改动汇总，目标 `origin/claude/rewrite-ranch`。
- fetch 后主线已是当前 HEAD 祖先；脏工作区不能直接 rebase，先完成进度提交，再执行 rebase origin/main 并推送开发分支。
- 提交前重跑 54/54 测试、章节规范和 diff 空白校验；模型资源、DAT、派生真值和临时截图排除，不推 main。


## 2026-10-12 重复下载与短输入反馈

- 用户反馈线上模型反复下载、没有选项，确认当前是 BGE Small ZH/EN embedding，不是对话生成模型。
- 建立 `codex/fix-intent-loading`，基于已部署 main 5581f48；fetch 网络连接失败，未修改远端。
- 发现 90 秒 timeout 使用通用 abort，LocalIntentResolver 随即销毁 Worker；未完成的模型下载下次从头开始，UI 却落入“无法确定”。改为 timeout 仅取消单个请求，Worker 和初始化 Promise 保留；显式取消仍终止。
- 加入缺宾语事件确认候选、条件不满足反馈；Broad Walk “买”无需模型可选择买面包屑，之后“喂鸟”执行。该房间没有询问妇人的已实现原版事件，不补对话。
- 59/59 测试、章节规范通过；旧出口仍 43；13 条真实模型语料通过。
- 真实慢加载测试：推迟 onnx 请求，300ms 超时后重试；两次识别同一 Worker/一次下载；刷新页面第 2 个 Worker 仍 Cache Storage 命中，模型下载总次数 1。HTTP cache 经路由禁用，Cache Storage 仍启用；状态保护和买→喂鸟通过，无 pageerror。
- 截图与结果 `/tmp/trinity-intent-lifecycle/`；技能启动截图 `/tmp/trinity-intent-fix-skill/shot-0.png`。补截图滚动等待，确保可见候选。
- 当前改动仅本地，尚未推送/部署；下一步发布前同步主线，线上验证慢网仍应继续补充。

- 发布前远端连接恢复，fetch 与 GitHub API 确认 main 仍为 5581f48。沿用本轮游戏发布授权，将已验证修复经 PR 检查后合并部署；实际状态以远端工作流结果为准。

- 线上慢网观测发现 progress 在读取约 16 MB 后报告 100%，随后仍继续接收至 22 MB 以上：压缩 Content-Length 与解压流长度不一致。UI 改为显示已接收 MB，完成阶段以资源 done / 模型 recognizing 事件为准，补浏览器回归防止“假完成”。

- 线上长等待真实验收已通过，报告 `/tmp/trinity-intent-production-lifecycle/result.json`：ONNX 下载 1 次，刷新后 Worker 总数 2，确认候选可见、买→喂鸟成功，无 pageerror。首次联网确实耗时数分钟；脚本增加 `--timeout-ms`，本地默认 15 秒，公网可传 600000。PR #4 已部署，PR #5 收尾进度 UI。


## 2026-10-13 PR #6 修复与合并验收

- 人类要求修复审查发现的问题后合并。开发计划与范围登记 T14。
- 取消保留已就绪模型；独立 ready 通知覆盖首次推理前和后台加载后；Worker 销毁同步清空状态。
- 过期同意窗口关闭且旧按钮失效；所有菜单重试核对原游戏状态，读档/换房间后不重放；菜单原版动词说明修正。
- 82/82 测试、章节规范通过；出口报告与 main 基线逐字一致（既有 43 项）。真实浏览器 Worker 1、ONNX 下载 1、无异常，取消不推进，确认只执行 1 回合。截图 /tmp/trinity-pr6-browser 与 /tmp/trinity-pr6-skill 已复核。
- Git HTTPS fetch 两次连接超时；GitHub API 可用且确认 main 仍为 7ee0043、PR 头仍为 5049388。发布前继续同步校验，暂未合并。
