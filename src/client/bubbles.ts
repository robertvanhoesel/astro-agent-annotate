import { getAnnotations, subscribe, type Annotation } from "./state.js";
import { openNotePopup } from "./note-popup.js";

const HOST_ID = "aaa-bubbles-host";

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let started = false;
let rafId = 0;

function ensureHost(): void {
  if (host) return;
  host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483639;";
  shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .bubble {
      position: fixed;
      min-width: 22px; height: 22px;
      padding: 0 7px;
      box-sizing: border-box;
      background: #4E1B91; color: #ffffff;
      border-radius: 9999px;
      font: 700 11px/22px system-ui, -apple-system, sans-serif;
      text-align: center;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35), 0 0 0 2px rgba(78, 27, 145, 0.30);
      transform: translate(-50%, -50%);
      transition: background 0.1s ease, transform 0.1s ease;
      user-select: none;
    }
    .bubble:hover {
      transform: translate(-50%, -50%) scale(1.15);
      background: #6b2cb8;
    }
    .bubble.stale { background: #4b5563; color: #9ca3af; box-shadow: none; }
  `;
  shadow.appendChild(style);
  document.body.appendChild(host);
}

function findElementForAnnotation(ann: Annotation): Element | null {
  try {
    return document.querySelector(ann.selector);
  } catch {
    return null;
  }
}

function reposition(): void {
  if (!shadow) return;
  const bubbles = Array.from(
    shadow.querySelectorAll<HTMLDivElement>(".bubble"),
  );
  const anns = getAnnotations();
  bubbles.forEach((b, i) => {
    const ann = anns[i];
    if (!ann) {
      b.style.display = "none";
      return;
    }
    const el = findElementForAnnotation(ann);
    if (!el) {
      b.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      b.style.display = "none";
      return;
    }
    b.style.display = "";
    b.style.left = r.right + "px";
    b.style.top = r.top + "px";
  });
}

export function renderBubbles(): void {
  ensureHost();
  if (!shadow) return;
  shadow.querySelectorAll(".bubble").forEach((b) => b.remove());

  const anns = getAnnotations();
  anns.forEach((ann, i) => {
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = String(i + 1);
    b.title = ann.note;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const el = findElementForAnnotation(ann);
      if (!el) return;
      const r = el.getBoundingClientRect();
      openNotePopup(el, r.right, r.top, ann.id);
    });
    shadow!.appendChild(b);
  });
  reposition();
}

function tick(): void {
  reposition();
  rafId = requestAnimationFrame(tick);
}

export function startBubbles(): void {
  if (started) return;
  started = true;
  renderBubbles();
  subscribe(renderBubbles);
  rafId = requestAnimationFrame(tick);
}

export function stopBubbles(): void {
  if (!started) return;
  started = false;
  cancelAnimationFrame(rafId);
}
