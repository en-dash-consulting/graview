import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it, vi } from "vitest";
import { barPlaces } from "../../src/index.js";

/**
 * AN EMPTY KIND FOLDS INTO MORE UNTIL IT HAS A RECORD. n-dx's projection of
 * a v1 tree has no constraints, and its bar said "Constraints" beside the
 * work all the same, declared in `pages.primary` or derived. A kind with
 * nothing in it folds into More, declared or derived alike; its first
 * record brings it back. A graph with nothing in any kind folds none.
 */
const workshop = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../scripts/fixtures/desk-bar/workshop.gdd.json"), "utf8"));
const owner = { kind: "human" as const, id: "u:owner", roles: ["owner"] };

function storeOf(document: unknown, kinds: readonly string[]) {
  const compiled = compileDocument(document, { today: () => "2026-10-10" });
  if (!compiled.ok) throw new Error("the workshop did not compile");
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy! });
  for (const kind of kinds) store.apply({ name: `add-${kind}`, args: { name: `A ${kind}` } }, { author: owner });
  const views = { places: () => [{ kind: "decision", title: "What the workshop covers", as: "what-the-workshop-covers" }], arrangement: () => app.pages };
  return { store, places: () => barPlaces({ store, principal: owner, views }) };
}

const standing = (places: ReturnType<typeof barPlaces>) => places.filter((place) => place.primary !== false).map((place) => place.key);

describe("an empty kind on the bar", () => {
  it("folds into More, its pictures with it, while it has no records, and stands again with its first", () => {
    const { store, places } = storeOf(workshop, ["date", "deliverable"]);
    expect(standing(places())).toEqual(["home", "kind:date", "kind:deliverable"]);
    // Still offered: in More, at its own address.
    expect(places().find((place) => place.key === "kind:decision")).toMatchObject({ label: "Decisions", path: "/decisions", primary: false });
    store.apply({ name: "add-decision", args: { name: "Meet on Thursdays" } }, { author: owner });
    expect(standing(places())).toEqual(["home", "kind:date", "kind:decision", "kind:deliverable", "place:decision:what-the-workshop-covers"]);
  });

  it("says which kinds hold anything from the counts the graph keeps, never walking every record on a change", () => {
    const { store, places } = storeOf(workshop, ["date"]);
    const walked = vi.spyOn(store.graph, "allNodes");
    const sorted = vi.spyOn(store.graph, "nodesOfKind");
    expect(standing(places())).toEqual(["home", "kind:date"]);
    store.apply({ name: "add-deliverable", args: { name: "The report" } }, { author: owner });
    walked.mockClear();
    expect(standing(places())).toEqual(["home", "kind:date", "kind:deliverable"]);
    expect(walked).not.toHaveBeenCalled();
    expect(sorted).not.toHaveBeenCalled();
  });

  it("folds when `pages.primary` names it too", () => {
    const { places } = storeOf({ ...workshop, pages: { ...workshop.pages, primary: ["decisions", "deliverables"] } }, ["deliverable"]);
    expect(standing(places())).toEqual(["home", "kind:deliverable"]);
  });

  it("folds none when no kind has a record: nothing yet says which matter", () => {
    const { places } = storeOf(workshop, []);
    expect(standing(places())).toEqual(["home", "kind:date", "kind:decision", "kind:deliverable", "place:decision:what-the-workshop-covers"]);
  });
});
