// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { memoryViews, Store, type AnySchema, type GraviewApp, type KeptViews, type LensTidyEdit } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { editDocument } from "@graview/core/document";
import { fetchDeclaredLenses, fetchInspector } from "@graview/primitives";
import type { ReactViewRegistry, ViewProps } from "@graview/react/provider";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A VIEW HIDDEN FROM THE PLACE MENU LEAVES THE BAR, AND COMES BACK ON SHOW
 * (Roadmap f-hidden-view-leaves-the-bar). "I expected the nav item to
 * disappear, but it remained and I saw the indication in the nav dropdown
 * that it was technically Hidden": a place hidden while it was the one open
 * stayed an entry of the bar — a kind's list on Pages, a picture on the
 * scene — beside its own name under Hidden. A hidden place is offered
 * nowhere on the bar, whichever it is and wherever you are, live; you stay
 * on it, at its address — the one control naming it as where you are — and
 * Show puts it back.
 */
const hall = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"));
const compile = (document: unknown): GraviewApp<AnySchema> => {
  const compiled = compileDocument(document as never, { today: () => "2026-09-01" });
  if (!compiled.ok) throw new Error("every-lens did not compile");
  return compiled.app as GraviewApp<AnySchema>;
};
const seed = { nodes: [{ id: "seat-1", kind: "seat", label: "Front left", x: 0.2, y: 0.3 }, { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" }], edges: [] };
const me = { kind: "human" as const, id: "nick", roles: ["keeper"] };

function SeatChart(props: ViewProps<AnySchema>) {
  return <p data-testid="seat-chart">{props.nodes?.length ?? 0} seats charted</p>;
}
const views = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => registry.register("seat" as never, { cardinality: "many", fidelity: "full" }, SeatChart, { title: "Seat chart", name: "seat-chart" });

beforeAll(() => Promise.all([preload(), fetchDeclaredLenses(), fetchInspector()]));
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function settle(ms = 30) {
  await act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((done) => setTimeout(done, ms));
  });
}

const opened: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of opened.splice(0)) await done();
});

/** Opens the hall as a host does whose declaration the place menu changes: each lens edit is applied and the app handed back, as Graview Cloud does. */
async function open(options: { readonly face: "pages" | "scene"; readonly path?: string; readonly stop?: string }): Promise<{ readonly host: HTMLElement; readonly kept: KeptViews }> {
  let document = hall;
  let handle: EmbedHandle | undefined;
  const app = compile(document);
  const store = new Store({ schema: app.schema, snapshot: seed as never });
  const kept = memoryViews({
    may: { views: true, lenses: true },
    declaration: {
      change: (edit: LensTidyEdit) => {
        const edited = editDocument(document, [edit]);
        if (!edited.ok) throw new Error(edited.findings.map((finding) => finding.message).join("; "));
        document = edited.document;
        handle!.setApp(compile(document), store);
      },
      restore: () => undefined,
    },
  });
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  await act(async () => {
    handle = mount(host, { app, store, fonts: false, principal: me, views, keptViews: kept, ...options } as unknown as EmbedOptions);
  });
  opened.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  await settle();
  return { host, kept };
}

/** Every place the bar offers — on its row and in its drop-down — by name; the foot's Hidden and Recently deleted are not offers. */
const offered = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>("[data-place-path]")].filter((entry) => !entry.closest('[data-place-group="hidden"],[data-place-group="removed"]')).map((entry) => entry.textContent?.trim());
const hiddenFoot = (host: HTMLElement) => host.querySelector('[data-place-group="hidden"]')?.textContent ?? "";
async function openPlaces(host: HTMLElement) {
  if (host.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden") !== false) {
    await act(async () => host.querySelector<HTMLElement>('[data-testid="app-places-open"]')!.click());
    await settle();
  }
}
async function hide(kept: KeptViews, what: { readonly view: string } | LensTidyEdit) {
  await act(async () => void (await ("view" in what ? kept.hide(what.view) : kept.lens!(what))));
  await settle();
}
async function show(kept: KeptViews, what: { readonly view: string } | LensTidyEdit) {
  await act(async () => void (await ("view" in what ? kept.show(what.view) : kept.lens!({ ...what, hidden: false } as LensTidyEdit))));
  await settle();
}

describe("a view hidden from the place menu", () => {
  const cases = [
    { name: "a kind's list", face: "pages", path: "/seats", label: "Seats", named: true, what: { op: "set-lens-hidden", title: "seat", hidden: true } },
    { name: "a declared lens", face: "pages", path: "/places/by-day", label: "By day", what: { op: "set-lens-hidden", title: "By day", on: "shift", hidden: true } },
    { name: "a view the host keeps", face: "pages", path: "/places/seat-chart", label: "Seat chart", what: { view: "seat-chart" } },
    { name: "a view the host keeps, on the scene", face: "scene", stop: "#focus=aggregate:seat&in.view=seat-chart", label: "Seat chart", named: true, what: { view: "seat-chart" } },
    { name: "a declared lens, on the scene", face: "scene", stop: "#focus=aggregate:shift&in.view=by-day", label: "By day", named: true, what: { op: "set-lens-hidden", title: "By day", on: "shift", hidden: true } },
  ] as const;
  for (const one of cases) {
    it(`leaves the bar while it is the place open, and comes back on Show: ${one.name}`, async () => {
      const { host, kept } = await open({ face: one.face, ...("path" in one ? { path: one.path } : { stop: one.stop }) });
      await openPlaces(host);
      expect(offered(host)).toContain(one.label);
      await hide(kept, one.what as never);
      await openPlaces(host);
      expect(hiddenFoot(host)).toContain(one.label);
      expect(offered(host)).not.toContain(one.label);
      // Still open, and where a kind's list or the scene's picture is, the one control says so.
      if ("named" in one) expect(host.querySelector('[data-testid="app-places-open"]')?.textContent).toBe(one.label);
      await show(kept, one.what as never);
      await openPlaces(host);
      expect(offered(host)).toContain(one.label);
    });
  }

  it("leaves the bar from anywhere else too, and the page it was on is still at its address", async () => {
    const { host, kept } = await open({ face: "pages", path: "/" });
    await hide(kept, { op: "set-lens-hidden", title: "seat", hidden: true });
    await hide(kept, { view: "seat-chart" });
    await openPlaces(host);
    expect(offered(host)).not.toContain("Seats");
    expect(offered(host)).not.toContain("Seat chart");
    expect(hiddenFoot(host)).toContain("Seats");
    expect(hiddenFoot(host)).toContain("Seat chart");
    const chart = await open({ face: "pages", path: "/places/seat-chart" });
    await hide(chart.kept, { view: "seat-chart" });
    expect(chart.host.querySelector('[data-testid="seat-chart"]')).not.toBeNull();
  });
});
