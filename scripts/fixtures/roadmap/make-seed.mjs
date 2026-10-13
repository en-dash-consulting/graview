#!/usr/bin/env node
/**
 * Writes roadmap.seed.json: the Roadmap's shape at its real size — 146
 * features under 14 areas, 60 requests from 18 people, 28 releases and
 * 20 briefs — deterministically, so a screenshot taken today and one taken
 * after a change are of the same graph.
 *
 *   node scripts/fixtures/roadmap/make-seed.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let state = 7;
const rand = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];

const AREAS = ["core", "layout", "tools", "render", "react", "primitives", "pages", "ship", "studio", "embed", "guest", "skills", "hosting", "accounts"];
const WORDS = ["Filters", "Undo", "Search", "Calendar", "Import", "Export", "Roles", "Lenses", "Sync", "Offline", "Themes", "Forms", "Rules", "Charts", "Comments", "Files", "History", "Seats", "Invites", "Billing"];
const HOWS = ["that stay usable", "said in words", "on a phone", "for strangers", "without a build", "across apps", "at scale", "that remember", "by keyboard", "in the scene"];
const PEOPLE = ["Ada", "Bo", "Cass", "Dev", "Eli", "Fran", "Gus", "Hana", "Ivo", "Jun", "Kit", "Lev", "Mai", "Noor", "Oz", "Pia", "Quin", "Ravi"];

const nodes = [];
const edges = [];
let edge = 0;
const link = (kind, from, to) => edges.push({ id: `e${++edge}`, kind, from, to });

AREAS.forEach((name, i) => nodes.push({ id: `area-${i}`, kind: "area", name, package: `@graview/${name}`, product: i >= 12 ? "cloud" : "framework" }));
PEOPLE.forEach((name, i) => nodes.push({ id: `person-${i}`, kind: "person", name }));
const STAGES = ["considering", "planned", "building", "shipped"];
for (let i = 0; i < 146; i++) {
  const stage = i < 90 ? "shipped" : STAGES[i % 3];
  nodes.push({ id: `feature-${i}`, kind: "feature", name: `${WORDS[i % WORDS.length]} ${HOWS[Math.floor(i / WORDS.length) % HOWS.length]}`, stage, layer: rand() < 0.8 ? "framework" : "cloud" });
  link("partOf", `feature-${i}`, `area-${Math.floor(rand() * rand() * AREAS.length)}`);
  if (i > 10 && rand() < 0.2) link("dependsOn", `feature-${i}`, `feature-${Math.floor(rand() * i)}`);
}
for (let i = 0; i < 4; i++) link("pairsWith", `feature-${100 + i}`, `feature-${120 + i}`);
for (let i = 0; i < 28; i++) {
  const day = String(1 + ((i * 3) % 28)).padStart(2, "0");
  const month = String(6 + Math.floor(i / 7)).padStart(2, "0");
  nodes.push({ id: `release-${i}`, kind: "release", name: `0.1.${i}`, date: `2026-${month}-${day}`, state: i < 26 ? "published" : "draft" });
  if (i > 0) link("follows", `release-${i}`, `release-${i - 1}`);
}
for (let i = 0; i < 90; i++) link("ships", `release-${Math.min(25, Math.floor(i / 3.5))}`, `feature-${i}`);
for (let i = 0; i < 60; i++) {
  const status = pick(["open", "open", "accepted", "done", "declined"]);
  nodes.push({ id: `request-${i}`, kind: "request", name: `${pick(WORDS)} ${pick(HOWS)}, please`, status });
  link("raisedBy", `request-${i}`, `person-${Math.floor(rand() * PEOPLE.length)}`);
  if (rand() < 0.7) link("about", `request-${i}`, `area-${Math.floor(rand() * AREAS.length)}`);
  if (status !== "open" && status !== "declined") link("became", `request-${i}`, `feature-${Math.floor(rand() * 146)}`);
  const voters = new Set();
  for (let v = 0; v < Math.floor(rand() * 4); v++) voters.add(Math.floor(rand() * PEOPLE.length));
  for (const v of voters) link("votedBy", `request-${i}`, `person-${v}`);
}
for (let i = 0; i < 20; i++) {
  nodes.push({ id: `brief-${i}`, kind: "brief", name: `Brief ${i + 1}`, date: `2026-09-${String(1 + i).padStart(2, "0")}` });
  link("after", `brief-${i}`, `release-${Math.min(25, 6 + i)}`);
  for (let a = 0; a < 2; a++) link("about", `brief-${i}`, `feature-${Math.floor(rand() * 146)}`);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), "roadmap.seed.json");
writeFileSync(out, `${JSON.stringify({ nodes, edges }, null, 1)}\n`);
process.stdout.write(`wrote ${nodes.length} records and ${edges.length} links to ${out}\n`);
