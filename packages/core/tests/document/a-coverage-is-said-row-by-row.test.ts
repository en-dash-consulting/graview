import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace, type DescribedPart } from "../../src/describe.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * FR-112: describePlace SAYS A COVERAGE GRID. It said "A coverage of 2
 * people." and named them — nothing of what the grid is for. Now it says,
 * for each row, the columns it is linked to and through what (the joining
 * record's own words, for a path); each column with how many rows it has;
 * which rows have none and which columns are on none — as the lens's header
 * counts them. The seat's own graph: a guest who cannot see strengths sees
 * nobody strong at anything, as the guest's picture draws it.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/org-strengths.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/org-strengths.seed.json", import.meta.url), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const guest: Principal = { kind: "human", id: "u:guest", roles: ["guest"] };

function said(principal: Principal, width = 1440) {
  const result = describePlace(store, principal, "strengths", { app, width, today: "2026-10-06" });
  if (!result.ok) throw new Error(result.error);
  return result.description;
}

describe("the Strengths lens, described", () => {
  it("says each person's skills through the strength that joins them, and who has none", () => {
    const { text, drawnBy } = said(owner);
    expect(drawnBy).toBe("lens:coverage");
    expect(text).toContain("Ryan: SEO (Ryan SEO, level 3)");
    expect(text).toContain("Val: none");
  });

  it("names the columns, each with how many rows it has, as groups the way a board's columns are", () => {
    const { parts, text } = said(owner);
    expect(text).toContain("2 people against 3 skills, through strengths: Copywriting, Design, SEO.");
    const groups = parts.find((part): part is Extract<DescribedPart, { t: "list" }> => part.t === "list")?.groups ?? [];
    expect(groups.map((group) => [group.heading, group.items.map((item) => item.id)])).toEqual([
      ["Copywriting (0)", []],
      ["Design (0)", []],
      ["SEO (1)", ["p-ryan"]],
    ]);
    expect(text).toContain("1 person with no skill: Val.");
    expect(text).toContain("2 skills on no person: Copywriting, Design.");
  });

  it("says each row as a field part: the row's name, then its columns", () => {
    const fields = said(owner).parts.filter((part) => part.t === "field");
    expect(fields).toEqual([
      { t: "field", label: "Ryan", text: "SEO (Ryan SEO, level 3)" },
      { t: "field", label: "Val", text: "none" },
    ]);
  });

  it("says what the seat can see: a guest without strengths is told nobody has a skill", () => {
    const { text } = said(guest);
    expect(text).toContain("Ryan: none");
    expect(text).toContain("Val: none");
    expect(text).not.toContain("Ryan SEO");
    expect(text).toContain("2 people with no skill: Ryan, Val.");
  });

  it("says the same at a phone's width", () => {
    expect(said(owner, 390).parts).toEqual(said(owner).parts);
  });
});
