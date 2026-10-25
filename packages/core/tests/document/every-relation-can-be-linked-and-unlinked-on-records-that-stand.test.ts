import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * EVERY RELATION CAN BE LINKED AND UNLINKED ON RECORDS THAT STAND (Roadmap
 * f-connect-every-relation). Threat Watch's source offered "Unlink a
 * threat" and no "Link a threat": its `add-source` made a source and linked
 * it to a threat in one press, and an act that connects a relation replaced
 * the derived connect, so a source already made could never be linked to
 * another threat. An act that MAKES a record links only the one it makes;
 * the derived pair stays unless a declared act links (or unlinks) records
 * that already stand. A relation declared `acts: "none"`, an append-only
 * one's disconnect, and a relation to another app's kind are the only
 * relations without them.
 */
const fixtures = new URL("./fixtures/", import.meta.url);
const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, fixtures), "utf8"));
const golden: { name: string; document: unknown }[] = [
  ...readdirSync(fixtures)
    .filter((name) => name.endsWith(".gdd.json"))
    .map((name) => ({ name, document: read(name) })),
  ...(read("cloud-templates.json") as { id: string; document: unknown }[]).map((template) => ({ name: `cloud template ${template.id}`, document: template.document })),
];

type Edge = { to: readonly string[] | "*"; acts?: "none"; appendOnly?: boolean };
const appOf = (document: unknown): GraviewApp<AnySchema> | undefined => {
  const compiled = compileDocument(document as GraviewDocument, { today: () => "2026-10-25" });
  return compiled.ok ? (compiled.app as GraviewApp<AnySchema>) : undefined;
};
const storeOf = (app: GraviewApp<AnySchema>) => new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, ...(app.policy ? { policy: app.policy } : {}) });

/** Whether an act links (or unlinks) records that already stand: it makes none, and it stands on one end. */
const onRecordsThatStand = (act: { readonly creates?: readonly string[]; readonly subject?: { readonly kinds: readonly string[] | "*" } }, kind: string, edge: Edge) =>
  !act.creates?.length && (act.subject?.kinds === "*" || act.subject?.kinds.includes(kind) || edge.to === "*" || (act.subject?.kinds ?? []).some((one) => edge.to.includes(one)));

describe("every relation of every golden document", () => {
  for (const { name, document } of golden) {
    it(`can be linked and unlinked on records that stand: ${name}`, () => {
      const app = appOf(document);
      if (!app) return;
      const acts = storeOf(app).allMutations();
      const missing: string[] = [];
      for (const definition of app.schema.definitions) {
        for (const [relation, edge] of Object.entries((definition.edges ?? {}) as Record<string, Edge>)) {
          if (edge.acts === "none" || (edge.to !== "*" && edge.to.some((to) => to.startsWith("@")))) continue;
          const links = acts.some((act) => act.connects?.includes(relation) && onRecordsThatStand(act, definition.kind, edge));
          const unlinks = edge.appendOnly || acts.some((act) => act.severs?.includes(relation) && onRecordsThatStand(act, definition.kind, edge));
          if (!links) missing.push(`no act links ${definition.kind}.${relation}`);
          if (!unlinks) missing.push(`no act unlinks ${definition.kind}.${relation}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});

describe("a relation a creating act also links", () => {
  const threatWatch = read("threat-watch.gdd.json") as GraviewDocument;
  const edited = (edits: readonly unknown[]): GraviewDocument => {
    const outcome = editDocument(threatWatch, edits);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    return outcome.document;
  };

  it("keeps its derived connect, so a source already made can be linked to another threat", () => {
    const doc = edited([{ op: "add-act", act: "add-source", replace: true, title: "Add a source", creates: "source", effects: [{ connect: "covers", from: "$new", to: "$threat" }] }]);
    const app = appOf(doc)!;
    const store = storeOf(app);
    const names = store.allMutations().map((one) => one.name);
    expect(names).toContain("connect-source-covers");
    expect(names).toContain("disconnect-source-covers");
  });

  it("still gives way to a declared act that links two records that stand", () => {
    const doc = edited([
      { op: "add-act", act: "cite", title: "Cite it for a threat", on: "source", connects: "covers" },
      { op: "add-grant", roles: "*", mutations: ["cite"] },
    ]);
    const names = storeOf(appOf(doc)!).allMutations().map((one) => one.name);
    expect(names).not.toContain("connect-source-covers");
    expect(names).toContain("cite");
  });
});
