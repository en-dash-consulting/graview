import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/document/describe-place.js";
import { describeApp } from "../../src/cli/describe.js";
import { checkApp } from "../../src/cli/check.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { columnMoves, columnReach } from "../../src/describe.js";

/**
 * A NAMED STEP IS A MOVE (FR-108).
 *
 * A template already says how a record moves, with named steps that set its
 * status to a constant — `book` (unless declined), `mark-fixed` (which also
 * stamps the day), `reopen` (only from declined). A status board offers each
 * as the move to that value's column, only where its condition holds for
 * that record, and runs it as declared, everything it also records
 * included. The fixtures are Cloud's vendor shortlist and bug bash with
 * their free `set-status` acts taken out.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as GraviewDocument;
const vendors = read("vendor-steps.gdd.json");
const bugs = read("bug-bash.gdd.json");

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-06" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

const OWNER: Principal = { kind: "human", id: "o1", roles: ["owner"] };
const VIEWER: Principal = { kind: "human", id: "v1", roles: ["viewer"] };

function storeOf(app: GraviewApp<AnySchema>, nodes: readonly Record<string, unknown>[]) {
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes, edges: [] } as never });
}

const VENDORS = [
  { id: "v-new", kind: "vendor", name: "Bloom & Co", status: "researching" },
  { id: "v-out", kind: "vendor", name: "Petal Pushers", status: "declined" },
  { id: "v-in", kind: "vendor", name: "Sugar & Spoon", status: "contacted", quote: 450 },
];
const said = (moves: ReturnType<typeof columnMoves>) => moves.map((move) => [move.to, move.call.name]);

describe("in the vendor shortlist with no free set-status", () => {
  const app = compiled(vendors);

  it("a researching vendor offers Contacted, Booked and Declined, each by its named step", () => {
    const store = storeOf(app, VENDORS);
    expect(said(columnMoves(store, OWNER, store.graph.getNode("v-new") as never, "status"))).toEqual([
      ["contacted", "mark-contacted"],
      ["booked", "book"],
      ["declined", "decline"],
    ]);
  });

  it("a declined one offers only Contacted, by reopen: book's condition does not hold for it", () => {
    const store = storeOf(app, VENDORS);
    expect(said(columnMoves(store, OWNER, store.graph.getNode("v-out") as never, "status"))).toEqual([["contacted", "reopen"]]);
  });

  it("calls the step with the record alone, as the act was declared", () => {
    const store = storeOf(app, VENDORS);
    const [first] = columnMoves(store, OWNER, store.graph.getNode("v-new") as never, "status");
    expect(first).toEqual({ to: "contacted", call: { name: "mark-contacted", args: { id: "v-new" } }, title: "Mark as contacted" });
  });

  it("offers a viewer, who may run none of the steps, no move", () => {
    const store = storeOf(app, VENDORS);
    for (const id of ["v-new", "v-out", "v-in"]) expect(columnMoves(store, VIEWER, store.graph.getNode(id) as never, "status")).toEqual([]);
  });
});

describe("where a named step and a free set-<field> act both reach a column", () => {
  const withFree = structuredClone(vendors) as GraviewDocument & { acts: Record<string, unknown> };
  withFree.acts["set-status"] = { title: "Set the status", on: "vendor", sets: { status: "$status" } };
  const app = compiled(withFree);

  it("the named step wins, and the free act reaches only the columns no step does", () => {
    const store = storeOf(app, VENDORS);
    expect(said(columnMoves(store, OWNER, store.graph.getNode("v-in") as never, "status"))).toEqual([
      ["researching", "set-status"],
      ["booked", "book"],
      ["declined", "decline"],
    ]);
  });

  it("a column whose step refuses this record is not reached by the free act instead: the condition is never skipped", () => {
    const store = storeOf(app, VENDORS);
    expect(said(columnMoves(store, OWNER, store.graph.getNode("v-out") as never, "status"))).toEqual([
      ["researching", "set-status"],
      ["contacted", "reopen"],
    ]);
  });

  it("is said column by column, steps first", () => {
    const reach = columnReach(app.schema, app.mutations ?? [], "vendor", "status");
    expect(reach.map((one) => [one.value, one.by, one.acts.map((act) => act.name)])).toEqual([
      ["researching", "value", ["set-status"]],
      ["contacted", "step", ["mark-contacted", "reopen"]],
      ["booked", "step", ["book"]],
      ["declined", "step", ["decline"]],
    ]);
  });
});

describe("in the bug bash with no free set-status", () => {
  const app = compiled(bugs);
  const ISSUES = [
    { id: "i1", kind: "issue", title: "Card payment spins forever", severity: "blocker", status: "fixing" },
    { id: "i2", kind: "issue", title: "Typo on the receipt", severity: "cosmetic", status: "open" },
  ];

  it("every column is reached by its step", () => {
    const store = storeOf(app, ISSUES);
    expect(said(columnMoves(store, OWNER, store.graph.getNode("i1") as never, "status"))).toEqual([
      ["open", "reopen"],
      ["fixed", "mark-fixed"],
      ["won't fix", "wont-fix"],
    ]);
  });

  it("a move to Fixed runs mark-fixed as declared: it stamps fixedOn, and one undo takes both back", () => {
    const store = storeOf(app, ISSUES);
    const fixed = columnMoves(store, OWNER, store.graph.getNode("i1") as never, "status").find((move) => move.to === "fixed")!;
    const result = store.apply(fixed.call, { author: OWNER });
    expect(store.graph.getNode("i1")).toMatchObject({ status: "fixed", fixedOn: "2026-10-06" });
    store.undo(result.batch, { author: OWNER });
    expect(store.graph.getNode("i1")?.["status"]).toBe("fixing");
    expect(store.graph.getNode("i1")?.["fixedOn"]).toBeUndefined();
  });
});

describe("graview check notes a column nothing moves a card into", () => {
  it("in the vendor shortlist with no free set-status: Researching, at the binding's path", () => {
    const notes = checkApp(compiled(vendors)).findings.filter((f) => f.code === "lens-column-unreached");
    expect(notes.map((f) => [f.severity, f.where, f.message])).toEqual([["note", "lenses.0.bindings.vendor.column", '"Vendors by status" has a column no act moves a card into: Researching.']]);
  });

  it("and not in the bug bash, whose steps reach every column", () => {
    expect(checkApp(compiled(bugs)).findings.filter((f) => f.code === "lens-column-unreached")).toEqual([]);
  });
});

describe("graview describe and describePlace say which act moves to which column", () => {
  it("describe names each column's act", () => {
    const text = describeApp(compiled(vendors));
    expect(text).toContain(
      '"Vendors by status" moves a vendor to Contacted by "Mark as contacted" or "Reopen", to Booked by "Book" and to Declined by "Decline", for a seat its policy lets run it and where the act\'s condition holds for that vendor; any other seat is offered no move.',
    );
    expect(text).toContain('Nothing moves a vendor to Researching from the board.');
  });

  it("describePlace says the moves this seat is offered on this board, and none for a viewer", () => {
    const app = compiled(vendors);
    const store = storeOf(app, VENDORS);
    const owner = describePlace(store, OWNER, "vendors-by-status", { app, width: 390 });
    if (!owner.ok) throw new Error(owner.error);
    // A declined vendor is retired, so off the board: Contacted is reached here only by "Mark as contacted".
    expect(owner.description.text).toContain('Moves: to Contacted by "Mark as contacted"; to Booked by "Book"; to Declined by "Decline".');
    const viewer = describePlace(store, VIEWER, "vendors-by-status", { app, width: 390 });
    if (!viewer.ok) throw new Error(viewer.error);
    expect(viewer.description.text).toContain("Moves: none for this seat.");
  });
});
