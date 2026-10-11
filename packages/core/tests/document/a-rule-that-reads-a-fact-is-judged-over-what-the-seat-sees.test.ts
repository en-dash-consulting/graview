import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { answerSeenBy, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import "../../src/lines.js";

/**
 * A RULE THAT READS A FACT IS JUDGED, AND WORDED, OVER WHAT THE SEAT SEES.
 * A document's fact (`fact('<name>')`) is a count of the whole graph; a
 * rule that read one was judged over the whole graph and its sentence said
 * there, so a guest who sees one proposal was told "3 proposed". A seat's
 * problems are now judged over its sighted view, as a page served only
 * what its seat sees judges them, and `graview check` warns of a rule that
 * says a fact some role may not see all of (`rule-says-hidden-fact`).
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Proposals",
  roles: ["owner", "guest"],
  kinds: {
    person: { fields: { name: { type: "string", required: true } }, label: "{name}" },
    proposal: {
      fields: { title: { type: "string", required: true }, proposed: { type: "boolean" } },
      label: "{title}",
      edges: { by: { to: ["person"], cardinality: "one", description: "who wrote it", inverse: "what they proposed" } },
    },
  },
  computed: { proposed: "count(all('proposal') where proposed == true)" },
  rules: {
    "too-many-proposed": { over: "graph", require: "fact('proposed') <= 2", says: "{fact('proposed')} proposed, and at most two may be" },
    "none-proposed": { title: "Nothing proposed", over: "graph", require: "fact('proposed') < 1" },
    "a-title": { over: "proposal", require: "title != ''", says: "{title} has no title" },
  },
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["person", "proposal"] },
      { roles: ["guest"], kinds: ["person", "proposal"], own: true },
    ],
  },
} as const;

const compiled = compileDocument(document as never, { today: () => "2026-10-11" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;

const owner: Principal = { kind: "human", id: "person-ola", roles: ["owner"] };
const guest: Principal = { kind: "human", id: "person-gus", roles: ["guest"] };
const proposal = (id: string, by: string, proposed = true) => ({ node: { id, kind: "proposal", title: id, proposed }, edge: { kind: "by", from: id, to: by } });
const make = (hidden: number) => {
  const theirs = [proposal("mine", "person-gus"), proposal("draft", "person-gus", false), ...Array.from({ length: 2 + hidden }, (_, i) => proposal(`theirs-${i}`, "person-ola"))];
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    policy: app.policy!,
    snapshot: {
      nodes: [{ id: "person-ola", kind: "person", name: "Ola" }, { id: "person-gus", kind: "person", name: "Gus" }, ...theirs.map((one) => one.node)],
      edges: theirs.map((one) => one.edge),
    } as never,
  });
};
const said = (violations: readonly { invariant: string; message: string; line?: { text: string } }[]) => violations.map((v) => [v.invariant, v.message, v.line?.text ?? null]);

describe("a rule that reads a fact", () => {
  it("is judged over the whole graph for the store, and for a seat that sees it all", () => {
    const store = make(0);
    expect(said(store.violations()).map(([rule, message]) => [rule, message])).toEqual([
      ["too-many-proposed", "3 proposed, and at most two may be"],
      ["none-proposed", "Nothing proposed — fact (proposed) 3 ≥ 1"],
    ]);
    expect(said(store.seenBy(owner).violations())).toEqual(said(store.violations()));
  });

  it("is judged and worded over what a seat sees: a guest who sees one proposal is never told of three", () => {
    const store = make(0);
    const theirs = store.seenBy(guest).violations();
    // One proposed is within the limit, as far as the guest can tell…
    expect(theirs.map((v) => v.invariant)).not.toContain("too-many-proposed");
    // …and the line of the rule it does break says the one it sees.
    const none = theirs.find((v) => v.invariant === "none-proposed")!;
    expect(none.message).toBe("Nothing proposed — fact (proposed) 1 ≥ 1");
    expect(none.line?.text).toBe("fact (proposed) 1 ≥ 1");
    expect(JSON.stringify(theirs)).not.toMatch(/\b3\b/);
  });

  it("never changes a seat's line for a record the seat may not see", () => {
    const seat = (hidden: number) => said(make(hidden).seenBy(guest).violations());
    const before = seat(0);
    for (const hidden of [1, 5, 40]) expect(seat(hidden)).toEqual(before);
    // The owner, who sees them, is told each count.
    expect(said(make(5).seenBy(owner).violations())[0]![1]).toBe("8 proposed, and at most two may be");
  });

  it("is answered to a seat's act as the seat judges it: what it breaks and what stands after, in its own words", () => {
    const store = make(0);
    // The guest proposes its draft: three become four to the whole graph, and one two to the guest.
    const made = answerSeenBy(store, guest, store.apply({ name: "edit-proposal", args: { id: "draft", proposed: true } }, { author: guest }));
    expect(made.introduces.map((v) => v.invariant)).not.toContain("too-many-proposed");
    expect(JSON.stringify(made.violationsAfter)).not.toMatch(/\b4\b/);
    expect(made.violationsAfter.map((v) => v.message)).toContain("Nothing proposed");
  });

  it("is said by its title in a preview to a seat: judged over the whole graph, it may count what the seat may not see", () => {
    const store = make(0);
    const preview = answerSeenBy(store, guest, store.preview({ name: "edit-proposal", args: { id: "draft", proposed: true } }, undefined, { author: guest }));
    expect(preview.violationsAfter.map((v) => v.message)).toContain("too many proposed");
    for (const one of [...preview.introduces, ...preview.resolves, ...preview.violationsAfter]) expect(one.message).not.toMatch(/\d/);
    // A rule that reads only its subject says its own sentence still.
    const untitled = store.preview({ name: "edit-proposal", args: { id: "draft", title: "" } }, undefined, { author: guest });
    expect(answerSeenBy(store, guest, untitled).introduces.map((v) => v.message)).toEqual([" has no title"]);
  });
});

describe("graview check", () => {
  type Said = { readonly code: string; readonly severity: string; readonly message: string; readonly where?: string; readonly path?: string };
  const warned = (findings: readonly Said[]) => findings.filter((f) => f.code === "rule-says-hidden-fact" || f.code === "check:rule-says-hidden-fact");

  it("warns of a rule that says a fact some role may not see all of, naming the rule, the fact, the kind and the role", () => {
    const found = warned(checkApp(app).findings);
    expect(found.map((f) => [f.where, f.severity])).toEqual([
      ["too-many-proposed", "warning"],
      ["none-proposed", "warning"],
    ]);
    expect(found[0]!.message).toContain(`fact('proposed')`);
    expect(found[0]!.message).toContain(`proposal records "guest" may not see all of`);
    expect(found.every((f) => !f.message.includes(`"owner"`))).toBe(true);
    // The document's own compile says it at the rule's path.
    expect(warned(compiled.findings).map((f) => f.path)).toEqual(["rules.too-many-proposed", "rules.none-proposed"]);
  });

  it("says nothing where every role that is told the rule sees every record the fact reads", () => {
    const open = compileDocument({ ...document, policy: { ...document.policy, sees: [{ roles: ["owner", "guest"], kinds: ["person", "proposal"] }] } } as never);
    if (!open.ok) throw new Error("compiles");
    expect(warned(checkApp(open.app as GraviewApp<AnySchema>).findings)).toEqual([]);
  });

  it("follows a fact that reads another, and leaves alone a rule whose sentence says no fact", () => {
    const nested = compileDocument({
      ...document,
      computed: { proposed: "count(all('proposal') where proposed == true)", busy: "fact('proposed') > 2" },
      rules: { quiet: { over: "graph", require: "not fact('busy')", says: "It is busy: {fact('busy')}" }, "a-title": document.rules["a-title"] },
    } as never);
    if (!nested.ok) throw new Error(JSON.stringify(nested.findings));
    expect(warned(checkApp(nested.app as GraviewApp<AnySchema>).findings).map((f) => f.where)).toEqual(["quiet"]);
  });
});
