import { $ } from "../lib/dom.js";

export function syncLeverHandlePos(lever) {
  const h = $("leverHandle");
  if (!h) return;
  const range = 2.2;
  const t = (1 - lever) / range;
  h.style.top = t * 100 + "%";
}
