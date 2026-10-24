// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Violation } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * WHAT A SCREEN READER IS TOLD ON THE ROUTED FACE, stop by stop
 * (`scripts/verify-screen-reader.mjs`, `docs/screen-reader-walk.md`).
 *
 * Walking the Roadmap's accessibility tree found that a place followed
 * from the bar left the keyboard on the bar's link and the new page said
 * nothing; that the arrow beside a picture a record is seen in was a link
 * named "↗"; that a record's act opened its form with the keyboard left
 * behind, and Escape did not put it away; that a flagged row said "⚠" and
 * nothing else; and that a required field was "Name star".
 */

/** The name a reader is told: `aria-label`, else the words inside, less what is hidden from it. */
function nameOf(element: Element): string {
  const said = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element) || node.getAttribute("aria-hidden") === "true") return "";
    return node.getAttribute("aria-label") ?? [...node.childNodes].map(said).join("");
  };
  return (element.getAttribute("aria-label") ?? said(element)).replace(/\s+/g, " ").trim();
}

const location = defineNode("location", { fields: z.object({ label: z.string() }), plural: "Locations" });
const staff = defineNode("staff", {
  fields: z.object({ label: z.string() }),
  plural: "Staff",
  edges: { "works-at": { to: ["location"], description: "where they work", inverse: "who works here" } },
});
const schema = createSchema([location, staff]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const assign = defineMutation("works-at", {
  title: "Assign to a location",
  fromTheOtherEnd: "Assign somebody here",
  subject: { kinds: ["staff"], arg: "staffId" },
  connects: ["works-at"],
  input: z.object({ staffId: nodeRef(["staff"]), locationId: nodeRef(["location"]) }),
  apply: (ctx, args) => void ctx.addEdge({ kind: "works-at", from: args.staffId, to: args.locationId }),
});
const addStaff = defineMutation("add-staff", {
  title: "Add somebody",
  creates: ["staff"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "staff"), kind: "staff", label: args.label } as never),
});
const placed = defineInvariant("placed", {
  scope: { kind: "staff" },
  repairs: ["works-at"],
  evaluate({ subject, graph }): Violation[] {
    return graph.out(subject.id, "works-at").length > 0 ? [] : [{ invariant: "placed", subjectId: subject.id, label: "Works nowhere", message: "works nowhere", nodeIds: [subject.id], repairs: [] }];
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [assign, addStaff],
    invariants: [placed],
    snapshot: {
      nodes: [
        { id: "north", kind: "location", label: "North lot" },
        { id: "priya", kind: "staff", label: "Priya Raman" },
      ] as never,
      edges: [],
    },
  });
const Board: ViewComponent<typeof schema> = ({ nodes }) => <div>{nodes?.length ?? 0} people</div>;
const views = () => createViews(schema).register("staff", { cardinality: "many", fidelity: "full" }, Board, { title: "The roster" });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
});
async function face(path: string, context: Partial<PageContext<typeof schema>> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), ...context }} initialPath={path} />));
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
}
const frame = () => act(async () => new Promise<void>((done) => requestAnimationFrame(() => done())));

describe("what a screen reader is told on the routed face", () => {
  it("puts the keyboard on the new page's heading when a place is followed from the bar, whose link stays", async () => {
    const host = await face("/locations");
    const link = [...host.querySelectorAll<HTMLAnchorElement>("nav a")].find((one) => one.getAttribute("href") === "/staff")!;
    expect(link).toBeDefined();
    link.focus();
    await act(async () => link.click());
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    // The link is still on the bar; the keyboard is not on it, but on what the page is.
    expect(link.isConnected).toBe(true);
    expect(document.activeElement?.tagName).toMatch(/^H[12]$/);
    expect(document.activeElement?.textContent).toBe("Staff");
  });

  it("names a picture a record is seen in once, by the picture, and the record's way to the scene says no arrow aloud", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store(), views: views(), sceneHref: "/" }} initialPath="/staff/priya" />);
    const page = new DOMParser().parseFromString(html, "text/html");
    // Each picture is one stop (Roadmap f-seen-in-phone-length): the arrow beside it to the scene is gone, with its stop.
    expect([...page.querySelectorAll('[data-testid="seen-in"] a')].map(nameOf)).toEqual(["The roster"]);
    expect(nameOf(page.querySelector('[data-testid="spatial-link"]')!)).toBe("In the scene");
  });

  it("takes the keyboard into the form a record's act opens, and Escape puts it away and gives the keyboard back", async () => {
    const host = await face("/staff/priya");
    const opener = [...host.querySelectorAll<HTMLButtonElement>("[data-affordance]")].find((button) => button.textContent === "Assign to a location")!;
    opener.focus();
    await act(async () => opener.click());
    await frame();
    expect(opener.getAttribute("aria-expanded")).toBe("true");
    const first = document.activeElement as HTMLElement;
    expect(first.closest("form")).not.toBeNull();
    await act(async () => {
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await frame();
    expect(host.querySelector("form select")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(opener.getAttribute("aria-expanded")).toBe("false");
  });

  it("says a flagged row breaks a rule in words, before its name", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath="/staff" />);
    const page = new DOMParser().parseFromString(html, "text/html");
    const row = [...page.querySelectorAll("a.graview-row-title")].find((one) => one.textContent?.includes("Priya Raman"))!;
    expect(row.textContent).toContain("⚠");
    expect(nameOf(row)).toBe("Breaks a rule: Priya Raman");
  });

  it("shows a required field's star and does not say it: the field says it is required", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath="/staff" />);
    const page = new DOMParser().parseFromString(html, "text/html");
    const input = page.querySelector<HTMLInputElement>('form input[name="label"]')!;
    expect(input.required).toBe(true);
    const label = input.closest("label")!.querySelector('[data-graview-part="label"]')!;
    expect(label.textContent).toBe("Name *");
    expect(nameOf(label)).toBe("Name");
  });
});
