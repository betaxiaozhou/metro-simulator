import { $ } from "../lib/dom.js";

export let lastMmiMsg = "系统就绪";
/** 与左屏 MMI 告警条样式同步（由 render-mmi 每帧刷 class） */
export let lastMmiMsgLevel = "info";

let logCount = 0;

export function tcmsLog(msg, type = "") {
  const el = $("tcmsLog");
  if (!el) return;
  const d = document.createElement("div");
  if (type) d.className = type;
  const t = new Date().toTimeString().slice(0, 8);
  d.textContent = `[${t}] ${msg}`;
  el.insertBefore(d, el.firstChild);
  if (++logCount > 50) el.removeChild(el.lastChild);
}

export function showMsg(msg, level = "info") {
  lastMmiMsg = msg;
  lastMmiMsgLevel = level;
  const el = $("mmiMsg");
  if (el) {
    el.textContent = msg;
    el.className = "mmi-msg " + (level === "alarm" ? "alarm" : level === "ok" ? "ok" : "");
  }
}
