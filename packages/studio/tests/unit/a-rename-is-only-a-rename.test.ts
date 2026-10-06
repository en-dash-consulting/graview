import { documentHash, type DocumentEdit } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { declared, ownerOf, template, TEMPLATES, throughEditDocument, throughTheStudio } from "./templates.js";

/*
 * RENAMING A FIELD A RULE NAMES IS ONE EDIT. editDocument's rename-field
 * rewrites every rule that reads the field — its judgement, its sentence,
 * the prose around it, the act named for it (`set-budget` becomes
 * `set-cap`) — and the studio's rename rewrites its own copy of the rule.
 * The two copies differed in their words, so the studio said the rule
 * again whole after the rename, carrying its own stale words and repairs:
 * five of the templates' field renames gave a different document than
 * editDocument does, and three an error document (`"set-budget" is not an
 * act this document declares`). A rule only a rename touched is not a
 * change of its own.
 */
const renames = TEMPLATES.flatMap((name) => {
  const document = template(name);
  return declared(document)
    .filter((node) => node.kind === "field")
    .flatMap((field) =>
      // A plain word, whose act names follow it (set-budget → set-renamed), and a camelCase one, whose do not.
      ["renamed", `${field.label}Renamed`].map((to) => ({
        name: `${name}: ${ownerOf(field.id)}.${field.label} → ${to}`,
        document,
        call: { name: "rename-field", args: { id: field.id, to } },
        edit: { op: "rename-field", kind: ownerOf(field.id), field: field.label, to } as DocumentEdit,
      })),
    );
});

describe("renaming every field of every template through the studio", () => {
  it("covers every field of the five templates, two ways", () => {
    expect(renames.length).toBeGreaterThanOrEqual(110);
  });

  it.each(renames.map((c) => [c.name, c] as const))("%s gives editDocument's document", async (_name, c) => {
    const studio = throughTheStudio(c.document, [c.call]);
    expect(studio.edits()).toEqual([c.edit]);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    const edited = throughEditDocument(c.document, [c.edit]);
    expect(await documentHash(outcome.document)).toBe(await documentHash(edited));
    // What editDocument makes compiles, so what the studio makes does.
    expect(compileDocument(edited).ok).toBe(compileDocument(outcome.document).ok);
  });
});

describe("a rule the studio changed besides the rename is still said", () => {
  it("renaming budget and rewording what the rule says gives the rule again, with the act's new name kept", () => {
    const vendors = template("vendor-shortlist");
    const studio = throughTheStudio(vendors, [
      { name: "rename-field", args: { id: "field:category.budget", to: "cap" } },
      { name: "edit-rule", args: { id: "rule:within-budget", says: "{name} has gone past its {cap|money}" } },
    ]);
    const edits = studio.edits();
    expect(edits[0]).toEqual({ op: "rename-field", kind: "category", field: "budget", to: "cap" });
    expect(edits[1]).toMatchObject({ op: "add-rule", rule: "within-budget", replace: true, says: "{name} has gone past its {cap|money}", repairs: [{ act: "set-cap" }] });
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(compileDocument(outcome.document).ok).toBe(true);
  });
});
