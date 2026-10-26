// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EditableValue } from "../../src/index.js";
import { prefetchWhenInput } from "../../src/when-input-door.js";

/**
 * A DATE EMPTIED IN PLACE IS CLEARED (Roadmap f-clear-date-in-place). Since
 * 0.1.56 `null` clears a field a record may be without on a derived edit,
 * and the page's in-place editor still sent nothing when a person emptied a
 * date: a wrong date could be changed, never removed. Emptied now, a field
 * a record may be without is sent `null` and the record has none; a field it
 * cannot be without keeps its value and says it can't be empty.
 */
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  kinds: {
    actor: {
      noun: "actor",
      plural: "actors",
      label: "{name}",
      fields: {
        name: { type: "string", required: true },
        firstSeen: { type: "date" },
        alias: { type: "string" },
        targets: { type: "integer" },
      },
    },
  },
  acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
  policy: { grants: [{ roles: "*", mutations: "*" }] },
};

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined;
});

async function opened(field: string, value: string) {
  // A date's editor is fetched as a date that can be changed is drawn; here, before it is opened.
  await prefetchWhenInput();
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: { nodes: [{ id: "actor:apt1", kind: "actor", name: "APT1", firstSeen: "2006-01-01", alias: "Comment Crew", targets: 141 }] as never, edges: [] },
  });
  host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <GraviewProvider store={store} views={createViews(app.schema)} principal={owner}>
        <EditableValue nodeId="actor:apt1" field={field} value={value} stored={value} />
      </GraviewProvider>,
    );
  });
  await act(async () => host!.querySelector<HTMLButtonElement>(`button[data-graview-field="${field}"]`)!.click());
  return store;
}

/** Empty the open editor's box, as a person selecting all of it and deleting does, and press Enter. */
async function emptied(field: string) {
  const input = host!.querySelector<HTMLInputElement>(`input[data-graview-field="${field}"], [data-graview-when] input`)!;
  expect(input).not.toBeNull();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("a field emptied in place", () => {
  it("clears a date the record may be without: the edit is sent null, and the record then has none", async () => {
    const store = await opened("firstSeen", "2006-01-01");
    await emptied("firstSeen");
    const actor = store.graph.getNode("actor:apt1") as Record<string, unknown>;
    expect(Object.hasOwn(actor, "firstSeen") && actor["firstSeen"] !== undefined).toBe(false);
    expect(actor["name"]).toBe("APT1");
  });

  it("clears any optional field that can be emptied: words, and a number, never sent as zero", async () => {
    const words = await opened("alias", "Comment Crew");
    await emptied("alias");
    expect((words.graph.getNode("actor:apt1") as Record<string, unknown>)["alias"]).toBeUndefined();
    await act(async () => root!.unmount());
    host!.remove();
    root = undefined;
    const number = await opened("targets", "141");
    await emptied("targets");
    expect((number.graph.getNode("actor:apt1") as Record<string, unknown>)["targets"]).toBeUndefined();
  });

  it("keeps a field the record cannot be without, and says it can't be empty", async () => {
    const store = await opened("name", "APT1");
    await emptied("name");
    expect((store.graph.getNode("actor:apt1") as Record<string, unknown>)["name"]).toBe("APT1");
    expect(host!.querySelector('[data-graview-refused="name"]')?.textContent).toBe("Name can't be empty; it keeps APT1.");
  });
});
