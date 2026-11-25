#!/usr/bin/env node
/**
 * Every browser harness, one verdict.
 *
 * `pnpm test` is green whatever the harnesses say, and each of them is its
 * own command that somebody has to know to run. That is how three of them
 * came to be failing on main with nobody being told: `verify-menu` waited
 * for a control the design had removed, and two audit states waited for
 * elements nothing produced, and all of it sat in `docs/*.json` where a
 * report recorded its own errors as though they were the weather.
 *
 * So: one command, one exit code, and a line per harness saying what it
 * cost and whether it holds.
 *
 *   node scripts/verify-all.mjs              every harness (on main, a batch or CI; on a branch, --changed)
 *   node scripts/verify-all.mjs --all        every harness, wherever it runs
 *   node scripts/verify-all.mjs --changed    the harnesses this branch's change can reach, and a smoke set (lib/changed.mjs)
 *   node scripts/verify-all.mjs --changed --dry-run   which those are, and why, without running them
 *   node scripts/verify-all.mjs menu pages   only these
 *   node scripts/verify-all.mjs --list       the names, and nothing else
 *   node scripts/verify-all.mjs --except=shrunk   every harness but these
 *   node scripts/verify-all.mjs --failed     only what failed last time
 *   node scripts/verify-all.mjs --quick      fewer widths where a harness sweeps them (iteration)
 *   node scripts/verify-all.mjs --jobs=4     this many workers (default: one a core, at most sixteen; GRAVIEW_VERIFY_JOBS)
 *   node scripts/verify-all.mjs --serial     one at a time, as Nightly and verify.yml run a shard
 *   node scripts/verify-all.mjs --strict     one look: a harness that fails is not run again alone (lib/second-look.mjs)
 *
 * Side by side, each worker on a block of ports of its own (lib/pool.mjs):
 * the harnesses drive dev servers, and a worker's harnesses drive only its
 * own, which it starts once and keeps warm for the run. The harnesses that
 * time something never run two at once. Each harness's wall time, CPU,
 * server start-up and fixed waits are kept in its verdict and in
 * docs/watch/last-run.json (lib/timing.mjs), and what it read in
 * docs/watch/coverage.json (lib/coverage.mjs), which `--changed` reads.
 *
 * Every line is written with `writeSync` rather than `process.stdout.write`.
 * Node block-buffers stdout when it is not a terminal, so piped to a file or
 * read by a watching process this printed nothing at all for twenty minutes
 * and then everything at once — which is the failure this command exists to
 * fix, reproduced by the command itself.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles, currentBranch, forkPoint, headSha, mentionsIn, movedBetween, selectHarnesses } from "./lib/changed.mjs";
import { COVERAGE_ENV, COVERAGE_NO_FS_ENV, mergeCoverage, readCoverage, readRecorded, withHook, withoutHook, writeCoverage } from "./lib/coverage.mjs";
import { updateLedger } from "./lib/ledger.mjs";
import { ownedBy, writtenSince } from "./lib/on-github.mjs";
import { allUnits, missedByTheWhole, PART_ENV, partOf, partPath, PARTS, splitUnit, unitsOf, writeMerged } from "./lib/parts.mjs";
import { claimBlocks, defaultJobs, lockBlock, longestFirst, POOL_BASES, runPool } from "./lib/pool.mjs";
import { judge, keepFirstLook, missedClaims, recordFlakes } from "./lib/second-look.mjs";
import { described, holders, listeners, serving } from "./lib/serve.mjs";
import { cpuOf, readTimingLines, stampVerdicts, summarizeTiming, TIMING_ENV } from "./lib/timing.mjs";
import { watchFile } from "./lib/watch.mjs";
import { namedPorts, PORT_FLOOR, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Straight to the descriptor, so a watcher sees each line as it happens. */
const say = (text) => writeSync(1, text);

/**
 * The chain, cheapest first, so a broken build says so in seconds rather
 * than after ten minutes of screenshots.
 */
const CHAIN = [
  // First: the watch that judges every other harness's screens, made to fire.
  ["watch", "verify-watch.mjs"],
  // No browser: what Cloud's hosted page carries before the app draws, from esbuild's metafile (FR-57).
  ["hosted", "verify-hosted-page.mjs"],
  // A place drawn for an e-ink reader, as a host photographs it: it fits or goes onto pages, every pixel gray, each press its element's box, the same picture however soon it is taken, nothing fetched (Roadmap f-eink-display-profile, f-render-tap-map).
  ["device", "verify-device.mjs"],
  // Guest views, hostile, in a frame (three engines) and in a worker inside Claude's and ChatGPT's widgets (FR-04, FR-68–FR-71).
  ["guest", "guest-sandbox.mjs"],
  ["site", "verify-site.mjs"],
  // axe-core over the framework's markup as Cloud hosts it and over every example, on both faces, at a desk and a phone, light and dark.
  ["a11y", "verify-a11y.mjs"],
  // What a screen reader is told at each stop — the bar, the switch, a list, a record, columns, blocks, a form, the quick ask, another tab's change — read from the tree Chromium and WebKit expose, written as a walk.
  ["screen-reader", "verify-screen-reader.mjs"],
  // The awkward example in every face, width, scheme and seat — long, so it starts early.
  ["gauntlet", "verify-gauntlet.mjs"],
  ["lines", "verify-lines.mjs"],
  ["shrunk", "verify-shrunk.mjs"],
  ["navigation", "verify-navigation.mjs"],
  // A kind with no picture of its own opens to its stop: what it is, what is going on, its first act, a board or a table its data chooses — every example, a desk and a phone, light and dark.
  ["kind-stop", "verify-kind-stop.mjs"],
  ["menu", "verify-menu.mjs"],
  // Make this section better: a right-click inside a worker view names the menu for its section and outlines it; Just do it, Describe changes and Highlight area revise that section alone into a draft in place, judged first — a revision that drops styles handed back once, or refused — kept through the host's view door with one Undo, and offered to nobody who may not change views.
  ["section", "verify-section.mjs"],
  // Make any page better: a right-click anywhere on a built-in page — a row, the heading, a task's page, the home — offers "Make “Tasks” better"; words about the look typed in the menu go there and record words to the quick ask; the view spec is tried first, drawn as a draft and kept as one change with one Undo; what it cannot say is offered as the page's own view, kept with the built-in page under Also as; and nobody who may not change the app is offered it.
  ["page-better", "verify-page-better.mjs"],
  // The scene's menu on a place and in a list's column: a right-click between a list's tasks is about that list and offers its acts; on the place itself Better UI is offered and opens on the place's page, and the empty menu never says the app declares nothing; and the menu opens at the pointer, inside the window, on a card, the ground and a task on the place's page, in three engines.
  ["scene-menu", "verify-scene-menu.mjs"],
  // The inline AI: suggestions from the catalog in the context menu, a ghost accepted in part as one batch with its undo, a panel kept as a lens, each interaction once in Activity and on its record's page, a host's stored entries, and nothing of it with AI off — on both faces.
  ["inline-ai", "verify-inline-ai.mjs"],
  // Notify me in two presses: from a right-click on a record in the scene, a kind's list and an act on the routed face, listed in Activity with one press to stop, somebody else's change told once and the reader's own not, and offered after an act's form.
  ["notify", "verify-notify.mjs"],
  // The quick ask, in place of the Ask box: ⌘K's bar beside what is selected completes acts, places, records and "Show …"; words asked are answered on a card beside the record or list, a change a ghost accepted as one batch, a follow-up on the card; and with AI off none of it — on both faces, in three engines.
  ["quick-ask", "verify-quick-ask.mjs"],
  // What people tell Graview: each telling kept with what it did and how it ended, 👍 and 👎 on the card with "What should it have done?", the Studio's list an owner excludes from, what worked before suggested in the menu and still previewed, another person's only once two agree, and never one about a record the viewer cannot see (Roadmap f-menu-learns).
  ["told", "verify-told.mjs"],
  ["seat", "verify-seat.mjs"],
  ["who", "verify-who.mjs"],
  ["calendar", "verify-calendar.mjs"],
  ["desk", "verify-desk.mjs"],
  ["rota", "verify-rota.mjs"],
  ["studio", "verify-studio.mjs"],
  // The embed's chrome as one family: every popover over everything, the host's actions, the picture its whole width with no Ask box and the quick ask left out, the host's notices (FR-72, FR-75–FR-78).
  ["chrome", "verify-chrome.mjs"],
  // A part of the page missed while offline arrives when the network is back, in three engines, and never breaks the page (FR-139).
  ["offline", "verify-offline.mjs"],
  // Fewer pills and no name cut off, on Cloud's two apps, in three engines (FR-113, FR-117, FR-118).
  ["quiet", "verify-chrome-quiet.mjs"],
  // The whole brand from the document — logo, faces, shape, scheme, icon, the line under the name — on both faces, in three engines (FR-124, FR-125).
  ["brand", "verify-brand.mjs"],
  // A document's declared lenses drawn as places on both faces, and its arrangement honored, with no view of the host's (FR-79, FR-80).
  ["declared", "verify-declared.mjs"],
  // A document and a seed looked at with no product: `graview preview` draws both faces over the served store, `graview shots` photographs named places.
  ["preview", "verify-preview.mjs"],
  // The architecture recipe's product face, run as its page says: PagesApp with its own shell, home, route and record page over openRemote to a graview preview, through a Vite proxy that rewrites Origin for /graview, live both ways.
  ["face-recipe", "verify-face-recipe.mjs"],
  // A date and a date and time typed as people say them ("tomorrow 3pm") or picked from a month by keyboard, the zone said, an end that moves with its start, on both faces and a phone (Roadmap f-date-inputs).
  ["date-inputs", "verify-date-inputs.mjs"],
  // A selected record drawn once, its relations said in their words, a district's name in its box, on a document shaped like Cloud's workshop, in three engines (FR-141–FR-143).
  ["drawn-once", "verify-drawn-once.mjs"],
  // The page says when a place has drawn and settled: after a late font, a worker view's late image and a view that fails, nothing moving after it, off on a move and back as the next place settles (FR-188); and a view proposed and not kept, pictured where it attaches, marked, and kept nowhere (FR-187).
  ["drawn", "verify-drawn.mjs"],
  // A record's long text keeps its paragraphs and lists, spans the record under its label, is edited in a text area, and its facts follow the declared or the page's order, in three engines (FR-146–FR-148).
  ["long-text", "verify-long-text.mjs"],
  // Two seats type into one long brief at once with real keystrokes: the body opens live with no Save, both pages and the store converge, each draws the other's caret where they stand, and a caret stays on its word; a slowed page and one that drops offline mid-run converge, each person's ⌘Z takes back only their run, a composed word lands whole, a seat that may not see the body is served none of it, and a reader of op format 2 folds whole values to the same text (Roadmap f-collab-text).
  ["typed-together", "verify-typed-together.mjs"],
  // A roadmap grown large: status chips with counts, a Filter that opens short and finds a record by typing, whole badges, cards read at a glance, at a desk and a phone, in three engines.
  ["growing", "verify-growing.mjs"],
  // A picture or a document put on a record from the page — picked, pasted, a PDF inline, full size, refused in words, taken back — on both faces, in three engines (FR-162, FR-163).
  ["files", "verify-files.mjs"],
  // The app as it was: from a row of Activity, a timeline with a tick per change, scrubbed from the start to now on the scene and the routed face, each stop exactly as `store.at` says, nothing to change in the past (Roadmap f-playback).
  ["playback", "verify-playback.mjs"],
  // A record that links another app drawn as the app its host names, refused as no access, plainly without a resolver, on both faces at desk width, in three engines (FR-171).
  ["app-links", "verify-app-links.mjs"],
  // A date that repeats: the calendar draws each occurrence of a weekly practice, marked, the kind's stop counts and says the next one, and the record changes how it repeats in words, in three engines.
  ["repeats", "verify-repeats.mjs"],
  // An app's workflows on the scene's map: each in the street beside the district it writes, wired to what it reads and writes, a paused one dimmed and said, its last run in words, in three engines (Roadmap f-jobs-declared).
  ["workflows", "verify-workflows.mjs"],
  // A phone drawn as a tel: link grouped for its reader, a place as a link to the reader's maps app, a duration said "1 h 30 min", typed as words and summed, on both faces at desk width, in three engines.
  ["field-types", "verify-field-types.mjs"],
  // A blank fact an act the seat may run writes is an empty slot on the record's page — "Add allocation", reached by the keyboard, filled by the same editor — while a blank no act writes stays unsaid and a reader is offered none, in three engines.
  ["blank-facts", "verify-blank-facts.mjs"],
  // A record's facts, each by its type: a yes or no a switch taken back with Undo, an empty date picked and a note added where they stand, a choice's options, the list a task is on a chip with its own picker, the heading renamed, a refusal said beside its field, What can be done holding no act a fact already does, labels beside values at a desk and above them on a phone, light and dark, in three engines (Roadmap f-facts-by-type).
  ["facts", "verify-facts.mjs"],
  // A host whose page is the app hands the routed face the address bar, in three engines; an article's embed never touches it (FR-106).
  ["address", "verify-address.mjs"],
  // An app fills the phone after it turns, at the screen's height on both faces and in the Shell, in Chromium and WebKit (FR-165).
  ["viewport", "verify-viewport.mjs"],
  // Going into a district on a phone reads clean: the bar names where you are, the records before the tools, every record reachable, no author's words to a reader, nothing over the card — every district of three examples, on a Pixel and an iPhone.
  ["drive-in", "verify-drive-in.mjs"],
  // The scene under a finger and a mouse, on the discography's thousand songs: a tap chooses and never pans, a drag never chooses, a pinch and a wheel zoom under the hand, a double-tap goes in, a quick second tap lands where it was aimed, a list scrolls without moving its card, the page behind never scrolls, and the frames keep up at a quarter speed — on a phone and a desk, in Chromium and WebKit.
  ["scene-hands", "verify-scene-hands.mjs"],
  // Pages and the Scene as one face: no switch, one control at the foot that says the level, the same page moving from Page to Nearby to the City with its lines exact and no overshoot, every view standing in the city clear of the districts and their names, anything chosen there landing Nearby, the bar usable at every level, the history rising and falling, and a duplicate view found.
  ["one-face", "verify-one-face.mjs"],
  // The one face mounted whole through the embed, as Graview Cloud mounts it: its bar in the one face's slot, seen and pressed at Page, Nearby and City, at a desk and on a phone; the window scrolls the page; 1, 2, 3, [ and ] move the levels (FR-239).
  ["embed-one-face", "verify-embed-one-face.mjs"],
  // A view drawn where the page cannot read has its lines to the city: a worker view's cards and a frame guest's rows each a line within 2 px of its box at Nearby, kept on them every frame as the page or the frame scrolls, a record page drawn by a view that names no record still its one line, and Connected not repeating what a frame shows.
  ["frame-lines", "verify-frame-lines.mjs"],
  // The studio's whole path, on a scratch copy of seedbed: said, rewritten, written, compiled, migrated.
  ["rehearsal", "rehearse-studio.mjs"],
  ["remember", "verify-remember.mjs"],
  ["pages", "verify-pages.mjs"],
  // Whether a person can do each app's core jobs on both faces, and what it costs; fails only on a regression.
  ["journeys", "verify-journeys.mjs"],
  ["panning", "verify-panning.mjs"],
  // How long a person waits: Cloud's shell over the Roadmap's size and a small team's tasks, cold and between pages, at a desk and on a slow phone.
  ["first-load", "verify-first-load.mjs"],
  // A real catalog, built for production: what a person can read, at sixty frames a second.
  ["scale", "verify-scale.mjs"],
  // A thousand records under a hand: no React state while a drag moves, the grid moving with the picture, and what letting go costs, held to a reference.
  ["scene-at-scale", "verify-scene-at-scale.mjs"],
  // The GPU path by default and the DOM path without it, held against each other: one tree, one picture, the blur within budget, and silence where there is no GPU.
  ["renderer", "verify-renderer.mjs"],
  // The example built to be awkward, driven into every face, width, scheme and seat it has.
  ["survey", "survey-ui.mjs"],
  ["audit", "audit-ui.mjs"],
  /*
   * Last, because it packs every package and installs a project three ways:
   * what a stranger gets from `graview create`. It sat outside this chain,
   * and a scaffold that failed its own checker went unheard for a week.
   */
  ["create", "smoke-create.mjs"],
];

/*
 * TIMING: the harnesses that time frames or a time-to-live against a
 * budget — frames a second, a first load, a presence that lapses. They ran
 * after everything else, one at a time, with the ones that only wait for a
 * picture to settle (lines, one-face, embed-one-face, frame-lines) and the
 * ones that load the machine (journeys, create) beside them: a line of
 * thirteen that was an hour of the 0.1.74 batch's hour and a half. Now the
 * ones that wait for a settle run with everything else, as their waits are
 * for the picture to rest and not a fixed beat; and the seven that time
 * against a budget (scene-hands holds its frames at a quarter of the CPU)
 * run in the pool too, never two at once. One that fails
 * beside the others is looked at again alone (lib/second-look.mjs) before
 * it fails the run.
 */
const TIMING = new Set(["panning", "first-load", "scale", "scene-at-scale", "scene-hands", "renderer", "who"]);

/** Where the last run's verdicts are kept, for `--failed`. */
const LAST_RUN = resolve(repoRoot, "docs/watch/last-run.json");
/** What each harness took the last time it ran, whole and quick, kept so the next run starts the longest first. */
const TIMES = resolve(repoRoot, "docs/watch/times.json");

/*
 * AN APP OF ONE'S OWN. A walk builds its app beside the framework
 * (`../walk7`), and the kick-off says to run the journeys "with the app
 * named" — but every name here was a harness, so the walk's own app could
 * not be named at all. An argument that is a path is an app, handed to the
 * harnesses that drive one they are told about (TAKES_AN_APP).
 */
const isPath = (arg) => arg.includes("/") || arg.startsWith(".");
const TAKES_AN_APP = new Set(["journeys"]);
const argv = process.argv.slice(2);
const appPaths = argv.filter((arg) => !arg.startsWith("-") && isPath(arg)).map((arg) => resolve(arg));
const asked = argv.filter((arg) => !arg.startsWith("-") && !isPath(arg));
if (argv.includes("--list")) {
  say(`${CHAIN.map(([name]) => name).join("\n")}\n`);
  process.exit(0);
}
/*
 * `--except=shrunk,scale` leaves those out: the nightly runner has no Chrome
 * Canary for the GPU capture path, and says so here rather than failing it.
 */
const except = (argv.find((arg) => arg.startsWith("--except="))?.slice("--except=".length) ?? "").split(",").filter(Boolean);
// A harness by name, or one part of one run in parts (lib/parts.mjs: `quiet.webkit`).
const KNOWN = allUnits(CHAIN.map(([name]) => name));
const unknown = [...asked, ...except].filter((name) => !KNOWN.includes(name));
if (unknown.length > 0) {
  say(`No harness called ${unknown.join(", ")}. Known: ${KNOWN.join(", ")}\n`);
  process.exit(2);
}
/*
 * `--failed`: what failed last time, and nothing else. Iterating on a fix
 * reran the whole chain — twenty-three minutes — to learn whether the two
 * harnesses that had failed now held.
 */
const lastFailed = argv.includes("--failed") && existsSync(LAST_RUN)
  ? JSON.parse(readFileSync(LAST_RUN, "utf8")).results.filter((one) => one.code !== 0).map((one) => one.name)
  : null;
/*
 * `--changed`: only the harnesses this branch's change can reach, by what
 * each read the last time it ran (lib/changed.mjs, docs/watch/coverage.json),
 * and the smoke set. It is what `pnpm verify` with no names does on a
 * branch; `--all` runs every harness there, and on main or a batch, and on
 * a CI runner, no names is every harness, as it was.
 */
const branch = currentBranch(repoRoot);
const changedAsked = argv.includes("--changed") || (asked.length === 0 && !lastFailed && !argv.includes("--all") && !process.env.CI && branch !== null && branch !== "main" && !branch.startsWith("batch/"));
let selection = null;
if (changedAsked && asked.length === 0 && !lastFailed) {
  const from = forkPoint(repoRoot);
  if (from === null) {
    say("note  no merge base with origin/main or main, so every harness runs\n");
  } else {
    const changes = changedFiles(repoRoot, from);
    selection = selectHarnesses(changes, { chain: CHAIN.map(([name]) => name), movedSince: movedBetween(repoRoot, from), mentions: mentionsIn(repoRoot) });
    selection.from = from;
    selection.changes = changes.length;
  }
}
/*
 * WHAT RUNS: units, each a harness or a part of one, in the chain's order.
 * A harness run in parts (lib/parts.mjs) is each of its parts, side by side.
 */
const inChainOrder = (wanted) => {
  const order = KNOWN.filter((unit) => wanted.includes(unit));
  return order;
};
const quickRun = argv.includes("--quick");
const units = inChainOrder(
  // An app of one's own is one run of it: the parts are of the checkout's apps (lib/parts.mjs).
  (asked.length > 0 ? asked : lastFailed ? lastFailed.filter((unit) => KNOWN.includes(unit)) : selection ? selection.names : CHAIN.map(([name]) => name)).flatMap((unit) => (appPaths.length > 0 && TAKES_AN_APP.has(unit) ? [unit] : unitsOf([unit]))),
)
  .filter((unit) => !except.includes(unit) && !except.includes(splitUnit(unit).name))
  // --quick is Chromium alone where a harness sweeps engines: so are its parts, unless a part was named.
  .filter((unit) => !quickRun || asked.includes(unit) || !splitUnit(unit).part || (partOf(splitUnit(unit).name, splitUnit(unit).part)?.engine ?? "chromium") === "chromium");
const chain = CHAIN.filter(([name]) => units.some((unit) => splitUnit(unit).name === name));
const serial = argv.includes("--serial");
const jobsSaid = argv.find((arg) => arg.startsWith("--jobs="))?.slice("--jobs=".length);
const jobs = serial ? 1 : jobsSaid ? Math.max(1, Number(jobsSaid) || 1) : defaultJobs();
const quick = argv.includes("--quick");
const strict = argv.includes("--strict") || process.env.GRAVIEW_STRICT === "1";
// What each harness read is kept from a laptop's runs; a CI runner keeps nothing of it, so it records nothing (GRAVIEW_COVERAGE=1 to make it).
const keepCoverage = process.env.GRAVIEW_COVERAGE === "1" || (process.env.GRAVIEW_COVERAGE !== "0" && !process.env.CI);
const missing = appPaths.filter((path) => !existsSync(resolve(path, "vite.config.ts")));
if (missing.length > 0) {
  say(`No app at ${missing.join(", ")} (an app is a directory with a vite.config.ts)\n`);
  process.exit(2);
}
if (appPaths.length > 0 && !chain.some(([name]) => TAKES_AN_APP.has(name))) {
  say(`An app was named, and only ${[...TAKES_AN_APP].join(", ")} drives one it is told about: pnpm verify journeys ${argv.filter(isPath).join(" ")}\n`);
  process.exit(2);
}
if (selection) {
  say(`changed  ${selection.changes} file${selection.changes === 1 ? "" : "s"} since ${selection.from.slice(0, 9)}${selection.everything ? `; ${selection.everything} reaches every harness` : ""}: ${chain.length} of ${CHAIN.length} harnesses (--all for every one)\n`);
  for (const [name] of chain) say(`         ${name.padEnd(14)} ${selection.why.get(name).join("; ").slice(0, 110)}\n`);
  if (selection.unreached.length > 0) say(`         reached by no harness: ${selection.unreached.slice(0, 8).join(", ")}${selection.unreached.length > 8 ? ` and ${selection.unreached.length - 8} more` : ""}\n`);
  say("\n");
}
if (argv.includes("--dry-run")) process.exit(0);

/** The last line a harness printed that says anything — its own summary. */
const gist = (text) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1]?.slice(0, 72) ?? "";
};

/*
 * SAY WHAT WAS ALREADY RUNNING.
 *
 * The harnesses borrow a dev server that is already answering their port —
 * deliberately, because a harness you cannot run while the app is open is a
 * harness nobody runs. The cost is that a stale or foreign server silently
 * changes what is under test, and a machine busy serving six of them
 * changes how long everything takes.
 *
 * That is how a clean thirteen-minute chain became forty-seven minutes with
 * three failures in it — a presence check that waits on a time-to-live, a
 * click that waits for an animation to settle, and a seat harness thirty
 * times slower than usual. All three passed on a quiet machine a minute
 * later. Nothing in the report said the machine had not been quiet.
 *
 * So it says so now, at the top, before any of it runs.
 *
 * AND WHOSE THEY ARE. This note once said "2 dev servers already running"
 * on the gauntlet's and todo's ports, and the chain drove them — another project's
 * `graview preview` and another project's vite — and twenty-nine harnesses
 * failed against the wrong app. So every port a harness names is asked
 * first: free, or this checkout's server for that app, or somebody else's.
 * Somebody else's moves the whole run onto a free block of a hundred
 * (GRAVIEW_PORT_BASE), says so, and stops nothing: the chain was run for a
 * verdict on this checkout, and the other server is somebody's work.
 */
const FREE_BASES = [...Array.from({ length: 4 }, (_, step) => 5600 + step * 100), ...POOL_BASES];
const releases = [];
let found = await holders(namedPorts());
const foreign = found.filter((one) => !one.ours);
if (foreign.length > 0) {
  const was = process.env.GRAVIEW_PORT_BASE;
  let movedTo = null;
  for (const base of FREE_BASES) {
    if (String(base) === was) continue;
    // Locked, as the pool's blocks are (lib/pool.mjs): another chain on this machine does not take it too.
    const release = lockBlock(base);
    if (!release) continue;
    process.env.GRAVIEW_PORT_BASE = String(base);
    const there = await holders(namedPorts());
    // A block another checkout's chain is using holds ports no harness here names, too: that block is not free either.
    const strangers = [...(listeners(base, base + 99)?.keys() ?? [])].filter((port) => !there.some((one) => one.port === port && one.ours));
    if (there.every((one) => one.ours) && strangers.length === 0) {
      movedTo = base;
      found = there;
      releases.push(release);
      break;
    }
    release();
  }
  for (const one of foreign) {
    say(`held  port ${one.port} (${one.app ? `apps/${one.name}` : one.name}) is held by ${described(one.holder)}, which is not this checkout's.\n`);
  }
  if (movedTo === null) {
    if (was === undefined) delete process.env.GRAVIEW_PORT_BASE;
    else process.env.GRAVIEW_PORT_BASE = was;
    say(`stop  No block of ports from ${FREE_BASES[0]} to ${FREE_BASES.at(-1) + 99} is free either: stop that server, or run with GRAVIEW_PORT_BASE set to a free hundred.\n`);
    process.exit(2);
  }
  const first = Number(was ?? PORT_FLOOR);
  say(`moved Every harness port moves onto GRAVIEW_PORT_BASE=${movedTo} (${movedTo}–${movedTo + 99}) for this run, so no harness drives a server that is not this checkout's; nothing was stopped, and stopping ${foreign.length === 1 ? "that server" : "those servers"} gives the run ${first}–${first + 99} back.\n\n`);
}
const answering = found.filter((one) => one.ours).map((one) => one.port);
if (answering.length > 0) {
  say(
    `note  ${answering.length} dev server${answering.length === 1 ? "" : "s"} of this checkout's already running (${answering.join(", ")}).\n` +
      `      The harnesses will drive those rather than starting their own, and the\n` +
      `      machine is busier than it would be otherwise. Timing-sensitive checks —\n` +
      `      presence time-to-live, animations settling — are the ones that mind.\n\n`,
  );
}

/*
 * THE WORKERS, each on a block of ports of its own (lib/pool.mjs): the
 * first on the run's block, the others on free hundreds from 6000, locked
 * for the run. A worker's harnesses drive its own dev servers, never
 * another worker's, so side by side is never a harness measuring another
 * harness's app.
 */
const together = units.length;
const claimed = claimBlocks(Math.min(jobs, Math.max(1, together)));
releases.push(claimed.release);
const bases = claimed.bases;
const baseOf = (worker) => bases[worker] ?? null;
if (bases.length < Math.min(jobs, together)) say(`note  ${bases.length} block${bases.length === 1 ? "" : "s"} of ports free for ${Math.min(jobs, together)} workers: the pool is ${bases.length} wide\n`);

/** The port `name` is served on in a worker's block. */
const portIn = (name, base) => {
  const was = process.env.GRAVIEW_PORT_BASE;
  if (base === null) delete process.env.GRAVIEW_PORT_BASE;
  else process.env.GRAVIEW_PORT_BASE = String(base);
  try {
    return portFor(name);
  } finally {
    if (was === undefined) delete process.env.GRAVIEW_PORT_BASE;
    else process.env.GRAVIEW_PORT_BASE = was;
  }
};

/*
 * WARM SERVERS, per worker. Every harness borrows a server already answering
 * its port that is this checkout's (lib/serve.mjs), so a worker starts the
 * apps a harness names the first time one needs them and keeps them for the
 * rest of the run: a vite started once and transformed once, not once per
 * harness. Each counts what it serves toward the harnesses that used it
 * (coverage.mjs).
 */
const APPS = new Set(readdirSync(resolve(repoRoot, "apps")).filter((name) => existsSync(resolve(repoRoot, "apps", name, "vite.config.ts"))));
const appsOf = (file) => {
  const text = readFileSync(resolve(repoRoot, "scripts", file), "utf8");
  const named = [...text.matchAll(/\b(?:serving|portFor|at)\(\s*"([a-z0-9-]+)"/g)].map((match) => match[1]);
  return [...new Set(named)].filter((name) => APPS.has(name) && name !== "site");
};
const scratch = mkdtempSync(join(tmpdir(), "graview-chain-"));
const serverCoverage = (app) => join(scratch, `server-${app}.cov`);
const warm = bases.map(() => new Map());
const serverTimes = [];
const warmUp = async (worker, apps) => {
  for (const app of apps) {
    if (warm[worker].has(app)) continue;
    const port = portIn(app, baseOf(worker));
    const began = Date.now();
    try {
      // The worker's own block, so a page that links to other ports (the desk's, `__GRAVIEW_PORTS__`) links to this worker's servers.
      const env = { ...(baseOf(worker) === null ? {} : { GRAVIEW_PORT_BASE: String(baseOf(worker)) }), ...(keepCoverage ? { NODE_OPTIONS: withHook(withoutHook(process.env.NODE_OPTIONS ?? "")), [COVERAGE_ENV]: serverCoverage(app), [COVERAGE_NO_FS_ENV]: "1" } : {}) };
      warm[worker].set(app, await serving(app, port, repoRoot, { env }));
      serverTimes.push({ worker, app, port, ms: Date.now() - began });
    } catch (error) {
      warm[worker].set(app, null);
      say(`note  ${app} did not start on ${port} (${error.message}); its harnesses will try themselves.\n`);
    }
  }
};

/** The longest any one harness may run; the slowest (gauntlet) takes about eleven minutes on the nightly. */
const HARNESS_MINUTES = Number(process.env.GRAVIEW_HARNESS_MINUTES ?? 25);
/*
 * A HARNESS LONGER THAN THE LIMIT BY WHAT IT IS, not stuck: quiet sweeps
 * Cloud's two apps in three engines, two schemes and every width and box,
 * and took 35 minutes on a machine running other agents' harnesses — so it
 * was stopped at 25 every time and never wrote a verdict after #257.
 */
/*
 * And one-face on the GPU leg (`--renderer gpu`, the pinned Chrome on a
 * runner): 1,275 s on fix/one-face-titles-and-slow-removal (run
 * 44375675365), and past the 1,500 once it waits for the face to rest after
 * each move rather than a fixed beat (`still`, verify-one-face.mjs), where
 * the DOM leg went from 599 s to 706 s (runs 44248362642, 44362109115).
 */
const LONGER = { quiet: 60, "one-face": 35 };
const minutesFor = (name) => Math.max(HARNESS_MINUTES, process.env.GRAVIEW_HARNESS_MINUTES ? 0 : (LONGER[name] ?? 0));

/*
 * EACH HARNESS IN A PROCESS GROUP OF ITS OWN, under a shell that says what
 * it spent: `times` after the harness ends prints the CPU of every process
 * it waited for (its browsers, its servers) on descriptor 3. A harness
 * stopped past its limit is stopped with its whole group; Ctrl-C here stops
 * every group.
 */
const running = new Set();
const stopAll = (signal) => {
  for (const child of running) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Gone already.
    }
  }
  for (const servers of warm) for (const server of servers.values()) server?.stop();
  for (const release of releases) release();
  process.exit(signal === "SIGINT" ? 130 : 143);
};
process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));
// The harnesses run in groups of their own, which a closed terminal does not reach: closing it stops them here.
process.once("SIGHUP", () => stopAll("SIGHUP"));
process.once("uncaughtException", (error) => {
  say(`\nstopped: ${error?.stack ?? error}\n`);
  stopAll("SIGTERM");
});
process.once("unhandledRejection", (error) => {
  say(`\nstopped: ${error?.stack ?? error}\n`);
  stopAll("SIGTERM");
});

const CHILD_KEYS = { ANTHROPIC_API_KEY: "", XAI_API_KEY: "", OPENAI_API_KEY: "", TYPESAFE_API_KEY: "", JEV_API_KEY: "" };
const scriptName = (file) => file.replace(/\.mjs$/, "");
const verdictOwner = (name, file) => [name, scriptName(file).replace(/^verify-/, "")];
let looks = 0;
const runOne = async (unit, worker, again = false) => {
  const { name, part } = splitUnit(unit);
  const file = CHAIN.find(([known]) => known === name)[1];
  const piece = part ? partOf(name, part) : null;
  const base = baseOf(worker);
  await warmUp(worker, appsOf(file));
  looks += 1;
  const timingFile = join(scratch, `${unit}.${looks}.timing`);
  const coverageFile = join(scratch, `${unit}.${looks}.cov`);
  const began = Date.now();
  const env = {
    ...process.env,
    // No model key reaches a harness's dev servers: a harness judges the app, never a model's answer of the day.
    ...CHILD_KEYS,
    ...(quick ? { GRAVIEW_QUICK: "1" } : {}),
    [TIMING_ENV]: timingFile,
    ...(part ? { [PART_ENV]: part } : { [PART_ENV]: "" }),
    ...(keepCoverage ? { [COVERAGE_ENV]: coverageFile, NODE_OPTIONS: withHook(withoutHook(process.env.NODE_OPTIONS ?? "")) } : {}),
  };
  if (base === null) delete env.GRAVIEW_PORT_BASE;
  else env.GRAVIEW_PORT_BASE = String(base);
  const { code, output, cpu } = await new Promise((done) => {
    const child = spawn("bash", ["-c", 'node "$@" 3>&-; code=$?; times >&3; exit $code', "harness", resolve(repoRoot, "scripts", file), ...(piece?.args ?? []), ...(TAKES_AN_APP.has(name) ? appPaths : [])], {
      cwd: repoRoot,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe", "pipe"],
    });
    running.add(child);
    let output = "";
    let times = "";
    /*
     * A HARNESS THAT NEVER ENDS ENDS HERE. verify-menu waited forever on an
     * ask it could not answer, and the nightly's shard ran out its sixty
     * minutes: the harness after it never started, and the run said only
     * that it was canceled. Past the limit the harness is stopped (its dev
     * servers with it, lib/serve.mjs) and fails by name, and the chain goes
     * on. Each harness also fails its own stuck claim sooner (lib/deadline.mjs).
     */
    const stopped = setTimeout(() => {
      output += `\nstopped after ${minutesFor(name)} minutes: ${name} wrote no verdict in time (GRAVIEW_HARNESS_MINUTES)\n`;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // Gone.
        }
      }, 15_000).unref();
    }, minutesFor(name) * 60_000);
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.stdio[3].on("data", (chunk) => (times += chunk));
    /*
     * ENDED WHEN THE SHELL EXITS, its output read until its pipes close or
     * for three seconds more: a process the harness left behind holding its
     * stdout must not keep the chain waiting forever.
     */
    child.on("exit", (code) => {
      clearTimeout(stopped);
      const finish = () => {
        if (!running.has(child)) return;
        running.delete(child);
        done({ code: code ?? 1, output, cpu: cpuOf(times) });
      };
      child.once("close", finish);
      setTimeout(() => {
        // Whatever it left holding its output is stopped with its group, so the worker's ports are free for the next.
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // Gone.
        }
        finish();
      }, 3_000).unref();
    });
  });
  const took = Math.round((Date.now() - began) / 1000);
  /*
   * AND THE WATCH'S VERDICT. A harness holds its own claims; the watch holds
   * the rules every screen it reached must keep (lib/watch.mjs). A harness
   * whose claims all pass over a screen that left the keyboard on <body>
   * does not hold.
   */
  // A part in another engine writes that engine's watch (lib/watch.mjs).
  const watch = watchFile(scriptName(file), piece?.engine ?? "chromium", part ?? "");
  let seen = null;
  try {
    seen = existsSync(watch) ? JSON.parse(readFileSync(watch, "utf8")) : null;
  } catch {
    // Unreadable is not clean: the harness's own report says nothing the chain can trust.
    seen = { at: new Date().toISOString(), open: 1 };
  }
  const open = seen && Date.parse(seen.at) >= began ? seen.open : 0;
  const failed = code !== 0 ? code : open > 0 ? 1 : 0;
  const said = open > 0 ? `watch: ${open} open — docs/watch/${watch.split("/").pop()}` : gist(output);
  const lines = readTimingLines(timingFile);
  const timing = { wall: took, cpu: cpu?.total ?? null, ...summarizeTiming(lines), worker, ...(again ? { look: "second" } : {}) };
  // Kept with the verdict, too: what it cost beside what it claims.
  const owners = verdictOwner(name, file);
  const written = part
    ? [{ path: partPath(PARTS[name].verdict, part) }].filter((one) => existsSync(resolve(repoRoot, one.path)))
    : writtenSince(repoRoot, began - 1000).filter((one) => one.path.endsWith(".json") && !one.path.startsWith("docs/watch/") && !one.path.startsWith("docs/first-look/") && !one.path.includes(".part-") && owners.some((owner) => ownedBy(owner, one.path)));
  stampVerdicts(repoRoot, written.map((one) => one.path), timing);
  const cost = `${String(took).padStart(4)}s${cpu ? ` ${String(Math.round(cpu.total)).padStart(4)}s cpu` : ""}`;
  say(`${failed === 0 ? "ok  " : again ? "FAIL" : strict ? "FAIL" : "miss"} ${unit.padEnd(14)} ${cost}  ${said}\n`);
  return { name: unit, harness: name, file, code: failed, took, began: new Date(began).toISOString(), gist: said, output, timing, coverage: readRecorded(coverageFile) };
};

const started = Date.now();
// A part file an earlier run left is not this run's: each part about to run starts without one (lib/parts.mjs).
for (const unit of units) {
  const { name, part } = splitUnit(unit);
  if (part && PARTS[name]) rmSync(resolve(repoRoot, partPath(PARTS[name].verdict, part)), { force: true });
}
const recorded = existsSync(TIMES) ? JSON.parse(readFileSync(TIMES, "utf8")) : {};
const tookBefore = new Map(Object.entries(recorded).map(([name, one]) => [name, (quick ? one.quick : one.whole) ?? one.whole ?? one.quick]).filter(([, seconds]) => typeof seconds === "number"));
const timesSomething = new Set(units.filter((unit) => TIMING.has(splitUnit(unit).name)));
const order = longestFirst(units, { took: tookBefore, guess: (unit) => (timesSomething.has(unit) ? 300 : 60) });
const timingCount = order.filter((unit) => timesSomething.has(unit)).length;
say(`${order.length} harness${order.length === 1 ? "" : "es"} and parts, ${bases.length} at a time on ${bases.map((base) => base ?? PORT_FLOOR).join(", ")}${timingCount > 0 ? `; ${timingCount} that time something, one at a time beside the rest` : ""}${quick ? ", quick" : ""}\n`);
const firsts = await runPool(order, { jobs: bases.length, timing: timesSomething, run: (unit, worker) => runOne(unit, worker) });
/*
 * THE SECOND LOOK (lib/second-look.mjs): what failed is run again once the
 * first pass is over, with nothing of it beside it. Failing twice fails the
 * run; holding the second time is a flake — the run holds, and the flake is
 * written down by name in docs/flakes.json and raised as a warning where CI
 * shows one.
 *
 * A few at a time, each on its own worker's ports, and the ones that time
 * something one at a time after them: one by one, five second looks of
 * harnesses that also fail on main (guest, chrome, playback) were twenty
 * minutes of a run whose first pass took twenty-five.
 * GRAVIEW_SECOND_LOOKS=1 looks at each one alone.
 */
const missed = strict ? [] : firsts.filter((one) => one.code !== 0);
const lookWidth = Math.min(bases.length, Math.max(1, Number(process.env.GRAVIEW_SECOND_LOOKS) || Math.min(4, Math.ceil(bases.length / 3))));
if (missed.length > 0) say(`\nsecond look, ${lookWidth === 1 ? "alone" : `${lookWidth} at a time`}: ${missed.map((one) => one.name).join(", ")}\n`);
const seconds = new Map();
for (const one of missed) {
  // The first look's verdict and frames, kept under docs/first-look/ before the second writes over them (lib/second-look.mjs).
  const kept = keepFirstLook(repoRoot, one, { since: started });
  if (kept.length > 0) say(`first look of ${one.name} kept: ${kept.join(", ")}\n`);
}
const looksAgain = missed.map((one) => one.name);
const besides = looksAgain.filter((unit) => !timesSomething.has(unit));
for (const again of await runPool(besides, { jobs: lookWidth, run: (unit, worker) => runOne(unit, worker, true) })) seconds.set(again.name, again);
for (const unit of looksAgain.filter((one) => timesSomething.has(one))) seconds.set(unit, await runOne(unit, 0, true));
const results = [];
// In the chain's order, as the record always was.
for (const unit of units) {
  const one = firsts.find((first) => first.name === unit);
  if (one) results.push({ ...judge(one, seconds.get(unit)), timing: (seconds.get(unit) ?? one).timing, firstTiming: seconds.has(unit) ? one.timing : undefined });
}
/*
 * A HARNESS RUN IN PARTS, MADE WHOLE: once every part ran, its verdict is
 * written from theirs (lib/parts.mjs), with what each part cost. A run that
 * took only some parts leaves them for whoever runs the rest.
 */
const failedWhole = [];
for (const name of Object.keys(PARTS)) {
  const ran = results.filter((one) => one.harness === name && splitUnit(one.name).part);
  if (ran.length === 0) continue;
  const whole = PARTS[name].parts.every(({ part }) => units.includes(`${name}.${part}`));
  // --quick took one engine's parts on purpose: its verdict is made from those, so docs/<name>.json says what this run held.
  const byDesign = quick && !asked.some((one) => splitUnit(one).part);
  const path = writeMerged(repoRoot, name, { whole: whole || byDesign, since: started, only: byDesign ? ran.map((one) => splitUnit(one.name).part) : null });
  // Every part held and the whole does not: a claim no part made, or one only the whole can judge. It fails by the harness's own name.
  const missed = path && ran.every((one) => one.verdict !== "failed") ? missedByTheWhole(repoRoot, name) : [];
  if (missed.length > 0)
    failedWhole.push({ name, harness: name, file: ran[0].file, code: 1, took: 0, began: ran[0].began, verdict: "failed", missed, gist: `made of its parts: ${missed.join(", ")}`, output: missed.map((claim) => `FAIL ${claim}`).join("\n") });
  if (path) stampVerdicts(repoRoot, [path], { wall: ran.reduce((sum, one) => sum + (one.timing?.wall ?? 0), 0), cpu: ran.reduce((sum, one) => sum + (one.timing?.cpu ?? 0), 0), parts: Object.fromEntries(ran.map((one) => [splitUnit(one.name).part, one.timing])) });
}
for (const servers of warm) for (const server of servers.values()) server?.stop();
const wall = Math.round((Date.now() - started) / 1000);

const broken = [...results.filter((one) => one.verdict === "failed"), ...failedWhole];
const flakes = recordFlakes(repoRoot, results.filter((one) => one.verdict === "flaky"));
for (const flake of flakes) {
  const claims = flake.missed.length > 0 ? flake.missed.join(", ") : "no claim named";
  say(`flaky ${flake.harness.padEnd(12)} failed beside the others (${claims}) and held alone — docs/flakes.json\n`);
  if (process.env.GITHUB_ACTIONS) say(`::warning title=Flaky harness: ${flake.harness}::failed once (${claims}) and held when run again alone; fix its wait (docs/flakes.json)\n`);
}
if (broken.length > 0) {
  say(`\n${"—".repeat(60)}\n`);
  for (const one of broken) {
    /*
     * WHAT FAILED, not the last twenty-five lines.
     *
     * The tail was the first thing written here, and `verify-site` prints a
     * line per passing check — so its one failure scrolled off and the
     * report said nothing but `ok`, which is the exact shape of the problem
     * this command exists to fix, arrived at from the other direction.
     *
     * So: every line that is not a plain `ok`, and the tail as well when
     * there are none — some harnesses say what went wrong only at the end.
     */
    const lines = one.output.trimEnd().split("\n");
    const wrong = lines.filter((line) => !/^\s*ok\s/.test(line) && line.trim() !== "");
    const shown = wrong.length > 0 ? wrong : lines.slice(-25);
    say(`\n${one.name}:\n${shown.slice(-40).join("\n")}\n`);
  }
}
/*
 * THE PROBLEMS, ONCE EACH. A harness line says which harnesses failed; this
 * says what is wrong — each problem once however many screens showed it,
 * and whether it is new, still there, or fixed since the last run.
 */
// A harness that ran only some of its parts looked at only some of its screens: a problem it did not see there is not one it fixed.
const inFull = results.filter((one) => !PARTS[one.harness] || !splitUnit(one.name).part || PARTS[one.harness].parts.every(({ part }) => units.includes(`${one.harness}.${part}`)));
const ledger = updateLedger(repoRoot, { since: started, ran: new Set(inFull.map((one) => scriptName(one.file))) });
const line = (entry) => `  ${entry.rule.padEnd(22)} ${entry.detail.slice(0, 150)}  (${entry.harnesses.join(", ")})\n`;
if (ledger.fresh.length + ledger.still.length + ledger.fixed.length + ledger.flapping.length > 0) {
  say(`\nproblems: ${ledger.fresh.length} new, ${ledger.still.length} still open, ${ledger.fixed.length} fixed, ${ledger.flapping.length} back after a fix\n`);
  if (ledger.fresh.length) say(`new\n${ledger.fresh.map(line).join("")}`);
  if (ledger.still.length) say(`still open\n${ledger.still.map(line).join("")}`);
  if (ledger.fixed.length) say(`fixed\n${ledger.fixed.map(line).join("")}`);
  if (ledger.flapping.length) say(`back after a fix — the check or its timing, before the product\n${ledger.flapping.map(line).join("")}`);
}
mkdirSync(resolve(repoRoot, "docs/watch"), { recursive: true });

/*
 * WHAT EACH READ, kept for the next branch's `--changed` (lib/coverage.mjs):
 * a harness that held is recorded with what it and its processes read, and
 * what the dev servers it used served; one that failed keeps its old
 * record, since a harness that stopped early read less than it covers.
 */
if (keepCoverage) {
  // By harness: a harness run in parts read what all its parts read, and one part that failed keeps the harness's old record.
  const ran = new Map();
  const fileSeen = new Map();
  const isFile = (path) => {
    if (!fileSeen.has(path)) {
      try {
        fileSeen.set(path, statSync(resolve(repoRoot, path)).isFile());
      } catch {
        fileSeen.set(path, false);
      }
    }
    return fileSeen.get(path);
  };
  const failedHarnesses = new Set(results.filter((result) => result.verdict === "failed").map((result) => result.harness));
  for (const one of results.filter((result) => !failedHarnesses.has(result.harness))) {
    const first = firsts.find((result) => result.name === one.name);
    const read = new Set([...(ran.get(one.harness) ?? []), ...(first?.coverage ?? []), ...(seconds.get(one.name)?.coverage ?? [])]);
    const used = new Set(appsOf(one.file));
    for (const path of read) if (path.startsWith("apps/")) used.add(path.split("/")[1]);
    for (const app of used) for (const path of readRecorded(serverCoverage(app))) read.add(path);
    // Only files of the checkout (or a whole package, `packages/core/`): not a page's address that looked like a path, nor a config's passing timestamp copy.
    const files = [...read].filter((path) => !/\.timestamp-\d+/.test(path) && (path.endsWith("/") ? existsSync(resolve(repoRoot, path)) : isFile(path)));
    if (files.length > 0) ran.set(one.harness, files);
  }
  /*
   * A harness's record is replaced only by a whole look at it: every part,
   * not --quick, no app named. Anything less — one part, fewer widths, a
   * walk's own app — read less than the harness reaches, and adds to its
   * record instead.
   */
  const whole = new Set([...ran.keys()].filter((name) => !quick && appPaths.length === 0 && (!PARTS[name] || PARTS[name].parts.every(({ part }) => units.includes(`${name}.${part}`)))));
  if (ran.size > 0) writeCoverage(mergeCoverage(readCoverage(repoRoot), ran, { sha: headSha(repoRoot) ?? "", whole }), repoRoot);
}
// And what each took, for the next run's order.
for (const one of results) {
  const at = (recorded[one.name] ??= {});
  at[quick ? "quick" : "whole"] = one.timing?.wall ?? one.took;
}
writeFileSync(TIMES, `${JSON.stringify(Object.fromEntries(Object.entries(recorded).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);

/*
 * WHEN EACH RAN AND WHAT IT MISSED, kept with the verdict: a run on GitHub's
 * runners (verify.yml) credits each harness with the files written while it
 * ran, and says the claims it missed by name (lib/on-github.mjs). And what
 * each cost, slowest first, with what the run itself cost.
 */
// The file is committed: a path of this machine's said in a harness's last line is not.
const scrubbed = (text) => [repoRoot, homedir(), tmpdir(), realpathSync(tmpdir())].reduce((said, path) => said.split(path).join(path === repoRoot ? "." : "~"), String(text ?? ""));
const spent = results.reduce((sum, one) => sum + one.took, 0);
const slowest = [...results].sort((a, b) => (b.timing?.wall ?? 0) - (a.timing?.wall ?? 0)).slice(0, 12).map((one) => ({ name: one.name, wall: one.timing?.wall ?? one.took, cpu: one.timing?.cpu ?? null, serverStartup: one.timing?.serverStartup ?? 0, fixedWaits: one.timing?.fixedWaits ?? 0, settledWaits: one.timing?.settledWaits ?? 0 }));
writeFileSync(
  LAST_RUN,
  `${JSON.stringify(
    {
      at: new Date().toISOString(),
      run: { wall, harnessTime: spent, workers: bases.length, quick, ...(selection ? { changed: { from: selection.from, files: selection.changes, ran: chain.length, of: CHAIN.length } } : {}), servers: serverTimes.map(({ worker, app, ms }) => ({ worker, app, ms })), slowest },
      results: [...results, ...failedWhole].map(({ name, file, code, took, began, verdict, gist: said, missed, output, timing, firstTiming }) => ({
        name,
        file,
        code,
        took,
        began,
        verdict,
        timing,
        ...(firstTiming ? { firstTiming } : {}),
        ...(verdict === "held" ? {} : { gist: scrubbed(said), missed: (missed ?? missedClaims(output ?? "")).map(scrubbed) }),
      })),
    },
    null,
    2,
  )}\n`,
);
for (const release of releases) release();
rmSync(scratch, { recursive: true, force: true });
say(`\nslowest: ${slowest.slice(0, 6).map((one) => `${one.name} ${one.wall}s`).join(", ")}\n`);
say(
  `\n${results.length - broken.length + failedWhole.length} of ${results.length} harnesses hold${failedWhole.length > 0 ? `, and ${failedWhole.map((one) => one.name).join(", ")} made of its parts does not` : ""}${flakes.length > 0 ? `, ${flakes.length} on a second look` : ""} (${Math.floor(wall / 60)}m${String(wall % 60).padStart(2, "0")}s, ${Math.round(spent / 60)}m of harness time, ${bases.length} at a time)\n`,
);
process.exit(broken.length > 0 ? 1 : 0);
