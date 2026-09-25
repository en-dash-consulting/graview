#!/usr/bin/env node
/**
 * THE DOCS, WRITTEN OUT OF THE REPOSITORY.
 *
 * The site had no reference. Twelve packages, thirteen skills, five CLI
 * commands, six lenses and a checker with seventy-one things it can say, and
 * the only place any of it was written down was a marketing page's appendix
 * or a source comment — which is how a page ends up saying "three lenses"
 * for six months after the fourth one shipped.
 *
 * So nothing here is written twice. A package's page is its own
 * `package.json` and `README.md`; a skill's page is its `SKILL.md`; the
 * checker's page is the `code`, `message` and `fix` of every finding
 * `check.ts` can produce, read out of the source. Run it after changing any
 * of those; `--check` fails when a page has gone stale, which is what the
 * test calls.
 *
 *   node scripts/site-docs.mjs            # write docs/site/docs/**
 *   node scripts/site-docs.mjs --check    # fail if any of it is stale
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => resolve(repoRoot, ...parts);
const OUT = at("docs/site/docs");

/* ── reading the repository ───────────────────────────────────────────── */

const dirsIn = (path) => readdirSync(at(path)).filter((e) => statSync(at(path, e)).isDirectory()).sort();

function packages() {
  return dirsIn("packages").map((dir) => {
    const json = JSON.parse(readFileSync(at("packages", dir, "package.json"), "utf8"));
    const readme = at("packages", dir, "README.md");
    return {
      dir,
      name: json.name ?? dir,
      description: json.description ?? "",
      version: json.version ?? "",
      exports: Object.keys(json.exports ?? {}).filter((k) => k !== "./dist/*"),
      /* A README opens with the package's name, which is already the h1 of
         the page it lands on. Two of them reads as a mistake, so the first
         heading goes when it says the same thing. */
      body: existsSync(readme)
        ? readFileSync(readme, "utf8").replace(/^#\s+.*\n+/, (line) =>
            line.toLowerCase().includes((json.name ?? dir).toLowerCase()) ? "" : line,
          )
        : "",
      api: publicNames(dir),
    };
  });
}

/**
 * What a package actually exports, read off its barrel.
 *
 * Not a type-aware extraction — a regex over `export { … }` and
 * `export function`. It is a listing, not a signature, and a listing that is
 * always current beats a signature that is six months old.
 */
function publicNames(dir) {
  const barrel = at("packages", dir, "src/index.ts");
  if (!existsSync(barrel)) return [];
  const source = readFileSync(barrel, "utf8");
  const found = new Set();
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) found.add(name);
    }
  }
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|class|const)\s+([A-Za-z_$][\w$]*)/g)) {
    found.add(m[1]);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

function skills() {
  return dirsIn("packages/skills/skills").map((dir) => {
    const body = readFileSync(at("packages/skills/skills", dir, "SKILL.md"), "utf8");
    const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
    const meta = Object.fromEntries(
      (front?.[1] ?? "").split("\n").map((line) => {
        const at_ = line.indexOf(":");
        return at_ === -1 ? ["", ""] : [line.slice(0, at_).trim(), line.slice(at_ + 1).trim()];
      }),
    );
    return { dir, name: meta.name ?? dir, description: meta.description ?? "", body: body.slice(front?.[0].length ?? 0) };
  });
}

/** The checker's source: `check.ts` and the families it asks, in `check/`. */
function checkerSource() {
  const dir = at("packages/core/src/cli/check");
  return [readFileSync(at("packages/core/src/cli/check.ts"), "utf8"), ...readdirSync(dir).map((name) => readFileSync(at("packages/core/src/cli/check", name), "utf8"))].join("\n");
}

/**
 * Every finding the checker can produce, with the sentence it says and the
 * fix it offers. Read out of the source, because a list of error codes
 * maintained by hand is a list of the error codes that existed once.
 */
function findings() {
  const source = checkerSource();
  const out = new Map();
  for (const m of source.matchAll(/severity:\s*"(error|warning|note)",\s*\n\s*code:\s*"([a-z0-9-]+)"/g)) {
    if (!out.has(m[2])) out.set(m[2], { code: m[2], severity: m[1] });
  }
  /* Codes declared without a severity on the line above are still codes. */
  for (const m of source.matchAll(/code:\s*"([a-z0-9-]+)"/g)) {
    if (!out.has(m[1])) out.set(m[1], { code: m[1], severity: "error" });
  }
  return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * THE COMMANDS, OUT OF THE HELP THE CLI ALREADY PRINTS.
 *
 * The first version of this read each command's source file and guessed —
 * a usage export if there was one, otherwise the first block comment, which
 * for `check.ts` turned out to be an interior note about what a `note` is.
 * The CLI has written its own help since the beginning and prints it on
 * `graview --help`. Reading that means the docs and the terminal say the
 * same words because they ARE the same words.
 */
function commands() {
  const index = readFileSync(at("packages/core/src/cli/index.ts"), "utf8");
  const body = /const USAGE = `([\s\S]*?)\n`;/.exec(index)?.[1] ?? "";
  const create = /export const CREATE_USAGE = `([\s\S]*?)\n`;/
    .exec(readFileSync(at("packages/core/src/cli/create.ts"), "utf8"))?.[1] ?? "";
  const whole = body.replace("${CREATE_USAGE}", create).replace(/\\`/g, "`");

  /* Each command starts at its own `graview <name>` line, two spaces in. */
  const out = [];
  const lines = whole.split("\n");
  let current = null;
  for (const line of lines) {
    const start = /^ {2}graview ([a-z]+)\b/.exec(line);
    if (start) {
      if (current) out.push(current);
      current = { name: start[1], usage: [line.trim()], blurb: [], table: [], flags: false };
      continue;
    }
    if (current === null) continue;
    /*
     * Prose until the first flag, then everything is the flag table. A
     * flag's own description wraps onto a line that looks exactly like
     * prose, so there is no telling them apart line by line — but a command
     * never goes back to prose after its flags, and that is enough.
     */
    if (/^\s*--/.test(line)) current.flags = true;
    if (current.flags) current.table.push(line.replace(/^ {2}/, ""));
    else if (/^ {6,}\S/.test(line)) current.blurb.push(line.trim());
    else if (line.trim() !== "") current.usage.push(line.trim());
  }
  if (current) out.push(current);
  return out
    .map((c) => ({
      name: c.name,
      usage: [...c.usage, ...(c.table.length ? ["", ...c.table] : [])].join("\n"),
      blurb: c.blurb.join(" "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ── the smallest markdown that these files actually use ──────────────── */

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(text) {
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
      const fence = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) { fence.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<div class="code" data-scroller><pre><code>${escape(fence.join("\n"))}</code></pre></div>`);
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

/* ── the page shell ───────────────────────────────────────────────────── */

const head = readFileSync(at("docs/site/index.html"), "utf8");
const HEAD_START = head.indexOf("<!doctype html>");
const HEAD_END = head.indexOf('<a class="skip"');
const MARK = /<a class="who"[\s\S]*?<\/a>/.exec(head)?.[0] ?? "";
const CSS_START = "/* site-css:start — written by scripts/site-css.mjs. Edit docs/site/site.css. */";
const CSS_END = "/* site-css:end */";
const css = readFileSync(at("docs/site/site.css"), "utf8").trimEnd();

/**
 * Every docs page is the same document with different content in it. The
 * head comes off the landing page so the fonts, the icon and the colour
 * scheme cannot drift; `..` gets the stylesheet and the mark right from one
 * directory down.
 */
function shell({ title, blurb, here, body, up = ".." }) {
  const meta = head
    .slice(HEAD_START, HEAD_END)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)} — Graview docs</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(blurb)}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(title)} — Graview docs">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(blurb)}">`);
  const nav = [
    ["index.html", "Docs home"],
    ["concepts.html", "Concepts"],
    ["packages.html", "Packages"],
    ["skills.html", "Skills"],
    ["cli.html", "The CLI"],
    ["checks.html", "What check says"],
  ];
  return `${meta}<a class="skip" href="#main">Skip to content</a>

<div class="wrap" lang="en">
  <nav class="rail" aria-label="Documentation">
    <div class="brand">
      ${MARK}
      <span class="it"><a href="${up}/index.html" style="color: inherit; text-decoration: none;">Graview</a></span>
      <span class="sub">Documentation</span>
    </div>

    <div class="jump">
${nav.map(([href, label]) => `      <a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("\n")}
      <a href="${up}/progression.html">The garden, grown</a>
      <a href="${up}/index.html">&larr; The page</a>
    </div>

    <div class="railfoot">
      written out of the repository<br>
      by scripts/site-docs.mjs<br>
      never by hand
    </div>
  </nav>

  <main class="col" id="main">
${body}
  </main>
</div>

<footer>
  <p class="sm dim">
    Graview is built by <a href="https://endash.us">En&nbsp;Dash</a>. These pages are
    generated from the repository — <code>node scripts/site-docs.mjs</code> — so nothing
    on them can disagree with the code they describe.
  </p>
</footer>
<script>
/*
 * A REGION THAT SCROLLS NEEDS A WAY INTO IT.
 *
 * A code block narrower than its content scrolls sideways, and a keyboard
 * cannot reach it without a tab stop — axe calls it
 * scrollable-region-focusable, and at 320px every page with a wide code
 * sample failed it the day these pages appeared. The landing page has done
 * this since it was audited. Conditional, and re-asked on resize, because a
 * tab stop on something that does NOT scroll is a stop that goes nowhere.
 */
(function () {
  var scrollers = [].slice.call(document.querySelectorAll("[data-scroller]"));
  function mark() {
    scrollers.forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
      if (scrolls) {
        el.setAttribute("tabindex", "0");
        /*
         * A REGION NEEDS A NAME, so only the ones that have one get the
         * role. Promoting every scrolling code block to a region put two
         * unnamed landmarks on the same page and axe said so — a landmark
         * a screen reader lists as "region, region" is worse than no
         * landmark, and the tab stop is what the keyboard actually needed.
         */
        if (el.getAttribute("aria-label")) el.setAttribute("role", "region");
      } else {
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
      }
    });
  }
  mark();
  addEventListener("resize", mark);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mark);
})();

/* The same copy button the landing page has, and the same promise: where
   the clipboard is refused the command is still on the page, selectable. */
document.querySelectorAll("[data-copy]").forEach(function (button) {
  button.addEventListener("click", function () {
    var said = button.textContent;
    function done(word) {
      button.textContent = word;
      button.setAttribute("data-copied", "");
      setTimeout(function () { button.textContent = said; button.removeAttribute("data-copied"); }, 1600);
    }
    if (!navigator.clipboard) { done("Select it"); return; }
    navigator.clipboard.writeText(button.dataset.copy).then(
      function () { done("Copied"); },
      function () { done("Select it"); }
    );
  });
});
</script>
<style>
${CSS_START}
${css}
${CSS_END}
</style>
</body>
</html>
`;
}

const section = (id, heading, inner) =>
  `    <section id="${id}" aria-labelledby="h-${id}">\n      <div class="head"><span class="tick" aria-hidden="true"></span><h2 id="h-${id}">${escape(heading)}</h2></div>\n${inner}\n    </section>\n`;

const slug = (text) => text.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/* ── the pages ────────────────────────────────────────────────────────── */

function build() {
  const pkgs = packages();
  const sks = skills();
  const codes = findings();
  const cmds = commands();
  const files = new Map();

  /* One page per package. */
  for (const pkg of pkgs) {
    files.set(`packages/${pkg.dir}.html`, shell({
      title: pkg.name,
      blurb: pkg.description,
      here: "packages.html",
      up: "../..",
      body:
        `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
        `      <h1 id="h-what">${escape(pkg.name)}</h1>\n` +
        `      <p class="lede" style="margin-top: 18px;">${escape(pkg.description)}</p>\n` +
        `      <div class="cta"><div class="cta-line"><code>pnpm add ${escape(pkg.name)}</code>` +
        `<button type="button" class="copy" data-copy="pnpm add ${escape(pkg.name)}">Copy</button></div></div>\n` +
        (pkg.exports.length > 1
          ? `      <p class="sm dim" style="margin-top: 14px;">Entry points: ${pkg.exports.map((e) => `<code>${escape(pkg.name + e.slice(1))}</code>`).join(", ")}</p>\n`
          : "") +
        `    </section>\n` +
        (pkg.body ? section("readme", "What it is", render(pkg.body)) : "") +
        (pkg.api.length
          ? section("api", `What it exports (${pkg.api.length})`,
              `      <p class="sm dim">Read off the package's own barrel, so this is what is there today.</p>\n` +
              `      <ul class="names">${pkg.api.map((n) => `<li><code>${escape(n)}</code></li>`).join("")}</ul>`)
          : ""),
    }));
  }

  /* One page per skill. */
  for (const skill of sks) {
    files.set(`skills/${skill.dir}.html`, shell({
      title: skill.name,
      blurb: skill.description,
      here: "skills.html",
      up: "../..",
      body:
        `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
        `      <h1 id="h-what">${escape(skill.name)}</h1>\n` +
        `      <p class="lede" style="margin-top: 18px;">${escape(skill.description)}</p>\n` +
        `      <p class="sm dim">Installed into a project by <code>graview skills install .</code>, and read by whichever assistant is working beside you.</p>\n` +
        `    </section>\n` +
        section("skill", "The skill", render(skill.body)),
    }));
  }

  /* And the indexes. */
  files.set("packages.html", shell({
    title: "Packages", here: "packages.html",
    blurb: `The ${pkgs.length} packages Graview ships, what each is for, and what each exports.`,
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The packages</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Twelve, in tier order. Each depends only on the ones above it, and a product takes as many as it needs.</p>\n` +
      `    </section>\n` +
      section("all", "All of them",
        `      <ul class="cards">\n` +
        pkgs.map((p) =>
          `        <li><a href="packages/${p.dir}.html"><strong>${escape(p.name)}</strong><span>${escape(p.description)}</span></a></li>`,
        ).join("\n") + `\n      </ul>`),
  }));

  files.set("skills.html", shell({
    title: "Skills", here: "skills.html",
    blurb: `The ${sks.length} skills that teach an assistant the authoring moves, each ending in a real check.`,
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The skills</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Each teaches a model one shape of the declaration, and each ends in <code>graview check</code> — reporting what it actually said, rather than claiming the work is done.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>graview skills install .</code><button type="button" class="copy" data-copy="graview skills install .">Copy</button></div></div>\n` +
      `    </section>\n` +
      section("all", "All of them",
        `      <ul class="cards">\n` +
        sks.map((s) =>
          `        <li><a href="skills/${s.dir}.html"><strong>${escape(s.name)}</strong><span>${escape(s.description)}</span></a></li>`,
        ).join("\n") + `\n      </ul>`),
  }));

  files.set("cli.html", shell({
    title: "The CLI", here: "cli.html",
    blurb: "graview check, describe, docs and create — what each reads and what each says.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The CLI</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Every one of these reads the declaration and nothing else. None of them needs a browser, a server or a running app.</p>\n` +
      `    </section>\n` +
      cmds.map((c) => section(`cli-${c.name}`, `graview ${c.name}`,
        (c.usage ? `      <div class="code" data-scroller aria-label="graview ${c.name}, usage"><pre><code>${escape(c.usage)}</code></pre></div>\n` : "") +
        (c.blurb ? `      <p>${inline(c.blurb)}</p>` : ""),
      )).join(""),
  }));

  files.set("checks.html", shell({
    title: "What check says", here: "checks.html",
    blurb: `Every one of the ${codes.length} things graview check can tell you, and how loudly.`,
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">What <code>graview check</code> says</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">${codes.length} findings, read out of the checker's own source. An <strong>error</strong> should fail your build. A <strong>warning</strong> is a judgement call. A <strong>note</strong> is a question worth answering once.</p>\n` +
      `    </section>\n` +
      ["error", "warning", "note"].map((severity) => {
        const mine = codes.filter((c) => c.severity === severity);
        if (mine.length === 0) return "";
        return section(severity, `${mine.length} ${severity}${mine.length === 1 ? "" : "s"}`,
          `      <ul class="names">${mine.map((c) => `<li><code>${escape(c.code)}</code></li>`).join("")}</ul>`);
      }).join(""),
  }));

  /*
   * The one page that is prose. Everything else here is read out of the
   * repository; a concept is not in the repository — it is the reason the
   * repository is shaped the way it is, and nothing can generate that.
   * Each one links to the skill that teaches it, so the prose stays short
   * and the instructions stay in one place.
   */
  const concepts = [
    ["The declaration", "graview-new-app",
      "One object — <code>defineApp</code> — carrying the schema, the mutations, the invariants, the policy, the brand, the lenses and the intelligence. It has no React in it, which is what lets a build, a CLI and a model all read it."],
    ["Kinds and edges", "graview-node-kind",
      "A kind is a thing your domain has; an edge is how two of them relate, and it carries how it READS from each end. Declaring a kind gets you a district, a card at three fidelities, a hue, an accessible label and a place in every agent tool — before anything is drawn."],
    ["Acts", "graview-node-kind",
      "Every change is a named, typed mutation. It is the button in the interface, the tool in the model's schema and the line in the log, and it says what it <code>creates</code>, <code>connects</code> and <code>severs</code> so the surfaces can derive themselves from it."],
    ["Rules that repair", "graview-invariant",
      "An invariant names the mutations that fix what it finds. That is the difference between a validation error and a problem with a way out — the interface can offer the repair because the rule said what it was."],
    ["Lenses", "graview-lens",
      "A lens places nodes by a rule the domain supplies — a time, two sets, a coordinate, an outline. It binds ROLES rather than field names, so a lens written for your domain works unchanged in somebody else's, and a test in a second domain is how that claim is kept."],
    ["Who may do what", "graview-permissions",
      "One policy, declared once. The strip, the routed pages and the agent's tools all narrow from it, and an act a seat may not take is struck through with the sentence saying who can — never a button that silently fails."],
    ["The seat for a model", "graview-agent-seat",
      "An intelligence provider declares what a model may do and how words and pictures reach it. Its turns land in the same log with an author and an intent, and come back out through the same undo."],
  ];
  files.set("concepts.html", shell({
    title: "Concepts", here: "concepts.html",
    blurb: "The declaration, and the seven things in it.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Concepts</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Seven things, one object. Every surface in a Graview application is derived from some part of what is on this page.</p>\n` +
      `    </section>\n` +
      concepts.map(([title, skill, blurb]) => section(slug(title), title,
        `      <p>${blurb}</p>\n` +
        `      <p class="sm dim">Taught by <a class="inl" href="skills/${skill}.html"><code>${skill}</code></a>.</p>`,
      )).join(""),
  }));

  files.set("index.html", shell({
    title: "Docs", here: "index.html",
    blurb: "Graview's documentation: the concepts, the packages, the skills, the CLI and everything the checker can say.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Documentation</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Everything here except the concepts is written out of the repository, so none of it can disagree with the code it describes.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm create graview@latest my-app</code><button type="button" class="copy" data-copy="npm create graview@latest my-app">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">New here? <a class="inl" href="../progression.html">The garden, grown</a> is the whole framework in fifteen live steps.</p></div>\n` +
      `    </section>\n` +
      section("map", "Where things are",
        `      <ul class="cards">\n` +
        `        <li><a href="concepts.html"><strong>Concepts</strong><span>The declaration, and the seven things in it.</span></a></li>\n` +
        `        <li><a href="packages.html"><strong>Packages (${pkgs.length})</strong><span>What each ships and what each exports.</span></a></li>\n` +
        `        <li><a href="skills.html"><strong>Skills (${sks.length})</strong><span>What your assistant reads before it writes.</span></a></li>\n` +
        `        <li><a href="cli.html"><strong>The CLI</strong><span>check, describe, docs, create.</span></a></li>\n` +
        `        <li><a href="checks.html"><strong>What check says (${codes.length})</strong><span>Every finding, and how loudly.</span></a></li>\n` +
        `        <li><a href="../progression.html"><strong>The garden, grown</strong><span>Fifteen live chapters, from one kind to a product.</span></a></li>\n` +
        `      </ul>`),
  }));

  return files;
}

/* ── writing it out ───────────────────────────────────────────────────── */

const checking = process.argv.includes("--check");
const files = build();
let stale = 0;

for (const [name, html] of files) {
  const path = resolve(OUT, name);
  const now = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (now === html) continue;
  if (checking) {
    process.stderr.write(`docs/site/docs/${name} is out of date — run \`pnpm site:docs\`.\n`);
    stale += 1;
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, html);
  }
}

if (checking) {
  if (stale > 0) process.exit(1);
  process.stdout.write(`every one of the ${files.size} docs pages is the repository's own\n`);
} else {
  process.stdout.write(`wrote ${files.size} pages into docs/site/docs\n`);
}
