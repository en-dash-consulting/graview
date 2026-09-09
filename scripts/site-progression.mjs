#!/usr/bin/env node
/**
 * The garden's chapters, written into the page that explains this thing.
 *
 * `docs/progression.json` is what `scripts/progression.mjs` saw: every
 * chapter's declaration, check verdict and pictures. This renders that
 * record into `docs/site/index.html` between two markers, so the marketing
 * page's spine is generated from the real app and re-generated whenever the
 * pictures are — never hand-written prose about pictures that moved on.
 *
 *   node scripts/site-progression.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = resolve(repoRoot, "docs/site/index.html");
const report = JSON.parse(readFileSync(resolve(repoRoot, "docs/progression.json"), "utf8"));
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const chapter = (c) => {
  // The chapter is LIVE on the page (docs/site/chapters.js mounts it); the
  // photographs stay on disk for CI and the record.
  const said = c.saw?.standing ?? "";
  const verdict = c.check.ok
    ? `graview check: Seedbed — ${c.check.warnings ? `${c.check.warnings} warning(s)` : "no problems found"}.`
    : `graview check: ${c.check.errors} error(s)`;
  const phone = c.picture?.phone ? " phone" : "";
  return `
      <article class="chapter${phone}" id="chapter-${c.n}" aria-labelledby="h-chapter-${c.n}">
        <div class="chapter-head">
          <span class="chapter-n" aria-hidden="true">${c.n}</span>
          <h3 id="h-chapter-${c.n}">${esc(c.title)}</h3>
        </div>
        <p class="chapter-claim">${esc(c.claim)}</p>
        <figure class="chapter-shot">
          <div class="chapter-live" data-graview-chapter="${c.n}" role="region" aria-label="${esc(c.title)}, live">
            <p class="chapter-loading">The garden after chapter ${c.n}, loading…</p>
          </div>
          <figcaption>${esc(said ? `Standing says “${said}”.` : "")} ${esc(verdict)} This is the app itself: switch its face, click a district, take an act.</figcaption>
        </figure>
        <div class="chapter-adds">
          <span class="chapter-label">The declaration gained</span>
          <ul>${c.adds.map((a) => `<li><code>${esc(a)}</code></li>`).join("")}</ul>
        </div>
      </article>`;
};

const section = `
    <section id="grown" aria-labelledby="h-grown">
      <div class="head"><span class="tick" aria-hidden="true"></span><h2 id="h-grown">The garden, grown</h2></div>
      <p class="lede">
        One example, the community garden, declared a little at a time. Every
        chapter below is a real declaration that passes its own check, opened
        in a real browser by <code>scripts/progression.mjs</code> on every push.
        Nothing here is a mock-up; a chapter that stops holding its claim fails
        the build.
      </p>
      <p class="sm">
        Chapter one is what <code>graview create</code> writes. The loop from
        there is the whole method: declare, check, look, declare more.
      </p>
      <div class="chapters">${report.chapters.map(chapter).join("\n")}
      </div>
    </section>
`;

const source = readFileSync(page, "utf8");
const start = "<!-- progression:start -->";
const end = "<!-- progression:end -->";
const a = source.indexOf(start);
const b = source.indexOf(end);
if (a === -1 || b === -1 || b < a) {
  process.stderr.write(`docs/site/index.html needs ${start} … ${end} markers.\n`);
  process.exit(1);
}
const next = `${source.slice(0, a + start.length)}\n${section}    ${source.slice(b)}`;
writeFileSync(page, next, "utf8");
process.stdout.write(`wrote ${report.chapters.length} chapters into docs/site/index.html\n`);
