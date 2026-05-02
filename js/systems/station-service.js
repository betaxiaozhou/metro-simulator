import { CONST } from "../config/constants.js";
import { STATIONS } from "./route-model.js";
import { train } from "./vehicle-state.js";
import { showMsg, tcmsLog } from "../ui/messages.js";
import { openDoor, closeDoor, clearDoorAtpAllows } from "./doors.js";

export function handleStation() {
  if (!train.dwelling) return;
  train.dwellTimer += CONST.G_DT;
  if (train.dwellTimer > 20 && (train.mode === "AM" || train.mode === "FAM")) {
    if (train.doorMode === "AA" && train.doorOpenSide !== "none") closeDoor();
    if (train.doorClosed && train.dwellTimer > 22) {
      train.dwelling = false;
      train.nextStationIdx++;
      clearDoorAtpAllows();
      if (train.nextStationIdx < STATIONS.length) {
        showMsg(`ATO 启动 → ${STATIONS[train.nextStationIdx].name}`, "ok");
        tcmsLog(`ATO 离站，下一站 ${STATIONS[train.nextStationIdx].name}`, "info");
      } else showMsg("已到终点站", "ok");
    }
  }
  if (train.dwelling && train.doorClosed && (train.mode === "CM" || train.mode === "RM" || train.mode === "URM")) {
    train.dwelling = false;
    clearDoorAtpAllows();
  }
}

export function tryReleaseDoorAllowAligned(nextStn) {
  if (!nextStn || !train.dwelling || train.autoDoorReleased) return;
  /** 孤立模式不给出 ATP 门允许，仅能通过「车门允许」开门 */
  if (train.mode === "IS") return;
  if (
    train.mode !== "AM" &&
    train.mode !== "FAM" &&
    train.mode !== "CM" &&
    train.mode !== "RM" &&
    train.mode !== "URM"
  )
    return;
  if (!train.zeroSpeed) return;
  if (Math.abs(nextStn.pos - train.pos) > CONST.STOP_TOLERANCE) return;
  train.autoDoorReleased = true;
  train.doorAtpLeft = nextStn.platform === "left";
  train.doorAtpRight = nextStn.platform === "right";
  const platZh = nextStn.platform === "left" ? "左" : "右";
  const e = train.pos - nextStn.pos;
  const errStrMag = Math.abs(e) < 1.2 ? `${(e * 100).toFixed(1)} cm` : `${e.toFixed(3)} m`;
  if (train.doorMode === "MM") {
    showMsg(`对标停准（误差 ${errStrMag}），ATP ${platZh}侧站台门允许 · M/M 请开该侧车门`, "ok");
    tcmsLog(`停准：ATP ${platZh}侧门允许 · ${errStrMag} · M/M 手动开门`, "ok");
    return;
  }
  showMsg(`对标停准（误差 ${errStrMag}），ATP ${platZh}侧站台门允许`, "ok");
  tcmsLog(`停准：ATP ${platZh}侧门允许 · 误差 ${errStrMag}`, "ok");
  if (train.mode === "AM" || train.mode === "FAM") {
    setTimeout(() => {
      if (train.doorMode !== "MM") openDoor(nextStn.platform);
    }, 500);
  }
}
