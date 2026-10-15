// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnyMutationDefinition, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { linkedRecordsOver } from "@graview/core/linked";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A RECORD'S CHANGE STARTS FROM WHAT IT HOLDS (Roadmap f-edit-form-prefilled).
 *
 * "Change the feature" on a record page opened with "—" in every field: a
 * person changing one fact could not see the others, and a screen reader
 * heard "Stage, —, pop-up button" (the screen-reader pass). Every field
 * holds the record's value, for every type a field can be; and saving one
 * changes that one, leaving the rest as they were.
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

/** The record page's "Change the feature", drawn as the page draws it, on a store holding the feature. */
async function form(): Promise<{ host: HTMLElement; store: Store<AnySchema>; submit: () => Promise<void> }> {
  const store = new Store<AnySchema>({ schema: roadmap.schema, mutations: roadmap.mutations ?? [], snapshot: { nodes: [FEATURE], edges: [] } as never });
  const edit = store.allMutations().find((one) => one.name === "edit-feature") as AnyMutationDefinition<AnySchema>;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={createViews(store.schema)} principal={OWNER} linkedRecords={linkedRecords}>
        <DerivedForm store={store} mutation={edit} prefilled={{ id: "f1" }} principal={OWNER} />
      </GraviewProvider>,
    ),
  );
  // The linked picker asks the host for what it lists, a beat after it is drawn.
  await act(async () => new Promise((done) => setTimeout(done, 250)));
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  const submit = async () => act(async () => void host.querySelector<HTMLFormElement>("form")!.requestSubmit());
  return { host, store, submit };
}

/** Types into a box as a person does: the value set, then the event React listens for. */
async function type(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): Promise<void> {
  await act(async () => {
    const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

/** After a change to one field, every other field of the record is as it was, and the change says only that field. */
function onlyChanged(store: Store<AnySchema>, field: string, to: unknown): void {
  const node = store.graph.getNode("f1") as Record<string, unknown>;
  expect(node[field]).toEqual(to);
  for (const [key, was] of Object.entries(FEATURE)) if (key !== field) expect(node[key], key).toEqual(was);
  const said = store.log.all().at(-1)!.intent;
  expect(said.match(/ to /g)?.length, said).toBe(1);
}

describe("the derived edit's form on a record page", () => {
  it("holds the record's text, and saving it changes only the text", async () => {
    const { host, store, submit } = await form();
    const name = host.querySelector<HTMLInputElement>('input[name="name"]')!;
    expect(name.value).toBe("Billing across apps");
    await type(name, "Billing everywhere");
    await submit();
    onlyChanged(store, "name", "Billing everywhere");
  });

  it("holds the record's Markdown as written, and saving it changes only the Markdown", async () => {
    const { host, store, submit } = await form();
    const summary = host.querySelector<HTMLTextAreaElement>('textarea[name="summary"]')!;
    expect(summary.value).toBe("**Bill once** across every app.");
    await type(summary, "**Bill once** across every app. Said aloud.");
    await submit();
    onlyChanged(store, "summary", "**Bill once** across every app. Said aloud.");
  });

  it("holds the record's choice, never “—”, and saving it changes only the choice", async () => {
    const { host, store, submit } = await form();
    const stage = host.querySelector<HTMLSelectElement>('select[name="stage"]')!;
    expect(stage.value).toBe("planned");
    expect(stage.selectedOptions[0]!.textContent).toBe("Planned");
    await type(stage, "shipped");
    await submit();
    onlyChanged(store, "stage", "shipped");
    expect(store.log.all().at(-1)!.intent).toBe("Changed the stage of Billing across apps to Shipped");
  });

  it("holds the record's money as it is typed, and saving it changes only the money", async () => {
    const { host, store, submit } = await form();
    const budget = host.querySelector<HTMLInputElement>('input[name="budget"]')!;
    expect(budget.value).toBe("12,500");
    await type(budget, "13,000");
    await submit();
    onlyChanged(store, "budget", 13000);
  });

  it("holds the record's date and how it repeats, and saving the date changes only the date", async () => {
    const { host, store, submit } = await form();
    const day = host.querySelector<HTMLInputElement>('input[name="reviewOn"]')!;
    expect(day.value).toBe("2026-10-20");
    expect(host.querySelector<HTMLSelectElement>('select[name="reviewOnRepeat.every"]')!.value).toBe("week");
    await type(day, "2026-10-27");
    await submit();
    onlyChanged(store, "reviewOn", "2026-10-27");
  });

  it("holds the record's link, and saving it changes only the link", async () => {
    const { host, store, submit } = await form();
    const site = host.querySelector<HTMLInputElement>('input[name="site"]')!;
    expect(site.value).toBe("https://example.com/billing");
    await type(site, "https://example.com/billing-everywhere");
    await submit();
    onlyChanged(store, "site", "https://example.com/billing-everywhere");
  });

  it("holds the record's app, and saving it changes only the app", async () => {
    const { host, store, submit } = await form();
    const home = host.querySelector<HTMLInputElement>('input[name="home"]')!;
    expect(home.value).toBe("@nick/house");
    await type(home, "@nick/flat");
    await submit();
    onlyChanged(store, "home", "@nick/flat");
  });

  it("holds the record it links in another app, and picking another changes only the link", async () => {
    const { host, store, submit } = await form();
    const held = host.querySelector<HTMLButtonElement>('[data-graview-linked-candidate="house:h1"]')!;
    expect(held.getAttribute("aria-pressed")).toBe("true");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-graview-linked-candidate="house:h2"]')!.click());
    await submit();
    onlyChanged(store, "forHouse", "house:h2");
  });
});
