// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { editDocument, readDocument } from "@graview/core/document";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { barPlaces } from "@graview/primitives/pages";
import { useGoTo, type GoTo, type ViewComponent } from "@graview/react/provider";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A VIEW ARRIVES WHERE IT ASKED, AND A HIDDEN LENS IS REACHED, NOT LISTED.
 *
 * On the routed face a view's `navigate` (through `useGoTo`) goes to a
 * kind's list or a lens narrowed — `?filter=`, the word the list's own
 * arranging line writes — and to a section (`#…`), which the page scrolls
 * to and hands the keyboard; the address the host is told carries all of
 * it, so it can be shared. A lens kept off the lists (`set-lens-hidden`)
 * is not on the bar, the page list or the home's gallery, and is still
 * drawn at its address.
 */
const hall = readDocument(JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"))).document!;
const edited = editDocument(hall, [
  { op: "arrange-pages", first: null },
  { op: "set-lens-hidden", title: "By day", hidden: true },
]);
if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
const compiled = compileDocument(edited.document, { today: () => "2026-09-01" });
if (!compiled.ok) throw new Error("every-lens did not compile");
const app = compiled.app as GraviewApp<AnySchema>;

const seed = {
  nodes: [
    { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" },
    { id: "s2", kind: "shift", label: "Friday bar", day: "fri", from: 1080, until: 1320, on: "2026-09-11" },
    { id: "v1", kind: "volunteer", label: "Ada" },
    { id: "m1", kind: "member", label: "Nora" },
  ],
  edges: [{ id: "e1", kind: "covered-by", from: "s1", to: "v1" }],
};
const keeper = { kind: "human", id: "m1", roles: ["keeper"] } as const;
const store = () => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: structuredClone(seed) as never });

beforeAll(() => fetchDeclaredLenses());

const settle = () => act(async () => new Promise((done) => setTimeout(done, 60)));

async function rendered(path: string) {
  let goTo: GoTo | undefined;
  const views = declaredViews(app);
  // A custom home, as a worker view's is: it reaches the face's way of going.
  const Home: ViewComponent<AnySchema> = () => {
    goTo = useGoTo();
    return <p data-testid="custom-home">The hall</p>;
  };
  views.home?.(Home);
  const told: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const context = { store: store(), views, principal: keeper };
  await act(async () => root.render(<PagesApp context={context} initialPath={path} onNavigate={(to) => told.push(to)} />));
  await settle();
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, done, told, go: () => goTo!, context };
}

describe("a view's navigate, on the routed face", () => {
  it("goes to a kind's list narrowed, at an address that says the filter", async () => {
    const { host, done, told, go } = await rendered("/");
    await act(async () => go().list("shift", { filter: "day:mon" }));
    await settle();
    expect(told.at(-1)).toBe("/shifts?filter=day%3Amon");
    expect(host.textContent).toContain("Monday door");
    expect(host.textContent).not.toContain("Friday bar");
    await done();
  });

  it("goes to a lens narrowed, and says so over the picture with the way to all of it", async () => {
    const { host, done, told, go } = await rendered("/");
    await act(async () => go().place("by-day", { filter: "day:fri" }));
    await settle();
    expect(told.at(-1)).toBe("/places/by-day?filter=day%3Afri");
    expect(host.querySelector('[data-testid="place-narrowed"]')?.textContent).toContain("Only those where day is fri.");
    const lens = host.querySelector('[data-testid="place-lens"]')?.textContent ?? "";
    expect(lens).toContain("Friday bar");
    expect(lens).not.toContain("Monday door");
    await done();
  });

  it("goes to a section of the page, which takes the keyboard, and the address says the section", async () => {
    const { done, told, go } = await rendered("/");
    await act(async () => go().list("shift", { filter: "day:mon", section: "Shifts" }));
    await settle();
    expect(told.at(-1)).toBe("/shifts?filter=day%3Amon#shifts");
    expect(document.activeElement?.textContent).toBe("Shifts");
    await done();
  });

  it("arrives from a shared address the same way: the list narrowed, the section found", async () => {
    const { host, done } = await rendered("/shifts?filter=day%3Afri#shifts");
    expect(host.textContent).toContain("Friday bar");
    expect(host.textContent).not.toContain("Monday door");
    expect(document.activeElement?.textContent).toBe("Shifts");
    await done();
  });
});

describe("a lens kept off the lists, on the routed face", () => {
  it("is not on the bar's places, the page list or the home's gallery", async () => {
    const { host, done, context } = await rendered("/places");
    const listed = [...host.querySelectorAll('[data-testid="places"] a, [data-testid="places"] [data-testid]')].map((one) => one.textContent ?? "").join(" | ");
    expect(listed).toContain("The week");
    expect(listed).not.toContain("By day");
    expect(barPlaces({ store: context.store, principal: keeper, views: context.views }).map((place) => place.label)).not.toContain("By day");
    expect(barPlaces({ store: context.store, principal: keeper, views: context.views }).map((place) => place.label)).toContain("The week");
    expect([...host.querySelectorAll('[data-testid="app-places"] a')].map((a) => a.textContent)).not.toContain("By day");
    await done();
  });

  it("is reached at its address all the same", async () => {
    const { host, done } = await rendered("/places/by-day");
    expect(host.querySelector("[data-graview-page-title]")?.textContent).toContain("By day");
    expect(host.querySelector('[data-testid="place-lens"]')?.textContent).toContain("Monday door");
    await done();
  });
});
