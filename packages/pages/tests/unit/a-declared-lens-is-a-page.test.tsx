// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkApp, declaredLenses, describeApp, placesOf, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/document";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A DECLARED LENS IS A PAGE (FR-79), AND THE HOME IS ARRANGED AS DECLARED
 * (FR-80) — on the routed face, from a document and nothing else.
 *
 * The document declares one lens of each type the framework ships and a
 * `pages` arrangement: three kinds in order, one hidden, a lens first. The
 * registry is `declaredViews(app)` — no view the app wrote — and the
 * places it holds, the places `placesOf` lists, `check`'s silence and
 * `describe`'s sentences all come from `declaredLenses`, one list.
 */
const hall = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"));
const compiled = compileDocument(hall, { today: () => "2026-09-01" });
if (!compiled.ok) throw new Error("every-lens did not compile");
const app = compiled.app as GraviewApp<AnySchema>;

const seed = {
  nodes: [
    { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" },
    { id: "s2", kind: "shift", label: "Friday bar", day: "fri", from: 1080, until: 1320, on: "2026-09-11" },
    { id: "v1", kind: "volunteer", label: "Ada" },
    { id: "seat-1", kind: "seat", label: "Front left", x: 0.2, y: 0.3 },
    { id: "r1", kind: "room", label: "The cellar" },
    { id: "m1", kind: "member", label: "Nora" },
  ],
  edges: [
    { id: "e1", kind: "covered-by", from: "s1", to: "v1" },
    { id: "e2", kind: "taken-by", from: "seat-1", to: "v1" },
  ],
};
const store = () =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed as never });

beforeAll(() => fetchDeclaredLenses());

async function rendered(path: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: declaredViews(app), principal: { kind: "human", id: "m1", roles: ["keeper"] } }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, done };
}

describe("a document's declared lenses, on the routed face", () => {
  it("are the registry's places — the same list placesOf, check and describe read", () => {
    const views = declaredViews(app);
    const drawn = declaredLenses(app).drawn;
    expect(views.places().map((place) => [place.kind, place.title])).toEqual(drawn.flatMap((lens) => lens.kinds.map((kind) => [kind, lens.title])));
    expect(placesOf(app).filter((place) => place.lens).map((place) => place.title).sort()).toEqual(views.places().map((place) => place.title).sort());
    expect(checkApp(app).findings.filter((finding) => /^(lens|pages)-/.test(finding.code))).toEqual([]);
    const said = describeApp(app);
    for (const place of views.places()) expect(said).toContain(`"${place.title}"`);
  });

  it("draws each lens, by its title, at its own page", async () => {
    for (const place of declaredViews(app).places()) {
      const { host, done } = await rendered(`/places/${place.as}`);
      expect(host.querySelector('[data-testid="place-lens"]'), place.title).not.toBeNull();
      expect(host.querySelector("h1")?.textContent).toContain(place.title);
      // Drawn: the lens put something of its own in the frame.
      expect(host.querySelector('[data-testid="place-lens"]')?.children.length ?? 0, place.title).toBeGreaterThan(0);
      await done();
    }
  });

  it("opens on the place pages.first names, and the masthead still goes home", async () => {
    const { host, done } = await rendered("/");
    expect(host.querySelector("h1")?.textContent).toContain("The floor");
    await act(async () => (host.querySelector('[data-testid="masthead"]') as HTMLAnchorElement).click());
    expect(host.querySelector('[data-testid="standing"]')).not.toBeNull();
    await done();
  });

  it("orders the nav and the home's kinds as declared, leaves a hidden kind off the home and keeps it at its address", async () => {
    const { host, done } = await rendered("/problems");
    const nav = [...host.querySelectorAll('[data-testid="shell-nav"] a')].map((a) => a.textContent ?? "");
    const kinds = nav.filter((text) => /^(volunteers|seats|shifts|rooms|members)$/.test(text));
    expect(kinds).toEqual(["volunteers", "seats", "shifts", "rooms", "members"]);
    await act(async () => (host.querySelector('[data-testid="masthead"]') as HTMLAnchorElement).click());
    const counted = [...host.querySelectorAll('[data-testid="kinds"] li a')].map((a) => a.getAttribute("href"));
    expect(counted).toEqual(["/volunteers", "/seats", "/shifts", "/members"]);
    await done();
    const rooms = await rendered("/rooms");
    expect(rooms.host.textContent).toContain("The cellar");
    await rooms.done();
    const found = await rendered("/search?q=cellar");
    expect(found.host.textContent).toContain("The cellar");
    await found.done();
  });
});
