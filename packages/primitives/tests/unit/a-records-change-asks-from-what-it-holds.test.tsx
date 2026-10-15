// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { linkedRecordsOver } from "@graview/core/linked";
import { createViews, GraviewProvider } from "@graview/react";
import { deriveAffordances, type Affordance } from "@graview/tools";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AnswerArgs } from "../../src/index.js";

/**
 * A RECORD'S CHANGE ASKS FROM WHAT IT HOLDS, IN THE SCENE (Roadmap
 * f-edit-form-prefilled).
 *
 * "Change the feature", pressed on a record in the scene, asks its fields
 * one at a time beside the act; each question opened empty, so a person
 * changing one fact retyped or skipped every other, blind to what was
 * there. Each question opens on the record's value — typed in its box, or
 * its choice marked — and an answer left as it was is not sent: saving one
 * field changes that one and leaves the rest as they were.
 */
const compiled = (doc: unknown): GraviewApp<AnySchema> => {
  const result = compileDocument(doc, { today: () => "2026-10-14" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((one) => one.severity === "error")));
  return result.app as GraviewApp<AnySchema>;
};
const houseApp = compiled({
  format: "graview-document",
  formatVersion: 1,
  name: "House",
  kinds: { house: { label: "{street}", fields: { street: { type: "string", required: true } } } },
  acts: { "add-house": { creates: "house" } },
});
const houses = new Store<AnySchema>({ schema: houseApp.schema, snapshot: { nodes: [{ id: "h1", kind: "house", street: "12 Elm Street" }, { id: "h2", kind: "house", street: "4 Oak Lane" }], edges: [] } as never });
const roadmap = compiled({
  format: "graview-document",
  formatVersion: 1,
  name: "Roadmap",
  brand: { currency: "USD" },
  kinds: {
    feature: {
      label: "{name}",
      fields: {
        name: { type: "string", required: true },
        summary: { type: "text", format: "markdown" },
        stage: { type: "enum", options: ["considering", "planned", "shipped"] },
        budget: { type: "number", format: "money" },
        reviewOn: { type: "date", repeats: true },
        site: { type: "url" },
        home: { type: "app-link" },
      },
      edges: { forHouse: { to: ["@nick/house/house"], cardinality: "one" } },
    },
  },
  acts: { "add-feature": { title: "Add a feature", creates: "feature" } },
});
const FEATURE = {
  id: "f1",
  kind: "feature",
  name: "Billing across apps",
  summary: "**Bill once** across every app.",
  stage: "planned",
  budget: 12500,
  reviewOn: "2026-10-20",
  reviewOnRepeat: { every: "week" },
  site: "https://example.com/billing",
  home: "@nick/house",
  forHouse: "house:h1",
};
const OWNER: Principal = { kind: "human", id: "u:ada", roles: ["owner"] };
const linkedRecords = linkedRecordsOver({ "@nick/house": { store: houses, name: "House", opens: () => true, href: (ref) => `/house/${ref.id}` } });

const mounted: (() => void)[] = [];
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

/** The ask under the act, as the strip holds it: applied as the strip applies it, and put away once it is. */
function Strip({ store, affordance }: { readonly store: Store<AnySchema>; readonly affordance: Affordance }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <AnswerArgs
      store={store}
      affordance={affordance}
      onApply={(args) => {
        store.apply({ name: affordance.mutation, args: { ...affordance.args, ...args } }, { author: OWNER });
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  ) : null;
}

/** The scene's ask for "Change the feature" on the feature. */
async function asking(): Promise<{ host: HTMLElement; store: Store<AnySchema>; affordance: Affordance }> {
  const store = new Store<AnySchema>({ schema: roadmap.schema, mutations: roadmap.mutations ?? [], snapshot: { nodes: [FEATURE], edges: [] } as never });
  const affordance = deriveAffordances(store, ["f1"], { principal: OWNER } as never).affordances.find((one) => one.mutation === "edit-feature")!;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={createViews(store.schema)} principal={OWNER} linkedRecords={linkedRecords}>
        <Strip store={store} affordance={affordance} />
      </GraviewProvider>,
    ),
  );
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  return { host, store, affordance };
}

/** Types into a box as a person does: the value set, then the event React listens for. */
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

type Step = { readonly name: string; readonly held: string };
/**
 * Walks every question to the end: at each, what the box or the choices
 * hold, then `change` for the field named there, else the answer as it
 * opened — the box sent as it is, the choice held pressed again, a link in
 * another app kept by moving on.
 */
async function walk(host: HTMLElement, change: Record<string, (here: HTMLElement) => Promise<void>>): Promise<Step[]> {
  const steps: Step[] = [];
  for (let at = 0; at < 20; at++) {
    const ask = host.querySelector<HTMLElement>("[data-graview-asking]");
    if (!ask) break;
    // The linked picker asks the host for what it lists, a beat after it is drawn.
    if (ask.querySelector("[data-graview-linked-picker]")) await act(async () => new Promise((done) => setTimeout(done, 250)));
    const repeat = ask.querySelector<HTMLElement>("[data-graview-repeat]");
    const box = repeat ? null : ask.querySelector<HTMLInputElement | HTMLTextAreaElement>("form input, form textarea");
    const linked = ask.querySelector<HTMLElement>("[data-graview-linked-picker]");
    const held = ask.querySelector<HTMLButtonElement>('[role="group"] button[aria-current="true"]');
    const name = repeat?.getAttribute("data-graview-repeat") ?? box?.name ?? (linked ? "forHouse" : (held?.getAttribute("aria-label")?.split(":")[0] ?? "?"));
    steps.push({ name, held: repeat ? repeat.querySelector("select")!.value : box ? box.value : linked ? (linked.querySelector('[aria-pressed="true"]')?.getAttribute("data-graview-linked-candidate") ?? "") : (held?.textContent ?? "") });
    const step = Object.keys(change).find((key) => key === name);
    const was = ask.textContent;
    if (step) await change[step]!(ask);
    else if (repeat || box) await act(async () => void (repeat ?? box)!.closest("form")!.requestSubmit());
    else if (held) await act(async () => held.click());
    else await act(async () => [...ask.querySelectorAll("button")].find((one) => one.textContent === "Skip")!.click());
    // The next question may wait on a picker fetched as it is first drawn.
    for (let wait = 0; wait < 40 && host.querySelector("[data-graview-asking]")?.textContent === was; wait++) await act(async () => new Promise((done) => setTimeout(done, 50)));
  }
  return steps;
}
const held = (steps: Step[], name: string) => steps.find((step) => step.name === name)?.held;

/** After a change to one field, every other field of the record is as it was, and the change says only that field. */
function onlyChanged(store: Store<AnySchema>, field: string, to: unknown): void {
  const node = store.graph.getNode("f1") as Record<string, unknown>;
  expect(node[field]).toEqual(to);
  for (const [key, was] of Object.entries(FEATURE)) if (key !== field) expect(node[key], key).toEqual(was);
  const said = store.log.all().at(-1)!.intent;
  expect(said.match(/ to /g)?.length, said).toBe(1);
}
const typing = (value: string) => async (ask: HTMLElement) => {
  const box = ask.querySelector<HTMLInputElement | HTMLTextAreaElement>("form input, form textarea")!;
  await type(box, value);
  await act(async () => void box.form!.requestSubmit());
};

describe("the derived edit's ask in the scene", { timeout: 30_000 }, () => {
  it("opens on the record's text, and saving it changes only the text", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { name: typing("Billing everywhere") });
    expect(held(steps, "name")).toBe("Billing across apps");
    onlyChanged(store, "name", "Billing everywhere");
  });

  it("opens on the record's Markdown as written, and saving it changes only the Markdown", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { summary: typing("**Bill once** everywhere.") });
    expect(held(steps, "summary")).toBe("**Bill once** across every app.");
    onlyChanged(store, "summary", "**Bill once** everywhere.");
  });

  it("marks the record's choice among the others, and choosing another changes only the choice", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { Stage: async (ask) => act(async () => ask.querySelector<HTMLButtonElement>('button[aria-label="Stage: Shipped"]')!.click()) });
    expect(held(steps, "Stage")).toBe("Planned");
    onlyChanged(store, "stage", "shipped");
  });

  it("opens on the record's money as it is typed, and saving it changes only the money", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { budget: typing("13,000") });
    expect(held(steps, "budget")).toBe("12,500");
    onlyChanged(store, "budget", 13000);
  });

  it("opens on the record's date, and saving it changes only the date and not how it repeats", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { reviewOn: typing("2026-10-27") });
    expect(held(steps, "reviewOn")).toBe("2026-10-20");
    onlyChanged(store, "reviewOn", "2026-10-27");
  });

  it("opens on how the record's date repeats, in the picker the pages ask with, and changing it changes only the repeat", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, {
      reviewOnRepeat: async (ask) => {
        const every = ask.querySelector<HTMLSelectElement>('select[name="reviewOnRepeat.every"]')!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(every, "month");
          every.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await act(async () => void every.closest("form")!.requestSubmit());
      },
    });
    expect(held(steps, "reviewOnRepeat")).toBe("week");
    onlyChanged(store, "reviewOnRepeat", { every: "month" });
    expect(store.log.all().at(-1)!.intent).toBe("Changed the review on of Billing across apps to repeat every month");
  });

  it("opens on the record's link, and saving it changes only the link", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { site: typing("https://example.com/everywhere") });
    expect(held(steps, "site")).toBe("https://example.com/billing");
    onlyChanged(store, "site", "https://example.com/everywhere");
  });

  it("opens on the record's app, and saving it changes only the app", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { home: typing("@nick/flat") });
    expect(held(steps, "home")).toBe("@nick/house");
    onlyChanged(store, "home", "@nick/flat");
  });

  it("marks the record it links in another app, and picking another changes only the link", async () => {
    const { host, store } = await asking();
    const steps = await walk(host, { forHouse: async (ask) => act(async () => ask.querySelector<HTMLButtonElement>('[data-graview-linked-candidate="house:h2"]')!.click()) });
    expect(held(steps, "forHouse")).toBe("house:h1");
    onlyChanged(store, "forHouse", "house:h2");
  });
});
