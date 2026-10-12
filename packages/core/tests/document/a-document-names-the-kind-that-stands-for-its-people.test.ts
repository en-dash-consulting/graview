import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument, describeApp } from "../../src/check.js";
import { checkApp } from "../../src/check.js";
import { compileDocumentWithoutCheck } from "../../src/document/index.js";
import { nodeJsonSchema } from "../../src/json-schema.js";
import { createSchema, defineApp, defineNode, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A DOCUMENT NAMES THE KIND THAT STANDS FOR ITS PEOPLE (Roadmap
 * f-people-kind). A TypeScript installation's people are its `user` kind,
 * and a `self` grant or an `own` sight reads a principal's id as a record's.
 * A document could not say which of its kinds that was, so Graview Cloud
 * had nowhere to put a member's record and nothing to check it against.
 * `"people": true` on one kind says it: a record of that kind whose id is a
 * member's principal id is that member.
 */
const santa = JSON.parse(readFileSync(new URL("./fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));

function storeOf(document: unknown, nodes: readonly Record<string, unknown>[], edges: readonly { kind: string; from: string; to: string }[] = []) {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app;
  return { app, store: new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: nodes as never, edges } }) };
}
const ann: Principal = { kind: "human", id: "p_ann", roles: ["participant"] };
const codes = (result: { findings: readonly { code: string }[] }) => result.findings.map((finding) => finding.code);

describe("a document's people kind", () => {
  it("is the kind that says people: true, carried to the compiled app's definition", () => {
    const compiled = compileDocumentWithoutCheck(santa);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.app.schema.definitions.filter((definition) => definition.people).map((definition) => definition.kind)).toEqual(["participant"]);
  });

  it("is refused when two kinds both say they are the people", () => {
    const two = { ...santa, kinds: { ...santa.kinds, match: { ...santa.kinds.match, people: true } } };
    const compiled = compileDocument(two);
    expect(compiled.ok).toBe(false);
    expect(codes(compiled)).toContain("check:people-ambiguous");
  });

  it("is refused as missing when the policy reads a principal's record and no kind says it is the people", () => {
    const { people: _, ...participant } = santa.kinds.participant;
    const compiled = compileDocument({ ...santa, kinds: { ...santa.kinds, participant } });
    expect(compiled.ok).toBe(false);
    const finding = compiled.findings.find((one) => one.code === "check:people-unsaid");
    expect(finding?.message).toMatch(/no kind says it is the people/);
  });

  it("makes a seat whose principal id is a record of it that person: a self grant and an own sight hold", () => {
    const own = { ...santa, policy: { ...santa.policy, sees: [{ roles: ["participant"], kinds: ["participant"], own: true }, { roles: ["organizer"], kinds: ["participant", "match"] }] } };
    const { store } = storeOf(own, [
      { id: "p_ann", kind: "participant", name: "Ann" },
      { id: "p_bo", kind: "participant", name: "Bo" },
    ]);
    // Their own record, and nobody else's.
    expect(store.seenBy(ann).graph.allNodes().map((node) => node.id)).toEqual(["p_ann"]);
    // "You, on yours": Ann changes her own wish and not Bo's.
    expect(store.permits({ name: "edit-participant", args: { id: "p_ann", wish: "socks" } }, ann).ok).toBe(true);
    expect(store.permits({ name: "edit-participant", args: { id: "p_bo", wish: "socks" } }, ann).ok).toBe(false);
    store.apply({ name: "edit-participant", args: { id: "p_ann", wish: "socks" } }, { author: ann });
    expect(store.graph.getNode("p_ann")).toMatchObject({ wish: "socks" });
  });

  it("is said by describeApp and by the kind's JSON Schema", () => {
    const { app } = storeOf(santa, []);
    expect(describeApp(app)).toMatch(/The people are the participants: a participant whose id is a member.s principal id is that member\./);
    const participant = app.schema.definitions.find((definition) => definition.kind === "participant")!;
    expect(nodeJsonSchema(participant)["x-graview-people"]).toBe(true);
    expect(nodeJsonSchema(app.schema.definitions.find((definition) => definition.kind === "match")!)["x-graview-people"]).toBeUndefined();
  });
});

describe("a TypeScript app's people kind", () => {
  const person = defineNode("person", { fields: z.object({ label: z.string() }), people: true });
  const team = defineNode("team", { fields: z.object({ label: z.string() }) });

  it("is the definition that says people: true, and two are refused", () => {
    const one = defineApp({ name: "Teams", schema: createSchema([person, team]) });
    expect(codes(checkApp(one))).not.toContain("people-ambiguous");
    const two = defineApp({ name: "Teams", schema: createSchema([person, defineNode("team", { fields: z.object({ label: z.string() }), people: true })]) });
    expect(codes(checkApp(two))).toContain("people-ambiguous");
  });

  it("is the installation's user kind", async () => {
    const { declareInstallation } = await import("../../src/index.js");
    const installation = declareInstallation({ roles: ["admin", "member"], admin: "admin" });
    expect(installation.kinds[0].people).toBe(true);
    expect((installation.kinds[1] as { people?: boolean }).people).toBeUndefined();
  });

  it("describes nobody as the people when no kind says so", () => {
    const app = defineApp({ name: "Teams", schema: createSchema([team]) }) as GraviewApp;
    expect(describeApp(app)).not.toMatch(/The people are/);
  });
});
