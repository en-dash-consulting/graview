// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, z } from "@graview/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createPageRegistry, PagesApp, PageTrail, placeHere, usePlaceHere, type PageComponent, type PageContext, type PlaceHere } from "../../src/index.js";

/**
 * A PAGE SAYS WHERE YOU ARE (Roadmap gv-pages-where-am-i).
 *
 * Nick, from a product face over the derived pages: "people got caught in
 * the derived pages and didn't know where they were". On a step's page
 * nothing said "Plan › Steps › Consolidate", and no tab lit; the app
 * rebuilt a trail by matching `pluralSlug` against the path and reading the
 * record's label. The face says it: a trail at the head of each page, and
 * `usePlaceHere()` for a design that draws its own shell, its section named
 * by the registry.
 */
const plan = defineNode("plan", { fields: z.object({ label: z.string() }), plural: "Change plans", edges: { has: { to: ["step"] } } });
const step = defineNode("step", { fields: z.object({ label: z.string() }), plural: "Steps" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([plan, step, note]);
type S = typeof schema;
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "change-plan", kind: "plan", label: "The change plan" },
        { id: "consolidate", kind: "step", label: "Consolidate" },
        { id: "n1", kind: "note", label: "A note" },
      ] as never,
      edges: [],
    },
  });
const sections = () => createPageRegistry<S, PageComponent<S>>(schema).section(["plan", "step"], "Plan", { path: "/plan" }).route("/plan", () => <p>The plan</p>);

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function draw(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

const trailOf = (host: HTMLElement) => host.querySelectorAll<HTMLElement>('nav[aria-label="You are here"]');

describe("the trail on a record's page", () => {
  it("says the section, the kind's list and the record, the record last and current, each step a link to where it says", async () => {
    const host = await draw(<PagesApp context={{ store: store() }} registry={sections()} initialPath="/steps/consolidate" />);
    const trails = trailOf(host);
    expect(trails).toHaveLength(1);
    const steps = [...trails[0]!.querySelectorAll("li")];
    expect(steps.map((li) => li.textContent?.replace("›", "").trim())).toEqual(["Plan", "Steps", "Consolidate"]);
    expect([...trails[0]!.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/plan", "/steps"]);
    const current = trails[0]!.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("Consolidate");
    // Not said twice to the eye: the page's heading says the record's name under the trail.
    expect(current?.querySelector("a")).toBeNull();
    expect(host.querySelector("[data-graview-page-title]")?.textContent).toBe("Consolidate");
  });

  it("carries the base under a basename", async () => {
    const host = await draw(<PagesApp context={{ store: store() }} registry={sections()} basename="/a/recon" initialPath="/steps/consolidate" />);
    expect([...trailOf(host)[0]!.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["/a/recon/plan", "/a/recon/steps"]);
  });

  it("says the kind's list alone where the app named no section", async () => {
    const host = await draw(<PagesApp context={{ store: store() }} initialPath="/notes/n1" />);
    expect([...trailOf(host)[0]!.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["Notes", "/notes"]]);
  });
});

describe("the trail on a list's page", () => {
  it("says the section the list is in", async () => {
    const host = await draw(<PagesApp context={{ store: store() }} registry={sections()} initialPath="/change-plans" />);
    const trail = trailOf(host)[0]!;
    expect([...trail.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Plan"]);
    expect(trail.querySelector('[aria-current="page"]')?.textContent).toBe("Change plans");
  });

  it("is not drawn where nothing stands before the list: the heading says it", async () => {
    const host = await draw(<PagesApp context={{ store: store() }} initialPath="/notes" />);
    expect(trailOf(host)).toHaveLength(0);
  });
});

describe("a design's own shell", () => {
  it("is told where the face is by usePlaceHere, for its own tabs and trail", async () => {
    const heard: PlaceHere[] = [];
    const Shell = ({ children }: { readonly context: PageContext<S>; readonly children: ReactNode }) => {
      heard.push(usePlaceHere());
      return <div>{children}</div>;
    };
    await draw(<PagesApp context={{ store: store() }} registry={sections().surface("shell", Shell)} basename="/a/recon" initialPath="/steps/consolidate" />);
    expect(heard.at(-1)).toEqual({
      as: "record",
      kind: "step",
      id: "consolidate",
      label: "Consolidate",
      section: "Plan",
      trail: [
        { label: "Plan", href: "/a/recon/plan", path: "/plan" },
        { label: "Steps", href: "/a/recon/steps", path: "/steps" },
        { label: "Consolidate", href: "/a/recon/steps/consolidate", path: "/steps/consolidate", current: true },
      ],
    });
  });

  it("that places the trail itself gets one trail, not two", async () => {
    const Shell = ({ children }: { readonly context: PageContext<S>; readonly children: ReactNode }) => (
      <div>
        <PageTrail data-testid="shell-trail" />
        {children}
      </div>
    );
    const host = await draw(<PagesApp context={{ store: store() }} registry={sections().surface("shell", Shell)} initialPath="/steps/consolidate" />);
    expect(trailOf(host)).toHaveLength(1);
    expect(trailOf(host)[0]!.getAttribute("data-testid")).toBe("shell-trail");
  });

  it("that says it goes without the trail gets none from the derived pages", async () => {
    const Shell = ({ children }: { readonly context: PageContext<S>; readonly children: ReactNode }) => <div>{children}</div>;
    const host = await draw(<PagesApp context={{ store: store() }} registry={sections().surface("shell", Shell, { without: ["trail"] })} initialPath="/steps/consolidate" />);
    expect(trailOf(host)).toHaveLength(0);
  });
});

describe("placeHere, for a bar outside the face's router", () => {
  const context: PageContext<S> = { store: store() };
  it("says the home, a list, a record and a page of the face's own", () => {
    expect(placeHere(context, "/")).toEqual({ as: "home", label: "Home", trail: [{ label: "Home", href: "/", path: "/", current: true }] });
    expect(placeHere(context, "/change-plans?q=x", { registry: sections() })).toMatchObject({ as: "list", kind: "plan", label: "Change plans", section: "Plan" });
    expect(placeHere(context, "/problems")).toMatchObject({ as: "page", label: "Problems" });
  });

  it("never names a record by its id when there is no such record", () => {
    expect(placeHere(context, "/steps/gone")).toMatchObject({ as: "record", id: "gone", label: "Nothing lives here" });
  });

  it("names a section with no address without a link", () => {
    const registry = createPageRegistry<S, PageComponent<S>>(schema).section("step", "Plan");
    expect(placeHere(context, "/steps/consolidate", { registry }).trail[0]).toEqual({ label: "Plan" });
    expect(registry.sectionOf("step")).toEqual({ label: "Plan" });
    expect(registry.sectionOf("note")).toBeUndefined();
  });
});
