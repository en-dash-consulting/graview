#!/usr/bin/env node
// What an op costs written down, in op format 1 (an inverse beside the
// primitives) and op format 2 (the inverse derived), on the Beatles app:
// its seed, then a cover image on each release, each cover changed once,
// and ordinary edits beside them — the shape of a heavy hosted app's log.
//
//   pnpm build && node scripts/op-bytes.mjs              the Beatles' 18 releases
//   node scripts/op-bytes.mjs --covers 479               as many covers as the discography has albums
//   node scripts/op-bytes.mjs --image-kb 19 --edits 400  a cover's size, and how many plain edits
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = (path) => import(resolve(root, "packages/core/dist", path));
const { Store, withInverse } = await core("index.js");
const { compileDocument } = await core("check.js");

const args = process.argv.slice(2);
const option = (name, otherwise) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? Number(args[at + 1]) : otherwise;
};
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
// A cover kept in the record itself, as a data URL in a text field — how a heavy hosted app's covers came to be in its log.
const beatles = readJson("packages/core/tests/document/fixtures/beatles.gdd.json");
const document = {
  ...beatles,
  kinds: { ...beatles.kinds, artwork: { ...beatles.kinds.artwork, fields: { ...beatles.kinds.artwork.fields, picture: { type: "text" } } } },
  acts: {
    ...beatles.acts,
    "change-picture": { title: "Change the picture", on: "artwork", writes: ["picture"], description: "Put another cover on it." },
    "rename-song": { title: "Rename", on: "song", writes: ["name"], description: "Call a song something else." },
  },
};
const seed = readJson("packages/core/tests/document/fixtures/beatles.seed.json");
const imageKb = option("image-kb", 19);
const edits = option("edits", 200);

/** A data URL of about `kb` kilobytes, different for each `n`, as a photographed cover would be. */
const image = (n, kb = imageKb) => {
  let body = "";
  let x = n * 2654435761;
  while (body.length < kb * 1024) {
    x = (x * 1103515245 + 12345) % 2147483648;
    body += x.toString(36);
  }
  // A text field keeps 20,000 characters: the prefix comes out of the picture.
  return `data:image/jpeg;base64,${body.slice(0, kb * 1024 - 23)}`;
};

const compiled = compileDocument(document);
if (!compiled.ok) throw new Error(`The Beatles document does not compile: ${JSON.stringify(compiled.findings)}`);
const owner = { kind: "human", id: "nick", roles: ["owner"] };
let id = 0;
let tick = 0;
const store = new Store({
  schema: compiled.app.schema,
  mutations: compiled.app.mutations ?? [],
  invariants: compiled.app.invariants ?? [],
  ...(compiled.app.policy ? { policy: compiled.app.policy } : {}),
  snapshot: seed,
  ids: () => `op${++id}`,
  now: () => new Date(Date.UTC(2026, 9, 21, 9, 0, tick++)).toISOString(),
});
const names = new Set((compiled.app.mutations ?? []).map((one) => one.name));
const act = (name, callArgs) => {
  if (!names.has(name)) throw new Error(`No act "${name}" (there are ${[...names].join(", ")})`);
  return store.apply({ name, args: callArgs }, { author: owner });
};
const releases = store.graph.nodesOfKind("release");
const songs = store.graph.nodesOfKind("song");
const covers = option("covers", releases.length);

for (let n = 0; n < covers; n++) act("add-artwork", { name: `Cover ${n + 1}`, picture: image(n) });
const artworks = store.graph.nodesOfKind("artwork").filter((one) => one.picture);
for (const [n, art] of artworks.entries()) act("change-picture", { id: art.id, picture: image(10_000 + n) });
for (let n = 0; n < edits; n++) {
  const song = songs[n % songs.length];
  act("rename-song", { id: song.id, name: `${song.name} (take ${n + 1})` });
}
// And somebody takes back the last few covers they changed.
for (const batch of store.batches().filter((one) => one.intent.startsWith("Change")).slice(0, 5)) store.undo(batch.id, { author: owner });

const ops = store.log.all();
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const kib = (n) => `${(n / 1024).toFixed(1)} KB`;
const mib = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const rows = new Map();
for (const op of ops) {
  const what = op.undoes ? "undo" : (op.mutation?.name ?? "host change");
  const row = rows.get(what) ?? { n: 0, v1: 0, v2: 0 };
  row.n++;
  row.v1 += bytes(withInverse(op));
  row.v2 += bytes(op);
  rows.set(what, row);
}
const v1 = ops.reduce((sum, op) => sum + bytes(withInverse(op)) + 1, 0);
const v2 = ops.reduce((sum, op) => sum + bytes(op) + 1, 0);
console.log(`The Beatles: ${covers} covers of ${imageKb} KB, each changed once, ${edits} edits, 5 undone — ${ops.length} ops`);
console.log(`${"op".padEnd(16)} ${"ops".padStart(5)}  ${"format 1, each".padStart(15)}  ${"format 2, each".padStart(15)}  saved`);
for (const [what, row] of rows) {
  console.log(`${what.padEnd(16)} ${String(row.n).padStart(5)}  ${kib(row.v1 / row.n).padStart(15)}  ${kib(row.v2 / row.n).padStart(15)}  ${(100 * (1 - row.v2 / row.v1)).toFixed(0)}%`);
}
console.log(`whole log (one op a line)  format 1 ${mib(v1)}   format 2 ${mib(v2)}   saved ${(100 * (1 - v2 / v1)).toFixed(0)}%`);
