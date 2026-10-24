#!/usr/bin/env node
/**
 * A FIELD SURVEY AT THE SIZE PEOPLE ACTUALLY HAVE: twenty kinds, 1,016
 * records and about 4,100 links — the shape of a real app whose scene was
 * slow (a few districts of 80 to 250 records, whose villages stand fifty to
 * sixty-five blocks, and a dozen small ones; every kind linked to two to
 * six others, computed counts on most kinds, rules over the busiest, cards
 * whose badges are toned by an expression) with none of its contents. Every
 * name is made up from the word lists below, and the graph is the same on
 * every run, so a measurement taken today and one taken after a change are
 * of the same city.
 *
 * Imported by `verify-scene-at-scale` (`fieldSurvey()`), or run to write the
 * document and its seed into a directory:
 *
 *   node scripts/fixtures/large-scene/field-survey.mjs <dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** How many of each kind, and the kind's states — the field the city builds its rows of blocks from. */
const KINDS = {
  area: { count: 8, plural: "areas", states: ["mapped", "surveying", "closed"] },
  team: { count: 9, plural: "teams", states: ["active", "paused"] },
  person: { count: 12, plural: "people", states: ["active", "away", "left"] },
  site: { count: 7, plural: "sites", states: ["planned", "active", "done"] },
  station: { count: 15, plural: "stations", states: ["proposed", "active", "retired"] },
  instrument: { count: 12, plural: "instruments", states: ["ordered", "active", "retired"] },
  sample: { count: 56, plural: "samples", states: ["collected", "in progress", "done"] },
  measurement: { count: 165, plural: "measurements", states: ["draft", "active", "done"] },
  method: { count: 22, plural: "methods", states: ["proposed", "active", "retired"] },
  protocol: { count: 9, plural: "protocols", states: ["draft", "active", "retired"] },
  dataset: { count: 49, plural: "datasets", states: ["open", "in progress", "done"] },
  model: { count: 8, plural: "models", states: ["planned", "active", "retired"] },
  claim: { count: 170, plural: "claims", states: ["open", "active", "done"] },
  question: { count: 60, plural: "questions", states: ["open", "in progress", "done"] },
  review: { count: 83, plural: "reviews", states: ["requested", "in progress", "done"] },
  issue: { count: 250, plural: "issues", states: ["open", "in progress", "done"] },
  task: { count: 12, plural: "tasks", states: ["todo", "in progress", "done"] },
  milestone: { count: 3, plural: "milestones", states: ["planned", "active", "done"] },
  report: { count: 6, plural: "reports", states: ["draft", "in review", "done"] },
  source: { count: 60, plural: "sources", states: ["found", "read", "cited"] },
};

/** Each relation: from, name, to, how many a record has (a range), and whether it is one. */
const EDGES = [
  ["site", "inArea", "area", [1, 1], "one"],
  ["station", "atSite", "site", [1, 1], "one"],
  ["instrument", "atStation", "station", [1, 1], "one"],
  ["instrument", "uses", "method", [1, 3]],
  ["sample", "fromSite", "site", [1, 1], "one"],
  ["sample", "takenBy", "person", [1, 3]],
  ["measurement", "of", "sample", [1, 1], "one"],
  ["measurement", "by", "instrument", [1, 1], "one"],
  ["measurement", "follows", "protocol", [1, 2]],
  ["measurement", "relatesTo", "measurement", [0, 3]],
  ["method", "dependsOn", "method", [0, 2]],
  ["protocol", "uses", "method", [1, 4]],
  ["protocol", "ownedBy", "team", [1, 1], "one"],
  ["dataset", "holds", "measurement", [4, 12]],
  ["dataset", "ownedBy", "team", [1, 1], "one"],
  ["model", "trainedOn", "dataset", [2, 5]],
  ["model", "dependsOn", "model", [0, 2]],
  ["claim", "backedBy", "measurement", [1, 5]],
  ["claim", "challengedBy", "measurement", [0, 3]],
  ["claim", "about", "site", [1, 2]],
  ["claim", "rests", "dataset", [1, 3]],
  ["question", "about", "claim", [1, 4]],
  ["question", "raisedBy", "person", [1, 1], "one"],
  ["review", "of", "claim", [1, 1], "one"],
  ["review", "by", "person", [1, 3]],
  ["issue", "about", "instrument", [0, 1]],
  ["issue", "inData", "dataset", [0, 1]],
  ["issue", "inModel", "model", [0, 1]],
  ["issue", "raisedBy", "person", [1, 1], "one"],
  ["task", "closes", "issue", [0, 2]],
  ["task", "eases", "issue", [0, 2]],
  ["task", "ownedBy", "person", [1, 1], "one"],
  ["task", "toward", "milestone", [1, 2]],
  ["milestone", "forTeam", "team", [1, 1], "one"],
  ["report", "cites", "source", [3, 9]],
  ["report", "covers", "claim", [3, 9]],
  ["report", "by", "team", [1, 1], "one"],
  ["source", "about", "site", [1, 4]],
  ["person", "inTeam", "team", [1, 1], "one"],
];

const FIRST = ["North", "South", "East", "West", "Upper", "Lower", "Old", "New", "Far", "Near", "High", "Low"];
const PLACE = ["ridge", "creek", "meadow", "basin", "bluff", "hollow", "marsh", "terrace", "spring", "fork", "bend", "shelf"];
const THING = ["flow", "depth", "salinity", "turbidity", "nitrate", "silt", "canopy", "pollen", "drift", "runoff", "temperature", "oxygen"];
const DOING = ["holds", "drops", "rises", "varies", "lags", "settles", "spikes", "doubles"];
const GIVEN = ["Ash", "Bay", "Cole", "Dale", "Eden", "Fern", "Glen", "Hale", "Ira", "Jude", "Kai", "Lane", "Moss", "Nell", "Oak", "Pax"];
const FAMILY = ["Reed", "Stone", "Thorn", "Vale", "Wren", "Yarrow", "Birch", "Cliff"];

/** A seeded generator, so the city is the same on every run. */
function seeded(seed) {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** A record's made-up name, by kind and number. */
function nameOf(kind, i) {
  const a = FIRST[i % FIRST.length];
  const b = PLACE[Math.floor(i / FIRST.length) % PLACE.length];
  const t = THING[i % THING.length];
  switch (kind) {
    case "person":
      return `${GIVEN[i % GIVEN.length]} ${FAMILY[Math.floor(i / GIVEN.length) % FAMILY.length]}`;
    case "team":
      return `${a} ${b} team`;
    case "area":
      return `${a} ${b}`;
    case "site":
      return `${a} ${b} ${i + 1}`;
    case "station":
      return `Station ${String.fromCharCode(65 + (i % 26))}${i + 1}`;
    case "instrument":
      return `${t} gauge ${i + 1}`;
    case "sample":
      return `Sample ${b} ${i + 1}`;
    case "measurement":
      return `${t} at ${b} ${i + 1}`;
    case "claim":
      return `The ${b}'s ${t} ${DOING[i % DOING.length]} in the dry months`;
    case "question":
      return `Why does the ${t} ${DOING[(i + 3) % DOING.length]} near the ${b}?`;
    case "task":
      return `Recalibrate the ${t} gauge at the ${b}`;
    case "issue":
      return `${t} readings drift at the ${b}`;
    default:
      return `${kind[0].toUpperCase()}${kind.slice(1)} ${a.toLowerCase()} ${b} ${i + 1}`;
  }
}

/** The document: the kinds, their relations, their counts worked out, the rules, cards toned by an expression, and lenses. */
export function fieldSurveyDocument() {
  const kinds = {};
  for (const [kind, { plural, states }] of Object.entries(KINDS)) {
    const fields = {
      name: { type: "string", required: true },
      status: { type: "enum", options: states, default: states[0], required: true },
      notes: { type: "text" },
      priority: { type: "enum", options: ["low", "medium", "high", "critical"] },
      score: { type: "number" },
    };
    if (kind === "task" || kind === "milestone") fields.due = { type: "date" };
    kinds[kind] = { noun: kind, plural, label: "{name}", description: `A ${kind} in the survey.`, fields, describe: "{status}", glance: ["status", "priority"] };
  }
  for (const [from, name, to, , one] of EDGES) {
    kinds[from].edges ??= {};
    kinds[from].edges[name] = { to: [to], ...(one ? { cardinality: "one" } : {}), description: `${name} a ${to}`, inverse: `its ${KINDS[from].plural} (${name})` };
  }
  // Counts worked out from the links, as a real app's are: most kinds have some.
  const computed = (kind, entries) => (kinds[kind].computed = Object.fromEntries(entries.map(([key, expr]) => [key, { expr, label: key }])));
  computed("measurement", [["backs", "count(in('backedBy'))"], ["challenges", "count(in('challengedBy'))"], ["held", "count(in('holds'))"]]);
  computed("claim", [["support", "count(out('backedBy'))"], ["against", "count(out('challengedBy'))"], ["asked", "count(in('about') where status != 'done')"], ["serious", "(priority == 'high' || priority == 'critical') && status != 'done'"]]);
  computed("issue", [["closedBy", "count(in('closes'))"], ["easedBy", "count(in('eases'))"]]);
  computed("dataset", [["size", "count(out('holds'))"], ["models", "count(in('trainedOn'))"], ["problems", "count(in('inData') where status != 'done')"]]);
  computed("instrument", [["readings", "count(in('by'))"], ["problems", "count(in('about') where status == 'open')"]]);
  computed("site", [["samples", "count(in('fromSite'))"], ["stations", "count(in('atSite'))"], ["claims", "count(in('about'))"]]);
  computed("task", [["closing", "count(out('closes'))"], ["serious", "count(out('closes') where priority == 'critical')"]]);
  computed("team", [["people", "count(in('inTeam'))"], ["protocols", "count(in('ownedBy'))"]]);
  computed("method", [["needs", "count(out('dependsOn'))"], ["neededBy", "count(in('dependsOn'))"]]);
  computed("report", [["cited", "count(out('cites'))"], ["covered", "count(out('covers'))"]]);
  const tone = { expr: "if(priority == 'critical', 'bad', if(priority == 'high', 'warn', if(status == 'done', 'good', 'neutral')))" };
  const views = {};
  for (const kind of ["claim", "issue", "measurement", "dataset", "task", "instrument", "question", "review", "sample", "site"]) {
    views[kind] = { card: [{ title: "{name}" }, { badge: "{status}", tone }, { badge: "{priority}", tone: "neutral" }, { text: "{notes|excerpt}", tone: "neutral" }] };
  }
  return {
    format: "graview-document",
    formatVersion: 1,
    name: "A field survey",
    description: "A made-up field survey at a real app's size: twenty kinds, a thousand records, four thousand links. Every name in it is invented.",
    kinds,
    acts: Object.fromEntries(Object.entries(KINDS).map(([kind]) => [`add-${kind}`, { creates: kind, title: `Add a ${kind}`, description: `Put a new ${kind} into the survey.` }])),
    rules: {
      "claim-is-backed": { title: "A claim is backed", over: "claim", require: "exists(out('backedBy'))", says: "{name} has nothing behind it." },
      "claim-outweighs": { title: "A claim outweighs what challenges it", over: "claim", require: "count(out('backedBy')) > count(out('challengedBy'))", says: "{name} is challenged as much as it is backed." },
      "issue-is-about-something": { title: "An issue names what it is about", over: "issue", require: "exists(out('about')) || exists(out('inData')) || exists(out('inModel'))", says: "{name} is about nothing." },
      "task-moves-an-issue": { title: "A task closes or eases an issue", over: "task", require: "exists(out('closes')) || exists(out('eases'))", says: "{name} moves no issue." },
      "sample-has-notes": { title: "A done sample has notes", over: "sample", require: "status != 'done' || present(notes)", says: "{name} is done with no notes." },
      "report-cites": { title: "A report cites its sources", over: "report", require: "count(out('cites')) >= 2", says: "{name} cites too little." },
    },
    views,
    lenses: [
      { name: "columns", title: "Claims by status", bindings: { claim: { column: "status" } } },
      { name: "columns", title: "Issues by status", bindings: { issue: { column: "status" } } },
      { name: "columns", title: "Tasks board", bindings: { task: { column: "status" } } },
      { name: "coverage", title: "Sites by area", bindings: { rows: { kind: "site" }, columns: { kind: "area" }, link: { edge: "inArea" } } },
    ],
  };
}

/** The records and links, the same on every run. */
export function fieldSurveySeed() {
  const rand = seeded(20261024);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const nodes = [];
  for (const [kind, { count, states }] of Object.entries(KINDS)) {
    for (let i = 0; i < count; i += 1) {
      const node = { id: `${kind}-${i}`, kind, name: nameOf(kind, i), status: states[Math.floor(rand() * rand() * states.length * 1.4) % states.length] };
      if (rand() < 0.6) node.priority = pick(["low", "medium", "medium", "high", "critical"]);
      if (rand() < 0.5) node.score = Math.round(rand() * 100);
      if (rand() < 0.4) node.notes = `Seen on visit ${1 + Math.floor(rand() * 9)}.`;
      if (kind === "task" || kind === "milestone") node.due = `2026-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
      nodes.push(node);
    }
  }
  const edges = [];
  for (const [from, name, to, [least, most]] of EDGES) {
    for (let i = 0; i < KINDS[from].count; i += 1) {
      const many = least + Math.floor(rand() * (most - least + 1));
      const taken = new Set();
      for (let n = 0; n < many; n += 1) {
        // Skewed toward the first few: a real app has hubs.
        const j = Math.floor(rand() * rand() * KINDS[to].count);
        if ((from === to && j === i) || taken.has(j)) continue;
        taken.add(j);
        edges.push({ id: `e${edges.length + 1}`, kind: name, from: `${from}-${i}`, to: `${to}-${j}` });
      }
    }
  }
  return { nodes, edges };
}

/** Write the document and the seed into `dir`, and say where. */
export function writeFieldSurvey(dir) {
  mkdirSync(dir, { recursive: true });
  const document = join(dir, "field-survey.gdd.json");
  const seed = join(dir, "field-survey.seed.json");
  writeFileSync(document, `${JSON.stringify(fieldSurveyDocument(), null, 1)}\n`);
  const data = fieldSurveySeed();
  writeFileSync(seed, `${JSON.stringify(data)}\n`);
  return { document, seed, records: data.nodes.length, links: data.edges.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? ".");
  const { document, seed, records, links } = writeFieldSurvey(dir);
  process.stdout.write(`wrote ${records} records and ${links} links: ${document}, ${seed}\n`);
}
