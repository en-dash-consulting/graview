// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { readableFields } from "@graview/core/words";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EditableValue } from "../../src/index.js";

/**
 * SEVERAL OPTIONS CHANGED IN PLACE AS BOXES (Roadmap f-multi-select-enum,
 * FR-233). A record's facts say a choice that takes several of its options
 * by each option's label, "CTO, QA"; opened where it stands, it is a group
 * of boxes, one per option, and a box ticked or cleared sends the list now
 * ticked through the record's own edit — undoable, judged by the rules,
 * like every change made in place.
 */
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Memos",
  kinds: {
    memo: {
      noun: "memo",
      plural: "memos",
      label: "{title}",
      fields: {
        title: { type: "string", required: true },
        recipients: { type: "enum", multiple: true, options: ["cto", "developers", "qa", "product"], optionLabels: { cto: "CTO", qa: "QA" } },
      },
    },
  },
  acts: { "add-memo": { title: "Add a memo", creates: "memo" } },
  policy: { grants: [{ roles: "*", mutations: "*" }] },
};

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined;
});

describe("a choice that takes several options, changed in place", () => {
  it("is said by its options' labels, opens as a box per option, and a box ticked sends the list", async () => {
    const compiled = compileDocument(document);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
    const app = compiled.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      ...(app.policy ? { policy: app.policy } : {}),
      snapshot: { nodes: [{ id: "memo:q4", kind: "memo", title: "Q4 plan", recipients: ["cto", "qa"] }] as never, edges: [] },
    });
    const definition = store.schema.tryDefinition("memo");
    const fact = readableFields(store.graph.getNode("memo:q4") as never, definition).find((one) => one.key === "recipients")!;
    expect(fact.value).toBe("CTO, QA");
    host = globalThis.document.createElement("div");
    globalThis.document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <GraviewProvider store={store} views={createViews(app.schema)} principal={owner}>
          <EditableValue nodeId="memo:q4" field="recipients" value={fact.value} stored={fact.stored} />
        </GraviewProvider>,
      );
    });
    const opener = host.querySelector<HTMLButtonElement>('button[data-graview-field="recipients"]')!;
    expect(opener.textContent).toBe("CTO, QA");
    await act(async () => opener.click());
    const boxes = [...host.querySelectorAll<HTMLInputElement>('[data-graview-choices="recipients"] input[type="checkbox"]')];
    expect(boxes.map((box) => box.value)).toEqual(["cto", "developers", "qa", "product"]);
    expect(boxes.map((box) => box.checked)).toEqual([true, false, true, false]);
    expect(boxes.map((box) => box.closest("label")?.textContent?.trim())).toEqual(["CTO", "Developers", "QA", "Product"]);
    expect(globalThis.document.activeElement).toBe(boxes[0]);
    await act(async () => boxes[1]!.click());
    expect((store.graph.getNode("memo:q4") as { recipients?: unknown }).recipients).toEqual(["cto", "developers", "qa"]);
    const after = [...host.querySelectorAll<HTMLInputElement>('[data-graview-choices="recipients"] input[type="checkbox"]')];
    await act(async () => after[0]!.click());
    expect((store.graph.getNode("memo:q4") as { recipients?: unknown }).recipients).toEqual(["developers", "qa"]);
  });
});
