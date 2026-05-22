import { getAllAnnotations, clearAll } from "./state.js";

export function formatAnnotations(): string {
  const pages = getAllAnnotations();
  if (pages.length === 0) return "";
  const ts = new Date().toISOString();

  const lines: string[] = [];
  lines.push("# Annotations");
  lines.push(`_Collected ${ts}_`);
  lines.push("");

  let index = 0;
  for (const page of pages) {
    const n = page.annotations.length;
    lines.push(`## \`${page.url}\` — ${n} note${n === 1 ? "" : "s"}`);
    lines.push("");
    for (const a of page.annotations) {
      index++;
      lines.push(`${index}. **${a.note}**`);
      if (a.source) lines.push(`   - \`${a.source}\``);
      if (a.html) lines.push(`   - \`${a.html.replace(/`/g, "ʼ")}\``);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

async function writeViaApi(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function writeViaFallback(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.setAttribute("readonly", "");
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    ta.remove();
  }
  return ok;
}

export async function copyAnnotations(): Promise<boolean> {
  const text = formatAnnotations();
  if (!text) return false;
  const ok = (await writeViaApi(text)) || writeViaFallback(text);
  if (ok) clearAll();
  return ok;
}
