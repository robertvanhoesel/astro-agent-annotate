// Astro emits `data-astro-source-file` and `data-astro-source-loc` on every
// element in dev, then its built-in audit toolbar strips them at runtime.
// We capture them as they're inserted into the DOM (MutationObserver below)
// and walk ancestors at resolve time — same approach used by
// XKonstX/astro-inspect-clip, since it's the only way to keep the attrs
// usable through Astro's strip.
type Cached = { aaa?: string; file?: string; loc?: string };

const sourceCache = new WeakMap<Element, Cached>();

function captureFrom(el: Element): void {
  const aaa = el.getAttribute("data-aaa-src");
  const file = el.getAttribute("data-astro-source-file");
  const loc = el.getAttribute("data-astro-source-loc");
  if (aaa || file || loc) {
    sourceCache.set(el, {
      aaa: aaa ?? undefined,
      file: file ?? undefined,
      loc: loc ?? undefined,
    });
  }
}

let observer: MutationObserver | null = null;
const sel = "[data-aaa-src],[data-astro-source-file],[data-astro-source-loc]";

function captureExisting(): void {
  for (const el of document.querySelectorAll(sel)) captureFrom(el);
}

export function startSourceCache(): void {
  captureExisting();
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.type === "childList") {
        mut.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as Element;
          captureFrom(el);
          for (const desc of el.querySelectorAll(sel)) captureFrom(desc);
        });
      } else if (mut.type === "attributes" && mut.target.nodeType === Node.ELEMENT_NODE) {
        captureFrom(mut.target as Element);
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-aaa-src", "data-astro-source-file", "data-astro-source-loc"],
  });
}

export function resolveSource(el: Element): string {
  let cur: Element | null = el;
  let file: string | undefined;
  let loc: string | undefined;

  while (cur) {
    const liveAaa = cur.getAttribute?.("data-aaa-src");
    if (liveAaa) return liveAaa;

    const cached = sourceCache.get(cur);
    if (cached?.aaa) return cached.aaa;

    const liveFile = cur.getAttribute?.("data-astro-source-file") ?? cached?.file;
    const liveLoc = cur.getAttribute?.("data-astro-source-loc") ?? cached?.loc;

    if (!file && liveFile) file = liveFile;
    if (!loc && liveLoc) loc = liveLoc;
    if (file && loc) break;

    cur = cur.parentElement;
  }

  if (file && loc) return `${file}:${loc}`;
  if (file) return file;
  return "";
}
