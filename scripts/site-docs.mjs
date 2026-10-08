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
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => resolve(repoRoot, ...parts);

/**
 * WHAT `graview create` WRITES, from the generator itself rather than from
 * a list somebody typed. The docs page for starting a product shows the
 * files and the scripts a stranger will actually get, so the build has to
 * have run; that is already true of everything else here.
 */
async function scaffolded() {
  const { scaffoldProject } = await import(pathToFileURL(at("packages/core/dist/scaffold/index.js")).href);
  const scaffold = scaffoldProject({ name: "Field Notes", kind: "note", packageManager: "npm", range: "^0.1.0" });
  const manifest = JSON.parse(scaffold.files.find((f) => f.path === "package.json").contents);
  return {
    files: scaffold.files.map((f) => f.path),
    scripts: Object.entries(manifest.scripts),
    dependencies: Object.keys(manifest.dependencies),
    devDependencies: Object.keys(manifest.devDependencies),
  };
}

/** The example apps, described by their own manifests. */
function apps() {
  return dirsIn("apps")
    .map((dir) => {
      const json = JSON.parse(readFileSync(at("apps", dir, "package.json"), "utf8"));
      return { dir, name: json.name ?? dir, description: json.description ?? "" };
    })
    .filter((app) => app.description && !["spike", "promo"].includes(app.dir));
}
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
  const serve = /export const SERVE_USAGE = `([\s\S]*?)\n`;/
    .exec(readFileSync(at("packages/ship/src/cli.ts"), "utf8"))?.[1] ?? "";
  const whole = [body.replace("${CREATE_USAGE}", create), serve].join("\n").replace(/\\`/g, "`");

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
  /*
   * `skills` prints three one-line forms rather than a usage and a blurb,
   * and lives in its own package; it is read from there and shaped here.
   */
  const skillsUsage = /export const SKILLS_USAGE = `([\s\S]*?)\n`;/
    .exec(readFileSync(at("packages/skills/src/cli.ts"), "utf8"))?.[1] ?? "";
  out.push({
    name: "skills",
    usage: skillsUsage.split("\n").map((line) => line.trim()),
    blurb: ["Copies the authoring skills into `.claude/skills` and `.agents/skills`, where Claude Code and Codex look for them; `list` says what ships and `path` says where the files live. `graview create` runs the install for you."],
    table: [],
  });
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
/* The Graview logo off the landing page's header: the kit's outlines, inline so it takes the page's ink. */
const LOGO = /<a class="logo"[\s\S]*?<\/a>/.exec(head)?.[0] ?? "";
if (!LOGO) throw new Error("docs/site/index.html has no <a class=\"logo\"> in its header to put on the docs pages");
const CSS_START = "/* site-css:start — written by scripts/site-css.mjs. Edit docs/site/site.css. */";
const CSS_END = "/* site-css:end */";
const css = readFileSync(at("docs/site/site.css"), "utf8").trimEnd();

/**
 * Every docs page is the same document with different content in it. The
 * head comes off the landing page so the fonts, the icon and the color
 * scheme cannot drift; `..` gets the stylesheet and the mark right from one
 * directory down.
 */
function shell({ title, blurb, here, body, up = "..", scripts = [] }) {
  const meta = head
    .slice(HEAD_START, HEAD_END)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)} — Graview docs</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(blurb)}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(title)} — Graview docs">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(blurb)}">`)
    // The site's own files (the face, the icons) are `brand/` at the root: `up` from here.
    .replaceAll('"brand/', `"${up}/brand/`);
  /* A package's or a skill's page is one directory down, so the nav's
     links to the docs root are one `../` longer there — a nav that forgot
     this sent every nested page's "Docs home" to a file that does not exist. */
  const docsRoot = up === ".." ? "" : "../";
  const nav = [
    ["index.html", "Docs home"],
    ["getting-started.html", "Getting started"],
    ["concepts.html", "Concepts"],
    ["packages.html", "Packages"],
    ["cli.html", "The CLI"],
    ["agents.html", "With a model"],
    ["skills.html", "Skills"],
    ["checks.html", "What check says"],
    ["demos.html", "Live demos"],
  ];
  return `${meta}<a class="skip" href="#main">Skip to content</a>

<div class="wrap" lang="en">
  <nav class="rail" aria-label="Documentation">
    <div class="brand">
      ${LOGO.replace('href="index.html"', `href="${up}/index.html"`)}
      <span class="sub">Documentation</span>
    </div>

    <div class="jump">
${nav.map(([href, label]) => `      <a href="${docsRoot}${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("\n")}
      <a href="${up}/progression.html">The garden, grown</a>
      <a href="${up}/index.html">&larr; graview.dev</a>
    </div>

    <div class="railfoot">
      written out of the repository<br>
      by scripts/site-docs.mjs<br>
      never by hand
    </div>
  </nav>

  <main class="col" id="main" tabindex="-1">
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
${scripts.map((src) => `<script src="${src}"></script>`).join("\n")}
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

async function build() {
  const made = await scaffolded();
  const examples = apps();
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
      `      <p class="lede" style="margin-top: 18px;"><code>graview</code> is the tool a person installs; <code>@graview/*</code> is the framework a product imports. ${pkgs.length} packages, one version, each depending only on the ones beneath it.</p>\n` +
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
    blurb: "graview create, check, docs, describe, lens, figure, serve and skills — what each reads and what each says.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">The CLI</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">One command line, <code>graview</code>, and every subcommand lives in the package whose concern it is: the generator and the checker in <code>@graview/core</code>, <code>serve</code> in <code>@graview/ship</code>, <code>skills</code> in <code>@graview/skills</code>. None of them needs a browser.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm install -g graview</code><button type="button" class="copy" data-copy="npm install -g graview">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">Or not at all: a project made by <code>graview create</code> has it as a devDependency, so <code>npx graview check</code> works from inside one, and <code>npx graview create</code> works from nowhere.</p></div>\n` +
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
      `      <p class="lede" style="margin-top: 18px;">${codes.length} findings, read out of the checker's own source. An <strong>error</strong> should fail your build. A <strong>warning</strong> is a judgment call. A <strong>note</strong> is a question worth answering once.</p>\n` +
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

  /* Starting a product: what the command asks, what it writes, what to do next. */
  const create = cmds.find((c) => c.name === "create");
  files.set("getting-started.html", shell({
    title: "Getting started", here: "getting-started.html",
    blurb: "From nothing to a running product on Graview, and the loop from there: declare, check, look, declare more.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Getting started</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">One command writes a running product for your own domain. Everything on this page below the command is read out of the generator that writes it, so it is what you will actually get.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm create graview@latest my-app</code><button type="button" class="copy" data-copy="npm create graview@latest my-app">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">Or <code>pnpm create graview my-app</code>, or <code>npx graview create my-app</code>. Node 22 or later.</p></div>\n` +
      `    </section>\n` +
      section("asks", "What it asks",
        `      <p>The directory is the only thing it needs; the rest has a default it says out loud. Give it the product's name and the first kind of thing your domain has — <code>--kind shift</code>, <code>--kind work-order</code> — and it writes chapter one for that domain rather than for a placeholder.</p>\n` +
        (create ? `      <div class="code" data-scroller aria-label="graview create, usage"><pre><code>${escape(create.usage)}</code></pre></div>` : "")) +
      section("writes", `What it writes (${made.files.length} files)`,
        `      <p>The declaration split into domain and UI, so the domain has no React in it and <code>graview check</code> can read it headless. <code>src/domain/</code> is the whole surface you will work in; the shell in <code>src/ui/</code> is eighty lines made of framework parts, and every one of them can be replaced.</p>\n` +
        `      <ul class="names" aria-label="The files graview create writes">${made.files.map((f) => `<li><code>${escape(f)}</code></li>`).join("")}</ul>\n` +
        `      <p class="sm dim" style="margin-top: 14px;">Dependencies: ${made.dependencies.map((d) => `<code>${escape(d)}</code>`).join(", ")}. Dev: ${made.devDependencies.map((d) => `<code>${escape(d)}</code>`).join(", ")}. No zod of your own — <code>@graview/core</code> re-exports <code>z</code>, so a kind's fields are built with exactly the copy the framework was built with.</p>`) +
      section("scripts", "The scripts it gives you",
        `      <div class="tablewrap"><table><thead><tr><th scope="col">Script</th><th scope="col">Runs</th></tr></thead><tbody>` +
        made.scripts.map(([name, cmd]) => `<tr><td><code>npm run ${escape(name)}</code></td><td><code>${escape(cmd)}</code></td></tr>`).join("") +
        `</tbody></table></div>\n` +
        `      <p class="sm" style="margin-top: 14px;"><strong>Start with <code>verify</code></strong> — typecheck, tests, build and <code>graview check</code>, in that order — and then <code>dev</code>: the scene at the root, the routed face at <code>/pages</code>.</p>`) +
      section("loop", "The loop from there",
        `      <p>Open a session beside the declaration. The skills are already installed where Claude Code and Codex look for them, and the first one to read is <a class="inl" href="skills/graview-node-kind.html"><code>graview-node-kind</code></a>. Describe a kind; let the model draft its fields, its edges, its acts and its rule; run <code>graview check</code>; look at the picture; declare more. The checker tells you both when a shape is wrong, in words, before a page does.</p>\n` +
        `      <ul class="cards">\n` +
        `        <li><a href="skills/graview-new-app.html"><strong>graview-new-app</strong><span>The shape of the declaration, the shell that comes for free, and the CI that keeps it honest.</span></a></li>\n` +
        `        <li><a href="skills/graview-node-kind.html"><strong>graview-node-kind</strong><span>Add a kind — fields, edges, label, plural, roles — and verify it with graview check.</span></a></li>\n` +
        `        <li><a href="skills/graview-invariant.html"><strong>graview-invariant</strong><span>A rule that names the acts that would repair it, then make it fire.</span></a></li>\n` +
        `        <li><a href="skills/graview-pages.html"><strong>graview-pages</strong><span>The routed face, from the derived pages to a design of your own.</span></a></li>\n` +
        `        <li><a href="skills/graview-ship.html"><strong>graview-ship</strong><span>Persistence, migrations, export and health, self-hosted or behind a service.</span></a></li>\n` +
        `      </ul>`) +
      section("checkout", "Working on the framework itself",
        `      <p>A product can consume a checkout of the framework by path instead of a registry, the way the first-party examples do: build the framework, then <code>pnpm graview create ../my-app --link .</code>. The project resolves every <code>@graview/*</code> import into the checkout's <code>dist/</code>, and its dev server rebuilds when the framework does.</p>\n` +
        `      <div class="term" data-scroller aria-label="Commands to work on the framework itself">` +
        `<div class="l"><span class="p">$</span><span class="c2">git clone https://github.com/en-dash-consulting/graview &amp;&amp; cd graview</span></div>` +
        `<div class="l"><span class="p">$</span><span class="c2">pnpm install &amp;&amp; pnpm build</span><span class="n2">every package</span></div>` +
        `<div class="l"><span class="p">$</span><span class="c2">pnpm graview create ../my-app --link . --name "My App" --kind thing</span></div>` +
        `<div class="l"><span class="p">$</span><span class="c2">pnpm dev:seedbed</span><span class="n2">the garden — ?chapter=N opens any chapter</span></div>` +
        `</div>`),
  }));

  /* Working with a model: the second programming interface, and where each piece of it is documented. */
  const describe = cmds.find((c) => c.name === "describe");
  const docsCmd = cmds.find((c) => c.name === "docs");
  const toolsPkg = pkgs.find((p) => p.dir === "tools");
  const studioPkg = pkgs.find((p) => p.dir === "studio");
  const skillsPkg = pkgs.find((p) => p.dir === "skills");
  const skillCard = (name) => {
    const skill = sks.find((s) => s.dir === name);
    return skill ? `        <li><a href="skills/${skill.dir}.html"><strong>${escape(skill.name)}</strong><span>${escape(skill.description)}</span></a></li>\n` : "";
  };
  files.set("agents.html", shell({
    title: "Working with a model", here: "agents.html",
    blurb: "The declaration is the interface a person uses and the interface a model uses. What a model gets, how it is narrowed, and what it reads before it writes.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Working with a model</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">A declaration is a context graph, and a context graph is the one thing a model reads as well as a person does. Graview has two programming interfaces over one declaration: the surfaces a person uses, and the tools, descriptions and skills a model uses. Neither can drift from the other, because both are derived.</p>\n` +
      `    </section>\n` +
      section("seat", "The seat",
        `      <p>An intelligence provider in the declaration says what a model may do and how words and pictures reach it. The seat gets the same acts a person has, narrowed by the same policy, and its turns land in the same operation log with an author and an intent — watchable from altitude, and undoable out of order. What comes back from a model is a plan before it is a change: one row per thing, what it was sure about, what goes with what if you decline something, then one batch with one undo.</p>\n` +
        `      <ul class="cards">\n${skillCard("graview-agent-seat")}${skillCard("graview-permissions")}${skillCard("graview-desk")}      </ul>`) +
      section("tools", "Typed tools, derived",
        `      <p>${escape(toolsPkg?.description ?? "")} Every act is a tool with a schema and a sentence attached; the tool surface is generated from the declaration and narrowed by the seat's role, so a model is never offered an act it may not take.</p>\n` +
        `      <p class="sm dim">The package: <a class="inl" href="packages/tools.html"><code>@graview/tools</code></a>.</p>`) +
      section("read", "What a model can read",
        `      <p><code>graview describe</code> reads the declaration out for something that cannot see: what a blank installation meets and in what order, what is drawn and what falls back, what a seat may do, how a model is reached, what is judged. <code>graview docs</code> writes an <code>llms.txt</code> and an <code>agents.md</code> beside the entry, derived, so they cannot drift.</p>\n` +
        (describe ? `      <div class="code" data-scroller aria-label="graview describe, usage"><pre><code>${escape(describe.usage)}</code></pre></div>\n` : "") +
        (docsCmd ? `      <div class="code" data-scroller aria-label="graview docs, usage" style="margin-top: 10px;"><pre><code>${escape(docsCmd.usage)}</code></pre></div>` : "")) +
      section("skills", `What a model reads before it writes (${sks.length} skills)`,
        `      <p>${escape(skillsPkg?.description ?? "")} Installed into a product by <code>graview skills install .</code> — which <code>graview create</code> runs for you — into <code>.claude/skills</code> and <code>.agents/skills</code>, so Claude Code and Codex find the same instructions.</p>\n` +
        `      <ul class="cards">\n` + sks.map((sk) => skillCard(sk.dir)).join("") + `      </ul>`) +
      section("studio", "The studio: a model edits the declaration itself",
        `      <p>${escape(studioPkg?.description ?? "")}</p>\n` +
        `      <ul class="cards">\n${skillCard("graview-studio")}${skillCard("graview-seed")}      </ul>\n` +
        `      <p class="sm dim">The package: <a class="inl" href="packages/studio.html"><code>@graview/studio</code></a>.</p>`),
  }));

  /* The demos: the garden's surfaces, live, and the example apps. */
  const frame = (n, label, aria, extra = "") =>
    `      <div class="chapter-live" data-graview-chapter="${n}" data-label="${escape(label)}" role="region" aria-label="${escape(aria)}"${extra}><p class="chapter-loading">${escape(label)}, loading…</p></div>`;
  files.set("demos.html", shell({
    title: "Live demos", here: "demos.html",
    blurb: "The example garden's surfaces, running on this page, and the example apps in the repository.",
    scripts: ["../chapters.js"],
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Live demos</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Nothing here is a screenshot. Each frame is the example garden, mounted on this page by <code>@graview/embed</code> from the same declaration, at a different place in it. <a class="inl" href="../progression.html">The garden, grown</a> has all sixteen chapters, each with what the declaration gained.</p>\n` +
      `    </section>\n` +
      section("city", "The city, at altitude",
        `      <p>Every kind is a district; every record a building on its own plot; every edge a road with its words on it. Drag the ground, press a district, come down to a plot.</p>\n` + frame(16, "The garden, grown", "The example garden at altitude, live", ' data-stop="#overview=1" data-settle="1"')) +
      section("pages", "The routed face",
        `      <p>The same store as ordinary pages — here in the garden's own design: an almanac over the same acts, rules and log.</p>\n` + frame(13, "The garden's own face", "The garden's routed pages, live", ' data-face="pages"')) +
      section("studio", "The studio",
        `      <p>The declaration itself, open as a graph, edited with ordinary acts and checked before the change lands.</p>\n` + frame(15, "Seedbed, in the studio", "The declaration open in the studio, live", ' data-settle="0"')) +
      section("seat", "A seat for an agent",
        `      <p>The same acts a person has, narrowed by the same policy, attributed in the same log.</p>\n` + frame(5, "Seedbed, with a seat", "The garden with an agent's seat, live")) +
      section("apps", "The example apps",
        `      <p>Each was built to prove a claim the others could not, and each is opened in a real browser on every push. They live under <code>apps/</code> in the repository; <code>pnpm apps</code> opens the desk, which opens the rest.</p>\n` +
        `      <ul class="cards">\n` + examples.map((app) => `        <li><a href="https://github.com/en-dash-consulting/graview/tree/main/apps/${app.dir}"><strong>${escape(app.dir)}</strong><span>${escape(app.description)}</span></a></li>`).join("\n") + `\n      </ul>`) +
      /* The city and the lens settle the way the landing page's do: the seat put away, the city stepped back once, through the product's own controls. */
      `    <script>
    document.addEventListener("graview:mounted", function (event) {
      var host = event.target;
      if (!(host instanceof Element) || !host.hasAttribute("data-settle")) return;
      var presses = Number(host.getAttribute("data-settle")) || 0;
      setTimeout(function () {
        var seat = host.querySelector('[data-graview-companion="open"] button[aria-expanded="true"]');
        if (seat) seat.click();
        for (var i = 0; i < presses; i += 1) { var out = host.querySelector('[data-testid="zoom-out"]'); if (out) out.click(); }
      }, 250);
    });
    </script>`,
  }));

  files.set("index.html", shell({
    title: "Docs", here: "index.html",
    blurb: "Graview's documentation: the concepts, the packages, the skills, the CLI and everything the checker can say.",
    body:
      `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
      `      <h1 id="h-what">Documentation</h1>\n` +
      `      <p class="lede" style="margin-top: 18px;">Everything here except the concepts is written out of the repository, so none of it can disagree with the code it describes.</p>\n` +
      `      <div class="cta"><div class="cta-line"><code>npm create graview@latest my-app</code><button type="button" class="copy" data-copy="npm create graview@latest my-app">Copy</button></div>\n` +
      `      <p class="cta-sub sm dim">New here? <a class="inl" href="getting-started.html">Getting started</a> is the first hour; <a class="inl" href="../progression.html">the garden, grown</a> is the whole framework in sixteen live steps.</p></div>\n` +
      `    </section>\n` +
      section("map", "Where things are",
        `      <ul class="cards">\n` +
        `        <li><a href="getting-started.html"><strong>Getting started</strong><span>One command to a running product, what it writes, and the loop from there.</span></a></li>\n` +
        `        <li><a href="concepts.html"><strong>Concepts</strong><span>The declaration, and the seven things in it.</span></a></li>\n` +
        `        <li><a href="agents.html"><strong>Working with a model</strong><span>The seat, the typed tools, what a model reads, and the studio.</span></a></li>\n` +
        `        <li><a href="demos.html"><strong>Live demos</strong><span>Every surface of the garden, running on the page, and the example apps.</span></a></li>\n` +
        `        <li><a href="packages.html"><strong>Packages (${pkgs.length})</strong><span>What each ships and what each exports.</span></a></li>\n` +
        `        <li><a href="skills.html"><strong>Skills (${sks.length})</strong><span>What your assistant reads before it writes.</span></a></li>\n` +
        `        <li><a href="cli.html"><strong>The CLI</strong><span>create, check, docs, describe, lens, figure, serve, skills.</span></a></li>\n` +
        `        <li><a href="checks.html"><strong>What check says (${codes.length})</strong><span>Every finding, and how loudly.</span></a></li>\n` +
        `        <li><a href="../progression.html"><strong>The garden, grown</strong><span>Sixteen live chapters, from one kind to a product.</span></a></li>\n` +
        `      </ul>`),
  }));

  /* Each page carries its own address, not the landing page's. */
  for (const [name, html] of files) {
    const url = `https://graview.dev/docs/${name}`;
    files.set(name, html
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`));
  }
  return files;
}

/** Every page on the site, for the crawlers, in one place. */
function sitemap(files) {
  const urls = ["https://graview.dev/", "https://graview.dev/progression.html", ...[...files.keys()].sort().map((name) => `https://graview.dev/docs/${name}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
}

/* ── writing it out ───────────────────────────────────────────────────── */

const checking = process.argv.includes("--check");
const files = await build();
files.set("../sitemap.xml", sitemap(files));
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
