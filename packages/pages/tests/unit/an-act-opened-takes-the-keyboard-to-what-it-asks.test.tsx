// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm, PagesApp, Repairs, type PageContext } from "../../src/index.js";

/**
 * AN ACT OPENED TAKES THE KEYBOARD TO WHAT IT ASKS (the journeys' relate
 * and repair on the pages). A record's act opened its form and left the
 * keyboard on the act's button — or put it in the form's first box, a note
 * nobody was asked for — and the choice the act was pressed for was six
 * Tabs on, past every act after it, where the pointer pressed it once. And
 * the acts themselves were a Tab stop each: the tenth act of a record was
 * ten Tabs from the first, where the pointer pressed it where it stood.
 */
const location = defineNode("location", { fields: z.object({ label: z.string() }), plural: "Locations" });
const staff = defineNode("staff", {
  fields: z.object({ label: z.string() }),
  plural: "Staff",
  edges: { "works-at": { to: ["location"], description: "where they work", inverse: "who works here" } },
});
const schema = createSchema([location, staff]);
const { defineMutation } = bindSchema(schema);
const assign = defineMutation("works-at", {
  title: "Assign to a location",
  subject: { kinds: ["staff"], arg: "staffId" },
  connects: ["works-at"],
  // A note first, which nobody has to give: the act is pressed for the location.
  input: z.object({ staffId: nodeRef(["staff"]), note: z.string().optional(), locationId: nodeRef(["location"]) }),
  apply: (ctx, args) => void ctx.addEdge({ kind: "works-at", from: args.staffId, to: args.locationId }),
});
const rename = defineMutation("rename-staff", {
  title: "Rename",
  subject: { kinds: ["staff"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["staff"]), label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.patchNode(args.id, { label: args.label }),
});
const promote = defineMutation("promote", {
  title: "Promote",
  subject: { kinds: ["staff"], arg: "id" },
  input: z.object({ id: nodeRef(["staff"]) }),
  apply: () => undefined,
});

const fresh = () =>
  new Store({
    schema,
    mutations: [assign, rename, promote],
    snapshot: {
      nodes: [
        { id: "north", kind: "location", label: "North lot" },
        { id: "priya", kind: "staff", label: "Priya Raman" },
      ] as never,
      edges: [],
    },
  });

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const one of cleanup) await one();
  cleanup = [];
  document.body.innerHTML = "";
});

async function draw(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  cleanup.push(() => act(async () => root.unmount()));
  return host;
}

const frames = () => act(async () => new Promise((resolve) => setTimeout(resolve, 60)));

describe("an act opened from the keyboard", () => {
  it("puts the keyboard in the field the act asks for, past one it does not", async () => {
    const store = fresh();
    const context: PageContext<typeof schema> = { store };
    const host = await draw(<PagesApp context={context} initialPath="/staff/priya" />);
    const opener = [...host.querySelectorAll<HTMLButtonElement>("[data-affordance]")].find((button) => button.textContent?.startsWith("Assign to a location"))!;
    opener.focus();
    await act(async () => opener.click());
    await frames();
    const asked = document.activeElement as HTMLElement | null;
    expect(asked?.tagName).toBe("SELECT");
    expect(asked?.getAttribute("name")).toBe("locationId");
  });

  it("is one Tab stop for a record's acts, a letter moving to the act it begins", async () => {
    const store = fresh();
    const context: PageContext<typeof schema> = { store };
    const host = await draw(<PagesApp context={context} initialPath="/staff/priya" />);
    const acts = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="record-actions"] [data-affordance]')];
    expect(acts.length).toBeGreaterThan(1);
    const row = acts[0]!.closest<HTMLElement>("[data-graview-roving]");
    expect(row?.getAttribute("data-graview-roving")).toBe("letters");
    // One of them takes Tab; the rest are the arrows' and the letters'.
    expect(acts.filter((one) => one.tabIndex === 0)).toHaveLength(1);
    acts[0]!.focus();
    await act(async () => void acts[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true })));
    expect(document.activeElement?.textContent).toMatch(/^Rename/);
  });

  it("takes the keyboard into a form drawn with autoFocus, at what it asks", async () => {
    const store = fresh();
    await draw(<DerivedForm store={store} mutation={assign as never} prefilled={{ staffId: "priya" }} autoFocus />);
    await frames();
    expect((document.activeElement as HTMLElement | null)?.getAttribute("name")).toBe("locationId");
  });

  it("leaves the keyboard where it is for a form drawn without it", async () => {
    const store = fresh();
    await draw(<DerivedForm store={store} mutation={assign as never} prefilled={{ staffId: "priya" }} />);
    await frames();
    expect(document.activeElement).toBe(document.body);
  });

  it("takes the keyboard into a repair's question when the repair is pressed", async () => {
    const store = fresh();
    const host = await draw(<Repairs store={store} repairs={[{ mutation: "works-at", label: "Give Priya a place", args: { staffId: "priya" }, missing: ["locationId"] }] as never} />);
    const repair = host.querySelector<HTMLButtonElement>("[data-graview-repair]")!;
    repair.focus();
    await act(async () => repair.click());
    await frames();
    expect((document.activeElement as HTMLElement | null)?.getAttribute("name")).toBe("locationId");
  });
});
