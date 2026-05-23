import { resolveSource } from "./source.js";
import {
  openNotePopup,
  isPopupOpen,
  isPopupDirty,
  closePopup,
} from "./note-popup.js";

const HOST_ID = "aaa-overlay-host";

let host: HTMLDivElement | null = null;
let outlineEl: HTMLDivElement | null = null;
let labelEl: HTMLDivElement | null = null;
let altDown = false;
let forceActive = false;
let currentTarget: Element | null = null;
let lastMouse: { x: number; y: number } | null = null;
let mounted = false;

function isActive(): boolean {
  return altDown || forceActive;
}

function ensureOverlay(): void {
  if (host) {
    if (!host.isConnected) document.body.appendChild(host);
    return;
  }
  host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483640;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .outline {
        position: fixed; box-sizing: border-box;
        border: 1px solid #4E1B91;
        background: rgba(78, 27, 145, 0.18);
        pointer-events: none;
        border-radius: 2px;
        display: none;
      }
      .label {
        position: fixed;
        background: #13151a;
        color: #e5e7eb;
        font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        padding: 3px 7px;
        border-radius: 4px;
        border: 1px solid #343841;
        pointer-events: none;
        white-space: nowrap;
        max-width: 80vw; overflow: hidden; text-overflow: ellipsis;
        display: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      .label .tag { color: #f3f4f6; font-weight: 600; }
      .label .sep { color: #4b5563; margin: 0 4px; }
      .label .src { color: #9ca3af; }
    </style>
    <div class="outline"></div>
    <div class="label"></div>
  `;
  outlineEl = shadow.querySelector(".outline");
  labelEl = shadow.querySelector(".label");
  document.body.appendChild(host);
}

function isOnToolbarUi(e: Event): boolean {
  const path = e.composedPath();
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "astro-dev-toolbar" || tag.startsWith("astro-dev-toolbar-")) {
      return true;
    }
  }
  return false;
}

function isOnPopup(e: Event): boolean {
  const path = e.composedPath();
  for (const node of path) {
    if (node instanceof Element && node.id === "aaa-popup-host") return true;
  }
  return false;
}

function isOnBubble(e: Event): boolean {
  const path = e.composedPath();
  for (const node of path) {
    if (node instanceof Element && node.id === "aaa-bubbles-host") return true;
  }
  return false;
}

function isOurNode(el: Element | null): boolean {
  if (!el) return false;
  if (el.id === HOST_ID || el.id === "aaa-popup-host" || el.id === "aaa-bubbles-host") return true;
  const tag = el.tagName?.toLowerCase?.();
  if (tag === "astro-dev-toolbar" || tag?.startsWith?.("astro-dev-toolbar-")) return true;
  return false;
}

function findTargetAt(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (isOurNode(el)) continue;
    if (el.closest("[id^='aaa-']")) continue;
    return el;
  }
  return null;
}

function updateOutline(): void {
  if (!outlineEl || !labelEl) return;
  if (!isActive() || !currentTarget) {
    outlineEl.style.display = "none";
    labelEl.style.display = "none";
    document.documentElement.style.cursor = "";
    return;
  }
  const rect = currentTarget.getBoundingClientRect();
  outlineEl.style.display = "block";
  outlineEl.style.left = rect.left + "px";
  outlineEl.style.top = rect.top + "px";
  outlineEl.style.width = rect.width + "px";
  outlineEl.style.height = rect.height + "px";

  const tag = currentTarget.tagName.toLowerCase();
  const src = resolveSource(currentTarget);
  labelEl.innerHTML = "";
  const tagSpan = document.createElement("span");
  tagSpan.className = "tag";
  tagSpan.textContent = `<${tag}>`;
  labelEl.appendChild(tagSpan);
  if (src) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "·";
    labelEl.appendChild(sep);
    const srcSpan = document.createElement("span");
    srcSpan.className = "src";
    srcSpan.textContent = src;
    labelEl.appendChild(srcSpan);
  }
  labelEl.style.display = "block";
  labelEl.style.left = rect.left + "px";
  labelEl.style.top = Math.max(2, rect.top - 24) + "px";

  document.documentElement.style.cursor = "crosshair";
}

function onMouseMove(e: MouseEvent): void {
  lastMouse = { x: e.clientX, y: e.clientY };
  if (!isActive()) return;
  if (isOnToolbarUi(e) || isPopupOpen()) {
    if (currentTarget) {
      currentTarget = null;
      updateOutline();
    }
    return;
  }
  const t = findTargetAt(e.clientX, e.clientY);
  if (t !== currentTarget) {
    currentTarget = t;
    updateOutline();
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape" && forceActive) {
    setOverlayActive(false);
    return;
  }
  if ((e.key === "Alt" || e.altKey) && !altDown) {
    altDown = true;
    if (lastMouse) {
      currentTarget = findTargetAt(lastMouse.x, lastMouse.y);
    }
    updateOutline();
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === "Alt" || !e.altKey) {
    if (altDown) {
      altDown = false;
      if (!forceActive) currentTarget = null;
      updateOutline();
    }
  }
}

function onBlur(): void {
  if (altDown) {
    altDown = false;
    if (!forceActive) currentTarget = null;
    updateOutline();
  }
}

function onClick(e: MouseEvent): void {
  if (isOnToolbarUi(e)) return;
  if (isOnPopup(e)) return;
  if (isPopupOpen()) {
    if (isOnBubble(e) && !isPopupDirty()) {
      closePopup();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!isPopupDirty()) closePopup();
    return;
  }
  if (!isActive()) return;
  const t = findTargetAt(e.clientX, e.clientY);
  if (!t) return;
  e.preventDefault();
  e.stopPropagation();
  openNotePopup(t, e.clientX, e.clientY);
}

function onScrollOrResize(): void {
  if (isActive() && lastMouse) {
    const t = findTargetAt(lastMouse.x, lastMouse.y);
    if (t !== currentTarget) currentTarget = t;
    updateOutline();
  }
}

export function setOverlayActive(active: boolean): void {
  if (forceActive === active) return;
  forceActive = active;
  if (!active && !altDown) {
    currentTarget = null;
  } else if (active && lastMouse) {
    currentTarget = findTargetAt(lastMouse.x, lastMouse.y);
  }
  updateOutline();
}

export function mountOverlay(): void {
  ensureOverlay();
  if (mounted) {
    if (isActive() && lastMouse) {
      currentTarget = findTargetAt(lastMouse.x, lastMouse.y);
    } else if (!isActive()) {
      currentTarget = null;
    }
    updateOutline();
    return;
  }
  mounted = true;
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur, true);
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize, true);
}
