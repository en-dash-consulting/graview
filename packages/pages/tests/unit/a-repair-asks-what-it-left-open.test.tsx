// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, isoDate, Store, type Violation } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Repairs } from "../../src/index.js";

/**
 * A REPAIR ASKS WHAT IT LEFT OPEN, AND ONLY THAT. "Correct when Kerosene
 * came out" names the derived edit act with `missing: ["released"]`; the
 * routed face drew the edit act's every field, the name first, and a date
 * typed into the first box renamed the single "2023-04-14". Answered, the
 * form went and took the keyboard to <body>.
 */
const album = defineNode("album", {
  fields: z.object({ label: z.string().min(1), released: isoDate.optional(), type: z.enum(["album", "single"]) }),
  plural: "Albums",
  label: (node) => node.label,
});
const schema = createSchema([album]);
const { defineInvariant } = bindSchema(schema);
const early = defineInvariant("early", {
  scope: { kind: "album" },
  repairs: ["edit-album"],
  evaluate({ subject }): Violation[] {
    return subject.released && subject.released > "2023-05-05"
      ? [{ invariant: "early", subjectId: subject.id, label: "Released too late", message: "late", nodeIds: [subject.id], repairs: [{ mutation: "edit-album", args: { id: subject.id }, missing: ["released"], label: `Correct when ${subject.label} came out` }] }]
      : [];
  },
});

describe("a repair that leaves one argument open, on the routed face", () => {
  it("asks for that argument alone, submits under the repair's words, and hands the keyboard back", async () => {
    const store = new Store({
      schema,
      mutations: [],
      invariants: [early],
      snapshot: { nodes: [{ id: "kerosene", kind: "album", label: "Kerosene", released: "2023-06-30", type: "single" }] as never, edges: [] },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const draw = () => root.render(<main><h1>What is broken</h1><Repairs store={store} repairs={store.violations()[0]?.repairs ?? []} /></main>);
    await act(async () => draw());
    await act(async () => host.querySelector<HTMLButtonElement>("[data-graview-repair]")!.click());
    const inputs = [...host.querySelectorAll("input, select")].map((el) => el.getAttribute("name"));
    expect(inputs).toEqual(["released"]);
    expect(host.querySelector('button[type="submit"]')!.textContent).toBe("Correct when Kerosene came out");
    const input = host.querySelector<HTMLInputElement>('input[name="released"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    input.focus();
    await act(async () => {
      setter.call(input, "2023-04-14");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => draw());
    // The keyboard is handed back after the form goes, a frame or more later: on a busy
    // machine one frame is not enough, so wait for it (up to two seconds) rather than for a frame.
    for (const end = Date.now() + 2000; document.activeElement === document.body && Date.now() < end; ) {
      await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    }
    expect(store.graph.getNode("kerosene")).toMatchObject({ label: "Kerosene", released: "2023-04-14" });
    expect(document.activeElement).not.toBe(document.body);
    await act(async () => root.unmount());
  });
});
