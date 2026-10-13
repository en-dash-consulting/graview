import { readFileSync } from "node:fs";
import { readDocument, type GraviewDocument } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * A GRANT, A SIGHT AND THE PEOPLE ARE NAMED EDITS (FR-170). The studio
 * said a grant or a sight it changed as a finding — "no edit says a grant
 * yet" — and passed a kind made the people over without a word. Each is
 * now `editDocument`'s own op, so the document the studio hands back says
 * what the studio says.
 */
const santa: GraviewDocument = readDocument(JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"))).document!;
const compiled = compileDocument(santa);
if (!compiled.ok) throw new Error("the fixture must compile");
const app = compiled.app;

function studioOn(calls: readonly { name: string; args: Record<string, unknown> }[]) {
  const studio = createStudio(app as never, { document: santa });
  for (const call of calls) studio.store.apply(call as never);
  return studio;
}

describe("the studio's grants, sights and people", () => {
  it("a grant given and one revoked come back as add-grant and remove-grant", () => {
    const studio = studioOn([
      { name: "grant", args: { role: "role:participant", act: "act:draw" } },
      { name: "revoke-grant", args: { id: "grant:1" } },
    ]);
    expect(studio.edits().filter((edit) => /grant/.test(edit.op))).toEqual([
      { op: "remove-grant", roles: ["organizer"], mutations: "*" },
      { op: "add-grant", roles: ["participant"], mutations: ["draw"] },
    ]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(outcome.document.policy!.grants).toEqual([santa.policy!.grants[1], { roles: ["participant"], mutations: ["draw"] }]);
  });

  it("a sight taken away comes back as remove-sight, naming it by what it shows", () => {
    const studio = studioOn([{ name: "remove-sight", args: { id: "sight:2" } }]);
    expect(studio.edits()).toEqual([{ op: "remove-sight", roles: ["organizer"], kinds: ["match"] }]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(outcome.document.policy!.sees).toEqual([santa.policy!.sees![0], santa.policy!.sees![2]]);
  });

  it("the people said on a kind comes back as set-people, and a move says the kind that stops first", () => {
    const studio = studioOn([
      { name: "edit-kind", args: { id: "declared:participant", people: false } },
      { name: "edit-kind", args: { id: "declared:match", people: true } },
    ]);
    expect(studio.edits()).toEqual([
      { op: "set-people", kind: "participant", people: false },
      { op: "set-people", kind: "match", people: true },
    ]);
    // A sight via "givenBy" then reads matches as the people, which it never reaches: the edit says so, as the checker would.
    const outcome = studio.document();
    expect(outcome?.ok).toBe(false);
    if (outcome && !outcome.ok) expect(outcome.findings.map((finding) => finding.code)).toEqual(["sight-via-misses-people"]);
  });

  it("a change that touches no grant, sight or people kind says none of them", () => {
    expect(studioOn([{ name: "add-field", args: { kind: "declared:match", label: "budget", type: "number", required: false } }]).edits()).toEqual([{ op: "add-field", kind: "match", field: "budget", type: "number" }]);
  });
});
