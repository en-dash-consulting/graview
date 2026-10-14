import { readFileSync } from "node:fs";
import { createSchema, defineApp, defineNode } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { readDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/**
 * A SIGHT THAT HIDES A FIELD, IN THE STUDIO (Roadmap f-field-sight). A
 * sight's `hide` and `fields` are carried in from a checkout, added and
 * changed by the sight's own acts, written back into the declaration and
 * the policy file, and said to a document as `add-sight` / `remove-sight`.
 */
const player = defineNode("player", { fields: z.object({ label: z.string().min(1), phone: z.string().optional() }), plural: "Players" });
const app = defineApp({
  name: "roster",
  schema: createSchema([player]),
  policy: {
    roles: ["coach", "parent"],
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["coach"], kinds: ["player"] },
      { roles: ["parent"], kinds: ["player"], hide: ["phone"] },
    ],
  },
});
const policyFile = (studio: ReturnType<typeof createStudio>) => studio.files().find((file) => file.path.endsWith("policy.ts"))!.contents;

describe("a sight that hides a field, in the studio", () => {
  it("is carried through from the checkout and written back as it was", () => {
    const studio = createStudio(app);
    expect(studio.declaration().policy?.sees).toEqual(app.policy!.sees);
    expect(policyFile(studio)).toContain('{ roles: ["parent"], kinds: ["player"], hide: ["phone"] },');
  });

  it("is added and changed by the sight's acts", () => {
    const studio = createStudio(app);
    studio.store.apply({ name: "add-sight", args: { kind: "declared:player", fields: ["label"] } });
    studio.store.apply({ name: "change-sight", args: { id: "sight:2", hide: [] } });
    expect(studio.declaration().policy?.sees).toEqual([
      { roles: ["coach"], kinds: ["player"] },
      { roles: ["parent"], kinds: ["player"] },
      { roles: "*", kinds: ["player"], fields: ["label"] },
    ]);
    expect(policyFile(studio)).toContain('{ roles: "*", kinds: ["player"], fields: ["label"] },');
  });

  it("is said to a document as add-sight with what it hides", () => {
    const santa: GraviewDocument = readDocument(JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"))).document!;
    const compiled = compileDocument(santa);
    if (!compiled.ok) throw new Error("the fixture must compile");
    const studio = createStudio(compiled.app as never, { document: santa });
    const kind = studio.store.graph.nodesOfKind("kind" as never).find((node: { label?: string }) => node.label?.toLowerCase().startsWith("participant")) as unknown as { id: string };
    studio.store.apply({ name: "add-sight", args: { kind: kind.id, role: "role:organizer", hide: ["wish"] } } as never);
    expect(studio.edits()).toContainEqual({ op: "add-sight", roles: ["organizer"], kinds: ["participant"], hide: ["wish"] });
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(outcome.document.policy!.sees!.at(-1)).toEqual({ roles: ["organizer"], kinds: ["participant"], hide: ["wish"] });
  });
});
