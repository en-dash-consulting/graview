import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { evaluateExpr, parseExpr } from "../../src/document/expr/index.js";
import { ActRefusal, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A GUARD CAN SAY THE RECORD'S OWN VALUE WHERE AN ARGUMENT HAS THE SAME NAME
 * (Roadmap f-guard-reads-record-not-argument). In an act's `allowedWhen` and
 * its `refusal`, a bare name reads the argument the call gave by that name,
 * and the record's field only where the call gave none. `$subject` is the
 * record the act is on, so `$subject.holder` is always the record's own
 * holder, whatever the call says. graview check warns when a guard or a
 * refusal reads a bare name that is both a field of the kind and an argument
 * of the act.
 */
const leases = (take: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Leases",
  description: "Who holds which piece of work.",
  kinds: {
    lease: {
      noun: "lease",
      plural: "leases",
      label: "{name}",
      description: "A hold on one piece of work.",
      fields: {
        name: { type: "string", required: true },
        holder: { type: "string" },
        expiresAt: { type: "datetime" },
      },
    },
  },
  acts: { take: { title: "Take", on: "lease", writes: ["holder", "expiresAt"], ...take } },
});

const onTheRecord = { allowedWhen: "$subject.holder == null or $subject.expiresAt < now()", refusal: "{name} is held by {$subject.holder}" };
const bare = { allowedWhen: "holder == null or expiresAt < now()", refusal: "{name} is held by {holder}" };

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-11-08" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>, expiresAt: string) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    snapshot: { nodes: [{ id: "lease-a", kind: "lease", name: "Build the page", holder: "worker-a", expiresAt }], edges: [] } as never,
  });
const LIVE = "2099-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";
const take = { id: "lease-a", holder: "worker-b", expiresAt: PAST };

describe("a guard reads the record's own value as $subject", () => {
  it("judges the record, not the call: a live lease is refused whatever expiresAt the call sends", () => {
    const store = storeOf(compiled(leases(onTheRecord)), LIVE);
    expect(() => store.apply({ name: "take", args: take })).toThrow(ActRefusal);
    expect((store.graph.getNode("lease-a") as Record<string, unknown>)["holder"]).toBe("worker-a");
  });

  it("names the record's own value in its refusal", () => {
    const store = storeOf(compiled(leases(onTheRecord)), LIVE);
    expect(() => store.apply({ name: "take", args: take })).toThrow("Build the page is held by worker-a");
  });

  it("allows the call once the record's own lease has run out", () => {
    const store = storeOf(compiled(leases(onTheRecord)), PAST);
    store.apply({ name: "take", args: { ...take, expiresAt: LIVE } });
    expect((store.graph.getNode("lease-a") as Record<string, unknown>)["holder"]).toBe("worker-b");
  });

  it("a bare name reads the argument the call gave by that name", () => {
    const store = storeOf(compiled(leases(bare)), LIVE);
    store.apply({ name: "take", args: take });
    expect((store.graph.getNode("lease-a") as Record<string, unknown>)["holder"]).toBe("worker-b");
  });

  it("is the outer record inside a where, where bare names are the member's", () => {
    const expr = parseExpr("count(all('lease') where holder == $subject.holder)");
    const a = { id: "a", kind: "lease", name: "A", holder: "x" };
    const b = { id: "b", kind: "lease", name: "B", holder: "x" };
    const c = { id: "c", kind: "lease", name: "C", holder: "y" };
    const all = [a, b, c];
    const graph = { getNode: (id: string) => all.find((n) => n.id === id), has: () => true, nodesOfKind: (kind: string) => all.filter((n) => n.kind === kind), out: () => [], in: () => [] };
    expect(evaluateExpr(expr, { graph: graph as never, subject: a as never, kinds: new Map() })).toBe(2);
  });

  it("follows a renamed field, in the condition and the refusal", () => {
    const renamed = editDocument(leases(onTheRecord) as never, [{ op: "rename-field", kind: "lease", field: "holder", to: "owner" }]);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const act = (renamed.document.acts as Record<string, { allowedWhen: string; refusal: string }>)["take"]!;
    expect(act.allowedWhen).toContain("$subject.owner == null");
    expect(act.refusal).toBe("{name} is held by {$subject.owner}");
  });

  it("is the only name the language spells with a $", () => {
    expect(() => parseExpr("$record.holder == null")).toThrow(/\$subject/);
  });
});

describe("graview check and a name that means both", () => {
  const warned = (doc: unknown) => compileDocument(doc, { today: () => "2026-11-08" }).findings.filter((f) => f.code === "act-name-means-both");

  it("warns of a guard's bare name that is a field and an argument, naming the act and the field", () => {
    const found = warned(leases({ allowedWhen: bare.allowedWhen }));
    expect(found.map((f) => [f.severity, f.path])).toEqual([
      ["warning", "acts.take.allowedWhen"],
      ["warning", "acts.take.allowedWhen"],
    ]);
    expect(found[0]!.message).toMatch(/"take"/);
    expect(found[0]!.message).toMatch(/holder/);
    expect(found[0]!.fix).toMatch(/\$subject\.holder/);
    expect(found[1]!.message).toMatch(/expiresAt/);
  });

  it("warns of a refusal's bare name the same way", () => {
    expect(warned(leases({ allowedWhen: onTheRecord.allowedWhen, refusal: bare.refusal })).map((f) => f.path)).toEqual(["acts.take.refusal"]);
  });

  it("says nothing of $subject's fields, nor of a field the act takes no argument for", () => {
    expect(warned(leases(onTheRecord))).toEqual([]);
    expect(warned(leases({ allowedWhen: "name != ''", refusal: "{name} is held" }))).toEqual([]);
  });
});
