// ═══════════════════════════════════════════════════
//  Trinity 全部物品定义
// ═══════════════════════════════════════════════════

export const ITEMS = {

  // ── 序章：肯辛顿花园 ──
  coin: {
    cn: "七边硬币", aliases: ["coin","seven-sided coin","50p","硬币","钱币","五十便士"],
    desc: "A seven-sided coin — a British 50 pence piece.\n一枚七边形硬币——英国五十便士。",
    start: "pocket",
  },
  credit_card: {
    cn: "信用卡", aliases: ["credit card","card","信用卡","卡"],
    desc: "Your American Express card.\n你的美国运通信用卡。",
    start: "pocket",
  },
  watch: {
    cn: "手表", aliases: ["watch","wristwatch","手表","表"],
    desc(s) {
      const t = Math.floor(30 + (s.turns || 0) * 0.5);
      const min = t % 60;
      const hr = 3;
      return `Your wristwatch says it's ${hr}:${String(min).padStart(2,"0")} pm.\n你的手表显示现在是下午${hr}:${String(min).padStart(2,"0")}。`;
    },
    start: "worn", fixed: false,
  },
  ball: {
    cn: "足球", aliases: ["ball","soccer ball","足球","球"],
    desc: "You see nothing unusual about the soccer ball.\n你没看出这个足球有什么不寻常的。",
    start: "flower_walk",
    roomDesc: "You can see a soccer ball half-hidden among the blossoms.\n你可以看到一个足球半隐在花丛中。",
  },
  umbrella: {
    cn: "雨伞", aliases: ["umbrella","伞","雨伞"],
    desc: 'The closed umbrella\'s handle is carved in the shape of a parrot\'s head.\n合拢的雨伞手柄雕成了鹦鹉头的形状。',
    start: "lancaster_gate_tree",
  },
  gnomon: {
    cn: "日晷指针", aliases: ["gnomon","指针","日晷指针"],
    desc: "It's a triangular piece of metal, about a quarter-inch thick and four inches long.\n一块三角形的金属片，大约四分之一英寸厚、四英寸长。",
    start: "the_wabe",
  },
  bag: {
    cn: "面包屑袋", aliases: ["bag","crumbs","bag of crumbs","面包屑","面包袋","袋子"],
    desc: "A bag of crumbs.\n一袋面包屑。",
    start: null,
  },
  small_coin: {
    cn: "小硬币", aliases: ["small coin","change","找零","小硬币","二十便士"],
    desc: "A small coin — twenty pence change.\n一枚小硬币——二十便士的找零。",
    start: null,
  },
  paper_bird: {
    cn: "纸鸟", aliases: ["paper bird","paper","bird","纸鸟","折纸鸟","纸鹤","折纸","纸"],
    desc(s) { return s.hasFlag("bird_unfolded") ? 'The words "Long Water, Four O\'Clock" are scrawled on the piece of paper.\n纸上潦草地写着"Long Water, Four O\'Clock"。' : "A folded paper bird.\n一只折纸鸟。"; },
    start: "round_pond",
    roomDesc: "",
  },
  ruby: {
    cn: "红宝石", aliases: ["ruby","红宝石","宝石","gem"],
    desc: "The ruby is bigger than a walnut, with finely cut facets that sparkle with crimson fire.\n这颗红宝石比核桃还大，精细切割的刻面闪烁着绯红的火光。",
    start: null,
  },

  // ── The Wabe ──
  sundial: {
    cn: "日晷",
    aliases: ["sundial", "dial", "日晷", "表盘"],
    desc: "The perimeter of the sundial is inscribed with seven curious symbols and a compass rose.\n日晷周边刻着七个奇特的符号和罗盘玫瑰。",
    start: "vertex",
    fixed: true,
    fixedMsg: "The sundial is too heavy to move.\n日晷太重，无法移动。",
  },
  ring: {
    cn: "符号环",
    aliases: ["ring", "symbol ring", "symbols", "符号环", "环"],
    desc: "A ring of seven astronomical symbols. You can turn it to point to different symbols.\n七个天文符号的环。你可以转动它指向不同符号。",
    start: "vertex",
    fixed: true,
    fixedMsg: "The ring is part of the sundial.\n符号环是日晷的一部分。",
  },
  soap_bubble: {
    cn: "肥皂泡",
    aliases: ["soap bubble", "bubble", "肥皂泡", "泡"],
    desc: "A fragile soap bubble, glistening in the light. It might protect you in harsh conditions.\n一个脆弱的肥皂泡，在光线下闪烁。",
    start: "cottage",
  },
  splinter: {
    cn: "木片", aliases: ["splinter","木片","碎片"],
    desc: "Its edges flicker with the eerie phosphorescence of decay.\n\n它的边缘闪烁着腐朽的诡异磷光。",
    start: "south_bog",
  },
  axe: {
    cn: "斧头", aliases: ["axe","ax","斧头","斧"],
    desc: "A small but sharp-looking axe.\n\n一把小巧但锋利的斧头。",
    start: "top_of_arbor",
  },
  icicle: {
    cn: "冰锥", aliases: ["icicle","冰锥","冰柱","冰"],
    desc(s) { return s.hasFlag("icicle_hard") ? "A hard icicle, keeping its shape in the cold.\n\n一根坚硬的冰锥，在寒冷中保持着形状。" : "An icicle that is slowly melting. You'd better use it quickly.\n\n一根正在慢慢融化的冰锥。你得赶快用它。"; },
    start: null,
  },
  lump: {
    cn: "金属块", aliases: ["lump","metal","lump of metal","金属块","磁铁","块"],
    desc: "You feel a strong magnetic attraction.\n\n你感到强烈的磁力吸引。",
    start: "crater",
    fixed: true,
    fixedMsg: "The lump of metal is far too heavy and hot to carry.\n\n金属块太重太烫，无法搬运。",
  },
  garlic: {
    cn: "大蒜", aliases: ["garlic","大蒜","蒜"],
    desc: "A clove of fresh garlic with a pungent smell.\n\n一瓣新鲜的大蒜，散发着辛辣的气味。",
    start: "herb_garden",
  },
  thyme: {
    cn: "百里香", aliases: ["thyme","百里香","香草"],
    desc: "Better not. There isn't much thyme left.\n\n还是别了。百里香/时间所剩不多了。",
    start: "herb_garden",
    fixed: true,
    fixedMsg: "Better not. There isn't much thyme left.\n\n还是别了。百里香/时间所剩不多了。",
  },
  cage: {
    cn: "鸟笼", aliases: ["cage","birdcage","笼子","鸟笼"],
    desc(s) { return s.hasFlag("cage_has_lemming") ? "A small wire birdcage with a lemming inside, looking around nervously.\n\n小铁丝鸟笼里关着一只旅鼠，不安地四处张望。" : "A small wire birdcage. The door can be opened and closed.\n\n一个小巧的铁丝鸟笼，门可以打开和关上。"; },
    start: null,
  },
  key_barrow: {
    cn: "骸骨钥匙", aliases: ["skeleton key","key","钥匙","骸骨钥匙","骷髅钥匙"],
    desc: "A key carved from bone, cold and smooth to the touch.\n\n一把由骨头雕成的钥匙，冰冷而光滑。",
    start: "ossuary",
  },
  coconut: {
    cn: "椰子", aliases: ["coconut","椰子"],
    desc(s) { return s.hasFlag("coconut_cracked") ? "一个被劈开的椰子，还在渗出乳白色的椰奶。" : "一颗棕色的椰子，摇晃时能听到里面液体晃动的声音。"; },
    start: null,
  },
  emerald: {
    cn: "绿宝石", aliases: ["emerald","绿宝石"],
    desc: "一颗在大锅的烈焰中诞生的绿宝石，翠绿如春叶。",
    start: null,
  },
  spade: {
    cn: "铲子", aliases: ["spade","铲子","铲","锹"],
    desc: "A small spade, suitable for digging.\n一把小铁铲，适合挖掘。",
    start: null,
  },
  shroud: {
    cn: "裹尸布", aliases: ["shroud","裹尸布","布"],
    desc: "一块灰白色的亚麻布，散发着古老的霉味。穿上它你看起来就像一具行走的尸体。",
    start: null,
  },
  bandage: {
    cn: "绷带", aliases: ["bandage","绷带"],
    desc: "一卷泛黄的绷带。",
    start: null,
  },
  boots: {
    cn: "靴子", aliases: ["boots","boot","靴子","靴"],
    desc(s) {
      const r = s.hasFlag("ruby_in_red_boot");
      const e = s.hasFlag("emerald_in_green_boot");
      let d = "一双神奇的靴子。左脚绿色，右脚红色。";
      if (r) d += " 红靴嵌着一颗红宝石，长出了小翅膀。";
      if (e) d += " 绿靴嵌着一颗绿宝石，长出了小翅膀。";
      if (r && e) d += " 穿上它们你可以跑得飞快。";
      return d;
    },
    start: null,
  },
  silver_coin: {
    cn: "银币", aliases: ["silver coin","silver","银币"],
    desc: "一枚古老的银币，上面刻着你看不懂的符号。",
    start: null,
  },
  toadstool_islet: {
    cn: "毒菌", aliases: ["toadstool","mushroom","毒菌","蘑菇"],
    desc: "A lone toadstool with a white door that leads to the New Mexico desert.\n\n一株孤零零的毒菌，上面有一扇通向新墨西哥沙漠的白门。",
    start: "islet",
    fixed: true,
    fixedMsg: "The toadstool is rooted in the sand.\n\n毒菌扎根在沙地里。",
  },
  walnut: {
    cn: "核桃", aliases: ["walnut","核桃"],
    desc: "一颗核桃。",
    start: null,
  },

  // ── 日本 ──
  // (spade obtained here, umbrella & paper_bird lost)

  // ── 地下 ──
  lantern: {
    cn: "灯笼", aliases: ["lantern","灯笼","灯","提灯"],
    desc(s) { return s.hasFlag("lantern_on") ? "一盏正在发光的灯笼，照亮周围几米的范围。" : "一盏灭了的灯笼。"; },
    start: null,
  },
  walkie_talkie: {
    cn: "对讲机", aliases: ["walkie-talkie","walkie","walkie talkie","对讲机","无线电"],
    desc(s) { return s.hasFlag("walkie_on") ? "对讲机正在嘶嘶作响，偶尔传来断断续续的人声。" : "一部军用对讲机，开关在侧面。"; },
    start: null,
  },
  skink: {
    cn: "蜥蜴", aliases: ["skink","lizard","蜥蜴","石龙子"],
    desc(s) { return s.hasFlag("skink_dead") ? "一只死去的蜥蜴。" : "一只小小的石龙子蜥蜴，在你的口袋里不安地扭动。"; },
    start: null,
  },

  // ── 太平洋 ──
  // (coconut obtained here)

  // ── 俄罗斯 ──
  lemming: {
    cn: "旅鼠", aliases: ["lemming","旅鼠"],
    desc: "一只毛茸茸的小旅鼠。它用黑豆般的眼睛紧张地看着你。",
    start: null,
  },

  // ── 新墨西哥 ──
  knife: {
    cn: "刀", aliases: ["knife","刀","刀子","牛排刀"],
    desc: "一把锋利的牛排刀。",
    start: null,
  },
  screwdriver: {
    cn: "螺丝刀", aliases: ["screwdriver","螺丝刀","改锥","起子"],
    desc: "一把十字螺丝刀。",
    start: null,
  },
  binoculars: {
    cn: "望远镜", aliases: ["binoculars","望远镜","双筒望远镜"],
    desc: "一副军用双筒望远镜。可以用来看远处的东西。",
    start: null,
  },
  key_padlock: {
    cn: "挂锁钥匙", aliases: ["padlock key","small key","挂锁钥匙","小钥匙"],
    desc: "一把小小的挂锁钥匙。",
    start: null,
  },
  slip: {
    cn: "纸条", aliases: ["slip","cardboard","纸条","硬纸片"],
    desc(s) { return "一张硬纸片，背面印着电线颜色的图例。"; },
    start: null,
  },
};
