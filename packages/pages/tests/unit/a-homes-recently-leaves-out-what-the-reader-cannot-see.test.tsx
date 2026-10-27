import { readFileSync } from "node:fs";
import { Store, WITHHELD_INTENT, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A HOME'S RECENTLY LEAVES OUT WHAT THE READER CANNOT SEE (Roadmap
 * f-recently-hides-unseen). A Secret Santa keeps each match to its giver,
 * so a stranger on the public page was shown five lines of "A change you
 * cannot see — Someone": a list that read as broken, about changes the
 * reader was never meant to know of. Recently now lists only what the
 * reader may see, and folds the rest into one quiet line at its foot — "and
 * 2 changes kept from you" — never a row per withheld op, and nothing at
 * all for a reader from whom nothing was kept.
 */
const santa = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(santa);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;
const organizer: Principal = { kind: "human", id: "p_org", roles: ["organizer"] };
const ann: Principal = { kind: "human", id: "p_ann", roles: ["participant"] };
const stranger: Principal = { kind: "human", id: "passer-by", roles: [] };

/** Three participants added in the open, then three matches drawn, each the giver's alone. */
function drawn() {
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: { nodes: [{ id: "p_ann", kind: "participant", name: "Ann" }, { id: "p_bo", kind: "participant", name: "Bo" }, { id: "p_cy", kind: "participant", name: "Cy" }] as never, edges: [] },
  });
  for (const name of ["Dee", "Eli", "Flo"]) store.apply({ name: "add-participant", args: { name } }, { author: organizer });
  store.apply({ name: "draw", args: { note: "Ann for Bo", giver: "p_ann", receiver: "p_bo" } }, { author: organizer });
  store.apply({ name: "draw", args: { note: "Bo for Cy", giver: "p_bo", receiver: "p_cy" } }, { author: organizer });
  store.apply({ name: "draw", args: { note: "Cy for Ann", giver: "p_cy", receiver: "p_ann" } }, { author: organizer });
  return store;
}

const home = (principal: Principal) => renderToStaticMarkup(<PagesApp context={{ store: drawn(), principal }} initialPath="/" />);
const recently = (html: string) => html.match(/<section[^>]*data-testid="recently"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? "";
const rows = (section: string) => [...section.matchAll(/<li[^>]*data-testid="recently-row"[^>]*>([\s\S]*?)<\/li>/g)].map((row) => row[1]!.replace(/<[^>]+>/g, ""));
const folded = (section: string) => [...section.matchAll(/data-testid="recently-kept"[^>]*>([\s\S]*?)<\/p>/g)].map((line) => line[1]!.replace(/<[^>]+>/g, ""));

describe("a home's Recently, read by a seat the app keeps some changes from", () => {
  it("lists a participant only the changes they may see, and folds the rest into one quiet line", () => {
    const section = recently(home(ann));
    expect(section).not.toContain(WITHHELD_INTENT);
    expect(section).not.toContain("Someone");
    const lines = rows(section);
    expect(lines).toHaveLength(4);
    expect(lines.some((line) => line.includes("Ann for Bo"))).toBe(true);
    expect(lines.some((line) => line.includes("Bo for Cy") || line.includes("Cy for Ann"))).toBe(false);
    expect(folded(section)).toEqual(["and 2 changes kept from you"]);
  });

  it("shows a stranger the additions and one line for the three matches kept from them, never a row per match", () => {
    const section = recently(home(stranger));
    expect(section).not.toContain(WITHHELD_INTENT);
    expect(section).not.toContain("Someone");
    expect(rows(section)).toHaveLength(3);
    expect(folded(section)).toEqual(["and 3 changes kept from you"]);
  });

  it("says nothing of changes kept from a reader who sees everything", () => {
    const section = recently(home(organizer));
    expect(rows(section)).toHaveLength(5);
    expect(folded(section)).toEqual([]);
    expect(section).not.toContain("kept from you");
  });
});
