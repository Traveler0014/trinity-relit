# AGENTS.md — Trinity Relit

本文件是项目规则的**唯一权威来源**，Claude Code（经 CLAUDE.md 引用）与 Codex 共用。
`.cursor/rules/*.mdc` 为历史副本，与本文件冲突时以本文件为准。

## 项目概况

浏览器端中英双语文字冒险，忠实还原 Infocom 的 Trinity (1986)。
`prototype/` 是纯静态 ES module，无构建步骤、无运行时依赖。推送到 `main` 会自动部署到 GitHub Pages。

### 关键文件

| 文件 | 说明 |
|---|---|
| `prototype/js/engine.js` | GameState + GameEngine。**未经人类明确要求不得修改** |
| `prototype/js/parser.js` | 中英文输入解析 |
| `prototype/js/data/*.js` | 章节数据（房间、事件），每章一个文件 |
| `prototype/js/data/items.js` | 全部物品 |
| `prototype/js/ui.js` / `main.js` | DOM 与启动流程 |
| `prototype/js/embedding*.js` | 语义兜底，**当前未启用**，不要放回启动路径 |
| `zparse.py` | 从 `Trinity 1986/TRINITY.DAT` 提取 Z-machine 数据 |

### 必读文档

- `SHIP_PLAN.md` — 发布路线图与当前进度
- `prototype/ARCHITECTURE.md` — 分层结构、事件执行路径、章节切换协议
- `prototype/CHAPTER_PLAN.md` / `CHAPTER_RULES.md` — 章节内容与编码规范（改章节前必读）

## 核心原则

1. **所有英文文本必须来自 1986 原版**。绝不自创英文内容。
2. **地图结构必须与 Z-machine 数据一致**（以 `zparse.py` / `extract_exit_truth.py` 结果为准）。
3. **版权隔离**：`.DAT`、`trinity_*.json`、`scripts/exit_truth.json` 等原版及派生数据永远不得提交。提交前检查 `git status`。

## 章节数据规则（`prototype/js/data/*.js`）

工作流：先用 `zparse.py` 提取房间数据 → 从 dfrotz transcript 取原文 → 按模板编写 → 全部校验通过。

文本格式：`"Original English from Infocom.\n\n中文翻译。"`

```javascript
room_id: {
  name: "English Name", cn: "中文名",
  desc(s) { return "English.\n\n中文。"; },
  exits(s) { return { n: "other_room" }; },
  onEnter(s, eng) {},
  events: [{ id: "x", match: {verb:[],noun:[]}, triggers: [], when: s=>true, act(s,eng){}, text: "" }],
}
```

- 字符串含 `"` 时用单引号 `'...'`。
- 每个 `onTurn` 必须以 `if (s.room !== "this_room_id") return;` 开头。
- `act()` 先执行、`text` 后输出；若 `act` 内已 `eng.print()`，则 `text` 设为 `""`。
- 出口的 `act` 中不要调用 `eng.moveTo()`，引擎会在 act 之后自动移动。
- 同一房间的 events 中，`when` 条件更具体的放前面。
- 只使用 `CHAPTER_RULES.md` §4 列出的状态 API。
- Z-machine 方向属性：63=N 62=NE 61=E 60=SE 59=S 58=SW 57=W 56=NW 55=UP 54=DOWN 53=IN 52=OUT。2 字节值 = 房间对象号；3 字节以上 = 条件例程。

## 命令

```bash
npm run dev -- --port 8080   # 本地服务器；并行开发时两边用不同端口
npm run verify               # 章节规范校验（CI 也会跑）
npm run truth                # 生成出口真值表（需本地 TRINITY.DAT）
npm run verify:exits         # 出口与 Z-machine 真值比对（仅本地可跑）
npm test                     # 通关测试（阶段 2 完成后可用）
```

**完成标准**：`npm run verify` 输出 0 项不符合；有 `TRINITY.DAT` 时 `npm run verify:exits` 不新增偏差；存在测试时 `npm test` 通过。未通过前不得声称任务完成。

## 多 agent 协作规则

本项目由 Claude Code 与 Codex 并行开发，各自在独立的 git worktree 和分支中工作。

1. **开工前先读 `TASKS.md`**，只做分配给自己的任务，只改该任务「涉及文件」一栏列出的文件。
2. 需要改范围外的文件（尤其是 `engine.js`、`parser.js`、`items.js`）时，**停下来问人类**，不要自行扩大范围。
3. **不要直接推送或合并到 `main`**（会触发部署）。在自己的分支提交，由人类开 PR 合并。
4. 分支命名以 agent 为前缀：`claude/<任务>`、`codex/<任务>` 或 `pi/<任务>`。
5. 开工前和提交前先 `git fetch && git rebase origin/main`，保持与对方已合并的工作同步。
6. 完成任务后更新 `TASKS.md` 中该任务的状态，并在 `SHIP_PLAN.md` 的进度跟踪中打勾。
7. 审查对方代码时，重点检查：是否越出文件范围、是否自创英文文本、是否提交了版权数据、校验是否真的通过。
8. 提交信息沿用仓库风格：`类型: 简述`（如 `feat:`、`fix:`、`docs:`、`test:`），中文描述。
