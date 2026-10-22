// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A BRAND MAY KEEP THE LINE UNDER THE NAME OFF THE HOME (Roadmap
 * f-home-subtitle-separate). With a home view the routed face drew the
 * document's `description` above it; a view with its own hero said it
 * twice, and the only way to stop it was to delete the description, which
 * took it out of the app's listings too. `brand.subtitle: false` keeps it
 * off the home and keeps the description: still the name's hover on the
 * bar. Without it the home draws the line, as it did.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const read = (name: string) => JSON.parse(readFileSync(resolve(fixtures, name), "utf8"));
const LINE = "What a review found, where it is and how bad it is.";
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

async function home(document: Record<string, unknown>, seed: unknown) {
  const compiled = compileDocument(document as never, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), invariants: app.invariants ?? [], snapshot: seed as never });
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: owner, ...(app.brand ? { brand: app.brand } : {}) }} initialPath="/" />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  const said = {
    homeView: host.querySelector('[data-testid="home-view"]') !== null,
    lines: [...host.querySelectorAll('[data-testid="app-subtitle"]')].map((line) => line.textContent),
    hover: host.querySelector('[data-testid="app-home"]')?.getAttribute("title") ?? null,
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("the line under the app's name, on the home", () => {
  const review = read("blocks-layout.gdd.json");
  const seed = read("blocks-layout.seed.json");

  it("is drawn above a home view when the brand says nothing of it, as before", async () => {
    expect(await home(review, seed)).toEqual({ homeView: true, lines: [LINE], hover: expect.stringContaining(LINE) });
  });

  it("is not drawn when the brand says subtitle: false, and the description is still the name's hover", async () => {
    expect(await home({ ...review, brand: { ...(review.brand ?? {}), subtitle: false } }, seed)).toEqual({ homeView: true, lines: [], hover: expect.stringContaining(LINE) });
  });

  it("is not drawn on a home with no view of its own either, once the brand says so", async () => {
    const vendors = read("vendors.gdd.json");
    const drawn = await home(vendors, { nodes: [], edges: [] });
    expect(drawn.lines).toEqual([vendors.description]);
    expect((await home({ ...vendors, brand: { ...vendors.brand, subtitle: false } }, { nodes: [], edges: [] })).lines).toEqual([]);
  });
});
