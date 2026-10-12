// ═══════════════════════════════════════════════════
//  设备级偏好设置
//  与游戏存档（trinity-relit:save:vN）分开存放：导入别人的存档
//  不应该改变本机的功能开关。将来的设置面板只是同一份
//  数据的另一个读写入口（消费 get/set/subscribe），游戏
//  逻辑不感知面板的存在。
//
//  隐私模式 / 存储被禁用时降级为仅内存生效，不抛异常。
// ═══════════════════════════════════════════════════

const KEY = "trinity-relit:settings:v1";

// 每个设置项的合法取值；新增设置项在这里登记即可。
// 读到不合法的值一律回落默认，而不是悄悄改写。
const SCHEMA = {
  semantic: ["ask", "on", "off"],
};
const DEFAULTS = { semantic: "ask" };

const listeners = new Set();
let cache = null;

function load() {
  if (cache) return cache;
  const data = { ...DEFAULTS };
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, allowed] of Object.entries(SCHEMA)) {
        if (allowed.includes(parsed[key])) data[key] = parsed[key];
      }
    }
  } catch { /* 存储不可用或数据损坏：按默认值处理 */ }
  cache = data;
  return data;
}

function persist() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(cache));
  } catch { /* 写不进磁盘就只在本次会话生效 */ }
}

export const settings = {
  get(key) {
    return load()[key];
  },
  set(key, value) {
    const allowed = SCHEMA[key];
    if (!allowed || !allowed.includes(value)) return false;
    const data = load();
    if (data[key] === value) return true;
    data[key] = value;
    persist();
    for (const fn of listeners) {
      try { fn({ ...data }); } catch { /* 订阅方异常不影响写入 */ }
    }
    return true;
  },
  // 面板刷新用；返回取消订阅函数。
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
