# Trinity Relit

让经典 Infocom 文字冒险游戏重新可玩。

**[在浏览器中开始游戏](https://peanutfive.github.io/trinity-relit/)** — 打开即玩，无需安装、无需账号、无需 API Key。

---

## 为什么是 Trinity

`Trinity (1986)` 由 Brian Moriarty 编写、Infocom 出版，被广泛认为是 Infocom 最优秀的作品之一。游戏融合了历史与奇幻元素，以散文诗般的笔触探讨原子弹的毁灭性力量与核时代战争的徒劳。Trinity 之名，取自 1945 年 7 月人类第一次核爆炸试验的代号。

今天能玩到它的人很少了——需要安装解释器、在终端操作、用英文输入指令。门槛不在于游戏本身，在于运行环境和语言。Trinity Relit 从这里出发，试验几种降低门槛的方式。

---

## 怎么玩

直接用中文或英文输入你想做的事，例如：

```
往北走          看看那只纸鹤          拿起雨伞
n               examine the bird      take umbrella
```

方向、动作、以及「把伞给女孩」「用斧头砍泡泡」这类复合句都能识别。输入「帮助」查看完整指令提示。

目前实现 11 个章节、130 个房间，从伦敦肯辛顿花园一路到新墨西哥的三位一体试验场。主线可通关，但地图、条件机制和英文来源仍在逐项核对；本地开发版进度与公开站可能不同，见 [项目评估与优化计划](PROJECT_REVIEW.md)。

---

## 两种实现

### 方案 B：浏览器端中英解析器（主开发线）

`prototype/` 完全在浏览器本地运行，不需要推理服务器或 API Key。标准命令无需模型；自然表达识别会按需加载本地运行的小模型。

```bash
npm run dev
# 打开 http://127.0.0.1:8080/
```

- 纯静态 ES module，首屏与标准命令不等待模型
- 中/英文指令均支持，含把字句、用字句等复合结构
- 章节懒加载，首屏只加载序章

> 自然表达识别：parser 未能精确理解动作或目标时，按输入语言懒加载 BGE Small ZH / EN。模型从当前场景已有动作中提出建议，点击确认后由引擎检查条件并执行；取消、超时、拒识不消耗回合。模型不编写故事，也不能改变游戏规则。中文/英文量化权重分别约 24/34 MB，另需 tokenizer 与推理运行时。

本地准备同源模型资源（推荐，避免公共 CDN 无法访问）：

```bash
npm run prepare:models
# 官方模型源不可达时，可改用固定版本的公开镜像：
# npm run prepare:models -- --model-host https://hf-mirror.com
npm run dev -- --port 8081
```

资源下载到被 Git 忽略的 `prototype/vendor/intent/`，含来源记录和开源许可证。Pages 部署会自动准备这些资源；未准备时按需尝试公共源，失败后仍可使用标准命令。识别在浏览器内运行，指令不会发送给模型服务。详见 [语义识别实施计划](prototype/SEMANTIC_PLAN.md)。

### 方案 A：保留原作，加一层中文接口

`trinity_cn.py` 不动原版游戏逻辑，只在外面包一层 Gemini API：游戏输出翻译成中文，玩家的中文输入翻译成游戏命令。

```bash
# 需要: dfrotz, python3, google-genai, Gemini API Key
python3 trinity_cn.py
```

- 游戏输出实时翻译成简体中文
- 支持中文指令输入（"往北走"、"拿起伞"）
- 输入 `/原文` 显示上次英文原文

---

## 开发

```bash
npm run dev            # 本地起服务器
npm test               # 单元与完整主线回归
npm run verify         # 章节规范校验（CHAPTER_RULES.md §10）
npm run truth          # 从 TRINITY.DAT 生成出口真值表（需自备游戏文件）
npm run verify:exits   # 把章节出口与 Z-machine 真值逐条比对
```

文档索引：

| 文档 | 内容 |
|---|---|
| [`PROJECT_REVIEW.md`](./PROJECT_REVIEW.md) | 全项目评估、当前优化清单与剩余验收门槛 |
| [`SHIP_PLAN.md`](./SHIP_PLAN.md) | 发布收尾路线图与当前进度 |
| [`prototype/ARCHITECTURE.md`](./prototype/ARCHITECTURE.md) | 分层结构、事件执行路径、章节切换协议 |
| [`prototype/CHAPTER_PLAN.md`](./prototype/CHAPTER_PLAN.md) | 章节内容路线图与房间清单 |
| [`prototype/CHAPTER_RULES.md`](./prototype/CHAPTER_RULES.md) | 章节编写规范与引擎 API |
| [`prototype/MECHANISMS_VS_PLAN.md`](./prototype/MECHANISMS_VS_PLAN.md) | 已实现机制对照表 |

---

## 游戏文件与版权

出于版权原因，**本仓库不包含原版游戏文件，也不分发任何原版游戏数据**。运行方案 A 需要自行准备 `TRINITY.DAT`。方案 B 的英文描述来自原版，地图与出口以 `zparse.py` 的解析结果为准。

Trinity (1986) 的著作权归属 Infocom / Activision。本项目是非商业的独立致敬与可访问性实验，与版权方无关，也未获其背书。

---

## License

项目代码采用 [MIT](./LICENSE)。原版文本的权利不在此授权范围内。
