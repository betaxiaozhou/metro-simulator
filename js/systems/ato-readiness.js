/**
 * ATO 发车允许与 A/A 自动上车：门关好锁紧（含站台门回读）、未扣车、非站停作业、前方具备示意移动空间等。
 */
import { showMsg, tcmsLog } from "../ui/messages.js";
import { train } from "./vehicle-state.js";
import { STATIONS } from "./route-model.js";
import { calcTargetInfo } from "./signaling-atp.js";
import { platformScreenDoorsOpenForDmi } from "./doors.js";

/** 列车停稳（与零速检测略留裕量，避免抖动） */
function approxStopped() {
  return train.zeroSpeed && Math.abs(train.vel) < 0.09;
}

export function disengageAto() {
  train.atoRunning = false;
  train.atoReady = false;
}

/** 人工按 ATO 与「允许启动」灯、A/A 自动发车的共同条件 */
export function atoStartPreconditionsMet() {
  if (!train.keyOn) return false;
  if (!train.atpActive) return false;
  if (train.mode !== "AM" && train.mode !== "FAM") return false;
  if (train.direction !== "F") return false;
  if (Math.abs(train.lever) > 0.05) return false;
  if (!train.doorClosed) return false;
  if (platformScreenDoorsOpenForDmi()) return false;
  if (train.ebActive) return false;
  if (train.holdAtStation) return false;
  if (train.dwelling) return false;
  if (!approxStopped()) return false;
  const ns = STATIONS[train.nextStationIdx];
  if (!ns) return false;
  const { dist } = calcTargetInfo();
  /* 示意：至下一限制性目标（站台/限速点）须保留一定距离，表示前方非闭锁 */
  if (dist <= 8) return false;
  return true;
}

/** 仅 A/A：满足条件时自动投入 ATO（每帧可调用，内部幂等） */
export function tryAutoStartAtoAa() {
  if (train.doorMode !== "AA") return;
  if (train.atoRunning) return;
  if (!atoStartPreconditionsMet()) return;
  train.atoReady = true;
  train.atoRunning = true;
  showMsg("ATO 自动启动", "ok");
  tcmsLog("ATO 自动启动 (A/A)", "ok");
}
