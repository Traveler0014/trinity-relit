import assert from "node:assert/strict";
import test from "node:test";
import { createGame, command, findRoute, go } from "./harness.mjs";

test("从宫殿门经过六扇蘑菇门、牧场，剪线后回到开局", async (t) => {
  const game = createGame();
  const { eng, state, output } = game;
  const act = (input) => command(game, input);
  const walk = (room) => go(game, room);
  const has = (item) => assert.ok(state.has(item), `应当已经取得 ${item}`);
  const flag = (name) => assert.ok(state.hasFlag(name), `事件没有完成：${name}`);
  async function stage(name, run) {
    let completed = false;
    await t.test(name, async () => {
      await run();
      completed = true;
    });
    assert.ok(completed, `${name} 失败，停止后续通关步骤`);
  }
  const at = (chapter, room) => {
    assert.equal(state.chapter, chapter);
    assert.equal(state.room, room);
    assert.ok(state.visited.has(room));
  };
  async function dial(symbol) {
    await walk("vertex");
    for (let turns = 0; state.sundialSymbol !== symbol; turns++) {
      assert.ok(turns < 7, "转动符号环没有改变日晷状态");
      await act("turn ring");
    }
  }
  async function door(chapter, destination) {
    assert.equal(eng.loadedChapters.has(chapter), false, `${chapter} 应当懒加载`);
    assert.equal(eng.rooms[destination], undefined);
    await walk(destination);
    at(chapter, destination);
    assert.ok(eng.loadedChapters.has(chapter));
    flag(`wabe_to_${chapter}_used`);
  }

  await stage("序章：解开风向、婴儿车与白门，真实加载 Wabe", async () => {
    at("prologue", "palace_gate");
    await act("看看四周");
    await walk("flower_walk");
    await act("拿足球"); has("ball");
    await walk("the_wabe");
    await act("unscrew gnomon");
    await act("take gnomon"); has("gnomon");
    await walk("round_pond");
    await act("take paper bird"); has("paper_bird");
    await act("open paper bird"); flag("bird_unfolded");
    await walk("broad_walk");
    await act("buy crumbs"); has("bag");
    await act("feed birds"); flag("birds_fed");
    await act("take ruby"); flag("wind_changed");
    await walk("black_lion_gate");
    await act("push pram"); at("prologue", "inverness_terrace");
    await act("push pram"); at("prologue", "lancaster_gate");
    await act("wait"); flag("umbrella_woman_done");
    await act("throw ball at tree");
    await act("拿雨伞"); has("umbrella");
    await act("push pram"); at("prologue", "lancaster_walk");
    // 寻路不能把受条件限制的草坪当捷径，也不能替玩家解决谜题。
    assert.equal(findRoute(eng, "long_water"), null);
    await act("open pram");
    await act("enter pram"); flag("in_pram");
    await act("open umbrella"); at("prologue", "long_water");
    flag("pram_broken");
    assert.equal(state.itemAt("paper_bird"), "long_water");
    await act("take paper bird");
    await act("take gnomon");
    flag("white_door_visible");
    await walk("wading");
    await act("enter door"); at("wabe", "meadow");
    flag("prologue_done");
    assert.equal(state.score, 15);
  });

  await stage("Wabe → Japan：日晷开门，雨伞与纸鹤谜题", async () => {
    await walk("moor");
    assert.equal(findRoute(eng, "playground"), null);
    assert.match(await act("in"), /蘑菇门紧闭/);
    at("wabe", "moor");
    await dial(1);
    await walk("moor");
    await door("japan", "playground");
    await act("wait"); flag("girl_found_playground");
    await act("把雨伞给女孩"); flag("umbrella_given_to_girl");
    await walk("shelter");
    await act("take spade"); has("spade");
    await act("give paper to girl");
    assert.equal(state.hasFlag("bird_unfolded"), false);
    await walk("playground");
    await act("ride bird"); at("wabe", "moor");
    assert.equal(state.score, 19);
  });

  await stage("Underground：带光源往返三个洞穴，取得灯笼和对讲机", async () => {
    await dial(2);
    await walk("south_bog");
    await act("take splinter"); has("splinter");
    await walk("ossuary");
    assert.ok(state.visited.has("cemetery"), "保留 cottage.s 的真实通路");
    await door("underground", "underground_1");
    await walk("underground_2");
    await act("take walkie-talkie"); has("walkie_talkie");
    await walk("underground_3");
    await act("take lantern"); has("lantern");
    await act("turn lantern"); flag("lantern_on");
    await walk("underground_2");
    await act("drop lantern"); flag("lantern_dropped_middle");
    await act("drop splinter");
    await walk("underground_1");
    await walk("underground_2"); // 此次仅靠留在中间的灯笼避开尸妖。
    await act("take lantern"); has("lantern");
    await walk("underground_1");
    await walk("ossuary"); at("wabe", "ossuary");
    assert.equal(state.score, 21);
  });

  await stage("Orbit：肥皂泡门槛、斧头、上下移动与破泡返回", async () => {
    await dial(3);
    await walk("waterfall");
    assert.equal(findRoute(eng, "orbit_satellite"), null);
    assert.match(await act("in"), /需要肥皂泡/);
    await walk("top_of_arbor");
    await act("take axe"); has("axe");
    const flippedBefore = state.flipped;
    await act("n");
    assert.equal(state.flipped, !flippedBefore);
    await walk("cottage");
    await act("take soap bubble"); has("soap_bubble");
    await walk("waterfall");
    await door("orbit", "orbit_satellite");
    await act("u"); at("orbit", "orbit_space");
    await act("d"); at("orbit", "orbit_satellite");
    await act("break bubble with axe"); at("wabe", "waterfall");
    assert.equal(state.itemAt("soap_bubble"), "destroyed");
    await act("drop axe");
  });

  await stage("Pacific：七回合内按下按钮，走过海滩并返回", async () => {
    await dial(4);
    await walk("chasms_brink");
    await door("pacific", "mesa");
    await walk("bottom_scaffold");
    await act("open box"); flag("pacific_box_open");
    await act("push switch");
    assert.equal(state.timer.id, "pacific_switch");
    assert.equal(state.timer.remaining, 6);
    await act("push button"); flag("pacific_button_pushed");
    assert.equal(state.timer, null);
    assert.equal(state.hasFlag("pacific_timer_expired"), false);
    for (const room of ["south_beach", "west_beach", "north_beach", "east_beach"]) await walk(room);
    await act("take coconut"); has("coconut");
    await act("drop coconut");
    await walk("mesa");
    await walk("chasms_brink"); at("wabe", "chasms_brink");
  });

  await stage("Tundra：取到旅鼠，返回药草园", async () => {
    await dial(5);
    await walk("herb_garden");
    await door("tundra", "tundra_1");
    await walk("cliff_edge");
    await act("take lemming"); has("lemming");
    await walk("tundra_1");
    await walk("herb_garden"); at("wabe", "herb_garden");
  });

  await stage("Islet → Desert → Ranch：白门和双向章节切换", async () => {
    await dial(6);
    await walk("the_river");
    await door("islet", "islet");
    await walk("sand_bar");
    // 当前银币、笼子没有取得路径；不注入物品/flags，记录在 SHIP_PLAN。
    await act("enter door"); at("desert", "shallow_crater");
    flag("islet_done");
    await walk("behind_shed");
    await walk("nw_ranch"); at("ranch", "nw_ranch");
    await walk("assembly_room");
    await walk("closet");
    await act("close door"); flag("closet_door_closed");
    await act("open door");
    assert.equal(state.hasFlag("closet_door_closed"), false);
    await walk("nw_ranch");
    await walk("behind_shed"); at("desert", "behind_shed");
  });

  await stage("Desert：吉普车离开后下塔，拉闸剪线触发时间循环结局", async () => {
    await walk("tower_platform");
    assert.match(await act("d"), /不能安全下塔/);
    at("desert", "tower_platform");
    await walk("south_of_tower");
    await walk("jeep");
    await act("turn dial"); flag("jeep_departed");
    await walk("tower_platform");
    await act("d"); at("desert", "tower_landing");
    await act("d"); at("desert", "base_of_tower");
    await act("pull breaker"); flag("breaker_pulled");
    const ending = await act("cut wire with red");
    assert.match(ending, /You cut the wire/);
    assert.match(ending, /时间循环闭合/);
    assert.match(ending, /Final score: 21 \/ 100/);
    at("prologue", "palace_gate");
    assert.equal(state.dead, false);
    assert.equal(state.score, 21); // 15 序章 + 4 Japan + 2 Underground。
    assert.deepEqual([...eng.loadedChapters], [
      "prologue", "wabe", "japan", "underground", "orbit", "pacific", "tundra", "islet", "desert", "ranch",
    ]);
    assert.equal(output.filter((entry) => entry.text.includes("Final score:")).length, 1);
    t.diagnostic(`完成 ${state.turns} 回合，访问 ${state.visited.size} 个房间，分数 ${state.score}/100`);
  });
});
