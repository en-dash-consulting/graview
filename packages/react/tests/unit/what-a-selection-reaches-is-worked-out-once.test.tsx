// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, useGraview } from "../../src/index.js";
import { useReached } from "../../src/emphasis.js";

/**
 * WHAT A SELECTION REACHES IS WORKED OUT ONCE, HOWEVER MANY ASK.
 *
 * Every card in the scene and the panel beside it asks what the selection
 * reaches, to light it and dim the rest, and each one walked every edge and
 * judged every rule over the whole graph for itself: choosing a district of
 * a thousand-record app spent most of a second on the same answer, twenty
 * times over.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, kind: "note", label: `Note ${i}` }));
const store = new Store({ schema, mutations: [], snapshot: { nodes, edges: [] } });
const views = createViews(schema);

const answers: (readonly string[])[] = [];
function Card() {
  answers.push(useReached());
  return null;
}
let outer: ReturnType<typeof useGraview> | null = null;
function Outside() {
  outer = useGraview();
  return null;
}

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("useReached", () => {
  it("judges the rules once for every card that asks, and hands each the same answer", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root.render(
        <GraviewProvider store={store} views={views} initialView={EMPTY_VIEW}>
          <Outside />
          {Array.from({ length: 20 }, (_, i) => (
            <Card key={i} />
          ))}
        </GraviewProvider>,
      ),
    );
    const judged = vi.spyOn(store, "violations");
    answers.length = 0;
    act(() => outer!.setSelection(["n3"]));
    expect(answers.length).toBeGreaterThanOrEqual(20);
    expect(answers.every((answer) => answer === answers[0])).toBe(true);
    expect(answers[0]).toEqual(["n3"]);
    expect(judged.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
