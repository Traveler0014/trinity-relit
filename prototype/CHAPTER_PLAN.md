# Trinity Relit — 章节开发总计划

> 本文档是所有后续章节开发的**权威路线图**。
> 调用 subagent 时必须引用本文档对应章节，要求按此计划执行。
> 编码规范见 `CHAPTER_RULES.md`；引擎 API 见 `CHAPTER_RULES.md §4`。

---

## 全局概览

| # | 章节 ID | 区域名 | 房间数 | 状态 | 依赖 |
|---|---------|--------|--------|------|------|
| 1 | `prologue` | Kensington Gardens, London | 11 | ✅ 完成 | — |
| 2 | `wabe` | The Wabe（中央枢纽） | 30 | ✅ 完成 | prologue |
| 3 | `japan` | Japanese Playground（广岛） | 2 | ✅ 完成 | wabe |
| 4 | `underground` | Underground（地下） | 3 | ✅ 完成 | wabe |
| 5 | `orbit` | Earth Orbit（地球轨道） | 2 | ✅ 完成 | wabe |
| 6 | `pacific` | Pacific Island（比基尼环礁） | 7 | ✅ 完成 | wabe |
| 7 | `tundra` | Russian Tundra（苏联冻原） | 11 | ✅ 完成 | wabe |
| 8 | `islet` | Islet（过渡小岛） | 2 | ✅ 完成 | wabe |
| 9 | `desert` | New Mexico Desert + Tower | 34 | ✅ 完成 | islet |
| 10 | `ranch` | McDonald Ranch（牧场） | 27 | 🔨 原版复核中 | desert |
| 11 | `finale` | Finale（终章） | ~3 | ✅ 完成 | ranch |

**总计：约 130 个房间**

### 开发顺序原则

1. **先枢纽后分支**：先完成 The Wabe（所有蘑菇门的起点），再开发各分支
2. **先小后大**：Japan (2) → Underground (3) → Orbit (2) → Pacific (7) → Tundra (11)
3. **最后主线**：Islet → Desert (34) → Ranch (27) → Finale
4. 每完成一个章节，立即做完整性验证，再进入下一个

---

## 章节 2：The Wabe（中央枢纽）

**文件**：`prototype/js/data/wabe.js`
**房间数**：30
**优先级**：🔴 最高（所有后续章节的前提）

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 576 | `meadow` | Meadow | 入口草地 |
| 323 | `summit` | Summit | 山顶 |
| 319 | `south_bog` | South Bog | 南沼泽 |
| 42 | `north_bog` | North Bog | 北沼泽 |
| 575 | `bottom_of_stairs` | Bottom of Stairs | 楼梯底部 |
| 316 | `vertex` | Vertex | 日晷顶点（核心枢纽） |
| 317 | `trellises` | Trellises | 棚架 |
| 462 | `arboretum` | Arboretum | 植物园 |
| 408 | `top_of_arbor` | Top of Arbor | 藤架顶部 |
| 4 | `north_arbor` | North Arbor | 北侧藤架 |
| 430 | `south_arbor` | South Arbor | 南侧藤架 |
| 418 | `arborvitaes_n` | Arborvitaes | 北侧崖柏 |
| 580 | `arborvitaes_s` | Arborvitaes | 南侧崖柏 |
| 306 | `chasms_brink` | Chasm's Brink | 深渊边缘 |
| 472 | `waterfall` | Waterfall | 瀑布（→ Orbit 蘑菇门） |
| 449 | `ice_cavern` | Ice Cavern | 冰穴 |
| 400 | `under_cliff` | Under Cliff | 悬崖下 |
| 213 | `bluff` | Bluff | 断崖 |
| 414 | `cemetery` | Cemetery | 墓地 |
| 353 | `barrow` | Barrow | 古墓 |
| 522 | `ossuary` | Ossuary | 纳骨堂（→ Underground 蘑菇门） |
| 370 | `promontory` | Promontory | 岬角 |
| 327 | `cottage` | Cottage | 小屋 |
| 417 | `herb_garden` | Herb Garden | 药草园（→ Tundra 蘑菇门） |
| 471 | `moor` | Moor | 荒野（→ Japan 蘑菇门） |
| 557 | `the_bend` | The Bend | 弯道 |
| 426 | `forest_clearing` | Forest Clearing | 林中空地 |
| 565 | `the_river` | The River | 河流（→ Islet 蘑菇门） |
| 441 | `craters_edge` | Crater's Edge | 陨石坑边缘 |
| 145 | `crater` | Crater | 陨石坑 |

### 核心机制

1. **日晷系统**（已在 `GameState` 中预留 `sundialSymbol` 属性）
   - Vertex 房间有日晷和符号环（7 个天文符号）
   - 转动符号环改变 `sundialSymbol` 值 (1-7)
   - 不同符号值打开不同的蘑菇门
   - 符号-门映射：Mars(♂)→Japan, Pluto(♇)→Underground, Mercury(☿)→Orbit, Neptune(♆)→Pacific, Libra(♎)→Tundra, Alpha(α)→Islet

2. **Klein 瓶 / Arboretum 翻转**（已预留 `flipped` 属性）
   - Arboretum 区域可以"翻转"
   - 翻转后方向关系改变

3. **蘑菇门**
   - 每个蘑菇门是条件出口
   - `when` 检查 `sundialSymbol` 是否匹配
   - 进入后蘑菇门可能关闭

4. **Cottage 中的关键物品**
   - 肥皂泡（soap bubble）— 进入 Earth Orbit 的必需品
   - 其他工具

### 需要添加的物品（items.js）

从 Z-machine 对象树提取，至少包括：
- `sundial` — 日晷（fixed，在 vertex）
- `ring` — 符号环（fixed，在 vertex）
- `toadstool_*` — 各蘑菇门（fixed，各所在房间）
- `soap_bubble` — 肥皂泡
- `axe` — 斧头（cottage 中）
- `umbrella_wabe` — 序章带入的雨伞
- `skink` — 蜥蜴
- `walnut` — 核桃
- 其他（从 zparse.py 提取完整列表）

### 引擎扩展需求

- 日晷符号切换的事件系统
- 蘑菇门的条件出口模板（可复用）
- Klein 翻转后的方向映射

### 子任务拆分

| 步骤 | 内容 | 预估工作量 |
|------|------|-----------|
| 2.1 | 用 zparse.py 提取 30 个房间的出口连通图 | 小 |
| 2.2 | 用 dfrotz 提取所有 30 个房间的文本 | 大 |
| 2.3 | 编写 wabe.js：先写 10 个核心房间（meadow→vertex→cottage 路径） | 大 |
| 2.4 | 编写 wabe.js：再写 10 个中间房间 | 大 |
| 2.5 | 编写 wabe.js：最后 10 个房间 + 蘑菇门 | 大 |
| 2.6 | 在 items.js 添加 Wabe 物品 | 中 |
| 2.7 | 在 main.js 注册章节 | 小 |
| 2.8 | 修改 prologue.js 的 wading 房间过渡事件 | 小 |
| 2.9 | 全流程验证 | 中 |

---

## 章节 3：Japanese Playground（广岛）

**文件**：`prototype/js/data/japan.js`
**房间数**：2
**优先级**：🟡 中

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 127 | `playground` | Playground | 游乐场 |
| 36 | `shelter` | Shelter | 避难所 |

### 核心机制

- 从 Moor 的蘑菇门进入（Mars ♂ 符号）
- 纸鹤谜题
- 历史场景：广岛原子弹前夕
- 通过白门返回 Wabe

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 3.1 | zparse.py 提取 2 个房间出口 + 物品 |
| 3.2 | dfrotz 提取文本 |
| 3.3 | 编写 japan.js |
| 3.4 | items.js 添加物品 |
| 3.5 | main.js 注册 + wabe.js 添加蘑菇门过渡 |
| 3.6 | 验证 |

---

## 章节 4：Underground（地下）

**文件**：`prototype/js/data/underground.js`
**房间数**：3
**优先级**：🟡 中

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 30 | `underground_1` | Underground | 地下通道 1 |
| 87 | `underground_2` | Underground | 地下通道 2 |
| 131 | `underground_3` | Underground | 地下通道 3 |

### 核心机制

- 从 Ossuary 的蘑菇门进入（Pluto ♇ 符号）
- 地下核试验场景
- 需要灯光物品

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 4.1 | zparse + dfrotz 数据提取 |
| 4.2 | 编写 underground.js |
| 4.3 | items.js + main.js 更新 |
| 4.4 | 验证 |

---

## 章节 5：Earth Orbit（地球轨道）

**文件**：`prototype/js/data/orbit.js`
**房间数**：2
**优先级**：🟡 中

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 124 | `orbit_satellite` | Earth Orbit! on a satellite | 卫星上 |
| 425 | `orbit_space` | Earth Orbit | 地球轨道 |

### 核心机制

- 从 Waterfall 的蘑菇门进入（Mercury ☿ 符号）
- **需要先在 Cottage 获得 soap bubble**
- 太空核爆场景
- 零重力机制

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 5.1 | zparse + dfrotz 数据提取 |
| 5.2 | 编写 orbit.js |
| 5.3 | items.js + main.js 更新 |
| 5.4 | 验证 |

---

## 章节 6：Pacific Island（比基尼环礁）

**文件**：`prototype/js/data/pacific.js`
**房间数**：7
**优先级**：🟡 中

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 76 | `mesa` | Mesa | 台地（蘑菇门入口） |
| 394 | `scaffold` | Scaffold | 脚手架 |
| 344 | `bottom_scaffold` | Bottom of Scaffold | 脚手架底部 |
| 224 | `north_beach` | North Beach | 北海滩 |
| 231 | `west_beach` | West Beach | 西海滩 |
| 215 | `east_beach` | East Beach | 东海滩 |
| 476 | `south_beach` | South Beach | 南海滩 |

### 核心机制

- 从 Mesa 的蘑菇门进入（Neptune ♆ 符号）
- 比基尼环礁核试验场景
- 信号弹 / 定时器
- 需要在脚手架上操作

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 6.1 | zparse + dfrotz 数据提取 |
| 6.2 | 编写 pacific.js（7 个房间） |
| 6.3 | items.js + main.js 更新 |
| 6.4 | 验证 |

---

## 章节 7：Russian Tundra（苏联冻原）

**文件**：`prototype/js/data/tundra.js`
**房间数**：11
**优先级**：🟡 中

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 56 | `tundra_1` | Tundra | 冻原区域 1 |
| 119 | `tundra_2` | Tundra | 冻原区域 2 |
| 188 | `tundra_3` | Tundra | 冻原区域 3 |
| 254 | `tundra_4` | Tundra | 冻原区域 4 |
| 320 | `tundra_5` | Tundra | 冻原区域 5 |
| 380 | `tundra_6` | Tundra | 冻原区域 6 |
| 509 | `tundra_7` | Tundra | 冻原区域 7 |
| 585 | `tundra_8` | Tundra | 冻原区域 8 |
| 488 | `under_platform` | Under Platform | 平台下方 |
| 43 | `cliff_edge` | Cliff Edge | 悬崖边 |
| 199 | `platform` | Platform | 平台 |

### 核心机制

- 从 Herb Garden 的蘑菇门进入（Libra ♎ 符号）
- 苏联核试验场景
- 多个同名"Tundra"房间（需用 obj# 区分）
- 隐蔽 / 时间限制机制

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 7.1 | zparse + dfrotz 数据提取（注意 8 个同名房间的区分） |
| 7.2 | 编写 tundra.js |
| 7.3 | items.js + main.js 更新 |
| 7.4 | 验证 |

---

## 章节 8：Islet（过渡小岛）

**文件**：`prototype/js/data/islet.js`
**房间数**：2
**优先级**：🟠 高（进入最终区域的必经之路）

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 5 | `islet` | Islet | 小岛 |
| 501 | `sand_bar` | Sand Bar | 沙洲 |

### 核心机制

- 从 The River 乘船到达（Alpha α 符号）
- 冥河渡船 Charon
- 最终白门 → New Mexico Desert

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 8.1 | zparse + dfrotz 数据提取 |
| 8.2 | 编写 islet.js |
| 8.3 | main.js 注册 + wabe.js 添加 River 过渡 |
| 8.4 | 验证 |

---

## 章节 9：New Mexico Desert + Tower（新墨西哥沙漠）

**文件**：`prototype/js/data/desert.js`
**房间数**：34
**优先级**：🟠 高（主线结局区域）

### 房间列表（关键房间）

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 146 | `base_of_tower` | Base of Tower | 塔底 |
| 158 | `tower_platform` | Tower Platform | 塔台 |
| 247 | `tower_landing` | Tower Landing | 塔台平台 |
| 290 | `east_of_tower` | East of Tower | 塔东 |
| 296 | `north_of_tower` | North of Tower | 塔北 |
| 311 | `west_of_tower` | West of Tower | 塔西 |
| 210 | `nw_of_tower` | Northwest of Tower | 塔西北 |
| 381 | `ne_of_tower` | Northeast of Tower | 塔东北 |
| 466 | `south_of_tower` | South of Tower | 塔南 |
| 219 | `sw_of_tower` | Southwest of Tower | 塔西南 |
| 174 | `outside_blockhouse` | Outside Blockhouse | 碉堡外 |
| 544 | `crossroads` | Crossroads | 十字路口 |
| 109, 120, 226, 293, 382, 534 | `paved_road_*` | Paved Road | 铺设道路（6 段） |
| 437 | `behind_shed` | Behind the Shed | 棚屋后 |
| 132, 159, 239, 465, 480, 497, 510, 529, 577 | `desert_*` | Desert | 沙漠（9 段） |
| 180, 222, 225 | `foothills_*` | Foothills | 山麓（3 段） |
| 456 | `shallow_crater` | Shallow Crater | 浅坑 |
| 493 | `jeep` | Jeep | 吉普车内 |
| 507 | `shack` | Shack | 小屋 |

### 核心机制

- 三位一体核试验（Trinity Test）原址
- 塔（Tower）是核弹 "The Gadget" 所在地
- 吉普车系统（Jeep，Obj#493 — 可能需要特殊移动逻辑）
- 大量同名房间（Desert ×9, Paved Road ×6, Foothills ×3）
- 最终倒计时：核爆前的时间限制
- 与 Ranch 区域相连

### 引擎扩展需求

- 吉普车驾驶机制（可能需要新的移动模式）
- 大区域同名房间的区分（描述需根据朝向/位置动态变化）

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 9.1 | zparse 提取全部 34 个房间出口连通图 |
| 9.2 | dfrotz 系统性提取文本（分批：塔区、道路、沙漠、山麓） |
| 9.3 | 编写 desert.js 批次 1：塔区（tower 相关 10 个房间） |
| 9.4 | 编写 desert.js 批次 2：道路 + 十字路口（7 个房间） |
| 9.5 | 编写 desert.js 批次 3：沙漠 + 山麓（12 个房间） |
| 9.6 | 编写 desert.js 批次 4：特殊房间（blockhouse、shack、jeep 等） |
| 9.7 | items.js 更新 |
| 9.8 | 验证 |

---

## 章节 10：McDonald Ranch（牧场）

**文件**：`prototype/js/data/ranch.js`
**房间数**：27（原有 26 个 ID + 原版 Front Deck #6）
**优先级**：🟠 高（主线结局的一部分）

### 房间列表（关键房间）

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 240 | `hallway` | Hallway | 走廊（中心） |
| 1 | `nw_room` | Northwest Room | 西北房间 |
| 12 | `spare_room` | Spare Room | 备用房间 |
| 21 | `kitchen` | Kitchen | 厨房 |
| 175 | `bathroom` | Bathroom | 浴室 |
| 214 | `bedroom` | Bedroom | 卧室 |
| 442 | `assembly_room` | Assembly Room | 组装室（核心！） |
| 460 | `se_room` | Southeast Room | 东南房间 |
| 352 | `closet` | Closet | 壁橱 |
| 37 | `sw_yard` | Southwest Yard | 西南院子 |
| 139 | `ne_yard` | Northeast Yard | 东北院子 |
| 477 | `se_yard` | Southeast Yard | 东南院子 |
| 297 | `back_yard` | Back Yard | 后院 |
| 573 | `front_yard` | Front Yard | 前院 |
| 6 | `front_deck` | Front Deck | 前平台 |
| 345 | `icehouse` | Icehouse | 冰库 |
| 122 | `nw_ranch` | Northwest of Ranch | 牧场西北 |
| 372 | `se_ranch` | Southeast of Ranch | 牧场东南 |
| 515 | `sw_ranch` | Southwest of Ranch | 牧场西南 |
| 558 | `ne_ranch` | Northeast of Ranch | 牧场东北 |
| 292 | `north_reservoir` | North of Reservoir | 水库北 |
| 336 | `edge_reservoir` | Edge of Reservoir | 水库边缘 |
| 457 | `reservoir` | Reservoir | 水库 |
| 242 | `underwater` | Underwater | 水下 |
| 300 | `under_windmill` | Under the Windmill | 风车下 |
| 540 | `windmill` | Windmill | 风车 |
| 559 | `south_reservoir` | South of Reservoir | 水库南 |

### 核心机制

- Assembly Room 是历史上组装原子弹核心（The Gadget）的地方
- 水库 + 水下区域（需要游泳 / 潜水机制）
- 风车谜题
- 与 Desert 区域连通

### 子任务拆分

| 步骤 | 内容 |
|------|------|
| 10.1 | zparse 提取出口 + 物品 |
| 10.2 | dfrotz 系统性提取文本 |
| 10.3 | 编写 ranch.js 批次 1：室内（hallway + 8 个房间） |
| 10.4 | 编写 ranch.js 批次 2：院子 + 外围（8 个房间） |
| 10.5 | 编写 ranch.js 批次 3：水库区（6 个房间） |
| 10.6 | items.js 更新 |
| 10.7 | 验证 |

---

## 章节 11：Finale（终章）

**文件**：`prototype/js/data/finale.js`
**房间数**：~3
**优先级**：🔵 最后

### 房间列表

| Obj# | 房间 ID | 英文名 | 说明 |
|------|---------|--------|------|
| 48 | `the_end` | The End | 结局 |
| 80 | `halfway` | Halfway | 过渡 |
| 166 | `thin_air_bird` | Thin Air | 骑巨鸟飞行 |
| 208 | `thin_air` | Thin Air | 空中 |

### 核心机制

- 游戏的最终结局
- 时间循环揭示
- 回到 Kensington Park（复用 prologue 房间）
- 分数统计 + 结局文本

---

## Subagent 调用规范

### 调用模板

当调用 subagent 编写章节时，**必须**在 prompt 中包含以下信息：

```
你正在为 Trinity Relit 项目编写章节 [章节ID]。

## 必读文件
1. `prototype/CHAPTER_RULES.md` — 编码规范（必须严格遵循）
2. `prototype/CHAPTER_PLAN.md` — 本计划的对应章节部分
3. `prototype/js/data/prologue.js` — 参考已完成的范例
4. `prototype/js/engine.js` — 引擎 API
5. `.cursor/rules/chapter-authoring.mdc` — 关键编码规则

## 当前任务
执行 CHAPTER_PLAN.md 中章节 [#] 的步骤 [X.Y]：[具体描述]

## 约束
- 所有英文文本必须来自原版 Infocom Trinity (1986)，禁止原创
- 中文翻译紧跟英文，用 \n\n 分隔
- 地图结构以 Z-machine 解析数据为准
- 必须通过 CHAPTER_RULES.md §10 的全部验证检查
- 字符串包含引号时外层必须用单引号
- 每个 onTurn 必须以房间守卫开头
```

### 数据提取调用

```
你正在为 Trinity Relit 项目的章节 [章节ID] 提取数据。

## 步骤 1：Z-machine 数据提取
运行 zparse.py 提取以下对象号的房间数据：[obj# 列表]
提取内容：房间名、出口方向（属性 52-63）、子对象（物品）

## 步骤 2：dfrotz 文本提取
使用 dfrotz 游玩到目标区域，记录：
- 每个房间的 verbose 描述
- 可交互物品的 examine 输出
- 关键动作的响应文本
- 失败/错误提示

## 输出格式
返回一个结构化的数据报告，包含：
1. 房间连通图（JSON 格式）
2. 完整文本（原始英文）
3. 物品列表及其初始位置
```

### 验证调用

```
你正在验证 Trinity Relit 的章节 [章节ID]。

## 验证清单（全部必须通过）
1. 语法检查：node -e 无错误
2. 出口联通：所有 exit 目标存在于 ROOMS
3. 双向出口：与 Z-machine 数据一致
4. 物品交叉引用：events 中的 item ID 在 items.js 中存在
5. API 兼容：所有 s.xxx() / eng.xxx() 在 CHAPTER_RULES.md §4 中列出
6. 引号安全：无未转义的引号
7. onTurn 守卫：每个 onTurn 以 if (s.room !== "xxx") return; 开头
8. 事件 ID 唯一：同房间内无重复
9. 文本格式：英文\n\n中文

如果验证失败，执行 CHAPTER_RULES.md §1 Phase 5 的冲突检测流程。
```

### 冲突解决协议

当 subagent 遇到冲突时，按以下优先级解决：

1. **Z-machine 数据 > dfrotz 文本 > 推测**
   - 房间出口方向：以 zparse.py 提取的属性值为准
   - 文本内容：以 dfrotz 实际输出为准
   - 无法确认时：标记 `// TODO: verify with dfrotz` 并继续

2. **已完成章节 > 新章节**
   - 如果新章节的出口指向已完成章节的房间，不修改已完成章节
   - 在新章节中适配已有的房间 ID

3. **引擎 API > 自定义逻辑**
   - 优先使用 engine.js 已有的方法
   - 如果需要新功能，在 act() 中用现有 API 组合实现
   - 除非绝对必要，不修改 engine.js

---

## 引擎扩展计划

以下功能可能在后续章节中需要，在遇到时再实现：

| 功能 | 需要的章节 | 优先级 |
|------|-----------|--------|
| 日晷符号切换 | wabe | 🔴 |
| Klein 瓶翻转 | wabe | 🔴 |
| 蘑菇门条件出口模板 | wabe | 🔴 |
| 肥皂泡包裹 / 零重力 | orbit | 🟡 |
| 吉普车移动模式 | desert | 🟡 |
| 游泳 / 潜水 | ranch | 🟡 |
| 时间循环结局 | finale | 🔵 |

这些扩展应在对应章节开发时一并实现，不提前添加。

---

## 进度跟踪

开发完成后在此处标记：

- [x] Chapter 1: Prologue — 2026-03-09
- [x] Chapter 2: The Wabe — 2026-03-10（30 房间 + 日晷/蘑菇门 + Klein 瓶翻转 + 验证通过）
- [x] Chapter 3: Japanese Playground — 2026-03-10（2 房间 + 纸鹤/雨伞/铲子谜题 + 向北向南致命 + 白门回 Wabe）
- [x] Chapter 4: Underground — 2026-03-10（3 房间 + 灯笼/尸妖/裂缝石龙子 + 光源必选 + 白门回 Ossuary）
- [x] Chapter 5: Earth Orbit — 2026-03-10（2 房间 + 卫星/泡泡/斧头返回瀑布）
- [x] Chapter 6: Pacific Island — 2026-03-10（7 房间 + Chasm's Brink 蘑菇门 + 台地/脚手架/海滩）
- [x] Chapter 7: Russian Tundra — 2026-03-10（11 房间 + 悬崖裂缝旅鼠+笼子）
- [x] Chapter 8: Islet — 2026-03-10（2 房间 + 白门→Desert）
- [x] Chapter 9: New Mexico Desert — 2026-03-10（34 房间：tower_landing/paved_road×6/desert×9/foothills×3/shallow_crater + 剪线→Prologue）
- [ ] Chapter 10: McDonald Ranch — 原有 26 个 ID 已保留，补原版 Front Deck #6；按 `RANCH_REWRITE_PLAN.md` 复核出口、描述及条件机制
- [x] Chapter 11: Finale — 2026-03-10（the_end 房间；剪线后直接 transitionChapter 回 Palace Gate）
