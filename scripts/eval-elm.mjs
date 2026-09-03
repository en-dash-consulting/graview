#!/usr/bin/env node
/**
 * THE ELM VERDICT, measured — not vibed.
 *
 * Question: does an in-browser Extreme Learning Machine classifier route
 * chat intents better than graphResponder's derived word-matching, when
 * both learn only from the app's own declared vocabulary?
 *
 * Method, pre-registered before results were seen:
 * - Corpus per app, generated from the declaration: standing paraphrases,
 *   per-mutation phrasings (an EXACT family embedding the full title, and a
 *   PARTIAL family that drops/shuffles title words — the case substring
 *   matching cannot survive), and about-<node> phrasings from sample data.
 * - Split by TEMPLATE, so every test phrasing shape is unseen in training.
 * - Baseline: the real graphResponder, its branch read off the reply.
 * - ELM: AsterMind IntentClassifier, 3 seeds, mean reported.
 * - Verdict rule: ADOPT if ELM's mean overall accuracy beats the baseline
 *   by ≥10 points and does not lose on any app; MIXED if it wins overall
 *   but loses somewhere; NO-LIFT otherwise.
 *
 *   node scripts/eval-elm.mjs      → docs/elm-eval.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IntentClassifier } from "@astermind/astermind-elm";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
// Workspace packages by their built entry points — this script lives at the
// repo root, which deliberately depends on nothing.
const { Store, labelOf } = await import(resolve(repoRoot, "packages/core/dist/index.js"));
const { graphResponder } = await import(resolve(repoRoot, "packages/tools/dist/index.js"));
const load = async (app) => (await import(resolve(repoRoot, `apps/${app}/dist/domain/app.js`))).default;
const data = (path) => JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"));

const APPS = {
  todo: { data: "apps/todo/src/data/example.json" },
  seedbed: { data: null },
};

/* ------------------------------------------------------------- corpus */

const STANDING = [
  "what's wrong?",
  "anything broken?",
  "is everything ok",
  "show me the problems",
  "what needs fixing around here",
  "are we in good standing",
  "any violations right now",
  "what should i worry about",
];
const ABOUT = [
  (l) => `tell me about ${l}`,
  (l) => `what is ${l}`,
  (l) => `show me ${l}`,
  (l) => `describe ${l} for me`,
  (l) => `what's the story with ${l}`,
  (l) => `${l} — anything i should know?`,
];
const EXACT = [
  (t) => `${t}`,
  (t) => `please ${t.toLowerCase()}`,
  (t) => `can you ${t.toLowerCase()}?`,
  (t) => `go ahead and ${t.toLowerCase()}`,
  (t) => `i want to ${t.toLowerCase()} now`,
];
const PARTIAL = [
  (t) => {
    const w = t.toLowerCase().split(" ");
    return w.length > 2 ? `${w[0]} ${w.slice(2).join(" ")}` : `${w[0]} it maybe`;
  },
  (t) => {
    const w = t.toLowerCase().split(" ");
    return `${w[w.length - 1]} ${w.slice(0, -1).join(" ")}`;
  },
  (t) => `${t.toLowerCase().split(" ")[0]} this thing for me`,
  (t) => {
    const w = t.toLowerCase().split(" ");
    return w.length > 1 ? `${w[0]} the ${w[w.length - 1]} please` : `${w[0]} please`;
  },
];

function corpusFor(app, store) {
  const rows = [];
  for (const [i, text] of STANDING.entries()) {
    rows.push({ text, label: "standing", family: "standing", template: `s${i}` });
  }
  for (const mutation of store.allMutations()) {
    const title = mutation.title ?? mutation.name;
    for (const [i, make] of EXACT.entries()) {
      rows.push({ text: make(title), label: `do:${mutation.name}`, family: "exact", template: `e${i}` });
    }
    for (const [i, make] of PARTIAL.entries()) {
      rows.push({ text: make(title), label: `do:${mutation.name}`, family: "partial", template: `p${i}` });
    }
  }
  const named = [...store.graph.allNodes()]
    .map((node) => labelOf(store.schema.tryDefinition(node.kind), node))
    .filter((l, i, all) => l.length > 2 && all.indexOf(l) === i)
    .slice(0, 10);
  for (const label of named) {
    for (const [i, make] of ABOUT.entries()) {
      rows.push({ text: make(label), label: "about", family: "about", template: `a${i}` });
    }
  }
  return rows;
}

// Held-out TEMPLATES: shapes the classifier never saw.
const TEST_TEMPLATES = new Set(["s5", "s6", "s7", "e3", "e4", "p2", "p3", "a4", "a5"]);

/* ------------------------------------------------- the two contestants */

async function baselinePredict(store, text) {
  const reply = await graphResponder()(store, text);
  const say = reply.say;
  if (/^\d+ problems?:|^Nothing is broken/.test(say)) return "standing";
  if (reply.proposals[0]?.why === "you asked in words") return `do:${reply.proposals[0].mutation}`;
  const asked = say.match(/^"(.+)" needs /);
  if (asked) {
    const found = store.allMutations().find((m) => (m.title ?? m.name) === asked[1]);
    if (found) return `do:${found.name}`;
  }
  if (/ — a [a-z]/.test(say)) return "about";
  return "other";
}

/* ---------------------------------------------------------------- run */

const report = { at: new Date().toISOString(), method: "template-held-out; 3 seeds; pre-registered thresholds", apps: {} };

for (const [app, spec] of Object.entries(APPS)) {
  const declaration = await load(app);
  const store = new Store({
    schema: declaration.schema,
    mutations: declaration.mutations ?? [],
    invariants: declaration.invariants ?? [],
    ...(spec.data ? { snapshot: data(spec.data) } : {}),
  });
  const rows = corpusFor(app, store);
  const train = rows.filter((r) => !TEST_TEMPLATES.has(r.template));
  const test = rows.filter((r) => TEST_TEMPLATES.has(r.template));
  if (test.length === 0) continue;

  // Baseline (deterministic; one pass).
  let baseHits = 0;
  const perFamily = {};
  for (const row of test) {
    const got = await baselinePredict(store, row.text);
    const hit = got === row.label;
    baseHits += hit ? 1 : 0;
    (perFamily[row.family] ??= { base: 0, elm: 0, n: 0 }).n += 1;
    perFamily[row.family].base += hit ? 1 : 0;
  }

  // ELM, three seeds.
  const elmAccs = [];
  const elmFamilyTotals = {};
  for (const seed of [11, 42, 77]) {
    const classifier = new IntentClassifier({
      categories: [...new Set(rows.map((r) => r.label))],
      hiddenUnits: 384,
      maxLen: 64,
      activation: "relu",
      useTokenizer: true,
      seed,
      log: { verbose: false },
    });
    classifier.train(train.map((r) => ({ text: r.text, label: r.label })));
    let hits = 0;
    for (const row of test) {
      const got = classifier.predictLabel(row.text, 0)?.label ?? "other";
      const hit = got === row.label;
      hits += hit ? 1 : 0;
      (elmFamilyTotals[row.family] ??= 0);
      elmFamilyTotals[row.family] += hit ? 1 : 0;
    }
    elmAccs.push(hits / test.length);
  }
  for (const family of Object.keys(perFamily)) {
    perFamily[family].elm = (elmFamilyTotals[family] ?? 0) / 3;
  }

  report.apps[app] = {
    train: train.length,
    test: test.length,
    intents: new Set(rows.map((r) => r.label)).size,
    baseline: +(baseHits / test.length).toFixed(3),
    elmMean: +(elmAccs.reduce((a, b) => a + b, 0) / elmAccs.length).toFixed(3),
    elmRuns: elmAccs.map((a) => +a.toFixed(3)),
    perFamily: Object.fromEntries(
      Object.entries(perFamily).map(([family, stat]) => [
        family,
        { baseline: +(stat.base / stat.n).toFixed(3), elm: +(stat.elm / stat.n).toFixed(3), n: stat.n },
      ]),
    ),
  };
}

const apps = Object.values(report.apps);
const overall = (key) => apps.reduce((sum, a) => sum + a[key] * a.test, 0) / apps.reduce((s, a) => s + a.test, 0);
report.overall = { baseline: +overall("baseline").toFixed(3), elmMean: +overall("elmMean").toFixed(3) };
const losesSomewhere = apps.some((a) => a.elmMean < a.baseline);
report.verdict =
  report.overall.elmMean - report.overall.baseline >= 0.1 && !losesSomewhere
    ? "ADOPT"
    : report.overall.elmMean > report.overall.baseline
      ? "MIXED"
      : "NO-LIFT";
report.rankingSlot = {
  verdict: "DEFERRED",
  reason:
    "Learning which suggestions get applied needs real op logs; none exist before launch. Revisit with real usage data from a launched product.",
};

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/elm-eval.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [app, r] of Object.entries(report.apps)) {
  console.log(
    `${app.padEnd(9)} baseline ${r.baseline}  elm ${r.elmMean}  (exact ${r.perFamily.exact?.baseline}/${r.perFamily.exact?.elm}  partial ${r.perFamily.partial?.baseline}/${r.perFamily.partial?.elm})`,
  );
}
console.log(`overall   baseline ${report.overall.baseline}  elm ${report.overall.elmMean}  → ${report.verdict}`);
