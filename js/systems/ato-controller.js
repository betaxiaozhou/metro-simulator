/**
 * ATO：仅输出纵向牵引/制动加速度（加速度经 CMD_ACC_TAU 与车体共同积分）。
 * 位置与速度仅由动力学积分得到；站停 dwelling 内不施加对标蠕动牵引。
 */
import { CONST } from "../config/constants.js";
import { clamp, ms2kmh } from "../lib/math.js";
import { STATIONS } from "./route-model.js";
import { train } from "./vehicle-state.js";
import { atoMinForwardZoneAtpLimit } from "./signaling-atp.js";

export function brakingEnvelopeStationKmh(distanceM) {
  const deff = Math.max(0, distanceM - CONST.ATO_STOP_MARGIN_M);
  const aEff = CONST.MAX_SERVICE_BRK * CONST.ATO_ENVELOPE_DECEL_SCALE;
  return ms2kmh(Math.sqrt(Math.max(0, 2 * aEff * deff)));
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

export function atoControl(atpLimit, ebiLimit, _targetInfo) {
  const ns = STATIONS[train.nextStationIdx];
  const auto = train.mode === "AM" || train.mode === "FAM";

  /** 站停乘降：双向抱闸（与 EB 工况同类）；禁止单向负加速度在速度过零后变成「倒车牵引」 */
  if (train.dwelling) {
    const mag = 0.42 * CONST.MAX_SERVICE_BRK;
    const v = train.vel;
    if (v > 0.02) return -mag;
    if (v < -0.02) return mag;
    return 0;
  }

  const dAhead = ns ? ns.pos - train.pos : Infinity;

  /** 末端蠕动：收紧到站窗口后，低速停在窗外时需微量牵引贴近停车标 */
  if (
    auto &&
    ns &&
    dAhead > CONST.STOP_TOLERANCE &&
    dAhead <= 4 &&
    Math.abs(train.vel) < 0.16
  ) {
    const creep = Math.min(
      0.22,
      Math.max(0.065, dAhead * 0.14),
    );
    let accCreep = clamp(creep, -CONST.MAX_SERVICE_BRK, CONST.MAX_TRACTION_ACC);
    const vKmhC = ms2kmh(Math.abs(train.vel));
    if (vKmhC > ebiLimit + CONST.ATP_OVERSPEED_MARGIN - 1.0)
      accCreep = -CONST.MAX_SERVICE_BRK;
    return accCreep;
  }


  if (ns && !train.dwelling && auto && dAhead <= 0 && Math.abs(train.vel) > 0.05) {
    return -CONST.MAX_SERVICE_BRK;
  }

  const limZoneAhead = atoMinForwardZoneAtpLimit();

  let vCurveKmh = computeAtoCurveTargetKmh(atpLimit);

  const vMs = train.vel;
  const vKmh = ms2kmh(vMs);
  const vTargetMs = (vCurveKmh / 3.6);
  const errMs = vTargetMs - vMs;
  const bandMs = CONST.ATO_CRUISE_DEADBAND_KMH / 3.6;

  const cruiseCeilingKmh = Math.max(0, atpLimit - 0.15);
  const inApproach =
    (ns && dAhead > 0 && dAhead < CONST.ATO_APPROACH_DIST_M) ||
    vCurveKmh < atpLimit - CONST.AM_REC_OFFSET - 3;

  let acc;
  if (inApproach) {
    if (errMs > 0.1) acc = clamp(0.36 * errMs, 0, 0.58 * CONST.MAX_TRACTION_ACC);
    /** 超速相对曲线：加大制动增益，避免仅靠偏弱比例项滞后冲标 */
    else if (errMs < -0.1)
      acc = clamp(0.78 * errMs, -CONST.MAX_SERVICE_BRK, 0);
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

  /** 距离–速度制动曲线下限：当前动能须在剩余距离内以不超过常用制动停尽（对标前移 + 安全系数） */
  if (auto && ns && dAhead > 0 && train.vel > 0.04) {
    const dEff = Math.max(0.35, dAhead - CONST.ATO_STOP_MARGIN_M);
    const needMag =
      ((train.vel * train.vel) / (2 * dEff)) * CONST.ATO_STOP_KINEMATIC_SAFETY;
    if (needMag > 0.055)
      acc = Math.min(acc, -Math.min(CONST.MAX_SERVICE_BRK, needMag));
  }

  if (vKmh > ebiLimit + CONST.ATP_OVERSPEED_MARGIN - 1.0) acc = -CONST.MAX_SERVICE_BRK;

  return clamp(acc, -CONST.MAX_SERVICE_BRK, CONST.MAX_TRACTION_ACC);
}
