#!/usr/bin/env node
/**
 * Builds a single visual page from the Markdown documents in /docs.
 *
 * Output:
 *   docs/site/index.html     full HTML page for local viewing (loads Mermaid from a CDN)
 *   docs/site/artifact.html  page body only, for publishing as a hosted page
 *                            (the hosting viewer renders <pre class="mermaid"> natively)
 *
 * No dependencies: the converter supports exactly the Markdown subset used in /docs
 * (headings, paragraphs, lists, tables, blockquotes, fenced code, hr, inline code,
 * bold, italic, links).
 *
 * Usage: node scripts/build-docs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");
const outDir = join(docsDir, "site");

const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";

const files = ["README.md", ...readdirSync(docsDir).filter((f) => /^\d{2}-.*\.md$/.test(f)).sort()];

const docId = (file) => (file === "README.md" ? "overview" : `doc-${file.slice(0, 2)}`);

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const STATUS_TOKENS = new Set(["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "WITHDRAWN"]);

function resolveHref(href) {
  if (/^https?:\/\//.test(href)) return { href, external: true };
  if (href === "site/index.html") return { href: "#overview" };
  const m = href.match(/^(?:docs\/)?([^/#]+\.md)(#.*)?$/);
  if (m) return { href: `#${docId(m[1])}` };
  return { href };
}

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, code) => {
    const cls = STATUS_TOKENS.has(code) ? ` class="st st-${code.toLowerCase().replace("_", "-")}"` : "";
    codes.push(`<code${cls}>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const r = resolveHref(href.replace(/&amp;/g, "&"));
    const ext = r.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(r.href)}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

function splitRow(line) {
  const cells = [];
  let cur = "";
  let inCode = false;
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (const ch of body) {
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function renderList(lines) {
  // lines: [{indent, ordered, text}]
  let html = "";
  let i = 0;
  function build(level) {
    const first = lines[i];
    const tag = first.ordered ? "ol" : "ul";
    let out = `<${tag}>`;
    while (i < lines.length && lines[i].indent >= level) {
      const item = lines[i];
      if (item.indent > level) {
        out = out.replace(/<\/li>$/, "") + build(item.indent) + "</li>";
        continue;
      }
      out += `<li>${inline(item.text)}</li>`;
      i++;
    }
    return out + `</${tag}>`;
  }
  while (i < lines.length) html += build(lines[i].indent);
  return html;
}

function convert(md, id) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const toc = [];
  let i = 0;
  let firstH1 = true;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      if (lang === "mermaid") {
        out.push(`<div class="diagram"><pre class="mermaid">${escapeHtml(buf.join("\n"))}</pre></div>`);
      } else {
        const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
        out.push(`<div class="code">${label}<pre><code>${escapeHtml(buf.join("\n"))}</code></pre></div>`);
      }
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2]);
      if (level === 1 && firstH1) {
        firstH1 = false;
        out.push(`<h1 class="doc-title">${text}</h1>`);
      } else {
        const hid = `${id}-${slug(text)}`;
        if (level === 2) toc.push({ id: hid, text: text.replace(/<[^>]+>/g, "") });
        out.push(`<h${level} id="${hid}">${text}</h${level}>`);
      }
      i++;
      continue;
    }

    if (/^---\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${buf.filter(Boolean).map((l) => `<p>${inline(l)}</p>`).join("")}</blockquote>`);
      continue;
    }

    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const head = splitRow(rows[0]);
      const body = rows.slice(2).map(splitRow);
      const thead = `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      out.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) {
          items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
          i++;
        } else if (/^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1].text += " " + lines[i].trim();
          i++;
        } else break;
      }
      out.push(renderList(items));
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{1,4}\s|>|\||---\s*$)/.test(lines[i]) &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i])
    )
      buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), toc };
}

const docs = files.map((file) => {
  const md = readFileSync(join(docsDir, file), "utf8");
  const id = docId(file);
  const title = (md.match(/^#\s+(.*)$/m) || [, file])[1].replace(/`/g, "");
  const { html, toc } = convert(md, id);
  return { file, id, title, html, toc };
});

const navTitle = (d) => (d.id === "overview" ? "Overview" : d.title.replace(/^\d{2}\s*·\s*/, ""));
const navNum = (d) => (d.id === "overview" ? "00" : d.file.slice(0, 2));

const nav = docs
  .map(
    (d) =>
      `<li><a href="#${d.id}"><span class="nav-num">${navNum(d)}</span><span>${escapeHtml(navTitle(d))}</span></a></li>`
  )
  .join("");

const sections = docs
  .map(
    (d) => `
<section class="doc" id="${d.id}">
  <div class="doc-meta"><span class="nav-num">${navNum(d)}</span><span class="file">docs/${d.file}</span></div>
  ${d.toc.length > 2 ? `<nav class="mini-toc" aria-label="Sections"><span>In this document</span>${d.toc.map((t) => `<a href="#${t.id}">${escapeHtml(t.text)}</a>`).join("")}</nav>` : ""}
  ${d.html}
  <p class="back"><a href="#top">Back to top</a></p>
</section>`
  )
  .join("\n");

const css = `
:root{
  /* Layout: fixed left rail of numbered documents, one long reading column on the right. */
  --bg:#f6f7fb; --surface:#ffffff; --surface-2:#eef1f8; --ink:#141a2e; --muted:#59627a;
  --line:#d9deea; --accent:#1f4fd1; --accent-ink:#ffffff; --code-bg:#eef1f8;
  --st-pending:#a15c00; --st-pending-bg:#fff1d6; --st-progress:#1f4fd1; --st-progress-bg:#e3eaff;
  --st-resolved:#126b3f; --st-resolved-bg:#dcf3e6; --st-rejected:#a1262d; --st-rejected-bg:#fde2e3;
  --st-withdrawn:#4b5563; --st-withdrawn-bg:#e8eaee;
  --font-display:"Space Grotesk", "Segoe UI", system-ui, sans-serif;
  --font-body:"Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono:"JetBrains Mono", ui-monospace, "Cascadia Code", Consolas, monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#0d1120; --surface:#141a2e; --surface-2:#1b2340; --ink:#e7eaf3; --muted:#9aa3bd;
  --line:#2a3354; --accent:#7f9dff; --accent-ink:#0d1120; --code-bg:#1b2340;
  --st-pending:#ffc56b; --st-pending-bg:#3a2a0c; --st-progress:#9db4ff; --st-progress-bg:#1d2a5c;
  --st-resolved:#7fd9a8; --st-resolved-bg:#123323; --st-rejected:#ff9a9f; --st-rejected-bg:#3d1518;
  --st-withdrawn:#c3c8d4; --st-withdrawn-bg:#2a2f3a; color-scheme:dark;
}}
:root[data-theme="dark"]{
  --bg:#0d1120; --surface:#141a2e; --surface-2:#1b2340; --ink:#e7eaf3; --muted:#9aa3bd;
  --line:#2a3354; --accent:#7f9dff; --accent-ink:#0d1120; --code-bg:#1b2340;
  --st-pending:#ffc56b; --st-pending-bg:#3a2a0c; --st-progress:#9db4ff; --st-progress-bg:#1d2a5c;
  --st-resolved:#7fd9a8; --st-resolved-bg:#123323; --st-rejected:#ff9a9f; --st-rejected-bg:#3d1518;
  --st-withdrawn:#c3c8d4; --st-withdrawn-bg:#2a2f3a; color-scheme:dark;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:16px}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
body{background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.6;margin:0}
a{color:var(--accent);text-underline-offset:2px}
a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
.shell{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}
.rail{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;background:var(--surface);border-right:1px solid var(--line);padding:28px 18px}
.brand{font-family:var(--font-display);font-weight:700;font-size:22px;letter-spacing:-0.01em;margin:0}
.brand-sub{color:var(--muted);font-size:13px;margin:4px 0 20px}
.rail ol{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.rail a{display:flex;gap:10px;align-items:baseline;padding:7px 10px;border-radius:6px;color:var(--ink);text-decoration:none;font-size:14px}
.rail a:hover{background:var(--surface-2)}
.nav-num{font-family:var(--font-mono);font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.legend{margin-top:24px;padding-top:16px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px}
.legend-label{width:100%;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
main{padding-block:32px 80px;padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}
.content{max-width:960px;margin:0 auto;display:grid;gap:28px}
.hero{padding:8px 0 4px}
.hero h1{font-family:var(--font-display);font-size:clamp(28px,4vw,40px);line-height:1.15;margin:0 0 8px;text-wrap:balance}
.hero p{color:var(--muted);margin:0;max-width:65ch}
.doc{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:28px clamp(16px,3vw,40px)}
.doc-meta{display:flex;gap:12px;align-items:center;margin-bottom:6px}
.doc-meta .file{font-family:var(--font-mono);font-size:12px;color:var(--muted)}
.doc-title{font-family:var(--font-display);font-size:clamp(24px,3vw,32px);line-height:1.2;margin:0 0 14px;text-wrap:balance}
.doc h2{font-family:var(--font-display);font-size:21px;margin:36px 0 10px;padding-top:18px;border-top:1px solid var(--line);text-wrap:balance}
.doc h3{font-family:var(--font-display);font-size:17px;margin:26px 0 8px}
.doc h4{font-size:15px;margin:20px 0 6px}
.doc p,.doc li{max-width:78ch}
.doc ul,.doc ol{padding-left:22px}
.doc li{margin:3px 0}
.doc hr{border:0;border-top:1px dashed var(--line);margin:32px 0}
blockquote{margin:0 0 16px;padding:12px 16px;background:var(--surface-2);border-radius:8px;color:var(--ink)}
blockquote p{margin:4px 0}
.mini-toc{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;margin:0 0 18px;padding:10px 0;border-bottom:1px solid var(--line)}
.mini-toc span{width:100%;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.table-wrap{overflow-x:auto;margin:12px 0 18px;border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{text-align:left;vertical-align:top;padding:8px 12px;border-bottom:1px solid var(--line)}
th{background:var(--surface-2);font-weight:600;white-space:nowrap}
tr:last-child td{border-bottom:0}
td{font-variant-numeric:tabular-nums}
code{font-family:var(--font-mono);font-size:.86em;background:var(--code-bg);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
.code{position:relative;margin:12px 0 18px}
.code pre{margin:0;overflow-x:auto;background:var(--code-bg);border:1px solid var(--line);border-radius:8px;padding:14px 16px;font-size:12.5px;line-height:1.55}
.code pre code{background:none;padding:0;font-size:inherit;overflow-wrap:normal}
.code-lang{position:absolute;top:6px;right:10px;font-family:var(--font-mono);font-size:11px;color:var(--muted)}
.diagram{overflow-x:auto;margin:14px 0 20px;padding:16px;background:var(--surface);border:1px solid var(--line);border-radius:8px}
.diagram pre.mermaid{margin:0;background:none;text-align:center;font-size:13px}
code.st{font-weight:600;letter-spacing:.02em}
.st-pending{color:var(--st-pending);background:var(--st-pending-bg)}
.st-in-progress{color:var(--st-progress);background:var(--st-progress-bg)}
.st-resolved{color:var(--st-resolved);background:var(--st-resolved-bg)}
.st-rejected{color:var(--st-rejected);background:var(--st-rejected-bg)}
.st-withdrawn{color:var(--st-withdrawn);background:var(--st-withdrawn-bg)}
.back{margin:28px 0 0;font-size:13px}
.mobile-nav{display:none}
@media (max-width: 900px){
  .shell{grid-template-columns:minmax(0,1fr)}
  .rail{display:none}
  .mobile-nav{display:block;margin-bottom:8px}
  .mobile-nav select{width:100%;font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}
}
`;

const options = docs.map((d) => `<option value="${d.id}">${navNum(d)} · ${escapeHtml(navTitle(d))}</option>`).join("");

const legend = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "WITHDRAWN"]
  .map((s) => `<code class="st st-${s.toLowerCase().replace("_", "-")}">${s}</code>`)
  .join("");

const body = `
<div class="shell" id="top">
  <aside class="rail" aria-label="Documents">
    <p class="brand">CampusConnect</p>
    <p class="brand-sub">Architecture &amp; System Design · v1.0</p>
    <ol>${nav}</ol>
    <div class="legend"><span class="legend-label">Complaint statuses</span>${legend}</div>
  </aside>
  <main>
    <div class="content">
      <header class="hero">
        <div class="mobile-nav"><label for="doc-jump" class="nav-num">Jump to document</label>
          <select id="doc-jump">${options}</select></div>
        <h1>CampusConnect architecture and system design</h1>
        <p>Smart campus complaint and feedback platform for a real university, delivered as one Next.js codebase that runs on the web and installs on phones as a PWA. Authors: Sudais Khalid and Farooq Khan.</p>
      </header>
      ${sections}
    </div>
  </main>
</div>
<script>
  (function(){
    var sel = document.getElementById("doc-jump");
    if (sel) sel.addEventListener("change", function(){ location.hash = sel.value; });
  })();
</script>`;

const head = `<title>CampusConnect Architecture</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>${css}</style>`;

const mermaidLocal = `<script src="${MERMAID_CDN}"></script>
<script>
  var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: true, theme: dark ? "dark" : "default", securityLevel: "strict", flowchart: { htmlLabels: true } });
</script>`;

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${mermaidLocal}\n</body>\n</html>\n`
);
writeFileSync(join(outDir, "artifact.html"), `${head}\n${body}\n`);

console.log(`Built ${docs.length} documents into docs/site/index.html and docs/site/artifact.html`);
