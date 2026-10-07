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
 * THE HOME'S OWN VIEW IS THE HOME (FR-81), AND A LIST'S RECORDS ARE LINKS
 * (FR-82) — on the routed face, from a document and nothing else: the
 * LifeLogics front page and lenses rebuilt as data. The shell stays; the
 * body is the home view's blocks; an empty graph still opens on the way in.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "lifelogics.gdd.json"), "utf8")), { today: () => "2026-10-05" });
if (!compiled.ok) throw new Error("lifelogics did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(resolve(fixtures, "lifelogics.seed.json"), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const partner: Principal = { kind: "human", id: "party-delivery", roles: ["partner"] };

beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

async function rendered(path: string, principal: Principal = owner, snapshot: unknown = seed) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never });
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, done };
}

describe("the home view on the routed face", () => {
  it("replaces the derived home's body, under the shell, with the page's heading its first headline", async () => {
    const { host, done } = await rendered("/");
    expect(host.querySelector('[data-testid="home-view"]')).not.toBeNull();
    // Its level-1 headline is said under the app's name on the bar (FR-131).
    expect(host.querySelector("main h2")?.textContent).toBe("A small start, on three fronts.");
    expect(host.querySelector('[data-testid="standing"]')).toBeNull();
    expect(host.textContent).toContain("$21,000");
    // The shell stays: the one bar, with the app's name as the page's heading.
    expect(host.querySelector('[data-testid="app-home"]')).not.toBeNull();
    await done();
  });

  it("makes each listed record a link to its own page", async () => {
    const { host, done } = await rendered("/");
    const links = [...host.querySelectorAll<HTMLAnchorElement>("a.graview-spec-item-link")].map((a) => a.getAttribute("href"));
    expect(links).toContain(`/packages/pkg-start`);
    expect(links).toContain(`/offers/offer-workshop`);
    await done();
  });

  it("an empty graph still opens on the way in", async () => {
    const { host, done } = await rendered("/", owner, { nodes: [], edges: [] });
    expect(host.querySelector('[data-testid="home-view"]')).toBeNull();
    expect(host.querySelector('[data-testid="standing"]')?.textContent).toBe("Nothing here yet.");
    expect(host.textContent).toMatch(/Begin with/);
    await done();
  });
});

describe("lists of related records on the routed face", () => {
  it("a package's page lists its offers as rows, each a link, and only those its seat sees", async () => {
    const all = await rendered("/packages/pkg-whole");
    expect([...all.host.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed"))).toEqual(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]);
    await all.done();
    const seen = await rendered("/packages/pkg-whole", partner);
    expect([...seen.host.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed"))).toEqual(["offer-analysis", "offer-suite"]);
    await seen.done();
  });

  it("a note's row on its list names the offers that answer it", async () => {
    const { host, done } = await rendered("/what-we-heard");
    const row = host.querySelector('[data-graview-spec="row"][data-graview-kind="signal"]');
    expect(row).not.toBeNull();
    const pilot = [...host.querySelectorAll('[data-graview-spec="row"][data-graview-kind="signal"]')].find((one) => one.textContent?.includes("Start with a pilot"));
    expect([...pilot!.querySelectorAll("[data-graview-listed]")].map((li) => li.getAttribute("data-graview-listed"))).toEqual(["offer-workshop", "offer-analysis"]);
    await done();
  });

  it("a blocks lens is a page of its own", async () => {
    const { host, done } = await rendered("/places/what-we-heard");
    expect(host.querySelector("[data-graview-page-title]")?.textContent).toContain("What we heard");
    expect(host.textContent).toContain("What hurts");
    await done();
  });
});
