/**
 * 信号 / ATP 层：区段限速、常用/紧急制动曲线、目标距离等。
 * 不直接积分列车运动；对外提供速度监督与目标信息供 ATO、DMI、仿真器使用。
 */
import { CONST } from "../config/constants.js";
import { clamp, ms2kmh, kmh2ms } from "../lib/math.js";
import { SPEED_ZONES, STATIONS, ROUTE_LEN } from "./route-model.js";
import { train } from "./vehicle-state.js";

export function getZoneLimit(p) {
  for (const [s, e, v] of SPEED_ZONES) {
    if (p >= s && p < e) return v;
  }
  return 80;
}

export function brakingCurveLimitKmh(p, includeStation, decel) {
  p = clamp(p, 0, ROUTE_LEN);
  let zone = getZoneLimit(p);
  let braking = 200;
  for (let look = 0; look < 800; look += 3) {
    const pp = p + look;
    if (pp > ROUTE_LEN) break;
    const z = getZoneLimit(pp);
    if (z < zone) {
      const v_target = z;
      const v0 = Math.sqrt(Math.pow(kmh2ms(v_target), 2) + 2 * decel * look);
      braking = Math.min(braking, ms2kmh(v0));
    }
  }
  const nextStn = STATIONS[train.nextStationIdx];
  if (includeStation && nextStn) {
    const d = nextStn.pos - p;
    if (d > 0 && d <= 600) {
      const deff = Math.max(0, d - CONST.ATP_STOP_MARGIN_M);
      const v0 = Math.sqrt(2 * decel * deff);
      braking = Math.min(braking, ms2kmh(v0));
    }
  }
  return Math.min(zone, braking);
}

export function modeMaxKmh() {
  if (train.mode === "RM") return CONST.RM_LIMIT;
  return 100;
}

export function calcATPLimit(p, includeStation = true) {
  if (p === undefined) p = train.pos;
  p = clamp(p, 0, ROUTE_LEN);
  const path = brakingCurveLimitKmh(p, includeStation, CONST.MAX_SERVICE_BRK);
  return Math.min(modeMaxKmh(), path);
}

export function calcEBILimit(p) {
  /** 任一侧车门开启：紧急制动干预限速视为 0 km/h（与 DMI EBI 指示一致） */
  if (!train.doorClosed) return 0;
  if (p === undefined) p = train.pos;
  p = clamp(p, 0, ROUTE_LEN);
  const path = brakingCurveLimitKmh(p, false, CONST.EB_BRAKE);
  return Math.min(modeMaxKmh(), path);
}

export function atoMinForwardZoneAtpLimit() {
  const p0 = clamp(train.pos, 0, ROUTE_LEN);
  const v = Math.abs(train.vel);
  const horizon = clamp(v * 5.5, 40, 300);
  let lo = calcATPLimit(p0, false);
  for (let dx = 25; dx <= horizon; dx += 25) {
    lo = Math.min(lo, calcATPLimit(p0 + dx, false));
  }
  return lo;
}

export function calcTargetInfo() {
  const p = train.pos;
  let dist = 9999;
  let target = 80;
  const nextStn = STATIONS[train.nextStationIdx];
  if (nextStn) {
    const d = nextStn.pos - p;
    if (d > 0 && d < dist) {
      dist = d;
      target = 0;
    }
  }
  const cur = getZoneLimit(p);
  for (let look = 1; look < 1500; look++) {
    const z = getZoneLimit(p + look);
    if (z < cur) {
      if (look < dist) {
        dist = look;
        target = z;
      }
      break;
    }
  }
  return { dist, target };
}
