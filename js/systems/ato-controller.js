/**
 * ATO：仅输出纵向牵引/制动加速度（加速度经 CMD_ACC_TAU 与车体共同积分）。
 * 位置与速度不改变除动力学外的任何作弊项。
 */
import { CONST } from "../config/constants.js";
import { clamp, ms2kmh, kmh2ms } from "../lib/math.js";
import { STATIONS } from "./route-model.js";
import { train } from "./vehicle-state.js";
import { atoMinForwardZoneAtpLimit } from "./signaling-atp.js";

export function brakingEnvelopeStationKmh(distanceM) {
  const deff = Math.max(0, distanceM - CONST.ATO_STOP_MARGIN_M);
  return ms2kmh(Math.sqrt(Math.max(0, 2 * CONST.MAX_SERVICE_BRK * deff)));
}

export function computeAtoCurveTargetKmh(atpLimit) {
  let rec = Math.max(0, atpLimit - CONST.AM_REC_OFFSET);
  const ns = STATIONS[train.nextStationIdx];
  if (!ns) return Math.min(rec, atpLimit);
  const d = ns.pos - train.pos;
  if (d <= 0) return 0;
  if (d >= CONST.ATO_BLEND_STATION_M) return Math.min(rec, atpLimit);
  const env = brakingEnvelopeStationKmh(d);
  return Math.min(rec, env, atpLimit);
}

export function computeAtoRecommendedKmh(atpLimit) {
  return computeAtoCurveTargetKmh(atpLimit);
}

export function atoCreepCapKmh(d) {
  if (d >= CONST.ATO_CREEP_M) return Infinity;
  const env = brakingEnvelopeStationKmh(d);
  /* 与原 soft 下限相比压低常数项，减小近标处名义目标速度、避免低速段再拉高牵引期望 */
  const soft = 3.5 + Math.sqrt(Math.max(d, 0)) * 2.1;
  return Math.min(env, soft);
}

/** 驻车 / 末段：按位置误差闭环（站内最后数米）；仅在此段可对欠标施加有限牵引 */
function dockingAcc(errM, v) {
  const kp = CONST.ATO_DOCK_KP;
  const kd = CONST.ATO_DOCK_KD;
  let acc = kp * errM - kd * Math.max(v, 0);
  acc = clamp(acc, -0.98 * CONST.MAX_SERVICE_BRK, 0.55 * CONST.MAX_TRACTION_ACC);
  if (Math.abs(errM) <= CONST.STOP_TOLERANCE && Math.abs(v) < 0.042) acc = 0;
  return acc;
}

export function atoControl(atpLimit, ebiLimit, _targetInfo) {
  const ns = STATIONS[train.nextStationIdx];
  const auto = train.mode === "AM" || train.mode === "FAM";

  if (train.dwelling && ns && auto) {
    const errM = ns.pos - train.pos;
    const v = train.vel;
    return dockingAcc(errM, v);
  }

  if (train.dwelling) return -0.42 * CONST.MAX_SERVICE_BRK;

  const dAhead = ns ? ns.pos - train.pos : Infinity;

  if (ns && !train.dwelling && auto && dAhead <= 0 && Math.abs(train.vel) > 0.05) {
    return -CONST.MAX_SERVICE_BRK;
  }

  if (auto && ns && !train.dwelling && dAhead > 0 && dAhead <= CONST.ATO_PRECISION_ZONE_M) {
    const v = Math.max(train.vel, 0);
    /**
     * 禁止在此对「距标 dAhead 米」调用 dockingAcc(dAhead)：该律的 errM 语义是 (标-车)，欠标微蠕动为正；
     * 若把剩余距离当 errM，d≈20m 会得到大幅牵引，表现为标前突然加速、冲标、门对不准。
     * 未 dwell 前一律走距离-速度走廊；贴标仅 dwell 分支的 dockingAcc(mark-pos)。
     */

    const margin = CONST.ATO_STOP_MARGIN_M + 0.08;
    const s = Math.max(dAhead - margin, 1e-4);
    const vPhys = Math.sqrt(Math.max(0, 2 * CONST.MAX_SERVICE_BRK * 0.92 * s));
    const envK = brakingEnvelopeStationKmh(dAhead);
    const softK = 3.5 + Math.sqrt(Math.max(dAhead, 0)) * 2.1;
    const creepCapKmh = Math.min(envK, softK);
    const vCreepCapMs = Math.min(vPhys, kmh2ms(creepCapKmh));
    const blendSpan = CONST.ATO_CREEP_BLEND_M ?? 22;
    const blendHi = CONST.ATO_CREEP_M + blendSpan;
    const blendLo = CONST.ATO_CREEP_M;
    let vReq;
    if (dAhead >= blendHi) vReq = vPhys;
    else if (dAhead <= blendLo) vReq = vCreepCapMs;
    else {
      const u = (blendHi - dAhead) / (blendHi - blendLo);
      const t = u * u * (3 - 2 * u);
      vReq = vPhys + (vCreepCapMs - vPhys) * t;
    }
    const dv = v - vReq;
    let accT;
    if (dv > 0.02) accT = clamp(-3.6 * dv - 0.45 * v, -CONST.MAX_SERVICE_BRK * 0.98, -0.04);
    else if (dv < -0.04) {
      if (v < 0.14 && dv < -0.25) {
        accT = clamp(0.38 * (-dv), 0.04, 0.52 * CONST.MAX_TRACTION_ACC);
      } else accT = 0;
    } else accT = clamp(-1.85 * dv - 0.32 * v, -CONST.MAX_SERVICE_BRK * 0.98, 0);

    const vKmh = ms2kmh(v);
    if (vKmh > ebiLimit + CONST.ATP_OVERSPEED_MARGIN - 1.0) accT = -CONST.MAX_SERVICE_BRK;
    if (accT > 0) return clamp(accT, 0, 0.52 * CONST.MAX_TRACTION_ACC);
    return clamp(accT, -CONST.MAX_SERVICE_BRK, 0);
  }

  const limZoneAhead = atoMinForwardZoneAtpLimit();

  let vCurveKmh = computeAtoCurveTargetKmh(atpLimit);
  if (ns && dAhead > 0 && dAhead < CONST.ATO_CREEP_M)
    vCurveKmh = Math.min(vCurveKmh, atoCreepCapKmh(dAhead));

  const vMs = train.vel;
  const vKmh = ms2kmh(vMs);
  const vTargetMs = kmh2ms(vCurveKmh);
  const errMs = vTargetMs - vMs;
  const bandMs = CONST.ATO_CRUISE_DEADBAND_KMH / 3.6;

  const cruiseCeilingKmh = Math.max(0, atpLimit - 0.15);
  const inApproach =
    (ns && dAhead > 0 && dAhead < CONST.ATO_APPROACH_DIST_M) ||
    vCurveKmh < atpLimit - CONST.AM_REC_OFFSET - 3;

  let acc;
  if (inApproach) {
    if (errMs > 0.1) acc = clamp(0.36 * errMs, 0, 0.58 * CONST.MAX_TRACTION_ACC);
    else if (errMs < -0.1) acc = clamp(0.44 * errMs, -CONST.MAX_SERVICE_BRK, 0);
    else acc = 0;
  } else {
    if (errMs > bandMs) {
      if (vKmh >= cruiseCeilingKmh) acc = 0;
      else acc = clamp(0.24 * (errMs - bandMs), 0, 0.52 * CONST.MAX_TRACTION_ACC);
    } else if (errMs < -bandMs)
      acc = clamp(0.38 * (errMs + bandMs), -CONST.MAX_SERVICE_BRK, 0);
    else acc = 0;
  }

  const approachingSuppressed =
    auto &&
    ns &&
    !train.dwelling &&
    dAhead > 0 &&
    dAhead <= CONST.ATO_SUPPRESS_LIM_CRIT_M;

  const limCrit = Math.min(atpLimit, limZoneAhead);
  if (!approachingSuppressed && vKmh > limCrit - 2.0)
    acc = Math.min(acc, -0.4 * CONST.MAX_SERVICE_BRK);

  if (!approachingSuppressed && ns && dAhead > 0 && dAhead < 14 && Math.abs(train.vel) > 0.12) {
    const t = clamp(dAhead / 14, 0.25, 1);
    acc = Math.min(acc, -t * CONST.MAX_SERVICE_BRK);
  }

  if (vKmh > ebiLimit + CONST.ATP_OVERSPEED_MARGIN - 1.0) acc = -CONST.MAX_SERVICE_BRK;

  return clamp(acc, -CONST.MAX_SERVICE_BRK, CONST.MAX_TRACTION_ACC);
}
