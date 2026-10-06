import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { describePlace } from "../../src/describe.js";
import { compileDocument, editDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * FR-84 and FR-89 together: a rename is only a rename. LifeLogics with
 * `offer` renamed to `item` and an offer's `list` renamed to `price` —
 * its records moved with it — says, place by place and seat by seat,
 * exactly what it said before.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const before = read("lifelogics.gdd.json") as GraviewDocument;
const seed = read("lifelogics.seed.json") as { nodes: Record<string, unknown>[]; edges: unknown[] };
const outcome = editDocument(before, [
  { op: "rename-field", kind: "offer", field: "list", to: "price" },
  { op: "rename-kind", kind: "offer", to: "item" },
]);
if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
const after = outcome.document;
const moved = {
  nodes: seed.nodes.map((node) => {
    if (node["kind"] !== "offer") return node;
    // Each value where it stood: a record's facts are read in the order it holds them.
    return Object.fromEntries(Object.entries(node).map(([key, value]) => (key === "list" ? ["price", value] : key === "kind" ? ["kind", "item"] : [key, value])));
  }),
  edges: seed.edges,
};

function open(document: GraviewDocument, snapshot: unknown) {
  const compiled = compileDocument(document, { today: () => "2026-10-05" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  return { app, store: new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never }) };
}
const was = open(before, seed);
const now = open(after, moved);
const say = (opened: ReturnType<typeof open>, principal: Principal, place: string) => {
  const result = describePlace(opened.store, principal, place, { app: opened.app, width: 390, today: "2026-10-05" });
  if (!result.ok) throw new Error(result.error);
  return { ...result.description, parts: JSON.parse(JSON.stringify(result.description.parts).replace(/"kind":"item"/g, '"kind":"offer"')) };
};

const SEATS: readonly [string, Principal][] = [
  ["an owner", { kind: "human", id: "u:owner", roles: ["owner"] }],
  ["the delivery partner", { kind: "human", id: "party-delivery", roles: ["partner"] }],
];

describe("a renamed app says what it said", () => {
  for (const place of ["home", "the-offers", "the-packages", "what-we-heard", "open-questions", "offers", "packages", "pkg-whole", "offer-suite"]) {
    for (const [who, principal] of SEATS) {
      it(`${place}, as ${who}`, () => {
        const a = say(was, principal, place);
        const b = say(now, principal, place);
        expect(b.parts).toEqual(a.parts);
        expect(b.problems).toEqual(a.problems);
      });
    }
  }
});
