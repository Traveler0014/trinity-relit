// ═══════════════════════════════════════════════════
//  Prologue — Kensington Gardens, London  1986
//  序章：肯辛顿花园
//  All English text faithfully reproduced from the
//  original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

function pramRoom(s) {
  if (s.hasFlag("pram_broken")) return "long_water";
  if (s.hasFlag("pram_at_flower")) return "flower_walk";
  if (s.hasFlag("pram_at_walk")) return "lancaster_walk";
  if (s.hasFlag("pram_at_lancaster")) return "lancaster_gate";
  if (s.hasFlag("pram_at_inverness")) return "inverness_terrace";
  return "black_lion_gate";
}

const BIRD_CRIES = [
  '"Feed the birds! Thirty p!"',
  '"Thirty p! Thirty p a bag!"',
  '"Feed the hungry birds!"',
  '"Thirty p for the starving birds!"',
  '"Thirty p!"',
  '"Feed the birds!"',
];

const BIRD_VERBS = [
  "cries", "hollers", "calls", "yells", "",
];

function birdCry(s) {
  if (s.hasFlag("birds_fed")) return "";
  const i = s.cnt("turn") % BIRD_CRIES.length;
  const v = BIRD_VERBS[i % BIRD_VERBS.length];
  const cry = BIRD_CRIES[i];
  return v ? `${cry} ${v} the bird woman.` : cry;
}

const NANNY_ADJ = [
  "offended", "haughty", "gawking", "starched", "babbling",
];
function nannyBlock(s) {
  const i = s.cnt("turn") % NANNY_ADJ.length;
  return `A surge of ${NANNY_ADJ[i]} nannies blocks your path.`;
}

const DOOMSDAY_MSGS = [
  "A steady drone begins to rise above the east wind. As it grows louder and more insistent, you recognize a sound you've heard only in old war movies. Air-raid sirens.\n\n一阵持续的嗡鸣声开始在东风之上升起。随着它越来越响亮、越来越急切，你辨认出一种只在老战争片里听过的声音。防空警报。",
  "Another siren joins the first. Tourists search the sky, eyes wide with apprehension.\n\n又一声警报加入了第一声。游客们搜寻着天空，眼中满是恐惧。",
  "Sirens are howling all around you. Children, sensing fear in the air, begin to whimper for their nannies.\n\n警报声在你四周嚎叫。孩子们感到了空气中的恐惧，开始向保姆们啜泣。",
  "Confused shouts can be heard in the distance. Worried nannies turn their perambulators toward the gates.\n\n远处传来混乱的呼喊。忧心的保姆们把婴儿车转向大门方向。",
  "Police and fire alarms join in the rising din as the crowd rushes to escape the open sky of the Gardens.\n\n警察和消防警报加入了不断升高的喧嚣，人群奔涌着逃离花园开阔的天空。",
  'Distant megaphones can be heard barking orders. Frightened tourists and screaming perambulators flee in every direction.\n\n远处传来扩音器吠叫般的命令。惊恐的游客和尖叫的婴儿车向四面八方逃窜。',
  'A round of gunfire drowns out the wailing sirens. Tourists cover their heads and trample one another in blind panic.\n\n一阵枪声淹没了哀嚎的警报。游客们捂住脑袋，在盲目的恐慌中互相践踏。',
  "The ground trembles with the roar of jet interceptors. Terror-stricken tourists dive for cover.\n\n地面随着喷气拦截机的轰鸣而颤抖。惊恐万状的游客纷纷扑倒寻找掩护。",
];

function doomTick(s, eng) {
  if (s.hasFlag("at_long_water") || s.hasFlag("prologue_done")) return;
  s.inc("doom_phase");
  const phase = s.cnt("doom_phase");
  if (phase === 1) {
    eng.print("\nThey are of sick and diseased imaginations who would toll the world's knell so soon.\n— Henry David Thoreau");
  } else if (phase >= 2 && phase <= 9) {
    eng.print("\n" + DOOMSDAY_MSGS[phase - 2]);
  } else if (phase >= 10) {
    eng.print(
      "\nThe east wind falls silent, and a new star flashes to life over the doomed city.\n\n" +
      "东风沉寂了，一颗新星在这座注定毁灭的城市上空闪耀。"
    );
    eng.die(
      "\nYou're on a lifeless strip of sand beside a great river. The water is unnaturally dark and still; ribbons of mist coil across its surface like ghostly fingers, obscuring what lies beyond.\n\n" +
      "你站在一条大河旁毫无生机的沙滩上。河水暗沉而静止，雾气的丝带像幽灵的手指般蜷曲过水面，遮蔽了彼岸。\n\n" +
      "The oarsman guides his dory to a soundless landing. Something in the way he crooks his skeletal finger compels you to board.\n\n" +
      "船夫将他的平底船无声地靠了岸。他弯曲骸骨般手指的方式令你不由自主地登上了船。"
    );
  }
}

// 计时器回调按 id 导出。存档只能带走 { remaining, id }，函数存不进 JSON，
// 读档时引擎靠这张表把回调装回去（见 engine.registerTimerHandlers）。
export const TIMERS = {
  doomsday(s, eng) {
    if (s.hasFlag("at_long_water") || s.hasFlag("prologue_done")) return;
    if (s.timer && s.timer.remaining <= 10) {
      doomTick(s, eng);
    }
  },
};

export const ROOMS = {

  // ─── 1. Palace Gate ───
  palace_gate: {
    name: "Palace Gate",
    cn: "宫殿门",

    desc(s) {
      let d = "";
      if (!s.hasFlag("palace_gate_visited")) {
        d += "Sharp words between the superpowers. Tanks in East Berlin. And now, reports the BBC, rumors of a satellite blackout. It's enough to spoil your continental breakfast.\n\n" +
             "But the world will have to wait. This is the last day of your $599 London Getaway Package, and you're determined to soak up as much of that authentic English ambience as you can. So you've left the tour bus behind, ditched the camera and escaped to Hyde Park for a contemplative stroll through the Kensington Gardens.\n\n" +
             "超级大国之间言辞激烈。坦克开进了东柏林。而现在，BBC报道说，有卫星通讯中断的传闻。这足以毁掉你的欧式早餐。\n\n但世界且等一等。今天是你599美元伦敦旅行套餐的最后一天，你决心尽可能多地浸泡在地道的英伦氛围里。于是你甩掉了旅行巴士，丢下了相机，逃进海德公园，在肯辛顿花园里悠然漫步。\n\n";
      }
      d += "A tide of perambulators surges north along the crowded Broad Walk. Shaded glades stretch away to the northeast, and a hint of color marks the western edge of the Flower Walk.\n\n" +
           "婴儿车的潮流沿着拥挤的大道(n)向北涌去。阴翳的林间空地向东北(ne)延展，一抹色彩标记着花径(e)的西缘。";
      return d;
    },

    onEnter(s, eng) {
      if (!s.hasFlag("palace_gate_visited")) {
        s.setFlag("palace_gate_visited");
        s.startTimer(80, "doomsday", TIMERS.doomsday);
      }
    },

    exits() {
      return { n: "broad_walk", e: "flower_walk", ne: "the_wabe" };
    },

    events: [
      {
        id: "examine_self",
        match: { verb: ["examine"], noun: ["self", "myself", "me", "自己"] },
        triggers: ["检查自己", "看看自己", "examine myself", "look at myself"],
        text: "Aside from your London vacation outfit, you're wearing a wristwatch.\n\n除了你的伦敦度假装束外，你还戴着一块手表。",
      },
      {
        id: "examine_sky_pg",
        match: { verb: ["examine"], noun: ["sky", "天空", "天"] },
        triggers: ["看天空", "look at sky", "look up"],
        text: "You can't see that here.\n\n你在这里看不到什么特别的天空。",
      },
    ],
  },

  // ─── 2. Broad Walk ───
  broad_walk: {
    name: "Broad Walk",
    cn: "大道",

    desc(s) {
      let d = "A brooding statue of Queen Victoria faces east, where the waters of the Round Pond sparkle in the afternoon sun. Your eyes follow the crowded Broad Walk north and south until its borders are lost amid the bustle of perambulators. Small paths curve northeast and southeast, between the trees.\n\n" +
              "维多利亚女王阴沉的雕像面朝东方，圆池塘的水面在午后阳光下粼粼闪光。你的目光追随拥挤的大道向南(s)北(n)延伸，直到它的边际消失在婴儿车的喧嚣中。小径向东北(ne)和东南(se)弯去，隐入树丛之间。";
      if (!s.hasFlag("birds_fed")) {
        if (!s.hasFlag("seen_bird_woman")) {
          d += "\n\nA cloud of pigeons fills the air! They circle overhead and congregate around a nearby bench, where an aged woman is selling bags of crumbs.\n\n一群鸽子腾空而起！它们在头顶盘旋，聚集在附近一条长椅周围，一位年迈的妇人正在兜售面包屑。";
          d += '\n\n"Feed the birds! Thirty p!" Her voice quavers with heartbreak.\n\n"喂鸟吧！三十便士！"她的声音因心碎而颤抖。';
        } else {
          d += "\n\nAn aged woman is selling crumbs nearby.\n\n一位年迈的妇人在附近卖着面包屑。";
          const cry = birdCry(s);
          if (cry) d += "\n\n" + cry;
        }
      }
      if (s.hasFlag("ruby_visible") && !s.hasFlag("ruby_snatched")) {
        d += "\n\nThe ruby at your feet is bigger than a walnut, with finely cut facets that sparkle with crimson fire.\n\n你脚边的红宝石比核桃还大，精细切割的刻面闪烁着绯红的火光。";
      }
      return d;
    },

    onEnter(s) {
      if (!s.hasFlag("seen_bird_woman") && !s.hasFlag("birds_fed")) {
        s.setFlag("seen_bird_woman");
      }
    },

    onTurn(s, eng) {
      if (s.room !== "broad_walk") return;
      if (!s.hasFlag("birds_fed")) {
        const cry = birdCry(s);
        if (cry && s.hasFlag("seen_bird_woman")) eng.print("\n" + cry);
      }
    },

    exits() {
      return { s: "palace_gate", n: "black_lion_gate", e: "round_pond", ne: "inverness_terrace", se: "the_wabe" };
    },

    events: [
      {
        id: "examine_statue",
        match: { verb: ["examine"], noun: ["statue", "victoria", "queen", "雕像", "女王"] },
        triggers: ["看雕像", "examine the statue", "look at queen victoria"],
        text: "She wasn't much to look at.\n\n她算不上好看。",
      },
      {
        id: "examine_woman_bw",
        match: { verb: ["examine"], noun: ["woman", "old lady", "lady", "老太太", "女人", "老人", "bird woman"] },
        triggers: ["看老太太", "examine the old lady", "examine the bird woman"],
        when: (s) => !s.hasFlag("birds_fed"),
        text(s) {
          return 'You get the feeling that she\'s been selling crumbs on this same bench, year after year, since well before you were born. Her face is lined with care for her feathered charges, who perch on her round shoulders without fear.\n\n你感觉她在这同一条长椅上卖面包屑已经年复一年，远在你出生之前就开始了。她的脸上刻满了对她羽毛朋友们的关切，鸟儿们毫无畏惧地栖息在她浑圆的肩头。';
        },
      },
      {
        id: "examine_pigeons_bw",
        match: { verb: ["examine"], noun: ["pigeons", "birds", "鸽子", "鸟"] },
        triggers: ["看鸽子", "examine the pigeons", "look at the birds"],
        when: (s) => !s.hasFlag("birds_fed"),
        text: "The pigeons stare back at you hungrily.\n\n鸽子们饥饿地回瞪着你。",
      },
      {
        id: "buy_bag",
        match: { verb: ["buy"], noun: ["bag", "crumbs", "面包屑", "鸟食", "bird food"] },
        triggers: ["买面包屑", "买鸟食", "buy crumbs", "buy bird food", "buy bag of crumbs"],
        when: (s) => s.has("coin") && !s.hasFlag("bag_bought"),
        act(s) {
          s.destroy("coin");
          s.take("bag");
          s.toPocket("small_coin");
          s.setFlag("bag_bought");
          if (!s.hasFlag("scored_bag")) { s.addScore(1); s.setFlag("scored_bag"); }
        },
        text: '"Bless yer," coos the bird woman, taking your money with a practiced snatch. "Twenty p\'s the change." She holds out a bag of crumbs and a small coin for you.\n\n' +
              '"上帝保佑你，"卖鸟食的老太太咕咕地说，熟练地一把接过你的钱。"找你二十便士。"她递给你一袋面包屑和一枚小硬币。\n\n[+1分]',
      },
      {
        id: "buy_bag_no_coin",
        match: { verb: ["buy"], noun: ["bag", "crumbs", "面包屑", "鸟食", "bird food"] },
        triggers: ["买面包屑", "buy crumbs without money"],
        when: (s) => !s.has("coin") && !s.hasFlag("bag_bought"),
        text: "You haven't got thirty p.\n\n你没有三十便士。",
      },
      {
        id: "feed_birds",
        match: { verb: ["feed", "throw", "give", "drop"], noun: ["bag", "crumbs", "面包屑", "鸽子", "pigeons", "birds", "鸟"] },
        triggers: ["喂鸽子", "撒面包屑", "喂鸟", "feed the pigeons", "scatter crumbs", "feed birds"],
        when: (s) => s.has("bag") && !s.hasFlag("birds_fed"),
        act(s) {
          s.destroy("bag");
          s.setFlag("birds_fed");
          s.setFlag("ruby_visible");
        },
        text: "You take a handful of crumbs out of the bag. They fall between your fingers and tumble across the ground.\n\n" +
              "As the wild birds gobble down the crumbs, a glint of red catches your eye. Frowning, you stoop down for a closer look... and gasp with astonishment!\n\n" +
              "The ruby at your feet is bigger than a walnut, with finely cut facets that sparkle with crimson fire. It must have been in the bag of crumbs.\n\n" +
              "你从纸袋里抓出一把面包屑。它们从你指间滑落，滚过地面。\n\n" +
              "当野鸟们狼吞虎咽地吃着面包屑时，一抹红光吸引了你的目光。你皱着眉弯下腰仔细看了看……不禁惊呼出声！\n\n" +
              "你脚边的红宝石比核桃还大，精细切割的刻面闪烁着绯红的火光。它一定是在那袋面包屑里的。",
      },
      {
        id: "take_ruby",
        match: { verb: ["take", "get", "pick"], noun: ["ruby", "红宝石", "宝石", "gem"] },
        triggers: ["捡红宝石", "拿宝石", "take the ruby", "pick up the gem"],
        when: (s) => s.hasFlag("ruby_visible") && !s.hasFlag("ruby_snatched"),
        act(s) {
          s.setFlag("ruby_snatched");
          s.setFlag("wind_changed");
        },
        text: 'As you reach down to touch the ruby, a very large bird races out from behind a tree. It snatches away the ruby with its beak, zigzags through a group of tourists and disappears to the east. If you didn\'t know better, you\'d swear that bird was a roadrunner.\n\n' +
              '"It\'s time!" shrieks the bird woman.\n\n' +
              "The east wind softens to a whisper and dies away.\n\n" +
              "Blowing leaves settle to the ground, and the trees are still. Then a fresh gust blows in from the west.\n\n" +
              "当你弯腰去碰那颗红宝石时，一只非常大的鸟从树后冲了出来。它用喙叼走了宝石，在一群游客间左冲右突，消失在东方。如果你不知道那是不可能的，你会发誓那是一只走鹃。\n\n" +
              '"时候到了！"卖鸟食的老太太尖声叫道。\n\n' +
              "东风轻柔地化为一丝低语，然后消散了。\n\n" +
              "飘飞的落叶沉落地面，树木静止了。然后一阵清新的风从西方吹来。",
      },
    ],
  },

  // ─── 3. Flower Walk ───
  flower_walk: {
    name: "Flower Walk",
    cn: "花径",

    desc(s) {
      let d = "Gaily colored flower beds line the walks bending north and west, filling the air with a gentle fragrance. A little path leads northwest, between the trees.\n\n" +
              "色彩缤纷的花坛排列在向北(n)和向西(w)弯曲的步道旁，空气中弥漫着淡雅的芬芳。一条小路向西北(nw)通去，隐入树丛之间。";
      if (s.inRoom("ball")) {
        d += "\n\nYou can see a soccer ball half-hidden among the blossoms.\n\n你可以看到一个足球半隐在花丛中。";
      }
      d += "\n\nThe spires of the Albert Memorial are all too visible to the south. Passing tourists hoot with laughter at the dreadful sight; nannies hide their faces and roll quickly away.\n\n" +
           "阿尔伯特纪念碑的尖塔在南边清晰可见。路过的游客看到这可怕的景象嘲笑不已；保姆们捂住脸，推着车迅速离开。";
      return d;
    },

    exits() {
      return { w: "palace_gate", n: "lancaster_walk", nw: "the_wabe" };
    },

    events: [
      {
        id: "examine_memorial",
        match: { verb: ["examine"], noun: ["memorial", "monument", "albert", "纪念碑", "石碑"] },
        triggers: ["看纪念碑", "examine the memorial", "examine the albert memorial"],
        text: "Your London guide book warned you that the Albert Memorial was ugly, but nothing could have prepared you for this embarrassing spectacle!\n\n你的伦敦旅游指南警告过你阿尔伯特纪念碑很丑，但没有什么能让你为这令人尴尬的景象做好心理准备！",
      },
      {
        id: "examine_ball",
        match: { verb: ["examine"], noun: ["ball", "soccer", "足球", "球"] },
        triggers: ["看球", "examine the ball", "look at soccer ball"],
        when: (s) => s.inRoom("ball") || s.has("ball"),
        text: "You see nothing unusual about the soccer ball.\n\n你没看出这个足球有什么不寻常的。",
      },
      {
        id: "take_ball",
        match: { verb: ["take", "get", "pick"], noun: ["ball", "soccer", "足球", "球"] },
        triggers: ["捡球", "拿足球", "take the soccer ball", "pick up the ball"],
        when: (s) => s.inRoom("ball"),
        act(s) {
          s.take("ball");
          if (!s.hasFlag("scored_ball")) { s.addScore(1); s.setFlag("scored_ball"); }
        },
        text: "You take the soccer ball off the flower beds.\n\n你从花坛上捡起了足球。\n\n[+1分]",
      },
    ],
  },

  // ─── 4. The Wabe ───
  the_wabe: {
    name: "The Wabe",
    cn: "日晷草地",

    desc(s) {
      let d = "This grassy clearing is only twenty feet across, and perfectly circular. Paths wander off in many directions through the surrounding thicket.\n\n" +
              "这片草地空地只有二十英尺宽，完美的圆形。小径从四周浓密的灌木丛中向各个方向蜿蜒而去。";
      if (s.itemAt("gnomon") === "the_wabe" && !s.hasFlag("gnomon_unscrewed")) {
        d += "\n\nA shaft of golden sunlight falls across a handsome antique sundial, erected at the exact center of the clearing.\n\n" +
             "一束金色阳光落在一座精美的古董日晷上，它矗立在空地的正中央。";
      } else if (s.itemAt("gnomon") === "the_wabe" && s.hasFlag("gnomon_unscrewed")) {
        d += "\n\nThe sundial stands at the center of the clearing. The gnomon lies on its face.\n\n" +
             "日晷矗立在空地中央。指针躺在表盘上。";
      } else {
        d += "\n\nThe sundial stands at the center of the clearing, its gnomon missing.\n\n" +
             "日晷矗立在空地中央，指针已不见踪影。";
      }
      return d;
    },

    exits() {
      return { sw: "palace_gate", nw: "broad_walk", se: "flower_walk", ne: "lancaster_walk", n: "round_pond" };
    },

    events: [
      {
        id: "examine_sundial",
        match: { verb: ["examine"], noun: ["sundial", "日晷", "表盘", "dial"] },
        triggers: ["检查日晷", "examine the sundial", "look at the dial"],
        text: 'The perimeter of the sundial is inscribed with seven curious symbols and a compass rose, with the legend "TEMPUS EDAX RERUM" emblazoned across the bottom. A triangular gnomon casts a fingerlike shadow that is creeping slowly towards the first symbol.\n\n' +
              '"And \'the wabe\' is the grass-plot round a sun-dial, I suppose?" said Alice, surprised at her own ingenuity.\n"Of course it is. It\'s called \'wabe,\' you know, because it goes a long way before it, and a long way behind it —"\n— Lewis Carroll\n\n' +
              '日晷的周边刻着七个奇特的符号和一个罗盘玫瑰，底部镌刻着"TEMPUS EDAX RERUM"（时间吞噬万物）的铭文。三角形的指针投下一道手指般的影子，正缓慢地爬向第一个符号。',
      },
      {
        id: "examine_gnomon",
        match: { verb: ["examine"], noun: ["gnomon", "指针"] },
        triggers: ["看指针", "examine the gnomon", "look at gnomon"],
        when: (s) => s.itemAt("gnomon") === "the_wabe" || s.has("gnomon"),
        text: "It's a triangular piece of metal, about a quarter-inch thick and four inches long, screwed into the center of the sundial.\n\n" +
              "它是一块三角形的金属片，大约四分之一英寸厚、四英寸长，拧在日晷的中心。",
      },
      {
        id: "unscrew_gnomon",
        match: { verb: ["unscrew", "turn", "twist"], noun: ["gnomon", "指针"] },
        triggers: ["拧指针", "拧开指针", "旋转指针", "unscrew the gnomon", "turn the gnomon"],
        when: (s) => !s.hasFlag("gnomon_unscrewed") && s.itemAt("gnomon") === "the_wabe",
        act(s) { s.setFlag("gnomon_unscrewed"); },
        text: "You can feel the gnomon getting more and more wobbly as you unscrew it. A final twist, and it falls with a clatter onto the face of the sundial.\n\n" +
              "你能感觉到指针在你拧动时越来越松动。最后一拧，它哐啷一声落在了日晷表盘上。",
      },
      {
        id: "take_gnomon",
        match: { verb: ["take", "get"], noun: ["gnomon", "指针"] },
        triggers: ["拿指针", "取下指针", "take the gnomon"],
        when: (s) => s.hasFlag("gnomon_unscrewed") && s.itemAt("gnomon") === "the_wabe",
        act(s) {
          s.take("gnomon");
          if (!s.hasFlag("scored_gnomon")) { s.addScore(5); s.setFlag("scored_gnomon"); }
        },
        text: "You take the gnomon off the sundial.\n\n你从日晷上取下了指针。\n\n[+5分]",
      },
      {
        id: "take_gnomon_blocked",
        match: { verb: ["take", "get"], noun: ["gnomon", "指针"] },
        triggers: ["拿指针", "take gnomon"],
        when: (s) => !s.hasFlag("gnomon_unscrewed") && s.itemAt("gnomon") === "the_wabe",
        text: "The gnomon is screwed tightly to the sundial.\n\n指针被牢牢地拧在日晷上。",
      },
    ],
  },

  // ─── 5. Round Pond ───
  round_pond: {
    name: "Round Pond",
    cn: "圆池塘",

    desc(s) {
      let d = "Ducks and swans bob on the sparkling surface of the Round Pond. They share the water with an impressive fleet of toy boats, directed by the excited shouts of children.\n\n" +
              "鸭子和天鹅在圆池塘波光粼粼的水面上浮沉。它们与一支壮观的玩具船队共享着水面，在孩子们兴奋的欢呼声中穿梭。\n\n" +
              "Crowded paths radiate from the Pond in many directions.\n\n" +
              "拥挤的小径从池塘向四面八方延伸。";
      if (s.inRoom("paper_bird")) {
        if (!s.hasFlag("seen_paper_bird")) {
          d += "\n\nOne of the toy boats on the Round Pond catches your eye. The east wind blows it closer, and you realize that the white sails are actually wings. It's a folded paper bird, floating just within reach.\n\n" +
               "圆池塘上的一只玩具船吸引了你的目光。东风把它吹得更近了，你才发现那白色的帆其实是翅膀。那是一只折纸鸟，漂浮在伸手可及的地方。";
        }
      }
      return d;
    },

    onEnter(s) {
      if (s.inRoom("paper_bird") && !s.hasFlag("seen_paper_bird")) {
        s.setFlag("seen_paper_bird");
      }
    },

    exits() {
      return { w: "broad_walk", n: "inverness_terrace", nw: "black_lion_gate", ne: "lancaster_gate", e: "lancaster_walk", s: "the_wabe" };
    },

    events: [
      {
        id: "examine_pond",
        match: { verb: ["examine"], noun: ["pond", "water", "池塘", "水", "水面"] },
        triggers: ["看池塘", "examine the pond", "look at the water"],
        text: "Ducks and swans paddle between the toy boats of the children.\n\n鸭子和天鹅在孩子们的玩具船之间划水。",
      },
      {
        id: "examine_boats",
        match: { verb: ["examine"], noun: ["boats", "boat", "toy", "船", "帆船", "小船"] },
        triggers: ["看帆船", "examine the boats", "look at toy boats"],
        text(s) {
          let t = "The toy boats are crafted of paper and sticks. They bob freely among the wild birds, who can barely conceal their outrage.\n\n玩具船是用纸和小棍做的。它们在野鸟之间自由地上下浮动，鸟儿们几乎掩饰不住自己的愤怒。";
          if (s.inRoom("paper_bird") && !s.hasFlag("seen_paper_bird")) {
            t += "\n\nOne of the toy boats on the Round Pond catches your eye. The east wind blows it closer, and you realize that the white sails are actually wings. It's a folded paper bird, floating just within reach.\n\n圆池塘上的一只玩具船吸引了你的目光。东风把它吹得更近了，你才发现那白色的帆其实是翅膀。那是一只折纸鸟，漂浮在伸手可及的地方。";
            s.setFlag("seen_paper_bird");
          }
          return t;
        },
      },
      {
        id: "take_paper_bird",
        match: { verb: ["take", "get", "pick"], noun: ["paper_bird", "bird", "paper bird", "paper", "纸鸟", "纸鹤", "折纸"] },
        triggers: ["拿纸鸟", "捡纸鸟", "take the paper bird", "pick up the paper bird"],
        when: (s) => s.inRoom("paper_bird"),
        act(s) {
          s.take("paper_bird");
          if (!s.hasFlag("scored_bird")) { s.addScore(3); s.setFlag("scored_bird"); }
        },
        text: "You lean over the edge of the Round Pond, and pluck the paper bird out of the water.\n\n你探身到圆池塘边缘，从水中捞起了那只纸鸟。\n\n[+3分]",
      },
      {
        id: "open_paper_bird",
        match: { verb: ["open", "unfold"], noun: ["paper_bird", "bird", "paper bird", "paper", "纸鸟", "纸鹤"] },
        triggers: ["打开纸鸟", "展开纸鸟", "unfold the paper bird", "open the paper bird"],
        when: (s) => s.has("paper_bird") && !s.hasFlag("bird_unfolded"),
        act(s) { s.setFlag("bird_unfolded"); },
        text: "You gently open the paper bird to its full size.\n\n你轻轻地把纸鸟展开到全幅大小。",
      },
      {
        id: "read_paper_bird",
        match: { verb: ["read", "examine"], noun: ["paper_bird", "paper", "bird", "纸鸟", "纸鹤", "纸"] },
        triggers: ["读纸鸟", "看纸鸟上的字", "read the paper bird", "read the paper"],
        when: (s) => s.has("paper_bird") && s.hasFlag("bird_unfolded"),
        text: 'The words "Long Water, Four O\'Clock" are scrawled on the piece of paper.\n\n纸上潦草地写着"Long Water, Four O\'Clock"（长水湖，四点钟）。',
      },
    ],
  },

  // ─── 6. Black Lion Gate ───
  black_lion_gate: {
    name: "Black Lion Gate",
    cn: "黑狮门",

    desc(s) {
      let d = "Nannies and tourists hurry through the Lancaster Gate to join the perambulators rolling south down the Broad Walk. Less crowded paths wind east along an iron fence, and southeast between the trees.\n\n" +
              "保姆和游客匆匆穿过兰开斯特门，加入沿大道(s)向南滚动的婴儿车行列。不那么拥挤的小径沿着铁栅栏向东(e)蜿蜒，另一条则向东南(se)穿过树丛。";
      if (pramRoom(s) === "black_lion_gate") {
        d += "\n\nA careless nanny has left her perambulator unattended.\n\n一位粗心的保姆把她的婴儿车留在了无人看管的地方。";
      }
      return d;
    },

    exits() {
      return { s: "broad_walk", e: "inverness_terrace", se: "round_pond" };
    },

    events: [
      {
        id: "examine_pram_blg",
        match: { verb: ["examine"], noun: ["pram", "perambulator", "carriage", "婴儿车", "推车", "车"] },
        triggers: ["看婴儿车", "examine the pram", "look at the perambulator"],
        when: (s) => pramRoom(s) === "black_lion_gate",
        text: "It looks as if the perambulator is closed.\n\n看起来婴儿车是关着的。",
      },
      {
        id: "open_pram_blg",
        match: { verb: ["open"], noun: ["pram", "perambulator", "carriage", "婴儿车"] },
        triggers: ["打开婴儿车", "open the pram", "open the perambulator"],
        when: (s) => pramRoom(s) === s.room && !s.hasFlag("pram_open"),
        act(s) { s.setFlag("pram_open"); },
        text: "You open the perambulator.\n\n你打开了婴儿车。",
      },
      {
        id: "push_pram_blg",
        match: { verb: ["push", "move"], noun: ["pram", "perambulator", "carriage", "婴儿车", "推车"] },
        triggers: ["推婴儿车", "push the pram", "push the pram east", "push perambulator e"],
        when: (s) => pramRoom(s) === "black_lion_gate",
        act(s, eng) {
          s.setFlag("pram_at_inverness");
          eng.moveTo("inverness_terrace");
        },
        text: "",
      },
    ],
  },

  // ─── 7. Inverness Terrace ───
  inverness_terrace: {
    name: "Inverness Terrace",
    cn: "因弗内斯台",

    desc(s) {
      let d = "Crowded walkways lead east and west along an iron fence. Narrow paths wander south into the Gardens.\n\n" +
              "拥挤的步道沿着铁栅栏向东(e)和向西(w)延伸。狭窄的小径向南(s)蜿蜒进入花园深处。";
      if (!s.hasFlag("boy_scared")) {
        d += "\n\nA young boy sits nearby, listening to a pair of headphones and idly blowing soap bubbles. There's a dish full of soapy water by his side.\n\n" +
             "一个小男孩坐在附近，戴着耳机听音乐，百无聊赖地吹着肥皂泡。他身旁放着一碟肥皂水。";
      }
      if (pramRoom(s) === "inverness_terrace") {
        d += "\n\nThe perambulator rolls to a stop.\n\n婴儿车缓缓停了下来。";
      }
      return d;
    },

    onTurn(s, eng) {
      if (s.room !== "inverness_terrace" || s.hasFlag("boy_scared")) return;
      s.inc("boy_cycle");
      const phase = s.cnt("boy_cycle") % 3;
      if (phase === 0) {
        eng.print("\nThe boy dips the bubble wand in the dish and swishes it around.\n\n男孩把泡泡棒浸入碟子里搅了搅。");
      } else if (phase === 1) {
        eng.print("\nThe boy pulls the bubble wand out of the dish, puts it to his lips and blows a big soap bubble.\n\n男孩从碟子里抽出泡泡棒，凑到嘴边吹了一个大肥皂泡。");
      } else {
        eng.print(
          "\nAtoms or systems into ruin hurled,\nAnd now a bubble burst, and now a world.\n— Alexander Pope\n\n" +
          "The boy snaps his fingers to the headphone music as the soap bubble bursts with a flabby pop.\n\n" +
          "男孩随着耳机里的音乐打着响指，肥皂泡啪的一声瘪了。"
        );
      }
    },

    exits() {
      return { w: "black_lion_gate", e: "lancaster_gate", s: "round_pond", se: "lancaster_walk", sw: "broad_walk" };
    },

    events: [
      {
        id: "examine_boy",
        match: { verb: ["examine"], noun: ["boy", "kid", "teenager", "男孩", "孩子", "少年"] },
        triggers: ["看男孩", "examine the boy", "look at the boy"],
        when: (s) => !s.hasFlag("boy_scared"),
        text: "The boy doesn't respond. It looks as if he can't hear you.\n\n男孩没有回应。看起来他听不见你说话。",
      },
      {
        id: "examine_headphones",
        match: { verb: ["examine"], noun: ["headphones", "earphones", "耳机"] },
        triggers: ["看耳机", "examine the headphones"],
        when: (s) => !s.hasFlag("boy_scared"),
        text: "You see nothing unusual about the headphones.\n\n你没看出耳机有什么不寻常的。",
      },
      {
        id: "examine_dish",
        match: { verb: ["examine"], noun: ["dish", "water", "soapy", "碟子", "肥皂水"] },
        triggers: ["看碟子", "examine the dish", "look at the soapy water"],
        when: (s) => !s.hasFlag("boy_scared"),
        text: "The dish is filled to the brim with soapy water.\n\n碟子里盛满了肥皂水。",
      },
      {
        id: "take_dish",
        match: { verb: ["take", "get"], noun: ["dish", "碟子"] },
        triggers: ["拿碟子", "take the dish"],
        when: (s) => !s.hasFlag("boy_scared"),
        act(s) {
          s.setFlag("boy_scared");
        },
        text: '"Aow!"\n\nThe startled boy leaps backward at your approach, splashing water all over the place. "Stupid git!" he cries (in an intriguing Cockney accent). Then he retrieves the empty dish, pockets the wand and disappears between the prams, glaring at you over his shoulder.\n\nHis last bubble floats away over the treetops.\n\n' +
              '"啊哦！"\n\n受惊的男孩在你靠近时向后跳去，溅得到处都是水。"蠢货！"他喊道（带着一口迷人的伦敦腔）。然后他捡起空碟子，把泡泡棒塞进口袋，消失在婴儿车丛中，回头瞪了你一眼。\n\n他最后一个泡泡飘过树梢远去了。',
      },
      {
        id: "push_pram_it",
        match: { verb: ["push", "move"], noun: ["pram", "perambulator", "carriage", "婴儿车", "推车"] },
        triggers: ["推婴儿车", "push the pram east", "push perambulator e"],
        when: (s) => pramRoom(s) === "inverness_terrace",
        act(s, eng) {
          s.clearFlag("pram_at_inverness");
          s.setFlag("pram_at_lancaster");
          eng.moveTo("lancaster_gate");
        },
        text: "",
      },
    ],
  },

  // ─── 8. Lancaster Gate ───
  lancaster_gate: {
    name: "Lancaster Gate",
    cn: "兰开斯特门",

    desc(s) {
      let d = "A crooked old tree shades the perambulators as they roll south down the Lancaster Walk. Shady paths lead west along an iron fence, and southwest between the trees.\n\n" +
              "一棵弯曲的老树为沿兰开斯特小路(s)向南滚去的婴儿车投下阴凉。幽暗的小径沿着铁栅栏向西(w)蜿蜒，另一条向西南(sw)穿入树丛。";
      if (!s.hasFlag("umbrella_woman_done")) {
        d += "\n\nThere's an old woman under the tree, struggling to open an umbrella. The stiff east wind isn't making it easy for her.\n\n" +
             "树下有一位老妇人，正在费力地撑开一把雨伞。强劲的东风让这件事变得不容易。";
      } else if (s.itemAt("umbrella") === "lancaster_gate_tree") {
        d += "\n\nAn umbrella is wedged in the branches overhead.\n\n一把雨伞卡在头顶的树枝间。";
      }
      if (s.inRoom("ball")) {
        d += "\n\nThere's a soccer ball here.\n\n这里有一个足球。";
      }
      if (s.hasFlag("ball_in_tree")) {
        d += "\n\nA soccer ball is wedged in the branches overhead.\n\n一个足球卡在头顶的树枝间。";
      }
      if (pramRoom(s) === "lancaster_gate") {
        d += "\n\nThe perambulator rolls to a stop.\n\n婴儿车缓缓停了下来。";
      }
      return d;
    },

    onEnter(s, eng) {
      if (!s.hasFlag("umbrella_woman_done") && !s.hasFlag("umbrella_woman_seen")) {
        s.setFlag("umbrella_woman_seen");
        s.setCnt("umbrella_woman_turns", 0);
      }
    },

    onTurn(s, eng) {
      if (s.room !== "lancaster_gate") return;
      if (!s.hasFlag("umbrella_woman_done") && s.hasFlag("umbrella_woman_seen")) {
        s.inc("umbrella_woman_turns");
        if (s.cnt("umbrella_woman_turns") >= 2) {
          s.setFlag("umbrella_woman_done");
          s.placeItem("umbrella", "lancaster_gate_tree");

          let scarText = "";
          if (!s.hasFlag("seen_woman_face")) {
            s.setFlag("seen_woman_face");
            scarText = "You begin to walk past the old woman, but stop in your tracks.\n\n" +
                       "Her face is wrong.\n\n" +
                       "You look a little closer and shudder to yourself. The entire left side of her head is scarred with deep red lesions, twisting her oriental features into a hideous mask. She must have been in an accident or something.\n\n" +
                       "你开始从老妇人身边走过，但停住了脚步。\n\n她的脸不对。\n\n你凑近一看，不禁打了个寒颤。她整个头部的左半边布满了深红色的伤疤，把她东方人的面容扭曲成一副可怖的面具。她一定是出过什么事故。\n\n";
          }

          eng.print(
            "\n" + scarText +
            "A strong gust of wind snatches the umbrella out of the old woman's hands and sweeps it into the branches of the tree.\n\n" +
            "The woman circles the tree a few times, gazing helplessly upward. That umbrella obviously means a lot to her, for a wistful tear is running down her cheek. But nobody except you seems to notice her loss.\n\n" +
            "After a few moments, the old woman dries her eyes, gives the tree a vicious little kick and shuffles away down the Lancaster Walk.\n\n" +
            "一阵强风从老妇人手中夺走了雨伞，将它吹进了树的枝杈间。\n\n" +
            "老妇人绕着树转了几圈，无助地仰望着。那把伞对她显然意义重大，一颗怅然的泪珠正沿她的脸颊滑落。但除了你，似乎没有人注意到她的损失。\n\n" +
            "片刻之后，老妇人擦干了眼泪，狠狠地踢了树一脚，然后蹒跚着沿兰开斯特小路走了。"
          );
        }
      }
    },

    exits() {
      return { s: "lancaster_walk", w: "inverness_terrace", sw: "round_pond" };
    },

    events: [
      {
        id: "examine_tree_lg",
        match: { verb: ["examine"], noun: ["tree", "crooked", "树", "老树"] },
        triggers: ["看树", "examine the tree", "look at the tree"],
        text(s) {
          if (s.itemAt("umbrella") === "lancaster_gate_tree") {
            return "It's quite a nice tree, actually, except for the umbrella wedged in its branches.\n\n其实这棵树还挺好看的，除了那把卡在枝杈间的雨伞。";
          }
          return "It's quite a nice tree, actually.\n\n其实这棵树还挺好看的。";
        },
      },
      {
        id: "examine_umbrella_tree",
        match: { verb: ["examine"], noun: ["umbrella", "伞", "雨伞"] },
        triggers: ["看雨伞", "examine the umbrella"],
        when: (s) => s.itemAt("umbrella") === "lancaster_gate_tree",
        text: "The closed umbrella dangles in the tree overhead, high out of reach. Its handle is carved in the shape of a parrot's head.\n\n" +
              "那把合拢的雨伞悬挂在头顶的树上，高得够不着。它的手柄雕成了鹦鹉头的形状。",
      },
      {
        id: "take_umbrella_tree",
        match: { verb: ["take", "get"], noun: ["umbrella", "伞", "雨伞"] },
        triggers: ["拿雨伞", "take the umbrella"],
        when: (s) => s.itemAt("umbrella") === "lancaster_gate_tree",
        text: "The umbrella is high out of reach.\n\n雨伞太高了，够不着。",
      },
      {
        id: "throw_ball_tree",
        match: { verb: ["throw", "hit", "toss"], noun: ["ball", "soccer", "足球", "球"], noun2: ["umbrella", "tree", "伞", "树"] },
        triggers: [
          "把球扔向树", "扔球打伞", "用球砸伞",
          "throw ball at tree", "throw ball at umbrella", "hit tree with ball",
        ],
        when: (s) => s.has("ball") && s.itemAt("umbrella") === "lancaster_gate_tree",
        act(s) {
          s.destroy("ball");
          s.setFlag("ball_in_tree");
          s.placeItem("umbrella", "lancaster_gate");
        },
        text: "The soccer ball lodges itself in the tree beside the umbrella.\n\n" +
              "The umbrella teeters uncertainly for a moment, then tumbles out of the tree and lands at your feet.\n\n" +
              "足球卡进了雨伞旁的树枝里。\n\n雨伞摇摆了一瞬，然后从树上跌落，掉在你脚边。",
      },
      {
        id: "take_umbrella_ground",
        match: { verb: ["take", "get", "pick"], noun: ["umbrella", "伞", "雨伞"] },
        triggers: ["捡伞", "take the umbrella", "pick up the umbrella"],
        when: (s) => s.itemAt("umbrella") === "lancaster_gate",
        act(s) {
          s.take("umbrella");
          if (!s.hasFlag("scored_umbrella")) { s.addScore(5); s.setFlag("scored_umbrella"); }
        },
        text: 'As you pick up the umbrella and smooth the wrinkles, you notice a touristy slogan printed around the outside: "All prams lead to the Kensington Gardens."\n\n' +
              '当你捡起雨伞抚平褶皱时，你注意到伞面外侧印着一句旅游标语："所有婴儿车都通向肯辛顿花园。"\n\n[+5分]',
      },
      {
        id: "push_pram_lg",
        match: { verb: ["push", "move"], noun: ["pram", "perambulator", "carriage", "婴儿车", "推车"] },
        triggers: ["推婴儿车", "push the pram south", "push perambulator s"],
        when: (s) => pramRoom(s) === "lancaster_gate",
        act(s, eng) {
          s.clearFlag("pram_at_lancaster");
          s.setFlag("pram_at_walk");
          eng.moveTo("lancaster_walk");
        },
        text: "",
      },
      {
        id: "open_umbrella_lg",
        match: { verb: ["open"], noun: ["umbrella", "伞", "雨伞"] },
        triggers: ["撑伞", "打开雨伞", "open the umbrella"],
        when: (s) => s.has("umbrella") && s.room === "lancaster_gate",
        act(s, eng) {
          if (s.hasFlag("wind_changed")) {
            eng.print("The west wind fills the umbrella the moment you open it. You're blown helplessly eastward past Inverness Terrace to the Black Lion Gate, where you collide with a crowd of starched nannies.\n\nPainfully, you regain your footing and snap the umbrella shut.\n\n西风在你撑开伞的瞬间灌满了伞面。你被无助地向东吹过因弗内斯台到黑狮门，撞上了一群衣着整洁的保姆。\n\n你痛苦地站稳，啪地合上了伞。");
            eng.moveTo("black_lion_gate");
          } else {
            eng.print("The east wind fills the umbrella the moment you open it. You're blown helplessly westward.\n\nPainfully, you regain your footing and snap the umbrella shut.\n\n东风在你撑开伞的瞬间灌满了伞面。你被无助地向西吹去。\n\n你痛苦地站稳，啪地合上了伞。");
            eng.moveTo("inverness_terrace");
          }
        },
        text: "",
      },
    ],
  },

  // ─── 9. Lancaster Walk ───
  lancaster_walk: {
    name: "Lancaster Walk",
    cn: "兰开斯特小路",

    desc(s) {
      let d = "An impressive sculpture of a horse and rider dominates this bustling intersection. The Walk continues north and south; lesser paths curve off in many directions.\n\n" +
              "一座令人印象深刻的骑马雕塑主宰着这个繁忙的十字路口。小路向北(n)南(s)延伸；较小的路径向各个方向弯曲而去。\n\n" +
              "A broad field of grass, meticulously manicured, extends to the east. Beyond it you can see the Long Water glittering between the trees.\n\n" +
              "一片修剪得无可挑剔的宽阔草坪向东延展开去。草坪那边，你可以看到长水湖在树间闪着粼光。\n\n" +
              "A printed notice is stuck into the grass.\n\n一块印刷的告示牌插在草地上。";
      if (pramRoom(s) === "lancaster_walk") {
        if (s.hasFlag("in_pram")) {
          d += "\n\nYou're sitting in the perambulator.\n\n你坐在婴儿车里。";
        } else {
          d += "\n\nThere's a perambulator here.\n\n这里有一辆婴儿车。";
        }
      }
      return d;
    },

    exits(s) {
      return {
        n: "lancaster_gate",
        s: "flower_walk",
        sw: "the_wabe",
        w: "round_pond",
        nw: "inverness_terrace",
        e: {
          to: "long_water",
          when: (s2) => s2.hasFlag("in_pram") && s2.hasFlag("umbrella_open"),
          fail(s2) {
            if (s2.hasFlag("in_pram") && !s2.hasFlag("umbrella_open")) {
              return "The perambulator doesn't move on its own.\n\n婴儿车不会自己动。";
            }
            return "Perhaps you should take a moment to examine the notice.\n\n也许你该花点时间看看那块告示牌。";
          },
          act(s2, eng) {
            s2.clearFlag("in_pram");
            s2.clearFlag("umbrella_open");
            s2.setFlag("pram_broken");
            s2.setFlag("at_long_water");

            const items = s2.inventoryList();
            for (const { id } of items) {
              if (id !== "umbrella") s2.placeItem(id, "long_water");
            }
          },
          text: "The west wind fills the umbrella the moment you open it. You and your perambulator are blown helplessly eastward onto the grass.\n\n" +
                "You zoom down a long slope, barely missing several trees and boulders. Peering over the top of the perambulator, you see the Long Water coming closer and closer. Unable to stop, and too stupid to let go of the umbrella, you bravely close your eyes and pinch your nose shut.\n\nCRASH!\n\n" +
                "西风在你撑开伞的瞬间灌满了伞面。你和你的婴儿车被无助地向东吹上了草坪。\n\n你沿着一个长长的斜坡飞驰而下，险险地擦过几棵树和巨石。你从婴儿车顶探头看去，长水湖越来越近。停不下来，又蠢得不肯松开雨伞，你勇敢地闭上眼睛，捏住了鼻子。\n\n轰！",
        },
      };
    },

    events: [
      {
        id: "examine_notice",
        match: { verb: ["examine", "read"], noun: ["notice", "sign", "牌子", "告示", "告示牌"] },
        triggers: ["看告示", "读告示", "read the notice", "examine the notice"],
        text: "The words DO NOT WALK ON THE GRASS are sternly printed on the notice.\n\n告示牌上严肃地印着：请勿践踏草坪。",
      },
      {
        id: "examine_sculpture",
        match: { verb: ["examine"], noun: ["sculpture", "statue", "horse", "rider", "雕塑", "雕像", "马", "骑手"] },
        triggers: ["看雕塑", "examine the sculpture", "look at the statue"],
        text: 'According to a plaque, the sculpture is called PHYSICAL ENERGY.\n\n根据铭牌，这座雕塑名为"PHYSICAL ENERGY"（体力）。',
      },
      {
        id: "open_pram_lw",
        match: { verb: ["open"], noun: ["pram", "perambulator", "carriage", "婴儿车"] },
        triggers: ["打开婴儿车", "open the pram", "open the perambulator"],
        when: (s) => pramRoom(s) === "lancaster_walk" && !s.hasFlag("pram_open"),
        act(s) { s.setFlag("pram_open"); },
        text: "You open the perambulator.\n\n你打开了婴儿车。",
      },
      {
        id: "enter_pram_lw",
        match: { verb: ["enter", "ride", "sit", "get"], noun: ["pram", "perambulator", "carriage", "婴儿车", "推车", "车"] },
        triggers: ["坐进婴儿车", "get in the pram", "enter the pram", "sit in pram"],
        when: (s) => pramRoom(s) === "lancaster_walk" && !s.hasFlag("in_pram"),
        act(s) {
          if (!s.hasFlag("pram_open")) {
            return;
          }
          s.setFlag("in_pram");
        },
        text(s) {
          if (!s.hasFlag("pram_open")) {
            return "You'd have to open the perambulator to do that.\n\n你得先打开婴儿车才行。";
          }
          return "With great difficulty, and much to the amusement of passersby, you jam yourself into the unfortunate perambulator.\n\n费了九牛二虎之力，在路人们的哄笑中，你把自己塞进了那辆可怜的婴儿车。";
        },
      },
      {
        id: "open_umbrella_lw",
        match: { verb: ["open"], noun: ["umbrella", "伞", "雨伞"] },
        triggers: ["撑伞", "打开雨伞", "open the umbrella"],
        when: (s) => s.has("umbrella") && s.room === "lancaster_walk",
        act(s, eng) {
          if (s.hasFlag("in_pram")) {
            if (s.hasFlag("wind_changed")) {
              s.clearFlag("in_pram");
              s.setFlag("pram_broken");
              s.setFlag("at_long_water");
              const items = s.inventoryList();
              for (const { id } of items) {
                if (id !== "umbrella") s.placeItem(id, "long_water");
              }
              eng.print(
                "The west wind fills the umbrella the moment you open it. You and your perambulator are blown helplessly eastward onto the grass.\n\n" +
                "You zoom down a long slope, barely missing several trees and boulders. Peering over the top of the perambulator, you see the Long Water coming closer and closer. Unable to stop, and too stupid to let go of the umbrella, you bravely close your eyes and pinch your nose shut.\n\nCRASH!\n\n" +
                "西风在你撑开伞的瞬间灌满了伞面。你和你的婴儿车被无助地向东吹上了草坪。\n\n你沿着一个长长的斜坡飞驰而下，险险地擦过几棵树和巨石。你从婴儿车顶探头看去，长水湖越来越近。停不下来，又蠢得不肯松开雨伞，你勇敢地闭上眼睛，捏住了鼻子。\n\n轰！"
              );
              eng.moveTo("long_water");
            } else {
              s.clearFlag("in_pram");
              eng.print("The east wind fills the umbrella the moment you open it. The perambulator is blown helplessly westward, dumping you onto the grass.\n\nPainfully, you regain your footing and snap the umbrella shut.\n\n东风在你撑开伞的瞬间灌满了伞面。婴儿车被无助地向西吹去，把你甩到了草地上。\n\n你痛苦地站稳，啪地合上了伞。");
            }
            return;
          }
          if (s.hasFlag("wind_changed")) {
            eng.print("The west wind fills the umbrella the moment you open it. You're blown helplessly eastward past the Round Pond.\n\nPainfully, you regain your footing and snap the umbrella shut.\n\n西风在你撑开伞的瞬间灌满了伞面。你被无助地向东吹过圆池塘。\n\n你痛苦地站稳，啪地合上了伞。");
            eng.moveTo("round_pond");
          } else {
            eng.print("The east wind fills the umbrella the moment you open it. You're blown helplessly westward to the Palace Gate.\n\nPainfully, you regain your footing and snap the umbrella shut.\n\n东风在你撑开伞的瞬间灌满了伞面。你被无助地向西吹到了宫殿门。\n\n你痛苦地站稳，啪地合上了伞。");
            eng.moveTo("palace_gate");
          }
        },
        text: "",
      },
      {
        id: "exit_pram",
        match: { verb: ["exit", "leave", "get out"], noun: ["pram", "perambulator", "carriage", "婴儿车"] },
        triggers: ["出来", "下车", "get out of pram", "exit pram", "leave pram"],
        when: (s) => s.hasFlag("in_pram"),
        act(s) {
          s.clearFlag("in_pram");
          s.clearFlag("umbrella_open");
        },
        text: "Gratefully, you clamber out of the cramped perambulator.\n\n你如释重负地从狭窄的婴儿车里爬了出来。",
      },
      {
        id: "push_pram_lw_s",
        match: { verb: ["push", "move"], noun: ["pram", "perambulator", "carriage", "婴儿车", "推车"] },
        triggers: ["推婴儿车", "push the pram south", "push perambulator s"],
        when: (s) => pramRoom(s) === "lancaster_walk" && !s.hasFlag("in_pram"),
        act(s, eng) {
          s.clearFlag("pram_at_walk");
          s.setFlag("pram_at_flower");
          eng.moveTo("flower_walk");
        },
        text: "",
      },
      {
        id: "walk_on_grass",
        match: { verb: ["walk", "go", "step"], noun: ["grass", "lawn", "east", "草坪", "草地"] },
        triggers: ["走上草坪", "walk on the grass", "step on the grass"],
        act(s, eng) {
          eng.print("As your feet touch the grass you sense a strange motion around you. Looking down, you watch with horror as the grass begins to ripple and writhe with vegetable indignance!\n\nAngry green stalks whip around your legs, pull you to the ground and drag you, kicking and screaming, back to the paved surface of the Lancaster Walk.\n\n当你的脚触碰到草坪时，你感到周围有一种奇怪的动静。低头看去，你惊恐地看着草地开始荡漾和扭动，带着植物的愤怒！\n\n愤怒的绿色茎秆抽打着你的腿，把你拖倒在地，踢打着、尖叫着，把你拖回了兰开斯特小路的铺砌路面上。");
        },
        text: "",
      },
    ],
  },

  // ─── 10. Long Water ───
  long_water: {
    name: "Long Water",
    cn: "长水湖",

    desc(s) {
      let d = "You're on a shady path that winds along the western shore of the Long Water. Looking south, you can see the graceful arch of a bridge, and beyond it the cool expanse of the river Serpentine.\n\n" +
              "你在一条沿长水湖西岸蜿蜒的林荫小路上。向南望去，你可以看到一座桥的优雅拱形，再远处是蛇形湖清凉的水面。\n\n" +
              "A charming statue stands nearby.\n\n一座迷人的雕像矗立在附近。";
      if (s.hasFlag("missile_visible")) {
        d += "\n\nThe missile isn't completely motionless. It's falling very, very slowly towards the Long Water.\n\n导弹并非完全静止。它正非常、非常缓慢地向长水湖坠落。";
        if (s.hasFlag("white_door_visible")) {
          d += "\n\nYour eyes follow the missile's trajectory downward, where you notice another peculiar phenomenon. It looks like a white door, suspended just above the surface of the water.\n\n" +
               "你的目光顺着导弹的轨迹向下追去，在那里你注意到另一个奇异的现象。那看起来像一扇白色的门，悬浮在水面上方。";
        }
      }
      return d;
    },

    onEnter(s, eng) {
      s.setFlag("at_long_water");
      s.setCnt("lw_turns", 0);
    },

    onTurn(s, eng) {
      if (s.room !== "long_water") return;
      s.inc("lw_turns");
      const t = s.cnt("lw_turns");
      if (t === 1 && !s.hasFlag("missile_visible")) {
        s.setFlag("missile_visible");
        eng.print(
          "\nYou begin to move away, but stop dead in your tracks.\n\n" +
          "A gleam overhead catches your eye.\n\n" +
          "Oh, dear. A missile is hanging motionless in the sky.\n\n" +
          "你刚要离开，却猛地停住了脚步。\n\n" +
          "头顶一道闪光吸引了你的目光。\n\n" +
          "天哪。一枚导弹悬停在空中。"
        );
      }
      if (t === 2 && !s.hasFlag("white_door_visible")) {
        s.setFlag("white_door_visible");
      }
    },

    exits(s) {
      return {
        s: {
          to: "wading",
          when: (s2) => s2.hasFlag("white_door_visible"),
          fail: "You begin to move away, but stop dead in your tracks.\n\nA gleam overhead catches your eye.\n\nOh, dear. A missile is hanging motionless in the sky.\n\n你刚要离开，却猛地停住了脚步。\n\n头顶一道闪光吸引了你的目光。\n\n天哪。一枚导弹悬停在空中。",
          text: "You wade into the cool, dark water.\n\n你涉入清凉幽暗的湖水中。",
        },
      };
    },

    events: [
      {
        id: "examine_statue_lw",
        match: { verb: ["examine"], noun: ["statue", "peter pan", "peter", "铜像", "雕像"] },
        triggers: ["看雕像", "examine the statue", "look at the statue"],
        text: "A charming statue stands nearby.\n\n一座迷人的雕像矗立在附近。",
      },
      {
        id: "examine_door_lw",
        match: { verb: ["examine"], noun: ["door", "white door", "门", "白门"] },
        triggers: ["看白门", "examine the white door", "look at the door"],
        when: (s) => s.hasFlag("white_door_visible"),
        text: "Looking directly at the white door makes you uneasy. It's as if your eyes can't decide whether it's really there or not.\n\n" +
              "直视那扇白门让你感到不安。仿佛你的眼睛无法确定它是否真的在那里。",
      },
      {
        id: "examine_missile",
        match: { verb: ["examine"], noun: ["missile", "导弹", "sky", "天空"] },
        triggers: ["看导弹", "examine the missile", "look at the sky"],
        when: (s) => s.hasFlag("missile_visible"),
        text: "The missile isn't completely motionless. It's falling very, very slowly towards the Long Water.\n\n导弹并非完全静止。它正非常、非常缓慢地向长水湖坠落。",
      },
    ],
  },

  // ─── 11. Wading ───
  wading: {
    name: "Wading",
    cn: "涉水",

    desc(s) {
      let d = "You're standing knee-deep in the Long Water, not far from the western shore. Looking east, you can see a white door hovering just above the surface.\n\n" +
              "你站在长水湖中，水没过膝盖，离西岸不远。向东望去，你可以看到一扇白色的门悬浮在水面上方。";
      return d;
    },

    onTurn(s, eng) {
      if (s.room !== "wading") return;
      eng.print(
        "\nA flock of ravens glides into view! They circle over the Long Water and disappear through the open white door.\n\n" +
        "一群乌鸦滑翔而入！它们在长水湖上空盘旋，然后消失在打开的白门中。\n\n" +
        "The missile continues its slow descent.\n\n导弹继续缓慢坠落。"
      );
    },

    exits() {
      return {
        w: "long_water",
      };
    },

    events: [
      {
        id: "examine_door_w",
        match: { verb: ["examine"], noun: ["door", "white door", "白门", "门"] },
        triggers: ["看白门", "examine the door", "look at the white door"],
        text: "Looking directly at the white door makes you uneasy. It's as if your eyes can't decide whether it's really there or not.\n\n" +
              "直视那扇白门让你感到不安。仿佛你的眼睛无法确定它是否真的在那里。",
      },
      {
        id: "enter_door",
        match: { verb: ["enter", "go", "walk"], noun: ["door", "门", "白门", "白色的门"] },
        triggers: [
          "进入白门", "穿过门", "走进那扇门",
          "enter the white door", "go through the door", "enter door",
        ],
        async act(s, eng) {
          s.setFlag("prologue_done");
          eng.print(
            "As you wade to the threshold a familiar roadrunner flutters past. The ruby in its beak gleams enticingly as it slips through the white door.\n\n" +
            "当你涉水走到门槛处，一只熟悉的走鹃扑棱着飞过。它喙中的红宝石闪烁着诱人的光芒，滑入了白门。\n\n" +
            'All color abruptly drains from the landscape. Trees, sky and sun flatten into a spherical shell, with you at the very center. A hissing in your ears becomes a rumble, then a roar as the walls of the shell collapse inward, faster and faster.\n\n' +
            "所有色彩突然从景物中褪去。树木、天空和太阳被压平成一个球形壳，而你正处于正中心。耳中的嘶嘶声变成隆隆声，然后化为轰鸣，壳壁越来越快地向内坍缩。\n\n" +
            '"This way, please."\n\nYou turn, but see no one.\n\n' +
            '"请这边走。"\n\n你转过身，但看不到任何人。\n\n' +
            '"This way," the voice urges. "Be quick."\n\n' +
            '"这边，"那个声音催促道。"快一点。"\n\n' +
            'The space around you articulates. "No!" your mind shudders. "That\'s not a direction!"\n\n' +
            '你周围的空间发出了关节般的声响。"不！"你的心智颤抖着。"那不是一个方向！"\n\n' +
            '"It\'s a perfectly legitimate direction," retorts the voice with cold amusement. "Now come along."\n\n' +
            '"那是一个完全合理的方向，"那个声音带着冷冷的笑意反驳道。"现在跟我来吧。"\n\n' +
            "—— 序章完 / End of Prologue ——"
          );
          await eng.transitionChapter({
            to: "wabe",
            roomCandidates: ["meadow", "vertex", "cottage"],
          });
        },
      },
      {
        id: "go_through_door_emb",
        triggers: [
          "往东走进门", "穿过白色的门去另一个世界",
          "walk east through the door", "go east into the light", "go east",
        ],
        async act(s, eng) {
          const room = eng.rooms["wading"];
          if (!room) return;
          const ev = room.events.find(e => e.id === "enter_door");
          if (ev) await eng._executeEvent(ev);
        },
      },
    ],
  },
};
