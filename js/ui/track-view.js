/** ATS / 示意图静态 SVG 绘制与列车图标 */
import { $ } from "../lib/dom.js";
import { SPEED_ZONES, STATIONS, SIGNALS, BALISES, posToX } from "../systems/route-model.js";
import { train } from "../systems/vehicle-state.js";

export function buildTrack() {
  const g = $("trackElems");
  if (!g) return;
  let html = "";
  for (const [s, e, v] of SPEED_ZONES) {
    if (v >= 80) continue;
    const x1 = posToX(s),
      x2 = posToX(e);
    html += `<rect class="speed-zone" x="${x1}" y="105" width="${x2 - x1}" height="35"/>`;
    html += `<text class="speed-zone-text" x="${(x1 + x2) / 2}" y="160" text-anchor="middle">${v} km/h</text>`;
  }
  for (const b of BALISES) {
    const x = posToX(b);
    html += `<rect class="balise" x="${x - 3}" y="138" width="6" height="6"/>`;
  }
  for (const s of STATIONS) {
    const x = posToX(s.pos);
    html += `<rect class="station-rect" x="${x - 30}" y="65" width="60" height="38" rx="2"/>`;
    html += `<text class="station-text" x="${x}" y="80">${s.name}</text>`;
    html += `<text class="station-text" x="${x}" y="96" style="font-size:9px;fill:#8aa6c2">${s.pos}m</text>`;
  }
  for (const sig of SIGNALS) {
    const x = posToX(sig.pos);
    html += `<line class="signal-mast" x1="${x}" y1="170" x2="${x}" y2="195"/>`;
    html += `<circle class="signal-light" id="sigL_${sig.pos}" cx="${x}" cy="172" r="3" fill="#1ed760"/>`;
    html += `<circle class="signal-light" cx="${x}" cy="180" r="3" fill="#332"/>`;
    html += `<circle class="signal-light" cx="${x}" cy="188" r="3" fill="#332"/>`;
  }
  g.innerHTML = html;
}

export function updateTrainMarker() {
  const tm = $("trainMarker");
  if (!tm) return;
  tm.setAttribute("transform", `translate(${posToX(train.pos)},0)`);
}
