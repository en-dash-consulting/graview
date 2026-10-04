import { compileDocument, documentHash, toDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";
import { template, throughEditDocument } from "./templates.js";

/*
 * THE DOCUMENT IS SAID, NOT GUESSED FROM AN OBJECT'S IDENTITY (FR-54).
 *
 * The studio found the document an app was compiled from by the app
 * object the compiler returned. A host that copied it (`{ ...app }`) or
 * swapped its policy for the signed-in seat's held a different object, and
 * `document()` was undefined — silently, so the host got a TypeScript app
 * back and no word of why. A host now says the document outright, and a
 * studio that has none says why in a finding.
 */
const chores = template("household-chores");
const compiled = compileDocument(chores);
if (!compiled.ok) throw new Error("the fixture must compile");
const ADD = { op: "add-field", kind: "chore", field: "effort", type: "integer" } as const;
const add = { name: "add-field", args: { kind: "declared:chore", label: "effort", type: "integer", required: false } };

describe("createStudio(app, { document })", () => {
  it("a copy of the compiled app, with the document said, hands back the document", async () => {
    const studio = createStudio({ ...compiled.app }, { document: chores });
    expect(studio.whyNoDocument()).toBeUndefined();
    studio.store.apply(add as never);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(await documentHash(outcome.document)).toBe(await documentHash(throughEditDocument(chores, [ADD])));
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    expect(await documentHash(toDocument(applied.app).document)).toBe(await documentHash(applied.document!));
  });

  it("an app whose policy was swapped for the seat's, with the document said, hands back the document's own policy", async () => {
    const seat = { ...compiled.app, policy: { grants: [{ roles: ["owner"] as const, mutations: "*" as const }] } };
    const studio = createStudio(seat as never, { document: chores });
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(await documentHash(outcome.document)).toBe(await documentHash(chores));
  });
});

describe("a studio with no document says why", () => {
  it("a copy with no document said: document() is undefined, and whyNoDocument() and apply() say so", () => {
    const studio = createStudio({ ...compiled.app });
    expect(studio.document()).toBeUndefined();
    const why = studio.whyNoDocument();
    expect(why?.code).toBe("studio-no-document");
    expect(why?.message).toMatch(/document/);
    expect(why?.fix).toMatch(/createStudio\(app, \{ document \}\)/);
    const applied = studio.apply();
    expect(applied.ok && applied.document).toBeFalsy();
    if (applied.ok) expect(applied.documentFindings).toEqual([why]);
  });

  it("the app the compiler returned needs nothing said", () => {
    expect(createStudio(compiled.app).whyNoDocument()).toBeUndefined();
  });
});
