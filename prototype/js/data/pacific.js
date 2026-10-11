// ═══════════════════════════════════════════════════
//  Pacific Island — 比基尼环礁  7 rooms
//  From Chasm's Brink (Neptune ♆) via mushroom door. Mesa = entrance; scaffold, beaches, coconut.
//  All English text from original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

// 计时器回调按 id 导出，读档后由引擎装回。理由同 prologue.js。
export const TIMERS = {
  pacific_switch(s, eng) {
    if (s.timer && s.timer.remaining <= 0) {
      s.setFlag("pacific_timer_expired");
      eng.print("Seven minutes have passed. You were too late.\n\n七分钟已过。你来不及了。");
    }
  },
};

export const ROOMS = {

  // ─── 1. Mesa (obj#76) — entry from Wabe Chasm's Brink ───
  mesa: {
    name: "Mesa",
    cn: "台地",

    desc(s) {
      return "You are on a mesa—a small island in the middle of an ocean. A scaffold rises to the south; the white door behind you leads back to the Wabe.\n\n你在台地上——大洋中的一座小岛。南面矗立着脚手架；身后的白门通向 Wabe。";
    },

    exits(s) {
      const ex = {
        s: "scaffold",
        d: "scaffold",
        n: "scaffold",
        u: "scaffold",
      };
      ex.out = {
        to: "chasms_brink",
        when: () => true,
        async act(s2, eng) {
          eng.print("You step through the white door. The world shifts. You are back at the Chasm's Brink.\n\n你穿过白门。世界陡然一变。你回到了深渊边缘。");
          await eng.transitionChapter({
            to: "wabe",
            roomCandidates: ["chasms_brink"],
          });
        },
        text: "",
      };
      ex.in = ex.out;
      return ex;
    },

    events: [],
  },

  // ─── 2. Scaffold (obj#394) — upper structure ───
  scaffold: {
    name: "Scaffold",
    cn: "脚手架",

    desc(s) {
      return "You are on the scaffold. The mesa is to the north and above; the bottom of the scaffold is below. Beaches lie in all directions.\n\n你在脚手架上。台地在北面、上方；脚手架底部在下方。四面都是海滩。";
    },

    exits() {
      return {
        u: "mesa",
        n: "north_beach",
        s: "south_beach",
        e: "east_beach",
        w: "west_beach",
        d: "bottom_scaffold",
      };
    },

    events: [],
  },

  // ─── 3. Bottom of Scaffold (obj#344) — box, switch, button ───
  bottom_scaffold: {
    name: "Bottom of Scaffold",
    cn: "脚手架底部",

    desc(s) {
      let d = "You are at the bottom of the scaffold. A box is here; open it and push the switch—you have seven minutes. Then push the button.\n\n你在脚手架底部。这里有一个箱子；打开它并按下开关——你有七分钟。然后按下按钮。";
      if (s.hasFlag("pacific_box_open")) d += "\n\nThe box is open. A switch and a button are inside.\n\n箱子开着。里面有一个开关和一个按钮。";
      if (s.hasFlag("pacific_switch_pushed")) d += "\n\nThe switch is on. You have seven minutes before you must push the button.\n\n开关已按下。你必须在七分钟内按下按钮。";
      if (s.hasFlag("pacific_button_pushed")) d += "\n\nYou have pushed the button in time.\n\n你及时按下了按钮。";
      return d;
    },

    exits() {
      return {
        u: "scaffold",
        nw: "west_beach",
        s: "south_beach",
        out: "south_beach",
      };
    },

    events: [
      {
        id: "pacific_open_box",
        match: { verb: ["open"], noun: ["box", "箱子"] },
        triggers: ["open box", "打开箱子"],
        when: (s) => s.room === "bottom_scaffold" && !s.hasFlag("pacific_box_open"),
        act(s) { s.setFlag("pacific_box_open"); },
        text: "You open the box. Inside are a switch and a button.\n\n你打开箱子。里面有一个开关和一个按钮。",
      },
      {
        id: "pacific_push_switch",
        match: { verb: ["push", "press"], noun: ["switch", "开关"] },
        triggers: ["push switch", "按开关"],
        when: (s) => s.room === "bottom_scaffold" && s.hasFlag("pacific_box_open") && !s.hasFlag("pacific_switch_pushed"),
        act(s) {
          s.setFlag("pacific_switch_pushed");
          s.startTimer(7, "pacific_switch", TIMERS.pacific_switch);
        },
        text: "You push the switch. You have seven minutes to push the button.\n\n你按下开关。你有七分钟时间按下按钮。",
      },
      {
        id: "pacific_push_button",
        match: { verb: ["push", "press"], noun: ["button", "按钮"] },
        triggers: ["push button", "按按钮"],
        when: (s) => s.room === "bottom_scaffold" && s.hasFlag("pacific_switch_pushed") && !s.hasFlag("pacific_button_pushed"),
        act(s, eng) {
          if (s.hasFlag("pacific_timer_expired")) {
            eng.print("Too late. The seven minutes have passed.\n\n太迟了。七分钟已经过了。");
            return;
          }
          if (s.timer && s.timer.id === "pacific_switch") s.clearTimer();
          s.setFlag("pacific_button_pushed");
          eng.print("You push the button in time. The signal is sent.\n\n你及时按下按钮。信号已发出。");
        },
        text: "",
      },
    ],
  },

  // ─── 4. North Beach (obj#224) — ring: E↔east, W↔west ───
  north_beach: {
    name: "North Beach",
    cn: "北海滩",

    desc(s) {
      return "You are on the north beach. The ocean stretches away. The scaffold is to the south.\n\n你在北海滩。大海向远处延伸。脚手架在南面。";
    },

    exits() {
      return {
        s: "scaffold",
        e: "east_beach",
        w: "west_beach",
      };
    },

    events: [],
  },

  // ─── 5. West Beach (obj#231) — ring: N↔north, SE↔south ───
  west_beach: {
    name: "West Beach",
    cn: "西海滩",

    desc(s) {
      return "You are on the west beach. A fin or dolphin may follow you. Coconuts and an islet are visible. Point at the coconut when the tide is right; the dolphin may toss it to your feet.\n\n你在西海滩。一只鳍或海豚可能会跟着你。可见椰子和一座小岛。潮水合适时指向椰子；海豚可能会把它抛到你脚边。";
    },

    exits() {
      return {
        e: "scaffold",
        n: "north_beach",
        se: "south_beach",
      };
    },

    events: [],
  },

  // ─── 6. East Beach (obj#215) — coconut among palm trees ───
  east_beach: {
    name: "East Beach",
    cn: "东海滩",

    desc(s) {
      return "You are on the east beach. The ocean and the scaffold are nearby.\n\n你在东海滩。大海与脚手架在近旁。";
    },

    onEnter(s) {
      if (!s.has("coconut") && !s.inRoom("coconut")) {
        s.placeItem("coconut", "east_beach");
      }
    },

    exits() {
      return {
        w: "scaffold",
        n: "north_beach",
        s: "south_beach",
      };
    },

    events: [],
  },

  // ─── 7. South Beach (obj#476) — red button (scenery) ───
  south_beach: {
    name: "South Beach",
    cn: "南海滩",

    desc(s) {
      return "You are on the south beach. The scaffold rises to the north. A red button is here.\n\n你在南海滩。脚手架在北面耸立。这里有一个红色按钮。";
    },

    exits() {
      return {
        n: "scaffold",
        in: "bottom_scaffold",
        w: "west_beach",
        e: "east_beach",
      };
    },

    events: [],
  },
};
