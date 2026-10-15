// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { markLanded, type ReactViewRegistry } from "@graview/react/provider";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * `pages.first` PICKS WHERE A NEW VISIT LANDS; THE DRAWN HOME STAYS HOME.
 *
 * The review app declared a home and `pages.first: "This week"`. It opened
 * on This week — and a press on Home, which draws the pages at their first
 * entry, was taken for an arrival and sent to This week again: the home
 * the author drew was nowhere. Once a visit has landed, on this face or on
 * the scene it opened on, "/" is the home.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "review.gdd.json"), "utf8")), { today: () => "2026-10-15" });
if (!compiled.ok) throw new Error("the review did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(resolve(fixtures, "review.seed.json"), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

async function rendered(views: ReactViewRegistry<AnySchema>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  await act(async () => root.render(<PagesApp context={{ store, views, principal: owner }} initialPath="/" />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  const said = {
    title: host.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null,
    home: host.querySelector('[data-testid="home-view"]') !== null,
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("a drawn home beside pages.first", () => {
  it("lands a new visit on the place pages.first names", async () => {
    const landed = await rendered(declaredViews(app));
    expect(landed.home).toBe(false);
    expect(landed.title).toContain("This week");
  });

  it("is the home at '/' once the visit has landed, on these pages or the scene", async () => {
    const views = declaredViews(app);
    await rendered(views);
    // The pages drawn again at their first entry — a press on Home from the scene — are no arrival.
    expect(await rendered(views)).toMatchObject({ home: true });
    const fromTheScene = declaredViews(app);
    markLanded(fromTheScene);
    expect(await rendered(fromTheScene)).toMatchObject({ home: true });
  });
});
