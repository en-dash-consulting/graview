#!/usr/bin/env node
/**
 * GRAVIEW.DEV, WRITTEN OUT OF THE REPOSITORY — AS A GRAVIEW APP.
 *
 * The site had no reference. Twelve packages, thirteen skills, five CLI
 * commands, six lenses and a checker with seventy-one things it can say, and
 * the only place any of it was written down was a marketing page's appendix
 * or a source comment — which is how a page ends up saying "three lenses"
 * for six months after the fourth one shipped.
 *
 * So nothing here is written twice, and the site is what Graview says an
 * app is: a declaration (`apps/site/app.json`) and its records. This reads
 * the repository into those records — a package is its own `package.json`,
 * `README.md` and barrel; a skill its `SKILL.md`; a check finding the `code`
 * and severity of every finding the checker's source can produce; a command
 * the help `graview --help` prints; a recipe its committed declaration and
 * seed — and then a page record for every address graview.dev serves,
 * related to what it is about. Each page is rendered from its record by
 * `renderPlace` (`@graview/pages/static`) in the site's own design,
 * `apps/site/design.mjs`. Run it after changing any of those; `--check`
 * fails when a page has gone stale, which is what the test calls.
 *
 *   node scripts/site-docs.mjs            # write docs/site/**
 *   node scripts/site-docs.mjs --check    # fail if any of it is stale
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { faqs, inlineMd, metaOf, SITE, siteDesign } from "../apps/site/design.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = (...parts) => resolve(repoRoot, ...parts);

/** The declaration the site is, and the hand-designed pages it fills. */
export const DECLARATION = "apps/site/app.json";
const HAND = "apps/site/pages";
const OUT = at("docs/site");

/* ── reading the repository ───────────────────────────────────────────── */

const dirsIn = (path) => readdirSync(at(path)).filter((e) => statSync(at(path, e)).isDirectory()).sort();

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
    scripts: Object.entries(manifest.scripts).map(([name, command]) => `${name} = ${command}`),
    dependencies: Object.keys(manifest.dependencies),
    devDependencies: Object.keys(manifest.devDependencies),
  };
}

/** The example apps, described by their own manifests. This site is not one of them: it has no manifest, and its page is its own. */
function apps() {
  return dirsIn("apps")
    .filter((dir) => existsSync(at("apps", dir, "package.json")))
    .map((dir) => {
      const json = JSON.parse(readFileSync(at("apps", dir, "package.json"), "utf8"));
      return { dir, name: json.name ?? dir, description: json.description ?? "" };
    })
    .filter((app) => app.description && !["spike", "promo"].includes(app.dir));
}

/**
 * THE RECIPES, read off their files: docs/site/recipes/recipes.json names
 * them and the prompt, and each one's app.json and seed.json are what an
 * agent wrote. What `graview check --document` prints about each is run
 * here, from the built CLI, so the page quotes the checker rather than
 * paraphrasing it.
 */
function recipes() {
  const index = JSON.parse(readFileSync(at("docs/site/recipes/recipes.json"), "utf8"));
  return index.recipes.map((entry) => {
    const file = at("docs/site/recipes", entry.slug, "app.json");
    const source = readFileSync(file, "utf8");
    const document = JSON.parse(source);
    const seed = JSON.parse(readFileSync(at("docs/site/recipes", entry.slug, "seed.json"), "utf8"));
    const counts = {};
    for (const node of seed.nodes ?? []) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
    let check;
    try {
      check = execFileSync(process.execPath, [at("packages/graview/dist/cli.js"), "check", "--document", file], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      throw new Error(`docs/site/recipes/${entry.slug}/app.json does not pass graview check:\n${error.stdout ?? ""}${error.stderr ?? ""}`);
    }
    return {
      slug: entry.slug,
      title: entry.title,
      task: entry.task,
      blurb: entry.blurb,
      prompt: index.prompt.replace("{task}", entry.task),
      name: document.name,
      summary: document.description,
      document: source,
      counts: Object.entries(counts).map(([kind, count]) => `${kind}=${count}`),
      records: (seed.nodes ?? []).length,
      relations: (seed.edges ?? []).length,
      check: check.trim().split("\n").filter(Boolean),
    };
  });
}

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
      depends: Object.keys({ ...json.dependencies, ...json.peerDependencies }),
      /* A README opens with the package's name, which is already the h1 of
         the page it lands on. Two of them reads as a mistake, so the first
         heading goes when it says the same thing. */
      readme: existsSync(readme)
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

/** The checker's source: `check.ts` and the families it asks, in `check/`, and the roles and facts it judges with a document's checked compile. */
function checkerSource() {
  const dir = at("packages/core/src/cli/check");
  return [
    readFileSync(at("packages/core/src/cli/check.ts"), "utf8"),
    ...readdirSync(dir).map((name) => readFileSync(at("packages/core/src/cli/check", name), "utf8")),
    readFileSync(at("packages/core/src/document/facts-and-roles.ts"), "utf8"),
  ].join("\n");
}

/**
 * Every finding the checker can produce, with how loudly it says it. Read
 * out of the source, because a list of error codes maintained by hand is a
 * list of the error codes that existed once.
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
  const doctor = /export const DOCTOR_USAGE = `([\s\S]*?)\n`;/
    .exec(readFileSync(at("packages/core/src/cli/doctor.ts"), "utf8"))?.[1] ?? "";
  /* Which package answers each: the core help's commands are core's, serve's is ship's, skills' is skills'. */
  const parts = [
    [body.replace("${CREATE_USAGE}", create).replace("${DOCTOR_USAGE}", doctor), "core"],
    [serve, "ship"],
  ];

  /* Each command starts at its own `graview <name>` line, two spaces in. */
  const out = [];
  for (const [text, home] of parts) {
    let current = null;
    for (const line of text.replace(/\\`/g, "`").split("\n")) {
      const start = /^ {2}graview ([a-z]+)\b/.exec(line);
      if (start) {
        if (current) out.push(current);
        current = { name: start[1], home, usage: [line.trim()], blurb: [], table: [], flags: false };
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
  }
  /*
   * `skills` prints three one-line forms rather than a usage and a blurb,
   * and lives in its own package; it is read from there and shaped here.
   */
  const skillsUsage = /export const SKILLS_USAGE = `([\s\S]*?)\n`;/
    .exec(readFileSync(at("packages/skills/src/cli.ts"), "utf8"))?.[1] ?? "";
  out.push({
    name: "skills",
    home: "skills",
    usage: skillsUsage.split("\n").map((line) => line.trim()),
    blurb: ["Copies the authoring skills into `.claude/skills` and `.agents/skills`, where Claude Code and Codex look for them; `list` says what ships and `path` says where the files live. `graview create` runs the install for you."],
    table: [],
  });
  return out
    .map((c) => ({
      name: c.name,
      home: c.home,
      usage: [...c.usage, ...(c.table.length ? ["", ...c.table] : [])].join("\n"),
      blurb: c.blurb.join(" "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * THE CONCEPTS. Everything else here is read out of the repository; a
 * concept is not in the repository — it is the reason the repository is
 * shaped the way it is, and nothing can generate that. So they are written
 * here, once, as records, each related to the skill that teaches it.
 */
const CONCEPTS = [
  ["The declaration", "graview-new-app",
    "One object — `defineApp` — carrying the schema, the mutations, the invariants, the policy, the brand, the lenses and the intelligence. It has no React in it, which is what lets a build, a CLI and a model all read it."],
  ["Kinds and edges", "graview-node-kind",
    "A kind is a thing your domain has; an edge is how two of them relate, and it carries how it READS from each end. Declaring a kind gets you a district, a card at three fidelities, a hue, an accessible label and a place in every agent tool — before anything is drawn."],
  ["Acts", "graview-node-kind",
    "Every change is a named, typed mutation. It is the button in the interface, the tool in the model's schema and the line in the log, and it says what it `creates`, `connects` and `severs` so the surfaces can derive themselves from it."],
  ["Rules that repair", "graview-invariant",
    "An invariant names the mutations that fix what it finds. That is the difference between a validation error and a problem with a way out — the interface can offer the repair because the rule said what it was."],
  ["Lenses", "graview-lens",
    "A lens places nodes by a rule the domain supplies — a time, two sets, a coordinate, an outline. It binds ROLES rather than field names, so a lens written for your domain works unchanged in somebody else's, and a test in a second domain is how that claim is kept."],
  ["Who may do what", "graview-permissions",
    "One policy, declared once. The strip, the routed pages and the agent's tools all narrow from it, and an act a seat may not take is struck through with the sentence saying who can — never a button that silently fails."],
  ["The seat for a model", "graview-agent-seat",
    "An intelligence provider declares what a model may do and how words and pictures reach it. Its turns land in the same log with an author and an intent, and come back out through the same undo."],
];

/** The chapters of the long version, read off its hand-designed page, which `site-progression.mjs` writes them into. */
function chapters(html) {
  return [...html.matchAll(/<article class="chapter[^"]*" id="chapter-(\d+)"[\s\S]*?<h2 id="h-chapter-\d+">([\s\S]*?)<\/h2>[\s\S]*?<p class="chapter-claim">([\s\S]*?)<\/p>[\s\S]*?<div class="chapter-adds">[\s\S]*?<ul>([\s\S]*?)<\/ul>/g)].map(([, n, title, claim, adds]) => ({
    number: Number(n),
    title: decodeHtml(title),
    claim: decodeHtml(claim),
    adds: [...adds.matchAll(/<code>([\s\S]*?)<\/code>/g)].map(([, add]) => decodeHtml(add)),
  }));
}
const decodeHtml = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/**
 * The releases, as the releases page says them: the records in
 * apps/site/releases.json, written with each Version packages pull request
 * (a test fails while a version in @graview/core's changelog has none), and
 * which of them the packages are at now.
 */
function releases() {
  const current = JSON.parse(readFileSync(at("packages/graview/package.json"), "utf8")).version;
  return JSON.parse(readFileSync(at("apps/site/releases.json"), "utf8")).releases.map((release) => ({ ...release, current: release.version === current }));
}

/* ── the records ──────────────────────────────────────────────────────── */

const readHand = (name) => readFileSync(at(HAND, name), "utf8");

/**
 * THE SITE'S RECORDS: what the repository says, as the declaration's kinds,
 * and a page record for every address the site serves, related to what it
 * is about and filed under the page it sits under. The order of the nodes
 * and the edges is the order a page lists them in.
 */
export async function siteRecords() {
  const nodes = [];
  const edges = [];
  const node = (kind, key, fields) => {
    const id = `${kind}:${key}`;
    nodes.push({ id, kind, ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== "")) });
    return id;
  };
  const edge = (kind, from, to) => edges.push({ id: `${kind}:${from}->${to}`, kind, from, to });

  const pkgs = packages();
  const byName = new Map(pkgs.map((p) => [p.name, `package:${p.dir}`]));
  for (const pkg of pkgs) {
    const id = node("package", pkg.dir, { name: pkg.name, dir: pkg.dir, description: pkg.description, version: pkg.version, readme: pkg.readme, api: pkg.api });
    pkg.exports.forEach((subpath, position) => {
      const entry = node("entry", `${pkg.name}${subpath.slice(1)}`, { specifier: `${pkg.name}${subpath.slice(1)}`, subpath, position });
      edge("exports", id, entry);
    });
  }
  for (const pkg of pkgs) for (const dep of pkg.depends) if (byName.has(dep)) edge("dependsOn", `package:${pkg.dir}`, byName.get(dep));

  const sks = skills();
  for (const skill of sks) node("skill", skill.dir, { name: skill.name, dir: skill.dir, description: skill.description, body: skill.body });
  for (const finding of findings()) node("check", finding.code, finding);
  for (const command of commands()) {
    const id = node("command", command.name, { name: command.name, usage: command.usage, blurb: command.blurb });
    edge("livesIn", id, `package:${command.home}`);
  }
  CONCEPTS.forEach(([title, skill, says], position) => edge("taughtBy", node("concept", title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), { title, says, position }), `skill:${skill}`));
  const rcps = recipes();
  rcps.forEach((recipe, position) => node("recipe", recipe.slug, { ...recipe, position }));
  for (const chapter of chapters(readHand("progression.html"))) node("chapter", String(chapter.number), chapter);
  for (const app of apps()) node("example", app.dir, { dir: app.dir, description: app.description });
  const landing = readHand("index.html");
  faqs(landing).forEach(({ question, answer }, position) => node("question", String(position + 1), { question, answer: inlineMd(answer, `${SITE}/`), position }));
  for (const release of releases()) node("release", release.version, release);
  const made = await scaffolded();
  const scaffold = node("scaffold", "graview-create", { name: "What graview create writes", ...made });

  /* The pages, an address each. */
  const page = (path, fields, about, under) => {
    const id = node("page", path, { path, format: path.endsWith(".html") ? "html" : path.endsWith(".xml") ? "xml" : path.endsWith(".md") ? "markdown" : "text", ...fields });
    if (about) edge("about", id, about);
    if (under) edge("under", id, `page:${under}`);
    return id;
  };
  const hand = (path, design, title, under) => page(path, { title, description: metaOf(readHand(path), "description"), design, template: `${HAND}/${path}` }, undefined, under);
  const docs = (path, design, title, description, fields = {}, about, under = "docs/index.html") =>
    page(`docs/${path}`, { title, description, design, twin: `docs/${path.replace(/\.html$/, ".md")}`, rail: fields.rail ?? path, ...fields }, about, under);

  hand("index.html", "landing", "Graview");
  hand("tour.html", "tour", "The tour", "index.html");
  hand("progression.html", "progression", "The garden, grown", "index.html");
  hand("404.html", "missing", "Not here");
  docs("index.html", "docs-home", "Documentation", "Graview's documentation: the concepts, the packages, the skills, the CLI and everything the checker can say.", {}, undefined, "index.html");
  docs("getting-started.html", "getting-started", "Getting started", "From nothing to a running product on Graview, and the loop from there: declare, check, look, declare more.", {}, scaffold);
  docs("recipes.html", "recipes", "Recipes", "Graview recipes: one prompt to hand an agent, with a different task each, and the app it made, checked on every push and live on its page.");
  for (const recipe of rcps) docs(`recipes/${recipe.slug}.html`, "recipe", recipe.title, `A Graview recipe: ${recipe.blurb}`, { rail: "recipes.html" }, `recipe:${recipe.slug}`, "docs/recipes.html");
  docs("concepts.html", "concepts", "Concepts", "The ideas behind a Graview app: one declaration, and the seven things in it — kinds and edges, acts, rules that repair, lenses, who may do what, and the seat for a model.");
  docs("packages.html", "packages", "Packages", `The ${pkgs.length} packages Graview ships, what each is for, and what each exports.`);
  for (const pkg of pkgs) docs(`packages/${pkg.dir}.html`, "package", pkg.name, pkg.description, { rail: "packages.html" }, `package:${pkg.dir}`, "docs/packages.html");
  docs("cli.html", "cli", "The CLI", "graview create, check, types, docs, describe, lens, figure, serve and skills — what each reads and what each says.");
  docs("agents.html", "agents", "Working with a model", "The declaration is the interface a person uses and the interface a model uses. What a model gets, how it is narrowed, and what it reads before it writes.");
  docs("skills.html", "skills", "Skills", `The ${sks.length} skills that teach an assistant the authoring moves, each ending in a real check.`);
  for (const skill of sks) docs(`skills/${skill.dir}.html`, "skill", skill.name, skill.description, { rail: "skills.html" }, `skill:${skill.dir}`, "docs/skills.html");
  docs("checks.html", "checks", "What check says", `Every one of the ${findings().length} things graview check can tell you, and how loudly.`);
  docs("demos.html", "demos", "Live demos", "The example garden's surfaces, running on this page, and the example apps in the repository.");
  docs("stability.html", "stability", "Stability", "What a Graview version may change on the five surfaces a host holds it to — ops, stored formats, the wire, the declaration and the tool names — and how a host reads what a build ships.", { body: readFileSync(at("docs/stability.md"), "utf8") });
  docs("releases.html", "releases", "Releases", "What came in each Graview version, newest first: a few plain lines each, what a host must know before upgrading, and links to its release and its full changelog.");
  docs("site.html", "site", "This site, as an app", "graview.dev is itself a Graview app: one declaration and the records written out of the repository, every page rendered from a record by renderPlace, and the whole of it live on this page.");
  page("start.md", { title: "Start here, agent", description: "The procedure the prompt on the front page points an agent at: scaffold, read, declare, check, preview, report back.", design: "start", body: readHand("start.md") }, undefined, "index.html");
  page("llms.txt", { title: "llms.txt", description: "What Graview is, and every docs page as its Markdown twin, for a language model.", design: "llms" }, undefined, "index.html");
  page("llms-full.txt", { title: "llms-full.txt", description: "Every docs page in full, as Markdown, in one file.", design: "llms-full" }, undefined, "index.html");
  page("robots.txt", { title: "robots.txt", description: "What every crawler may read: everything.", design: "robots" }, undefined, "index.html");
  page("sitemap.xml", { title: "The sitemap", description: "Every page, at its own address, with the day it last changed.", design: "sitemap" }, undefined, "index.html");

  return { nodes, edges };
}

/* ── rendering them ───────────────────────────────────────────────────── */

/**
 * EVERY ADDRESS, RENDERED FROM ITS RECORD. The declaration compiles with
 * the checker's own compiler, the records load into a store, and each page
 * record goes through `renderPlace` with the site's design — as an
 * anonymous reader, which is who reads graview.dev. A docs page's Markdown
 * twin is the same record in the twin's design.
 */
export async function renderSite() {
  const { compileDocument } = await import(pathToFileURL(at("packages/core/dist/check.js")).href);
  const { Store } = await import(pathToFileURL(at("packages/core/dist/index.js")).href);
  const { renderPlace } = await import(pathToFileURL(at("packages/pages/dist/static.js")).href);
  const source = readFileSync(at(DECLARATION), "utf8");
  const declaration = JSON.parse(source);
  const compiled = compileDocument(declaration);
  if (!compiled.ok) throw new Error(`${DECLARATION} does not compile: ${compiled.findings.map((f) => f.message).join("; ")}`);
  const snapshot = await siteRecords();
  const app = compiled.app;
  const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot });
  /* The page about this site carries the declaration and the records, so it opens live: JSON nothing in which can close the element it sits in. */
  const json = (id, value) => `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>\n`;
  const design = siteDesign({
    template: (path) => readFileSync(at(path), "utf8"),
    served: (path) => (existsSync(resolve(OUT, path)) ? readFileSync(resolve(OUT, path), "utf8") : ""),
    today: new Date().toISOString().slice(0, 10),
    declaration,
    data: () => json("site-app", declaration) + json("site-records", snapshot),
  });
  const files = new Map();
  const served = new Map();
  for (const page of snapshot.nodes.filter((n) => n.kind === "page")) {
    const rendered = renderPlace(store, app, page.id, { design: design.page });
    if (!rendered.found) throw new Error(`${page.path} has a record nobody can see`);
    files.set(page.path, rendered.html);
    served.set(page.path, page.id);
    if (page.twin) {
      files.set(page.twin, renderPlace(store, app, page.id, { design: design.twin }).html);
      served.set(page.twin, page.id);
    }
  }
  return { files, served, snapshot, store, app };
}

/* ── writing it out ───────────────────────────────────────────────────── */

const main = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const checking = process.argv.includes("--check");
  const { files, snapshot } = await renderSite();
  let stale = 0;
  for (const [name, text] of files) {
    const path = resolve(OUT, name);
    const now = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (now === text) continue;
    if (checking) {
      process.stderr.write(`docs/site/${name} is out of date — run \`pnpm site:docs\`.\n`);
      stale += 1;
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
  }
  if (checking) {
    if (stale > 0) process.exit(1);
    process.stdout.write(`every one of the ${files.size} addresses rendered from the site's ${snapshot.nodes.length} records is current\n`);
  } else {
    process.stdout.write(`wrote ${files.size} addresses from ${snapshot.nodes.length} records of ${DECLARATION}: the pages, their Markdown twins, start.md, llms.txt, llms-full.txt, robots.txt and the sitemap\n`);
  }
}
