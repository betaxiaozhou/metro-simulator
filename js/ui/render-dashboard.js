import { $ } from "../lib/dom.js";
import { STATIONS } from "../systems/route-model.js";
import { train } from "../systems/vehicle-state.js";
import { postVobcDmi, formatDoorModeForDmi } from "./dmi-bridge.js";
import { updateTrainMarker } from "./track-view.js";
import { atoStartPreconditionsMet } from "../systems/ato-readiness.js";

export function renderDashboard() {
  const ns = STATIONS[train.nextStationIdx];
  postVobcDmi();
  updateTrainMarker();

  const setText = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
  };

  setText("totalDist", train.pos.toFixed(0));
  setText("absPos", train.pos.toFixed(1));
  setText("atpLevel", train.atpActive ? "CBTC L2" : "降级");
  setText("moveAuth", ns ? Math.max(0, ns.pos - train.pos).toFixed(0) + "m" : "—");

  const trBar = $("trBar");
  const bkBar = $("bkBar");
  if (trBar) trBar.style.width = train.trPct + "%";
  if (bkBar) bkBar.style.width = train.bkPct + "%";
  setText("trPct", String(train.trPct));
  setText("bkPct", String(train.bkPct));
  setText("mrPress", train.mrPress.toFixed(0));
  setText("bcPress", train.bcPress.toFixed(0));
  setText("thirdRailState", train.keyOn ? "集电接通" : "ZK OFF");
  setText("lineV", train.keyOn ? "750" : "0");

  const ia = train.motorCurrentA;
  const iWrap = $("motorCurrentWrap");
  if (iWrap) {
    iWrap.className =
      "num motor-i-wrap " + (ia < -8 ? "regen" : ia > 8 ? "traction" : "neutral");
  }
  const iAbs = Math.abs(ia) < 0.5 ? "0" : (ia > 0 ? "+" : "") + ia.toFixed(0);
  setText("motorCurrentA", iAbs);

  const dms = formatDoorModeForDmi(train.doorMode);
  const doorTxt =
    train.doorOpenSide === "both"
      ? "双开"
      : train.doorOpenSide === "left"
        ? "左开"
        : train.doorOpenSide === "right"
          ? "右开"
          : "全关";
  const allowHint =
    train.doorManualBoth ? "人双" : train.doorAtpLeft ? "ATP左" : train.doorAtpRight ? "ATP右" : "—";
  setText("doorState", `${doorTxt} · ${dms || "—"} · ${allowHint}`);
  setText("acState", train.ac ? "开" : "关");

  setText("leverPos", (train.lever * 100).toFixed(0));
  let st = "惰行";
  if (train.lever <= -1.05) st = "EB 快速制动";
  else if (train.lever < -0.05) st = "常用制动";
  else if (train.lever > 0.05) st = "牵引";
  setText("leverState", st);

  const btnAto = $("btnATO");
  if (btnAto) {
    btnAto.classList.toggle("on", train.atoRunning);
    const aut = train.keyOn && (train.mode === "AM" || train.mode === "FAM");
    const showReady = aut && !train.atoRunning && atoStartPreconditionsMet();
    btnAto.classList.toggle("ready", showReady);
  }
}
