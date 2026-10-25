// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnyMutationDefinition, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EditableValue, prefetchWhenInput } from "@graview/primitives/pages";
import { createViews, GraviewProvider } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A YEAR OR A MONTH ALONE IS TYPED AS SAID (Roadmap f-partial-dates). A
 * document's date may know only its year (APT1, first seen 2006) or its
 * month; the date's editor reads "2006" and "May 2016" as that, says it
 * back, and keeps `2006` and `2016-05` — in an act's form and on the record.
 */
const result = compileDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Threats",
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
  kinds: { actor: { fields: { name: { type: "string", required: true }, firstSeen: { type: "date", label: "First seen" } } } },
  acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
});
if (!result.ok) throw new Error("the document compiles");
const app = result.app as GraviewApp<AnySchema>;
const OWNER: Principal = { kind: "human", id: "nick", roles: ["owner"] };

const mounted: (() => void)[] = [];
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

async function draw(store: Store<AnySchema>, children: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={createViews(store.schema)} principal={OWNER}>
        {children}
      </GraviewProvider>,
    ),
  );
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  await act(async () => prefetchWhenInput());
  return host;
}

async function type(element: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("a date that may know only its year or its month", () => {
  it("in an act's form: 'May 2016' is said back as a month alone and kept as 2016-05", async () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy! });
    const add = store.allMutations().find((one) => one.name === "add-actor") as AnyMutationDefinition<AnySchema>;
    const host = await draw(store, <DerivedForm store={store} mutation={add} principal={OWNER} />);
    await type(host.querySelector<HTMLInputElement>('input[name="name"]')!, "APT28");
    const seen = host.querySelector<HTMLInputElement>('input[name="firstSeen"]')!;
    await type(seen, "May 2016");
    expect(seen.closest("[data-graview-when]")!.querySelector("[data-graview-part=when-said]")!.textContent).toBe("May 2016 (a month alone)");
    expect(seen.validity.valid).toBe(true);
    await act(async () => void host.querySelector<HTMLFormElement>("form")!.requestSubmit());
    expect(store.graph.nodesOfKind("actor")[0]).toMatchObject({ name: "APT28", firstSeen: "2016-05" });
  });

  it("on the record: a year alone is said as the year, and a day typed over it is kept as a day", async () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [{ id: "actor:apt1", kind: "actor", name: "APT1", firstSeen: "2006" }], edges: [] } as never });
    const host = await draw(store, <EditableValue nodeId="actor:apt1" field="firstSeen" value="2006" stored="2006" />);
    await act(async () => host.querySelector<HTMLButtonElement>("button[data-graview-field=firstSeen]")!.click());
    await act(async () => prefetchWhenInput());
    const box = host.querySelector<HTMLInputElement>("[data-graview-when] input")!;
    expect(box.value).toBe("2006");
    await type(box, "2006-02");
    await act(async () => void box.form!.requestSubmit());
    expect(store.graph.getNode("actor:apt1")).toMatchObject({ firstSeen: "2006-02" });
  });
});
