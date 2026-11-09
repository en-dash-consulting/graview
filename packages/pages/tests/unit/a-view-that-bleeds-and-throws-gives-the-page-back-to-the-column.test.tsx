// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, markBleeds, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { PagesApp } from "../../src/index.js";

/**
 * A VIEW THAT BLEEDS AND THROWS GIVES THE PAGE BACK TO THE COLUMN (Roadmap
 * f-bleed-phone-rule-rtl). A React view on the home or a record's page that
 * said `bleed` and threw had no boundary at its slot: what caught it was
 * further up, so the page around it went too, or the slot kept the width
 * the view asked for with nothing in it. It is caught in the slot, its
 * panel stands where it would have drawn, and the rules that give a view
 * the page's width see it did not draw: the slot is the column again.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const thrown = (how: true | "full") =>
  markBleeds((() => {
    throw new Error("the thrown view threw");
  }) as unknown as ViewComponent<AnySchema>, how);

function views(where: "home" | "record", how: true | "full") {
  const registry = registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema));
  if (where === "home") registry.home?.(thrown(how));
  else registry.register("deliverable", { cardinality: "one", fidelity: "full" }, thrown(how));
  return registry;
}

let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quiet = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => quiet.mockRestore());

async function drawn(where: "home" | "record", how: true | "full") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: views(where, how) as never, principal: nick }} initialPath={where === "home" ? "/" : "/deliverables/deliverable%3Aemail"} />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const main = host.querySelector<HTMLElement>("[data-graview-page-main]");
  const slot = host.querySelector<HTMLElement>("[data-graview-bleed]");
  const panel = host.querySelector<HTMLElement>("[data-graview-view-error]");
  const said = {
    page: main !== null,
    caughtInTheSlot: Boolean(slot && panel && slot.contains(panel)),
    rule: slot?.querySelector(":scope > style")?.textContent ?? "",
    top: main?.querySelector(":scope > style")?.textContent ?? "",
    facts: host.querySelector('[data-testid="record-fields"]') !== null,
    title: host.querySelector("[data-graview-page-title]")?.textContent ?? null,
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("a view that bleeds and throws gives the page back to the column", () => {
  for (const where of ["home", "record"] as const) {
    for (const how of ["full", true] as const) {
      it(`on the ${where}, bleeding ${how === "full" ? "full" : "on a phone"}: caught in its slot, the page drawn around it`, async () => {
        const said = await drawn(where, how);
        expect(said.page).toBe(true);
        expect(said.caughtInTheSlot).toBe(true);
        if (where === "record") {
          expect(said.title).toBe("Email to Todd");
          expect(said.facts).toBe(true);
        }
      });
    }
  }

  it("the slot's width is the view's only where it drew: a panel for a view that threw is not", async () => {
    const full = await drawn("record", "full");
    expect(full.rule).toContain(":not(:has([data-worker-view-fallback],[data-worker-view-failed],[data-graview-view-error]))");
    const phone = await drawn("home", true);
    expect(phone.rule).toMatch(/:not\(:has\(>:is\([^)]*\[data-graview-view-error\][^)]*\)\)\)/);
    expect(phone.top).toMatch(/\[data-graview-bleed\]>:is\([^)]*\[data-graview-view-error\]/);
  });
});
