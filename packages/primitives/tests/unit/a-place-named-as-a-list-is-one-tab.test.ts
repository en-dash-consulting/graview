import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { createViews } from "@graview/react/provider";
import { describe, expect, it } from "vitest";
import { barPlaces, registerDeclaredLenses } from "../../src/index.js";

/**
 * A PLACE TITLED AS A KIND'S LIST IS, IS ONE TAB.
 *
 * The review app had a kind whose plural is "root causes" and a blocks
 * place titled "Root causes", and its bar had two tabs reading "Root
 * causes". The place the declaration drew is the one by that name — as
 * `pages.first` and `pages.primary` already read the word — and the kind's
 * list folds into More as "All root causes", at its own address still.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const review = JSON.parse(readFileSync(resolve(fixtures, "review.gdd.json"), "utf8"));
const seed = JSON.parse(readFileSync(resolve(fixtures, "review.seed.json"), "utf8"));

function bar(document: unknown = review) {
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error("the review did not compile");
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed });
  const views = registerDeclaredLenses(createViews(app.schema), app);
  return barPlaces({ store, principal: { kind: "human", id: "u:owner", roles: ["owner"] }, views });
}

describe("a place and a kind's list of one name", () => {
  it("are one tab by that name, the place's, standing on the bar", () => {
    const named = bar().filter((place) => place.label === "Root causes");
    expect(named).toEqual([expect.objectContaining({ path: "/places/root-causes", group: "pictures", primary: true })]);
  });

  it("keep the kind's list, folded into More as 'All root causes' at its own address", () => {
    expect(bar().find((place) => place.key === "kind:root-cause")).toMatchObject({ label: "All root causes", path: "/root-causes", primary: false });
  });

  it("leave a list whose name no place shares as it was", () => {
    const renamed = structuredClone(review);
    renamed.lenses[0].title = "Why it happened";
    expect(bar(renamed).find((place) => place.key === "kind:root-cause")).toMatchObject({ label: "Root causes", primary: true });
  });
});
