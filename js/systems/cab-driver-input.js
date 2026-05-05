import { clamp } from "../lib/math.js";
import { $ } from "../lib/dom.js";
import { beep } from "../audio/sfx-core.js";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { train } from "./vehicle-state.js";
import { syncLeverHandlePos } from "../ui/lever-handle.js";
import { disengageAto } from "./ato-readiness.js";

export const MODE_LIST = ["RM", "CM", "AM", "FAM"];

function normalizeDrivingModeIfNeeded() {
  if (MODE_LIST.indexOf(train.mode) >= 0) return;
  train.mode = "RM";
  const mv = $("modeValue");
  if (mv) {
    mv.textContent = "RM";
    mv.className = "value RM";
  }
}

function maxAuthorizedModeIndex() {
  const c = train.maxAuthorizedDrivingMode ?? "FAM";
  let idx = MODE_LIST.indexOf(c);
  if (idx < 0) idx = MODE_LIST.indexOf("FAM");
  return idx;
}

export function setMode(m) {
  if (train.mode === m) return;
  const targetIdx = MODE_LIST.indexOf(m);
  if (targetIdx < 0) return;
  if (targetIdx > maxAuthorizedModeIndex()) {
    showMsg(
      `不可选择 ${m}：已受「最高驾驶模式」限制（当前授权上限为 ${train.maxAuthorizedDrivingMode}）。可在右侧面板调高后再升级。`,
      "alarm",
    );
    tcmsLog(`模式切换被拒：目标 ${m} > 授权 ${train.maxAuthorizedDrivingMode}`, "alarm");
    return;
  }
  if (m === "AM" || m === "FAM") {
    if (train.direction !== "F") {
      showMsg("ATO/自动模式：请先将方向手柄置于「前进 F」", "alarm");
      return;
    }
    if (!train.zeroSpeed && Math.abs(train.lever) > 0.05) {
      showMsg("自动模式升级：请先停稳并将主控手柄归零", "alarm");
      return;
    }
  }
  train.mode = m;
  const mv = $("modeValue");
  if (mv) {
    mv.textContent = m;
    mv.className = "value " + m;
  }
  showMsg(`模式切换 → ${m}`, "ok");
  tcmsLog(`MODE: ${m}`, "info");
  beep(880, 0.1);
  if (m !== "AM" && m !== "FAM") {
    disengageAto();
  }
}

export function modeUp() {
  normalizeDrivingModeIfNeeded();
  const i = MODE_LIST.indexOf(train.mode);
  if (i < MODE_LIST.length - 1) setMode(MODE_LIST[i + 1]);
}

export function modeDown() {
  normalizeDrivingModeIfNeeded();
  const i = MODE_LIST.indexOf(train.mode);
  if (i > 0) setMode(MODE_LIST[i - 1]);
}

export function setLever(v) {
  v = clamp(v, -1.2, 1);
  if (train.atoRunning && Math.abs(v) > 0.02) {
    disengageAto();
    showMsg("ATO 退出（手柄移动）", "alarm");
    tcmsLog("ATO 退出: 手柄不在零位", "err");
  }
  train.lever = v;
  syncLeverHandlePos(train.lever);
}
