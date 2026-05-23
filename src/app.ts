import { defineToolbarApp } from "astro/toolbar";
import { mountOverlay, setOverlayActive } from "./client/overlay.js";
import { startSourceCache } from "./client/source.js";
import { startBubbles } from "./client/bubbles.js";
import { copyAnnotations } from "./client/clipboard.js";
import { closePopup } from "./client/note-popup.js";
import {
  clearAll,
  getAllAnnotations,
  getTotalCount,
  subscribe,
} from "./client/state.js";

const NOTIFICATION_STYLE_ID = "aaa-notification-style";
const NOTIFICATION_CSS = `
  [data-app-id="astro-agent-annotate"] .notification svg {
    display: none !important;
  }
  [data-app-id="astro-agent-annotate"] .notification::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #B33E67;
    transform: translate(-50%, -50%);
  }
  [data-app-id="astro-agent-annotate"]:hover .notification::before,
  [data-app-id="astro-agent-annotate"].active .notification::before {
    background: #c84e78;
  }
`;

function applyNotificationColor(): void {
  const tryApply = (): boolean => {
    const tb = document.querySelector("astro-dev-toolbar") as
      | (HTMLElement & { shadowRoot: ShadowRoot | null })
      | null;
    const root = tb?.shadowRoot;
    if (!root) return false;
    if (root.getElementById(NOTIFICATION_STYLE_ID)) return true;
    const style = document.createElement("style");
    style.id = NOTIFICATION_STYLE_ID;
    style.textContent = NOTIFICATION_CSS;
    root.appendChild(style);
    return true;
  };
  if (tryApply()) return;
  const mo = new MutationObserver(() => {
    if (tryApply()) mo.disconnect();
  });
  mo.observe(document.documentElement, { subtree: true, childList: true });
  setTimeout(() => mo.disconnect(), 8000);
}

function bootRuntime(): void {
  startSourceCache();
  mountOverlay();
  startBubbles();
  applyNotificationColor();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootRuntime, { once: true });
  } else {
    bootRuntime();
  }
  document.addEventListener("astro:page-load", () => {
    closePopup();
    bootRuntime();
  });
}

export default defineToolbarApp({
  init(canvas, app) {
    const render = () => {
      const pages = getAllAnnotations();
      const total = pages.reduce((n, p) => n + p.annotations.length, 0);
      const currentUrl = window.location.pathname;
      canvas.innerHTML = "";

      const win = document.createElement("astro-dev-toolbar-window");
      const root = document.createElement("div");
      root.style.cssText =
        "min-width:300px;max-width:380px;font:12px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;color:#e5e7eb;";

      if (total === 0) {
        const p = document.createElement("p");
        p.textContent =
          "Hover and select the element you want to annotate. Tip: hold Alt and click at any moment to annotate instantly.";
        p.style.cssText = "color:#9ca3af;margin:0;font-size:12px;line-height:1.5;";
        root.appendChild(p);
      } else {
        const list = document.createElement("div");
        list.style.cssText = "max-height:280px;overflow-y:auto;margin-bottom:8px;";

        let index = 0;
        let first = true;
        for (const page of pages) {
          const isCurrent = page.url === currentUrl;
          const heading = document.createElement("div");
          heading.textContent = page.url + (isCurrent ? "  (this page)" : "");
          heading.style.cssText =
            "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;" +
            `color:${isCurrent ? "#f3f4f6" : "#6b7280"};` +
            `font-weight:${isCurrent ? "600" : "400"};` +
            `margin:${first ? "0" : "10px"} 0 4px;letter-spacing:0.02em;text-transform:uppercase;`;
          list.appendChild(heading);
          first = false;

          for (const a of page.annotations) {
            index++;
            const row = document.createElement("div");
            row.style.cssText = "padding:3px 0 5px;";
            const t = document.createElement("div");
            t.textContent = `${index}. ${a.note}`;
            t.style.cssText = "color:#e5e7eb;font-size:12px;";
            row.appendChild(t);
            if (a.source) {
              const s = document.createElement("div");
              s.textContent = a.source;
              s.style.cssText =
                "color:#6b7280;font-family:ui-monospace,monospace;font-size:10px;margin-top:1px;word-break:break-all;";
              row.appendChild(s);
            }
            list.appendChild(row);
          }
        }
        root.appendChild(list);

        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:6px;align-items:stretch;";

        const copyBtn = document.createElement("button");
        const pageCount = pages.length;
        copyBtn.textContent =
          `Copy ${total} annotation${total === 1 ? "" : "s"}` +
          (pageCount > 1 ? ` across ${pageCount} pages` : "");
        copyBtn.style.cssText =
          "flex:1;padding:6px 10px;border-radius:5px;" +
          "background:#B3C7FF;color:#13151a;border:none;cursor:pointer;" +
          "font:600 12px/1.3 inherit;";
        copyBtn.addEventListener("mouseenter", () => {
          copyBtn.style.background = "#d4ddff";
        });
        copyBtn.addEventListener("mouseleave", () => {
          copyBtn.style.background = "#B3C7FF";
        });
        copyBtn.addEventListener("click", async () => {
          const ok = await copyAnnotations();
          if (ok) {
            try {
              app.toggleState({ state: false });
            } catch {
              /* ignore */
            }
          }
        });

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "Clear all";
        clearBtn.style.cssText =
          "padding:6px 10px;border-radius:4px;" +
          "background:transparent;color:#d1d5db;border:1px solid transparent;" +
          "cursor:pointer;font:500 12px/1.3 inherit;";
        clearBtn.addEventListener("mouseenter", () => {
          clearBtn.style.background = "rgba(255, 255, 255, 0.06)";
        });
        clearBtn.addEventListener("mouseleave", () => {
          clearBtn.style.background = "transparent";
        });
        clearBtn.addEventListener("click", () => {
          clearAll();
        });

        actions.appendChild(copyBtn);
        actions.appendChild(clearBtn);
        root.appendChild(actions);
      }

      win.appendChild(root);
      canvas.appendChild(win);
    };

    render();
    subscribe(() => {
      render();
      try {
        app.toggleNotification({ state: getTotalCount() > 0, level: "info" });
      } catch {
        /* ignore */
      }
    });
    try {
      app.toggleNotification({ state: getTotalCount() > 0, level: "info" });
    } catch {
      /* ignore */
    }

    app.onToggled?.(({ state }: { state: boolean }) => {
      setOverlayActive(state);
    });
  },
});
