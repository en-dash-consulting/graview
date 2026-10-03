import { readFileSync } from "node:fs";
import { PermissionDeniedError, Store, type AnyGraphNode, type AnySchema } from "@graview/core";
import { createToolRuntime } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { compileDocument, sayFindings, type CompiledDocument } from "@graview/core/document";

const vendors = JSON.parse(readFileSync(new URL("../packages/core/tests/document/fixtures/vendors.gdd.json", import.meta.url), "utf8"));
const TODAY = "2026-10-02";

function compiled(doc: unknown = vendors): CompiledDocument {
  const result = compileDocument(doc, { today: () => TODAY });
  if (!result.ok) throw new Error(sayFindings(result.findings));
  return result;
}

function storeOf(c: CompiledDocument) {
  const { app } = c;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    invariantOptions: { today: TODAY },
  });
}

const nodesOf = (store: Store<AnySchema>, kind: string) => store.graph.nodesOfKind(kind as never) as AnyGraphNode[];

const owner = { kind: "human" as const, id: "user:ada", roles: ["owner"] };
const viewer = { kind: "human" as const, id: "user:bo", roles: ["viewer"] };

describe("a document compiles into an app the framework accepts", () => {
  it("`writes` beside `creates` names fields of the new record, not a subject", () => {
    const doc = { ...vendors, acts: { ...vendors.acts, "add-vendor": { title: "Add a vendor", creates: "vendor", writes: ["name", "quote"] } } };
    const store = storeOf(compiled(doc));
    store.apply({ name: "add-vendor", args: { name: "Bloom", quote: 2400 } }, { author: { kind: "human", id: "user:a", roles: ["owner"] } as never });
    expect(store.graph.allNodes().find((n) => n["name"] === "Bloom")).toMatchObject({ quote: 2400 });
    const wrong = compileDocument({ ...doc, acts: { ...doc.acts, "add-vendor": { creates: "vendor", writes: ["price"] } } });
    expect(wrong.ok).toBe(false);
  });

  it("passes the framework's own check with no errors", () => {
    const c = compiled();
    expect(c.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(c.app.schema.kinds).toEqual(["category", "vendor"]);
  });

  it("runs acts through the store: create, connect, write, guard, undo", () => {
    const store = storeOf(compiled());
    store.apply({ name: "add-category", args: { name: "Florist", budget: 3000 } }, { author: owner });
    const florist = nodesOf(store, "category")[0]!;
    store.apply({ name: "add-to-category", args: { id: florist.id, name: "Bloom & Co" } }, { author: owner });
    const bloom = nodesOf(store, "vendor")[0]!;
    expect(bloom["status"]).toBe("researching");
    expect(store.graph.out(bloom.id, "fills").map((n) => n.id)).toEqual([florist.id]);

    const quoted = store.apply({ name: "set-quote", args: { id: bloom.id, quote: 2400 } }, { author: owner });
    expect(store.graph.getNode(bloom.id)!["quote"]).toBe(2400);

    store.apply({ name: "book", args: { id: bloom.id } }, { author: owner });
    expect(store.graph.getNode(bloom.id)!["status"]).toBe("booked");

    // Selective undo: booking read the vendor after the quote was written, so the
    // quote cannot be taken back alone — the framework names what is in the way.
    expect(() => store.undo(quoted.batch, { author: owner })).toThrow(/a later operation depends on it: "Book: Bloom & Co"/);
    const booked = store.batches().at(-1)!;
    store.undo([quoted.batch, booked.id], { author: owner });
    expect(store.graph.getNode(bloom.id)!["quote"]).toBeUndefined();
    expect(store.graph.getNode(bloom.id)!["status"]).toBe("researching");
  });

  it("an allowedWhen guard refuses with the document's own sentence", () => {
    const store = storeOf(compiled());
    store.apply({ name: "add-vendor", args: { name: "Sad Cakes" } }, { author: owner });
    const cakes = nodesOf(store, "vendor")[0]!;
    store.apply({ name: "decline", args: { id: cakes.id } }, { author: owner });
    expect(() => store.apply({ name: "book", args: { id: cakes.id } }, { author: owner })).toThrow("Sad Cakes was declined; reopen them first");
  });

  it("schema-checks an act's arguments, as a defineMutation act is", () => {
    const store = storeOf(compiled());
    expect(() => store.apply({ name: "add-vendor", args: { name: 42 } }, { author: owner })).toThrow();
    expect(() => store.apply({ name: "add-vendor", args: {} }, { author: owner })).toThrow();
    expect(store.log.all()).toHaveLength(0);
  });

  it("the policy refuses a role with no grant", () => {
    const store = storeOf(compiled());
    expect(() => store.apply({ name: "add-vendor", args: { name: "Nope" } }, { author: viewer })).toThrow(PermissionDeniedError);
  });

  it("rules yield violations with the document's sentence and offered repairs", () => {
    const store = storeOf(compiled());
    store.apply({ name: "add-category", args: { name: "Venue", budget: 10000 } }, { author: owner });
    const venue = nodesOf(store, "category")[0]!;
    store.apply({ name: "add-to-category", args: { id: venue.id, name: "The Barn" } }, { author: owner });
    store.apply({ name: "add-to-category", args: { id: venue.id, name: "The Loft" } }, { author: owner });
    const [barn, loft] = nodesOf(store, "vendor");
    store.apply({ name: "book", args: { id: barn!.id } }, { author: owner });

    const needsQuote = store.violations().find((v) => v.invariant === "booked-needs-quote")!;
    expect(needsQuote.message).toBe("The Barn is booked but has no quote");
    expect(needsQuote.repairs[0]).toMatchObject({ mutation: "set-quote", label: "Add the quote", args: { id: barn!.id }, missing: ["quote"] });

    store.apply({ name: "set-quote", args: { id: barn!.id, quote: 8000 } }, { author: owner });
    store.apply({ name: "set-quote", args: { id: loft!.id, quote: 4000 } }, { author: owner });
    store.apply({ name: "book", args: { id: loft!.id } }, { author: owner });
    const messages = store.violations().map((v) => v.message).sort();
    expect(messages).toEqual(["Venue has more than one vendor booked", "Venue is over its 10,000 budget"]);
  });

  it("the derived agent tool surface lists one tool per permitted act", async () => {
    const store = storeOf(compiled());
    const runtime = createToolRuntime(store as never, { author: owner } as never);
    const names = runtime.definitions.map((t) => t.name);
    for (const act of ["add-vendor", "book", "set-quote", "add-to-category"]) expect(names).toContain(act);
    const book = runtime.definitions.find((t) => t.name === "book")!;
    expect(JSON.stringify(book)).toContain("Mark a vendor as booked");
  });

  it("labels come from templates and the first required word field", () => {
    const c = compiled();
    const vendor = c.app.schema.definition("vendor" as never) as unknown as { label: (n: unknown) => string; describe: (n: unknown) => string };
    expect(vendor.label({ id: "v1", kind: "vendor", name: "Bloom", status: "booked", quote: 2400 })).toBe("Bloom");
    expect(vendor.describe({ id: "v1", kind: "vendor", name: "Bloom", status: "booked", quote: 2400 })).toBe("booked · 2,400");
  });
});

describe("a document that is wrong says where and why", () => {
  const broken = (patch: (d: any) => void) => {
    const d = structuredClone(vendors);
    patch(d);
    const r = compileDocument(d, { today: () => TODAY });
    expect(r.ok).toBe(false);
    return r.findings;
  };

  it("an unknown key is named, not ignored", () => {
    const f = broken((d) => (d.rules["booked-needs-quote"].requires = "x"));
    expect(f[0]).toMatchObject({ code: "unknown-key", path: "rules.booked-needs-quote" });
  });

  it("an edge to an undeclared kind", () => {
    const f = broken((d) => (d.kinds.vendor.edges.fills.to = ["venue"]));
    expect(f).toContainEqual(expect.objectContaining({ code: "edge-target", path: "kinds.vendor.edges.fills.to" }));
  });

  it("a rule naming a field its kind lacks", () => {
    const f = broken((d) => (d.rules["booked-needs-quote"].require = "price != null"));
    expect(f).toContainEqual(expect.objectContaining({ code: "rule-name", message: 'vendor has no field or relation called "price"' }));
  });

  it("an expression that does not parse, with the place", () => {
    const f = broken((d) => (d.rules["booked-needs-quote"].require = "quote != "));
    expect(f[0]).toMatchObject({ code: "expression", path: "rules.booked-needs-quote.require" });
  });

  it("an act setting a field the kind lacks", () => {
    const f = broken((d) => (d.acts.book.sets = { state: "booked" }));
    expect(f).toContainEqual(expect.objectContaining({ code: "act-field" }));
  });

  it("a grant naming an act nobody declared", () => {
    const f = broken((d) => (d.policy.grants[0].mutations = ["approve"]));
    expect(f).toContainEqual(expect.objectContaining({ code: "grant-act", path: "policy.grants.0.mutations" }));
  });

  it("not JSON at all", () => {
    const r = compileDocument("{ nope", { today: () => TODAY });
    expect(r.ok).toBe(false);
    expect(r.findings[0]!.code).toBe("not-json");
  });

  it("a two-line document is a working app", () => {
    const r = compileDocument({ format: "graview-document", formatVersion: 1, name: "Books", kinds: { book: { fields: { title: { type: "string", required: true } } } } });
    if (!r.ok) throw new Error(sayFindings(r.findings));
    expect(r.ok).toBe(true);
  });
});

describe("an act that makes a record and then fills it in", () => {
  it("does not claim to write its (absent) subject's fields", () => {
    const r = compileDocument({
      format: "graview-document", formatVersion: 1, name: "Notes",
      kinds: { note: { fields: { body: { type: "text", required: true }, received: { type: "datetime" } } } },
      acts: { "receive-note": { title: "Receive", description: "A note arrives.", creates: "note", effects: [{ set: { received: "$now" }, target: "$new" }] } },
    }, { today: () => TODAY });
    if (!r.ok) throw new Error(sayFindings(r.findings));
    const store = new Store<AnySchema>({ schema: r.app.schema, mutations: r.app.mutations ?? [] });
    store.apply({ name: "receive-note", args: { body: "hi" } });
    expect(typeof nodesOf(store, "note")[0]!["received"]).toBe("string");
  });
});
