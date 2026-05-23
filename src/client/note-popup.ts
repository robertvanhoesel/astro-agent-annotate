import {
  addAnnotation,
  updateAnnotation,
  removeAnnotation,
  findBySelector,
  getAnnotations,
  type Annotation,
} from "./state.js";
import { resolveSource } from "./source.js";

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let currentEl: Element | null = null;
let currentAnnotationId: string | null = null;

export function buildSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 6) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      part = `${part}#${CSS.escape(cur.id)}`;
      parts.unshift(part);
      break;
    }
    const cls = (cur as HTMLElement).className;
    if (typeof cls === "string" && cls.trim()) {
      const c = cls.trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (c.length) part += "." + c.map(CSS.escape).join(".");
    }
    if (cur.parentElement) {
      const sibs = Array.from(cur.parentElement.children).filter(
        (s) => s.tagName === cur!.tagName,
      );
      if (sibs.length > 1) {
        part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

function ensureHost(): void {
  if (host) {
    if (!host.isConnected) document.body.appendChild(host);
    return;
  }
  host = document.createElement("div");
  host.id = "aaa-popup-host";
  host.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483641;";
  shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .panel {
        position: fixed; pointer-events: auto;
        background: #13151a;
        color: #e5e7eb;
        border: 1px solid #343841;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        padding: 8px;
        width: 280px; max-width: 90vw;
        font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
        display: none;
      }
      .panel[data-open="true"] { display: block; }
      .meta {
        font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #9ca3af;
        padding: 0 2px 6px;
        word-break: break-all;
      }
      .meta .tag { color: #f3f4f6; font-weight: 600; }
      .meta .sep { color: #4b5563; margin: 0 4px; }
      textarea {
        width: 100%;
        min-height: 56px;
        resize: vertical;
        box-sizing: border-box;
        border: 1px solid #343841;
        border-radius: 4px;
        padding: 6px 8px;
        background: #0b0c0f;
        color: #f3f4f6;
        font: inherit;
        outline: none;
      }
      textarea::placeholder { color: #6b7280; }
      textarea:focus {
        border-color: #B3C7FF;
        box-shadow: 0 0 0 2px rgba(179, 199, 255, 0.40);
      }
      .actions {
        display: flex; gap: 4px; align-items: center;
        margin-top: 6px;
      }
      button {
        font: inherit; padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid transparent;
        cursor: pointer;
        background: transparent;
        color: #d1d5db;
      }
      button:hover { background: rgba(255, 255, 255, 0.06); }
      .primary {
        background: #B3C7FF; color: #13151a;
        border-color: #B3C7FF; font-weight: 600;
      }
      .primary:hover { background: #d4ddff; border-color: #d4ddff; }
      .delete {
        color: #f87171; margin-right: auto;
      }
      .delete[hidden] { display: none; }
      .spacer { flex: 1; }
    </style>
    <div class="panel" data-open="false">
      <div class="meta"></div>
      <textarea placeholder="Note for the agent…"></textarea>
      <div class="actions">
        <button class="delete" data-action="delete" hidden>Delete</button>
        <span class="spacer"></span>
        <button data-action="cancel">Cancel</button>
        <button class="primary" data-action="save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(host);

  shadow.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const action = t.dataset?.action;
    if (action === "save") commit();
    else if (action === "cancel") close();
    else if (action === "delete") del();
  });

  const ta = shadow.querySelector("textarea") as HTMLTextAreaElement;
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
  });
}

function commit(): void {
  if (!currentEl || !shadow) return;
  const ta = shadow.querySelector("textarea") as HTMLTextAreaElement;
  const text = ta.value.trim();
  if (!text) {
    close();
    return;
  }
  if (currentAnnotationId) {
    updateAnnotation(currentAnnotationId, text);
  } else {
    addAnnotation({
      note: text,
      source: resolveSource(currentEl),
      selector: buildSelector(currentEl),
      tag: currentEl.tagName.toLowerCase(),
      html: ((currentEl as HTMLElement).outerHTML || "").slice(0, 240),
    });
  }
  close();
}

function del(): void {
  if (currentAnnotationId) removeAnnotation(currentAnnotationId);
  close();
}

function close(): void {
  if (!shadow) return;
  const panel = shadow.querySelector(".panel") as HTMLElement;
  panel.dataset.open = "false";
  currentEl = null;
  currentAnnotationId = null;
}

export function isPopupOpen(): boolean {
  if (!shadow) return false;
  const panel = shadow.querySelector(".panel") as HTMLElement | null;
  return panel?.dataset.open === "true";
}

export function isPopupEmpty(): boolean {
  if (!shadow) return true;
  const ta = shadow.querySelector("textarea") as HTMLTextAreaElement | null;
  return !ta || ta.value.trim().length === 0;
}

/** True iff the textarea content differs from the saved annotation (or is non-empty for a new one). */
export function isPopupDirty(): boolean {
  if (!shadow) return false;
  const panel = shadow.querySelector(".panel") as HTMLElement | null;
  if (panel?.dataset.open !== "true") return false;
  const ta = shadow.querySelector("textarea") as HTMLTextAreaElement | null;
  if (!ta) return false;
  const current = ta.value.trim();
  if (currentAnnotationId) {
    const saved = getAnnotations().find((a) => a.id === currentAnnotationId);
    return (saved?.note ?? "") !== current;
  }
  return current.length > 0;
}

export function closePopup(): void {
  close();
}

export function openNotePopup(
  el: Element,
  clientX: number,
  clientY: number,
  annotationId?: string,
): void {
  ensureHost();
  if (!shadow) return;

  currentEl = el;
  currentAnnotationId = annotationId ?? null;

  if (!currentAnnotationId) {
    const existing = findBySelector(buildSelector(el));
    if (existing) currentAnnotationId = existing.id;
  }

  const existing: Annotation | undefined = currentAnnotationId
    ? getAnnotations().find((a) => a.id === currentAnnotationId)
    : undefined;

  const panel = shadow.querySelector(".panel") as HTMLElement;
  const meta = shadow.querySelector(".meta") as HTMLElement;
  const ta = shadow.querySelector("textarea") as HTMLTextAreaElement;
  const delBtn = shadow.querySelector(".delete") as HTMLButtonElement;

  const tag = el.tagName.toLowerCase();
  const src = resolveSource(el);
  meta.innerHTML = "";
  const tagSpan = document.createElement("span");
  tagSpan.className = "tag";
  tagSpan.textContent = `<${tag}>`;
  meta.appendChild(tagSpan);
  if (src) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "·";
    meta.appendChild(sep);
    const srcSpan = document.createElement("span");
    srcSpan.textContent = src;
    meta.appendChild(srcSpan);
  }

  ta.value = existing?.note ?? "";
  delBtn.hidden = !existing;

  panel.dataset.open = "true";
  const w = 280;
  const h = 130;
  const x = Math.min(window.innerWidth - w - 8, clientX);
  const y = Math.min(window.innerHeight - h - 8, clientY);
  panel.style.left = Math.max(8, x) + "px";
  panel.style.top = Math.max(8, y) + "px";

  requestAnimationFrame(() => {
    ta.focus();
    ta.select();
  });
}
