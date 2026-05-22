export type Annotation = {
  id: string;
  note: string;
  source: string;
  selector: string;
  tag: string;
  html: string;
  createdAt: number;
};

export type PageAnnotations = {
  url: string;
  annotations: Annotation[];
};

const KEY_PREFIX = "aaa:annotations:";
const listeners = new Set<() => void>();

function urlFromKey(k: string): string {
  return k.slice(KEY_PREFIX.length);
}

function currentKey(): string {
  return KEY_PREFIX + window.location.pathname;
}

function readKey(k: string): Annotation[] {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCurrent(): Annotation[] {
  return readKey(currentKey());
}

function notify(): void {
  for (const l of listeners) l();
}

function writeCurrent(annotations: Annotation[]): void {
  const k = currentKey();
  if (annotations.length === 0) localStorage.removeItem(k);
  else localStorage.setItem(k, JSON.stringify(annotations));
  notify();
}

export function getAnnotations(): Annotation[] {
  return readCurrent();
}

export function getCount(): number {
  return readCurrent().length;
}

/** Annotations across every URL the user has touched, grouped by URL. */
export function getAllAnnotations(): PageAnnotations[] {
  const pages: PageAnnotations[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const annotations = readKey(k);
    if (annotations.length === 0) continue;
    pages.push({ url: urlFromKey(k), annotations });
  }
  pages.sort((a, b) => a.url.localeCompare(b.url));
  return pages;
}

export function getTotalCount(): number {
  let total = 0;
  for (const p of getAllAnnotations()) total += p.annotations.length;
  return total;
}

export function addAnnotation(a: Omit<Annotation, "id" | "createdAt">): Annotation {
  const ann: Annotation = {
    ...a,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  writeCurrent([...readCurrent(), ann]);
  return ann;
}

export function updateAnnotation(id: string, note: string): void {
  writeCurrent(readCurrent().map((a) => (a.id === id ? { ...a, note } : a)));
}

export function removeAnnotation(id: string): void {
  writeCurrent(readCurrent().filter((a) => a.id !== id));
}

export function findBySelector(selector: string): Annotation | undefined {
  return readCurrent().find((a) => a.selector === selector);
}

/** Clear annotations across every URL. */
export function clearAll(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
  notify();
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key.startsWith(KEY_PREFIX)) notify();
  });
}
