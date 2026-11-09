// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, markReplacesPage, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { PagesApp } from "../../src/index.js";

/**
 * A PANEL FOR A VIEW THAT THREW SAYS NO DECLARED ID (the review of pull
 * request 549). Under "Deliverables could not draw" the panel said
 * `deliverable`, the kind's id, on a kind's list drawn by its view and on a
 * place; it says what could not draw in the words the page uses and nothing
 * a person was never meant to read.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const thrown = () =>
  (() => {
    throw new Error("the thrown view threw");
  }) as unknown as ViewComponent<AnySchema>;

let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quiet = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => quiet.mockRestore());

async function panelOn(where: "list" | "place"): Promise<string | null> {
  const registry = registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema));
  if (where === "list") registry.register("deliverable", { cardinality: "many", fidelity: "full" }, markReplacesPage(thrown()));
  else registry.register("deliverable", { cardinality: "many", fidelity: "full" }, thrown(), { title: "The briefs", name: "briefs", lens: "view" } as never);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry as never, principal: nick }} initialPath={where === "list" ? "/deliverables" : "/places/the-briefs"} />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const panel = host.querySelector("[data-graview-view-error]");
  const said = panel ? [...panel.children].map((child) => child.textContent ?? "").join(" | ") : null;
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("a panel for a view that threw says no declared id", () => {
  it("on a kind's list drawn by its view: the list's name, then what was thrown", async () => {
    expect(await panelOn("list")).toBe("Deliverables could not draw | the thrown view threw");
  });

  it("on a place: the place's title, then what was thrown", async () => {
    expect(await panelOn("place")).toBe("The briefs could not draw | the thrown view threw");
  });
});
