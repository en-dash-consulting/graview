#!/usr/bin/env node
/**
 * ADDS CONFORMANCE FIXTURES — NEVER REWRITES ONE (FR-32).
 *
 * Every candidate below whose id is not yet recorded is recorded, with what
 * THIS build makes of it: whether it compiles, what the check says, the tool
 * each act is offered as, the hash a log folds to. A fixture already
 * recorded is left exactly as it was — a change to it is an announced
 * difference (ANNOUNCED in fixtures.ts), never a regeneration — and the lock
 * gains the new ids' hashes.
 *
 *   pnpm build && node scripts/conformance-fixtures.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = (path) => import(resolve(root, "packages/core/dist", path));
const { FRAMEWORK_VERSION, Store } = await core("index.js");
const { compileDocument } = await core("check.js");
const { FIXTURES, ANNOUNCED, THIS_BUILD } = await core("conformance/index.js");

const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const vendors = readJson("packages/core/tests/document/fixtures/vendors.gdd.json");
const twoLines = {
  format: "graview-document",
  formatVersion: 1,
  name: "Chores",
  kinds: { chore: { fields: { title: { type: "string", required: true }, done: { type: "boolean" } } } },
  acts: { "add-chore": { title: "Add a chore", creates: "chore" } },
};

/** A log made by acting on a document's app, with a fixed clock and fixed ids, so it is the same every time. */
function logOf(document, author, calls) {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(`a log fixture's document does not compile: ${JSON.stringify(compiled.findings)}`);
  let id = 0;
  let tick = 0;
  const store = new Store({
    schema: compiled.app.schema,
    mutations: compiled.app.mutations ?? [],
    invariants: compiled.app.invariants ?? [],
    ...(compiled.app.policy ? { policy: compiled.app.policy } : {}),
    ids: () => `op${++id}`,
    now: () => new Date(Date.UTC(2026, 9, 2, 9, 0, tick++)).toISOString(),
  });
  for (const call of calls) {
    if (call.undo) store.undo(store.log.all().find((op) => op.intent.startsWith(call.undo)).batch, { author });
    else store.apply({ name: call.name, args: typeof call.args === "function" ? call.args(store) : call.args }, { author });
  }
  return JSON.parse(JSON.stringify(store.log.all()));
}
const owner = { kind: "human", id: "nick", roles: ["owner"] };
const firstOf = (store, kind) => store.graph.nodesOfKind(kind)[0].id;

const CANDIDATES = [
  { id: "document:vendors", kind: "document", document: vendors },
  { id: "document:two-lines", kind: "document", document: twoLines },
  {
    id: "log:vendors-booked-then-taken-back",
    kind: "log",
    document: "document:vendors",
    ops: () =>
      logOf(vendors, owner, [
        { name: "add-category", args: { name: "Florist", budget: 3000 } },
        { name: "add-vendor", args: { name: "Bloom & Co" } },
        { name: "file-under", args: (store) => ({ id: firstOf(store, "vendor"), to: firstOf(store, "category") }) },
        { name: "set-quote", args: (store) => ({ id: firstOf(store, "vendor"), quote: 2400 }) },
        { name: "book", args: (store) => ({ id: firstOf(store, "vendor") }) },
        { undo: "Book" },
      ]),
  },
  {
    id: "log:two-lines-made-and-done",
    kind: "log",
    document: "document:two-lines",
    ops: () =>
      logOf(twoLines, { kind: "human", id: "kai" }, [
        { name: "add-chore", args: { title: "Water the beds" } },
        { name: "edit-chore", args: (store) => ({ id: firstOf(store, "chore"), done: true }) },
      ]),
  },
];

const recorded = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));
const added = [];
for (const candidate of CANDIDATES) {
  if (recorded.has(candidate.id)) continue;
  if (candidate.kind === "document") {
    const compiled = compileDocument(candidate.document);
    added.push({
      id: candidate.id,
      since: FRAMEWORK_VERSION,
      kind: "document",
      document: candidate.document,
      expect: {
        compiles: compiled.ok,
        findings: compiled.ok ? [...THIS_BUILD.checkCodes(compiled.app)] : [],
        tools: compiled.ok ? THIS_BUILD.toolSchemas(compiled.app) : {},
      },
    });
  } else {
    const ops = candidate.ops();
    const compiled = compileDocument(CANDIDATES.find((one) => one.id === candidate.document).document);
    added.push({ id: candidate.id, since: FRAMEWORK_VERSION, kind: "log", document: candidate.document, ops, expect: { hash: THIS_BUILD.snapshotHash(THIS_BUILD.fold(compiled.app, ops)) } });
  }
}

const all = [...FIXTURES, ...added];
const file = resolve(root, "packages/core/src/conformance/fixtures.ts");
const source = readFileSync(file, "utf8");
const head = source.slice(0, source.indexOf("export const ANNOUNCED"));
writeFileSync(
  file,
  `${head}export const ANNOUNCED: readonly Announcement[] = ${JSON.stringify(ANNOUNCED, null, 2)};\n\nexport const FIXTURES: readonly ConformanceFixture[] = ${JSON.stringify(all, null, 2)} as never;\n`,
);

const lockPath = resolve(root, "packages/core/tests/conformance.lock.json");
let lock = {};
try {
  lock = JSON.parse(readFileSync(lockPath, "utf8"));
} catch {}
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
      : JSON.stringify(value);
for (const fixture of added) lock[fixture.id] = `sha256:${createHash("sha256").update(canonical(fixture)).digest("hex")}`;
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
process.stdout.write(`${added.length} fixture(s) added: ${added.map((fixture) => fixture.id).join(", ") || "none"}; ${all.length} in all.\n`);
