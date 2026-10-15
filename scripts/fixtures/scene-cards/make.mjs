#!/usr/bin/env node
/**
 * Writes `review.gdd.json` and `review.seed.json`: a review of a hospital's
 * systems — its modules and what the review found in each — beside a shelf
 * of records, for `verify-scene-cards`. Modeled on the two Cloud apps Nick
 * reported the scene's cards and lines from on 2026-10-15.
 *
 *   node scripts/fixtures/scene-cards/make.mjs
 */
import { writeFileSync } from "node:fs";

const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Systems review",
  description: "The modules of a hospital's systems, what the review found in each, and a shelf of records.",
  kinds: {
    module: {
      noun: "module",
      plural: "modules",
      description: "One part of the hospital's systems, with what it does and who relies on it.",
      fields: { title: { type: "string", required: true }, summary: { type: "text", label: "Summary" } },
      label: "{title}",
    },
    finding: {
      noun: "finding",
      plural: "findings",
      description: "Something the review found.",
      fields: {
        title: { type: "string", required: true },
        severity: { type: "enum", options: ["low", "medium", "high"], default: "low" },
      },
      label: "{title}",
      edges: { in: { to: ["module"], cardinality: "one", description: "the module it was found in", inverse: "the findings in it" } },
    },
    album: {
      noun: "album",
      plural: "albums",
      description: "A record.",
      fields: { title: { type: "string", required: true }, year: { type: "integer", label: "Year" } },
      label: "{title}",
      edges: { madeBy: { to: ["artist"], cardinality: "one", description: "who made it", inverse: "the albums they made" } },
    },
    artist: {
      noun: "artist",
      plural: "artists",
      description: "Who made a record.",
      fields: { name: { type: "string", required: true } },
      label: "{name}",
    },
  },
  acts: {},
};

const nodes = [];
const edges = [];
let next = 0;
const tie = (kind, from, to) => edges.push({ id: `e${++next}`, kind, from, to });

const SUMMARY =
  "Hospital relationship management: the referrals, the admitting physicians and the outreach to clinics that send patients, kept in one place so a liaison sees the whole relationship before a visit. It also holds the contracts with each hospital and who signed them, and it is where the quarterly review starts.";
nodes.push({ id: "module:hospital-services", kind: "module", title: "Hospital Services", summary: SUMMARY });
nodes.push({ id: "module:billing", kind: "module", title: "Billing", summary: "Claims and statements, from the visit to the paid bill." });
const FOUND = [
  ["Referral intake is retyped from fax", "high"],
  ["No audit trail on physician changes", "high"],
  ["Outreach visits logged in a spreadsheet", "medium"],
  ["Duplicate clinic records", "medium"],
  ["Liaison notes are not searchable", "low"],
  ["Stale contact numbers", "low"],
  ["Two logins for one task", "low"],
  ["Reports are emailed by hand", "medium"],
  ["No export for the board", "low"],
  ["Physician changes wait a week", "medium"],
];
for (const [at, [title, severity]] of FOUND.entries()) {
  nodes.push({ id: `finding:h${at + 1}`, kind: "finding", title, severity });
  tie("in", `finding:h${at + 1}`, "module:hospital-services");
}
for (const [at, [title, severity]] of [["Statements printed twice", "low"], ["Claims rejected without a reason", "high"]].entries()) {
  nodes.push({ id: `finding:b${at + 1}`, kind: "finding", title, severity });
  tie("in", `finding:b${at + 1}`, "module:billing");
}
nodes.push({ id: "artist:the-beatles", kind: "artist", name: "The Beatles" });
for (const [slug, title, year] of [
  ["beatles-for-sale", "Beatles for Sale", 1964],
  ["help", "Help!", 1965],
  ["rubber-soul", "Rubber Soul", 1965],
]) {
  nodes.push({ id: `album:${slug}`, kind: "album", title, year });
  tie("madeBy", `album:${slug}`, "artist:the-beatles");
}

writeFileSync(new URL("./review.gdd.json", import.meta.url), `${JSON.stringify(doc, null, 2)}\n`);
writeFileSync(new URL("./review.seed.json", import.meta.url), `${JSON.stringify({ nodes, edges }, null, 2)}\n`);
