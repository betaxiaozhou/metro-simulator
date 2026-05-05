/**
 * 列车纵向动力学：加速度由 ATP 监督、ATO 牵引/制动或司机手柄后经车体响应滤波，再扣除阻力后对速度、位置数值积分。
 * 速度带符号（前进为正、后退为负）；「后退 R」为人工限速工况，ATO 仍要求「前进 F」。
 */
import { CONST } from "../config/constants.js";
import { ms2kmh, clamp } from "../lib/math.js";
import { STATIONS, ROUTE_LEN } from "./route-model.js";
import { train } from "./vehicle-state.js";
import { calcATPLimit, calcEBILimit, calcTargetInfo } from "./signaling-atp.js";
import { atoControl } from "./ato-controller.js";
import { handleStation, tryReleaseDoorAllowAligned } from "./station-service.js";
import { disengageAto, tryAutoStartAtoAa } from "./ato-readiness.js";
import { clearDoorAtpAllows } from "./doors.js";
import { triggerEB } from "./emergency-brake.js";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { beep } from "../audio/sfx-core.js";
import { updateMotorCurrentModel } from "./traction-electrical.js";

function fmtStopErr(trainPos, markPos) {
  const m = trainPos - markPos;
  const a = Math.abs(m);
  if (a < 1.5) return `${(m * 100).toFixed(1)} cm`;
  return `${m.toFixed(2)} m`;
}

function brakingAgainstMotion(mag) {
  if (train.vel > 0.02) return -mag;
  if (train.vel < -0.02) return mag;
  return 0;
}

export function physicsTick(dt) {
  if (!train.keyOn) {
    train.motorCurrentA = 0;
    return;
  }

  const atpLimit = calcATPLimit();
  const ebiLimit = calcEBILimit();
  const targetInfo = calcTargetInfo();

  const vKmh = ms2kmh(Math.abs(train.vel));
  if (train.atpActive) {
    const doorOpenMoving = !train.doorClosed && Math.abs(train.vel) > 0.08;
    const overspeedDoorsClosed =
      train.doorClosed && vKmh > ebiLimit + CONST.ATP_OVERSPEED_MARGIN;
    if (doorOpenMoving) {
      triggerEB(`车门开启 · EBI 限速 0 km/h · 当前 ${vKmh.toFixed(1)} km/h`);
    } else if (overspeedDoorsClosed) {
      triggerEB(`超速 ${vKmh.toFixed(0)} > EBI ${ebiLimit.toFixed(0)}+${CONST.ATP_OVERSPEED_MARGIN}`);
    }
  }

  let cmdAccRaw = 0;
  if (train.ebActive) cmdAccRaw = brakingAgainstMotion(CONST.EB_BRAKE);
  else if (train.atoRunning && (train.mode === "AM" || train.mode === "FAM"))
    cmdAccRaw = atoControl(atpLimit, ebiLimit, targetInfo);
  else {
    if (train.lever > 0) {
      if (train.direction === "F") cmdAccRaw = train.lever * CONST.MAX_TRACTION_ACC;
      else if (train.direction === "R") cmdAccRaw = -train.lever * CONST.MAX_TRACTION_ACC;
    } else if (train.lever <= -1.05) cmdAccRaw = brakingAgainstMotion(CONST.EB_BRAKE);
    else if (train.lever < 0)
      cmdAccRaw = brakingAgainstMotion(Math.abs(train.lever) * CONST.MAX_SERVICE_BRK);
  }

  if (train.direction === "N" && cmdAccRaw > 0) cmdAccRaw = 0;
  if (!train.doorClosed && train.lever > 0) cmdAccRaw = 0;

  let cmdAcc;
  /** 牵引/制动指令经车体响应滤波；站停 dwelling 内同步滞后状态，避免进站大制动惯性把车速「夹」过零造成倒车 */
  if (train.ebActive) {
    cmdAcc = cmdAccRaw;
    train._cmdAccLag = cmdAccRaw;
  } else if (train.dwelling) {
    cmdAcc = cmdAccRaw;
    train._cmdAccLag = cmdAccRaw;
  } else {
    const deepenBrk = cmdAccRaw < train._cmdAccLag - 1e-6;
    let tau = deepenBrk ? CONST.CMD_ACC_TAU * 0.38 : CONST.CMD_ACC_TAU;
    /** ATO 进站加深制动：加快追随指令，减小「曲线已到而车体制动尚未建起」导致的冲标 */
    if (
      train.atoRunning &&
      (train.mode === "AM" || train.mode === "FAM") &&
      deepenBrk
    ) {
      const apStn = STATIONS[train.nextStationIdx];
      if (apStn && !train.dwelling) {
        const dMark = apStn.pos - train.pos;
        if (dMark > 0 && dMark < CONST.ATO_APPROACH_DIST_M) tau *= 0.62;
      }
    }
    const alpha = 1 - Math.exp(-dt / tau);
    train._cmdAccLag += (cmdAccRaw - train._cmdAccLag) * alpha;
    cmdAcc = train._cmdAccLag;
  }

  const v = train.vel;
  const dragMag = 0.005 * 9.8 + 0.0005 * v * v;
  let acc = cmdAcc;
  if (Math.abs(v) > 0.05) acc -= Math.sign(v) * dragMag;

  train.vel += acc * dt;

  train.pos += train.vel * dt;

  train.pos = clamp(train.pos, 0, ROUTE_LEN);
  if (train.pos <= 0 && train.vel < 0) train.vel = 0;
  if (train.pos >= ROUTE_LEN && train.vel > 0) train.vel = 0;

  /** 站台停稳：消除近零残余速度，避免乘降阶段肉眼可见蠕动 */
  if (train.dwelling && Math.abs(train.vel) < 0.028) train.vel = 0;

  if (train.direction === "N" && Math.abs(train.vel) < 0.02) train.vel = 0;

  const autoModes = train.atoRunning && (train.mode === "AM" || train.mode === "FAM");
  if (!autoModes && train.lever > 0 && train.direction !== "N" && train.doorClosed) {
    train.trPct = Math.round(train.lever * 100);
    train.bkPct = 0;
  } else if (cmdAcc > 0) {
    train.trPct = Math.round((cmdAcc / CONST.MAX_TRACTION_ACC) * 100);
    train.bkPct = 0;
  } else if (cmdAcc < 0) {
    train.trPct = 0;
    train.bkPct = Math.round((-cmdAcc / CONST.EB_BRAKE) * 100);
  } else {
    train.trPct = 0;
    train.bkPct = 0;
  }

  updateMotorCurrentModel(dt, cmdAcc);

  const bcTarget = train.bkPct * 4;
  train.bcPress += (bcTarget - train.bcPress) * 0.15;

  if (train.bkPct > 0) train.mrPress = Math.max(700, train.mrPress - 0.3 * dt);
  else train.mrPress = Math.min(900, train.mrPress + 1.5 * dt);

  handleStation();

  train.zeroSpeed = Math.abs(train.vel) < 0.072;

  /** 须在 handleStation 之后取站：否则 idx 已 ++ 仍用旧站判断进站会重复触发 dwelling，对标指向下一站轨旁标 */
  const nextStn = STATIONS[train.nextStationIdx] ?? null;
  const arrivalWin = CONST.ATO_ARRIVAL_WINDOW_M;
  const arrivalSlow = Math.abs(train.vel) < 0.12;
  if (nextStn && !train.dwelling && Math.abs(nextStn.pos - train.pos) <= arrivalWin && arrivalSlow) {
    clearDoorAtpAllows();
    train.dwelling = true;
    train.dwellTimer = 0;
    train.autoDoorReleased = false;
    train.dwellHadDoorOpenDuringStop = false;
    train.departSuggestEpochMs = Date.now();
    train.departSuggestAnchorIdx = train.nextStationIdx;
    const errDisp = fmtStopErr(train.pos, nextStn.pos);
    if ((train.mode === "AM" || train.mode === "FAM") && (train.doorMode === "MM" || train.doorMode === "AM")) {
      disengageAto();
      tcmsLog("进站：M/M、A/M — ATO 已退出，乘降完毕且「允许启动」亮灯后可按 ATO 发车", "info");
    }
    showMsg(`到达 ${nextStn.name}（停车误差 ${errDisp}）`, "ok");
    tcmsLog(`抵达 ${nextStn.name}, 停车误差 ${errDisp}`, "ok");
    if (
      (train.mode === "AM" || train.mode === "FAM") &&
      Math.abs(nextStn.pos - train.pos) > CONST.STOP_TOLERANCE
    ) {
      showMsg(
        `对标未满足（容差 ±${(CONST.STOP_TOLERANCE * 100).toFixed(0)} cm），停稳后对准停车标`,
        "alarm",
      );
      tcmsLog(`待对标停准（当前 |Δ|=${fmtStopErr(train.pos, nextStn.pos)}）`, "alarm");
    }
    beep(660, 0.15);
    setTimeout(() => beep(880, 0.2), 180);
  }

  tryReleaseDoorAllowAligned(nextStn);

  if (nextStn && !train.dwelling && train.pos > nextStn.pos + 30 && train.doorClosed) {
    train.nextStationIdx++;
    clearDoorAtpAllows();
    if (train.nextStationIdx < STATIONS.length)
      tcmsLog(`下一站 ${STATIONS[train.nextStationIdx].name}`, "info");
    else tcmsLog("已抵达终点站", "ok");
  }

  if (train.departSuggestAnchorIdx >= 0) {
    const ap = STATIONS[train.departSuggestAnchorIdx]?.pos;
    if (ap !== undefined && train.pos > ap + CONST.DEPART_SUGGEST_CLEAR_PAST_STATION_M) {
      train.departSuggestAnchorIdx = -1;
      train.departSuggestEpochMs = 0;
    }
  }

  tryAutoStartAtoAa();
}
