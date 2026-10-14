/**
 * `@graview/core/markdown` — PROSE WRITTEN IN MARKDOWN, READ SAFELY (FR-180).
 *
 * A text field may say it is written in Markdown (`markdownField()`,
 * `{"type": "text", "format": "markdown"}`). This reads one into blocks and
 * runs of words a face draws as elements — the routed face through React
 * (`@graview/primitives`, fetched with the first Markdown a record draws),
 * a static page as HTML (`markdownHtml`). Its own entry: nothing a page
 * draws first reads Markdown.
 *
 * What it reads, and nothing else:
 *
 *   # … ######            a heading, demoted under the page's own
 *   a blank line          a new paragraph; a single line break is kept
 *   - * + / 1. 1)         a list, nested by indenting; [ ] and [x] said as ☐ ☑
 *   > …                   a quotation
 *   ``` or ~~~            a block of code, as written
 *   --- *** ___           a rule
 *   | a | b | + |---|     a table
 *   **strong** *em* _em_ ~~struck~~ `code`
 *   [words](https://…)    a link — http, https and mailto only; any other
 *                         address (javascript:, data:, a relative path) is
 *                         its words, not a link
 *   <https://…>, https://…  an address, as a link
 *   ![words](…)           NOT a picture: its words, a link where the address
 *                         is http(s). A record's pictures are an image
 *                         field's, which the host stored (FR-162)
 *   \*  &amp; &#169;      an escape, an entity: the character
 *
 * NO HTML PASSES THROUGH. A tag is its letters; every word is text a face
 * writes as text (React's text nodes, `escapeHtml` here), so a value can
 * never become markup, a script or a handler, whatever it holds.
 *
 * Linear in what it reads: each line is read once, an inline mark looks for
 * its closing mark once (a mark with none is remembered as having none), and
 * nesting stops at a depth where it is words again.
 */

/** A run of words, as a face draws it. */
export type MarkdownInline =
  | { readonly t: "text"; readonly text: string }
  | { readonly t: "br" }
  | { readonly t: "code"; readonly text: string }
  | { readonly t: "strong" | "em" | "del"; readonly children: readonly MarkdownInline[] }
  | { readonly t: "link"; readonly href: string; readonly children: readonly MarkdownInline[] };

/** A block of a Markdown text. */
export type MarkdownBlock =
  | { readonly t: "heading"; readonly level: number; readonly children: readonly MarkdownInline[] }
  | { readonly t: "p"; readonly children: readonly MarkdownInline[] }
  | { readonly t: "list"; readonly ordered: boolean; readonly start: number; readonly items: readonly (readonly MarkdownBlock[])[] }
  | { readonly t: "quote"; readonly blocks: readonly MarkdownBlock[] }
  | { readonly t: "code"; readonly text: string; readonly lang?: string }
  | { readonly t: "rule" }
  | { readonly t: "table"; readonly align: readonly ("left" | "center" | "right" | undefined)[]; readonly head: readonly (readonly MarkdownInline[])[]; readonly rows: readonly (readonly (readonly MarkdownInline[])[])[] };

/** How deep quotes and lists nest, and emphasis within emphasis, before the rest is words. */
const DEEPEST = 8;

const FENCE_MARK = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+|$)/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const QUOTE = /^ {0,3}>[ \t]?/;
const ITEM = /^([ \t]*)([-*+]|(\d{1,9})[.)])(?:[ \t]+|$)/;
// Read on a trimmed line, so no two runs of spaces meet.
const TABLE_RULE = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?$|^\|\s*:?-+:?\s*\|$/;
const BLANK = /^[ \t]*$/;

/** A fence that opens code: three ticks or tildes, and a backtick fence's words hold no tick. */
function fenceOf(line: string): { readonly mark: string; readonly lang: string } | undefined {
  const fence = FENCE_MARK.exec(line);
  if (!fence || (fence[1]![0] === "`" && line.indexOf("`", fence[0].length) >= 0)) return undefined;
  return { mark: fence[1]!, lang: fence[2]! };
}

/** A heading's words: after its marks, less a closing run of "#" that follows a space. */
function headingWords(line: string, marks: number): string {
  let words = line.trim().slice(marks).trim();
  let end = words.length;
  while (end > 0 && words[end - 1] === "#") end--;
  if (end === 0 || words[end - 1] === " " || words[end - 1] === "\t") words = words.slice(0, end).trim();
  return words;
}

/** Whether a line starts a block of its own, ending the paragraph before it. */
const startsBlock = (line: string): boolean => fenceOf(line) !== undefined || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);

/** A tab is four columns, as Markdown reads indentation. */
const columns = (space: string): number => [...space].reduce((at, ch) => (ch === "\t" ? at + 4 - (at % 4) : at + 1), 0);

/** The cells of a table's row: split on bars that are not escaped and not in code. */
function cellsOf(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let ticks = false;
  for (let at = 0; at < body.length; at++) {
    const ch = body[at]!;
    if (ch === "\\" && body[at + 1] === "|") {
      cell += "|";
      at++;
    } else if (ch === "`") {
      ticks = !ticks;
      cell += ch;
    } else if (ch === "|" && !ticks) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

/** The blocks a Markdown text is written in. */
export function markdownBlocks(text: string): readonly MarkdownBlock[] {
  return blocksOf(text.replace(/\r\n?/g, "\n").replace(/\0/g, "�").split("\n"), 0);
}

function blocksOf(lines: readonly string[], depth: number): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let at = 0;
  while (at < lines.length) {
    const line = lines[at]!;
    if (BLANK.test(line)) {
      at++;
      continue;
    }
    const fence = fenceOf(line);
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence.mark[0] === "`" ? "`" : "~"}{${fence.mark.length},}[ \\t]*$`);
      const code: string[] = [];
      at++;
      while (at < lines.length && !close.test(lines[at]!)) code.push(lines[at++]!);
      at++;
      blocks.push({ t: "code", text: code.join("\n"), ...(fence.lang ? { lang: fence.lang } : {}) });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ t: "heading", level: heading[1]!.length, children: inlineOf(headingWords(line, heading[1]!.length), 0) });
      at++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ t: "rule" });
      at++;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      // A quote runs while its lines say ">" — and over a paragraph's lines that go on without it.
      while (at < lines.length && (QUOTE.test(lines[at]!) || (quoted.length > 0 && !BLANK.test(lines[at]!) && !startsBlock(lines[at]!) && !BLANK.test(quoted[quoted.length - 1]!)))) quoted.push(lines[at++]!.replace(QUOTE, ""));
      blocks.push(depth < DEEPEST ? { t: "quote", blocks: blocksOf(quoted, depth + 1) } : { t: "p", children: inlineOf(quoted.join("\n"), 0) });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      const ordered = item[3] !== undefined;
      const indent = columns(item[1]!);
      const items: MarkdownBlock[][] = [];
      // Each item: its first line after the mark, and every line after it that is indented under it or goes on its paragraph.
      while (at < lines.length) {
        const mark = ITEM.exec(lines[at]!);
        if (!mark || columns(mark[1]!) > indent + 1 || columns(mark[1]!) < indent || (mark[3] !== undefined) !== ordered) break;
        const inner = columns(mark[0]);
        const body: string[] = [lines[at]!.slice(mark[0].length)];
        at++;
        while (at < lines.length) {
          const next = lines[at]!;
          if (BLANK.test(next)) {
            // Blank lines go on the item only when what follows them is indented under it.
            let after = at;
            while (after < lines.length && BLANK.test(lines[after]!)) after++;
            if (after < lines.length && columns(/^[ \t]*/.exec(lines[after]!)![0]) >= Math.min(inner, indent + 2)) {
              for (; at < after; at++) body.push("");
              continue;
            }
            break;
          }
          const lead = columns(/^[ \t]*/.exec(next)![0]);
          // Indented under the item: its own indentation past the item's is kept, so a list in it nests.
          if (lead >= Math.min(inner, indent + 2)) body.push(" ".repeat(Math.max(0, lead - inner)) + next.replace(/^[ \t]*/, ""));
          else if (!startsBlock(next) && !BLANK.test(body[body.length - 1]!)) body.push(next.trim());
          else break;
          at++;
        }
        const task = /^\[([ xX])\][ \t]+/.exec(body[0]!);
        if (task) body[0] = `${task[1] === " " ? "☐" : "☑"} ${body[0]!.slice(task[0].length)}`;
        items.push(depth < DEEPEST ? blocksOf(body, depth + 1) : [{ t: "p", children: inlineOf(body.join("\n"), 0) }]);
      }
      blocks.push({ t: "list", ordered, start: ordered ? Math.min(Number(item[3]), 999_999_999) : 1, items });
      continue;
    }
    const rule = lines[at + 1];
    if (line.includes("|") && rule !== undefined && TABLE_RULE.test(rule.trim())) {
      const head = cellsOf(line);
      const align = cellsOf(rule).map((cell) => (/^:-+:$/.test(cell) ? "center" : /-:$/.test(cell) ? "right" : /^:-/.test(cell) ? "left" : undefined));
      const rows: (readonly MarkdownInline[])[][] = [];
      at += 2;
      while (at < lines.length && !BLANK.test(lines[at]!) && lines[at]!.includes("|") && !startsBlock(lines[at]!)) {
        const cells = cellsOf(lines[at++]!);
        rows.push(head.map((_, index) => inlineOf(cells[index] ?? "", 0)));
      }
      blocks.push({ t: "table", align: head.map((_, index) => align[index]), head: head.map((cell) => inlineOf(cell, 0)), rows });
      continue;
    }
    const paragraph: string[] = [];
    while (at < lines.length && !BLANK.test(lines[at]!) && (paragraph.length === 0 || !startsBlock(lines[at]!))) paragraph.push(lines[at++]!.trim());
    blocks.push({ t: "p", children: inlineOf(paragraph.join("\n"), 0) });
  }
  return blocks;
}

/** The addresses a link may go to: the web and mail. Anything else is its words. */
export function safeHref(address: string): string | undefined {
  const href = address.trim().replace(/^<|>$/g, "");
  // No control or space characters: a scheme hidden behind a tab or a newline is still a scheme.
  if (/[\u0000- \u007f-\u009f]/.test(href)) return undefined;
  return /^(?:https?:\/\/[^/?#]|mailto:[^@\s]+@)/i.test(href) ? href : undefined;
}

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", mdash: "—", ndash: "–", hellip: "…", rarr: "→", larr: "←", times: "×", middot: "·", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", deg: "°" };

/** An entity as its character; one it does not know, as written. Never a control character. */
function entity(name: string): string | undefined {
  if (name[0] === "#") {
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return Number.isFinite(code) && code > 31 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) && !(code >= 0x7f && code <= 0x9f) ? String.fromCodePoint(code) : undefined;
  }
  return ENTITIES[name];
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>|~<&"']/;
// Sticky: read where the reader stands, never past an address's own length.
const BARE_ADDRESS = /(?:https?:\/\/|mailto:)[^\s<>"'`]{1,2000}/iy;
const AUTOLINK = /<((?:https?:\/\/|mailto:)[^\s<>]{1,2000})>/iy;

/** A paragraph's words: emphasis, code, links, breaks and escapes, every other character text. */
export function inlineOf(source: string, depth: number): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", text });
    text = "";
  };
  // A closing mark that is not there is remembered as not there from where it was looked for.
  const none = new Map<string, number>();
  const closing = (mark: string, from: number): number => {
    if ((none.get(mark) ?? Infinity) <= from) return -1;
    const code = mark[0] === "`";
    let at = from;
    for (;;) {
      at = source.indexOf(mark, at);
      if (at < 0) {
        none.set(mark, Math.min(none.get(mark) ?? Infinity, from));
        return -1;
      }
      const before = source[at - 1];
      const after = source[at + mark.length];
      // Code closes on the same run of ticks, no longer.
      if (code ? before !== "`" && after !== "`" : true) {
        if (code) return at;
        // A closing mark follows a word, not a space; a single * or _ is not half of a double one; an underscore inside a word is the word's.
        if (before !== undefined && !/\s/.test(before) && (mark.length > 1 || (after !== mark && before !== mark)) && !(mark === "_" && after !== undefined && /\w/.test(after))) return at;
      }
      at += code ? 1 : mark.length;
    }
  };
  let at = 0;
  while (at < source.length) {
    const ch = source[at]!;
    if (ch === "\\" && at + 1 < source.length && ESCAPABLE.test(source[at + 1]!)) {
      text += source[at + 1];
      at += 2;
      continue;
    }
    if (ch === "\\" && source[at + 1] === "\n") {
      flush();
      out.push({ t: "br" });
      at += 2;
      continue;
    }
    if (ch === "\n") {
      // A line break is kept: what somebody wrote on its own line reads on its own line.
      flush();
      out.push({ t: "br" });
      at++;
      continue;
    }
    if (ch === "&") {
      const named = /^&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z]{2,8});/.exec(source.slice(at, at + 12));
      const said = named ? entity(named[1]!) : undefined;
      if (named && said !== undefined) {
        text += said;
        at += named[0].length;
        continue;
      }
    }
    if (ch === "`") {
      const run = /^`+/.exec(source.slice(at, at + 32))![0];
      const end = closing(run, at + run.length);
      if (end >= 0 && source[end + run.length] !== "`") {
        flush();
        const code = source.slice(at + run.length, end).replace(/\n/g, " ");
        out.push({ t: "code", text: /^ .* $/.test(code) && code.trim() ? code.slice(1, -1) : code });
        at = end + run.length;
        continue;
      }
      text += run;
      at += run.length;
      continue;
    }
    if (ch === "<") {
      AUTOLINK.lastIndex = at;
      const auto = AUTOLINK.exec(source);
      const href = auto ? safeHref(auto[1]!) : undefined;
      if (auto && href) {
        flush();
        out.push({ t: "link", href, children: [{ t: "text", text: auto[1]! }] });
        at += auto[0].length;
        continue;
      }
    }
    if ((ch === "h" || ch === "H" || ch === "m" || ch === "M") && (at === 0 || /[\s(*_~]/.test(source[at - 1]!))) {
      BARE_ADDRESS.lastIndex = at;
      const bare = BARE_ADDRESS.exec(source);
      if (bare) {
        // A sentence's stop or a closing bracket after an address is the sentence's.
        let address = bare[0].replace(/[.,:;!?*_~]+$/, "");
        while (address.endsWith(")") && address.split("(").length < address.split(")").length) address = address.slice(0, -1).replace(/[.,:;!?]+$/, "");
        const href = safeHref(address);
        if (href && address.length > 8) {
          flush();
          out.push({ t: "link", href, children: [{ t: "text", text: address }] });
          at += address.length;
          continue;
        }
      }
    }
    if (ch === "[" || (ch === "!" && source[at + 1] === "[")) {
      const open = ch === "!" ? at + 1 : at;
      const link = linkAt(source, open);
      if (link) {
        flush();
        const href = safeHref(link.address);
        const words = depth < DEEPEST ? inlineOf(link.words, depth + 1) : [{ t: "text" as const, text: link.words }];
        // A picture is its words (FR-180 chose no pictures from an address: a record's pictures are its image fields').
        if (href) out.push({ t: "link", href, children: words.length > 0 ? words : [{ t: "text", text: link.address }] });
        else out.push(...words);
        at = link.end;
        continue;
      }
    }
    if (ch === "*" || ch === "_" || ch === "~") {
      const double = source[at + 1] === ch;
      if (ch === "~" && !double) {
        text += ch;
        at++;
        continue;
      }
      const mark = double ? ch + ch : ch;
      const after = source[at + mark.length];
      const before = source[at - 1];
      // An opening mark comes before a word; an underscore inside a word (snake_case) is the word's.
      const opens = after !== undefined && !/\s/.test(after) && !(ch === "_" && before !== undefined && /\w/.test(before));
      const end = opens && depth < DEEPEST ? closing(mark, at + mark.length + 1) : -1;
      if (end >= 0) {
        flush();
        const children = inlineOf(source.slice(at + mark.length, end), depth + 1);
        out.push({ t: ch === "~" ? "del" : double ? "strong" : "em", children });
        at = end + mark.length;
        continue;
      }
      text += mark;
      at += mark.length;
      continue;
    }
    text += ch;
    at++;
  }
  flush();
  return out;
}

/** A link's words and address at `[`: `[words](address "title")`, its brackets balanced; undefined when it is not one. */
function linkAt(source: string, open: number): { readonly words: string; readonly address: string; readonly end: number } | undefined {
  let depth = 0;
  let at = open;
  // Brackets are looked for within a bounded reach: a lone "[" never sends the reader to the text's end.
  const reach = Math.min(source.length, open + 1000);
  for (; at < reach; at++) {
    const ch = source[at];
    if (ch === "\\") at++;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) break;
  }
  if (depth !== 0 || source[at + 1] !== "(") return undefined;
  const rest = /^\(\s*(<[^<>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/.exec(source.slice(at + 1, at + 2049));
  if (!rest) return undefined;
  return { words: source.slice(open + 1, at), address: rest[1]!.replace(/^<|>$/g, ""), end: at + 1 + rest[0].length };
}

/** A text as HTML writes it: every character that could start markup, escaped. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Options for drawing Markdown as HTML or elements. */
export interface MarkdownDrawing {
  /** The level a Markdown "#" is drawn at: a record's page's own heading and section are above it. 3 when unsaid. */
  readonly headingsFrom?: number;
  /** Where a link opens: `_blank` (a new tab, the default) or `_self`. */
  readonly target?: "_blank" | "_self";
}

/** The heading level a Markdown heading of `level` is drawn at, under the page's own. */
export const headingLevel = (level: number, from = 3): number => Math.min(6, level + from - 1);

function inlineHtml(parts: readonly MarkdownInline[], drawing: MarkdownDrawing): string {
  return parts
    .map((part) => {
      switch (part.t) {
        case "text":
          return escapeHtml(part.text);
        case "br":
          return "<br>";
        case "code":
          return `<code>${escapeHtml(part.text)}</code>`;
        case "strong":
        case "em":
        case "del":
          return `<${part.t}>${inlineHtml(part.children, drawing)}</${part.t}>`;
        case "link": {
          const blank = (drawing.target ?? "_blank") === "_blank" && !/^mailto:/i.test(part.href);
          return `<a href="${escapeHtml(part.href)}" rel="noopener noreferrer nofollow"${blank ? ' target="_blank"' : ""}>${inlineHtml(part.children, drawing)}</a>`;
        }
      }
    })
    .join("");
}

function blocksHtml(blocks: readonly MarkdownBlock[], drawing: MarkdownDrawing): string {
  return blocks
    .map((block) => {
      switch (block.t) {
        case "heading": {
          const level = headingLevel(block.level, drawing.headingsFrom);
          return `<h${level}>${inlineHtml(block.children, drawing)}</h${level}>`;
        }
        case "p":
          return `<p>${inlineHtml(block.children, drawing)}</p>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map((item) => `<li>${item.length === 1 && item[0]!.t === "p" ? inlineHtml(item[0]!.children, drawing) : blocksHtml(item, drawing)}</li>`).join("");
          return `<${tag}${block.ordered && block.start !== 1 ? ` start="${block.start}"` : ""}>${items}</${tag}>`;
        }
        case "quote":
          return `<blockquote>${blocksHtml(block.blocks, drawing)}</blockquote>`;
        case "code":
          return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
        case "rule":
          return "<hr>";
        case "table": {
          const cell = (tag: "th" | "td", parts: readonly MarkdownInline[], index: number) => `<${tag}${block.align[index] ? ` style="text-align:${block.align[index]}"` : ""}>${inlineHtml(parts, drawing)}</${tag}>`;
          return `<div data-graview-md-table=""><table><thead><tr>${block.head.map((parts, index) => cell("th", parts, index)).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((parts, index) => cell("td", parts, index)).join("")}</tr>`).join("")}</tbody></table></div>`;
        }
      }
    })
    .join("");
}

/** A Markdown text as HTML: escaped words in the elements it reads, and nothing else (a static page's). */
export function markdownHtml(text: string, drawing: MarkdownDrawing = {}): string {
  return blocksHtml(markdownBlocks(text), drawing);
}
