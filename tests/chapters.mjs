// 测试专用装配；不修改浏览器入口。main.js 接线另由集成测试验证。
import { ROOMS as PROLOGUE, TIMERS as PROLOGUE_TIMERS } from "../prototype/js/data/prologue.js";
export { PROLOGUE_TIMERS };
export const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },
  { id: "wabe", loader: () => import("../prototype/js/data/wabe.js") },
  { id: "japan", loader: () => import("../prototype/js/data/japan.js") },
  { id: "underground", loader: () => import("../prototype/js/data/underground.js") },
  { id: "orbit", loader: () => import("../prototype/js/data/orbit.js") },
  { id: "pacific", loader: () => import("../prototype/js/data/pacific.js") },
  { id: "tundra", loader: () => import("../prototype/js/data/tundra.js") },
  { id: "islet", loader: () => import("../prototype/js/data/islet.js") },
  { id: "desert", loader: () => import("../prototype/js/data/desert.js") },
  { id: "ranch", loader: () => import("../prototype/js/data/ranch.js") },
  { id: "finale", loader: () => import("../prototype/js/data/finale.js") },
];

