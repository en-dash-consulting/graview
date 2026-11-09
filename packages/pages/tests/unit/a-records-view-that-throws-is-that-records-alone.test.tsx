// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, markReplacesPage, type ViewComponent, type ViewProps } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { PagesApp } from "../../src/index.js";

/**
 * A RECORD'S VIEW THAT THROWS IS THAT RECORD'S ALONE (Roadmap
 * f-bleed-phone-rule-rtl, the review of pull request 549). The panel a view
 * left when it threw on one record stood on every record opened after it,
 * the page being the same one; it is that record's, and the next record's
 * page draws its view. A view that is the whole page and threw left a page
 * with no name a person could see and no facts: the record's page is drawn
 * around its panel as it would be without that view. The panel says what
 * could not draw in words, never the kind's declared id.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const EMAIL = "/deliverables/deliverable%3Aemail";
const AGENDA = "/deliverables/deliverable%3Aagenda";

/** Throws on the email, draws "drawn" on any other deliverable. */
function brief(options: { replaces?: boolean; ownHeading?: boolean } = {}) {
  const view = ((props: ViewProps<AnySchema>) => {
    if (props.node?.id === "deliverable:email" && (props.node as { subject?: string }).subject === "Email to Todd") throw new Error("the thrown view threw");
    return <p data-testid="brief-drawn">drawn</p>;
  }) as unknown as ViewComponent<AnySchema>;
  if (options.replaces) markReplacesPage(view);
  if (options.ownHeading) (view as { ownHeading?: boolean }).ownHeading = true;
  const registry = registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema));
  registry.register("deliverable", { cardinality: "one", fidelity: "full" }, view);
  return registry;
}

let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quiet = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => quiet.mockRestore());

async function face(views: unknown, path: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const shared = store();
  const draw = (at: string) => root.render(<PagesApp context={{ store: shared, views: views as never, principal: nick }} initialPath={path} path={at} />);
  await act(async () => draw(path));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const read = () => {
    const title = host.querySelector<HTMLElement>("[data-graview-page-title]");
    const panel = host.querySelector<HTMLElement>("[data-graview-view-error]");
    return {
      panel: panel?.textContent ?? null,
      drawn: host.querySelector('[data-testid="brief-drawn"]') !== null,
      title: title?.textContent ?? null,
      titleSeen: title !== null && title.style.position !== "absolute",
      facts: host.querySelector('[data-testid="record-fields"]') !== null,
    };
  };
  return {
    read,
    store: shared,
    go: async (at: string) => {
      await act(async () => draw(at));
      await act(async () => new Promise((done) => setTimeout(done, 20)));
    },
    done: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

describe("a record's view that throws is that record's alone", () => {
  it("the next record's page draws its view, and coming back says the panel again", async () => {
    const page = await face(brief(), EMAIL);
    expect(page.read().panel).not.toBeNull();
    await page.go(AGENDA);
    expect(page.read()).toMatchObject({ panel: null, drawn: true, title: "The day's agenda" });
    await page.go(EMAIL);
    expect(page.read().panel).not.toBeNull();
    await page.done();
  });

  for (const replaces of [false, true]) {
    it(`staying on the record, its view${replaces ? ", the whole page," : ""} is drawn again once the store changes`, async () => {
      const page = await face(brief({ replaces }), EMAIL);
      expect(page.read().panel).not.toBeNull();
      await act(async () => {
        page.store.apply({ name: "set-subject", args: { deliverableId: "deliverable:email", subject: "Email to Todd, fixed" } }, { author: nick });
      });
      await act(async () => new Promise((done) => setTimeout(done, 20)));
      expect(page.read()).toMatchObject({ panel: null, drawn: true, ...(replaces ? { facts: false } : {}) });
      await page.done();
    });
  }

  it("the panel says what could not draw in words, not the kind's id", async () => {
    const page = await face(brief(), EMAIL);
    const panel = page.read().panel!;
    expect(panel).toContain("This deliverable's view could not draw");
    expect(panel).not.toMatch(/could not draw\s*deliverable/);
    await page.done();
  });

  for (const ownHeading of [false, true]) {
    it(`a view that is the whole page${ownHeading ? " and its own heading" : ""} and threw: the record's name is seen and its facts stand under the panel`, async () => {
      const page = await face(brief({ replaces: true, ownHeading }), EMAIL);
      expect(page.read()).toMatchObject({ title: "Email to Todd", titleSeen: true, facts: true });
      expect(page.read().panel).not.toBeNull();
      // Another record, whose view draws, is the view's page again: no facts under it.
      await page.go(AGENDA);
      expect(page.read()).toMatchObject({ panel: null, drawn: true, facts: false });
      await page.done();
    });
  }
});

describe("the home's view that throws", () => {
  it("is drawn again once the store changes", async () => {
    let fail = true;
    const home = (() => {
      if (fail) throw new Error("the thrown home threw");
      return <p data-testid="home-drawn">home</p>;
    }) as unknown as ViewComponent<AnySchema>;
    const registry = registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema));
    registry.home?.(home);
    const shared = store();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: shared, views: registry as never, principal: nick }} initialPath="/" />));
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    const panel = host.querySelector("[data-graview-view-error]");
    expect(panel?.textContent).toContain("The home's view could not draw");
    fail = false;
    await act(async () => {
      shared.apply({ name: "set-subject", args: { deliverableId: "deliverable:agenda", subject: "The agenda" } }, { author: nick });
    });
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    expect(host.querySelector("[data-graview-view-error]")).toBeNull();
    expect(host.querySelector('[data-testid="home-drawn"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
