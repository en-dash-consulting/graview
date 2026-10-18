/**
 * THE PROSE A PAGE OF GRAVIEW.DEV IS WRITTEN IN: the smallest markdown the
 * records use, a page's section under its heading, and the repository the
 * prose links to. The design (`design.mjs`) and the Releases page
 * (`releases.mjs`) both write with it, so it is a module of its own rather
 * than one of theirs: the design draws the Releases page, and the Releases
 * page reaching back into the design for its words made the two a cycle.
 */

/** The repository every page links into. */
export const REPOSITORY = "https://github.com/en-dash-consulting/graview";

/* ── the smallest markdown that these files actually use ──────────────── */

export const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    /*
     * `.inl` on every link in prose, because a bare inline anchor is an
     * eighteen-pixel target and the floor is twenty-four. The landing page
     * has had this class since it was audited; the generated pages did not,
     * and every one of them failed the same check on the same day they
     * appeared. A class the hand-written page needs, the written-out pages
     * need too — that is what makes them the same site.
     */
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="inl" href="$2">$1</a>');
}

/**
 * Markdown to HTML, for the subset these files use: headings, fenced code,
 * lists, tables, blockquotes and paragraphs. Not a markdown library — a
 * renderer for the documents in this repository, which a test reads back.
 */
export function render(markdown) {
  const lines = markdown.split("\n");
  const out = [];
  let i = 0;
  const closeList = (kind) => { if (kind) out.push(`</${kind}>`); };
  let list = null;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      closeList(list); list = null;
      /* The fence's language goes on the code, where a reader that cannot
         see the page — a crawler, a model — learns what it is reading. */
      const lang = line.slice(3).trim() || "text";
      const fence = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) { fence.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<div class="code" data-scroller><pre><code class="language-${escape(lang)}">${escape(fence.join("\n"))}</code></pre></div>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList(list); list = null;
      const level = Math.min(6, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const number = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet || number) {
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) { closeList(list); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((bullet ?? number)[1])}</li>`);
      i += 1;
      continue;
    }
    /*
     * A LIST ITEM THAT RUNS ONTO THE NEXT LINE is still that list item.
     * Markdown wraps them with an indent and no marker, and the first
     * version of this renderer read the second line as a new paragraph —
     * so every wrapped bullet in every README closed its own list and
     * printed its tail at the left margin, under the one it belonged to.
     * It looked like a styling fault and was a parsing one.
     */
    if (list !== null && /^\s+\S/.test(line)) {
      const last = out.length - 1;
      out[last] = out[last].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      closeList(list); list = null;
      out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
      i += 1;
      continue;
    }
    if (line.trim() === "") { closeList(list); list = null; i += 1; continue; }
    if (line.startsWith("|")) {
      closeList(list); list = null;
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i += 1; }
      const cells = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        `<div data-scroller class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }
    /*
     * ALWAYS TAKE THE LINE. The first version gathered a paragraph with a
     * `while` whose condition excluded the very line that got here — so a
     * `---` rule, which matches no branch above and is excluded below,
     * advanced nothing and the renderer spun for ever on the first README
     * that had one. A loop whose progress depends on a condition it did not
     * itself check is a loop that will eventually stop making progress.
     */
    const para = [lines[i]];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !/^[-*#>|]|^\d+\./.test(lines[i]) && !lines[i].startsWith("```")) {
      para.push(lines[i]); i += 1;
    }
    closeList(list); list = null;
    /* A horizontal rule is a rule, not a paragraph of three hyphens. */
    const text = para.join(" ").trim();
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) out.push("<hr>");
    else if (text) out.push(`<p>${inline(text)}</p>`);
  }
  closeList(list);
  return out.join("\n");
}

export const section = (id, heading, inner) =>
  `    <section id="${id}" aria-labelledby="h-${id}">\n      <div class="head"><span class="tick" aria-hidden="true"></span><h2 id="h-${id}">${escape(heading)}</h2></div>\n${inner}\n    </section>\n`;
