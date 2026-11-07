// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Author, type Principal } from "@graview/core";
import { declined, suggest, suggestions } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import axe from "axe-core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, registerDefaultViews, Shell } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * A SUGGESTION READS AS ONE LINE WITH ITS BUTTONS (Roadmap
 * f-suggestion-card-one-line). Nick, on 0.1.66, a book app's inbox: "the
 * design of a lot of these notifications make it really difficult to digest
 * what's going on". One card said "Graview, tidying suggests Place in
 * chapter: What I steer by (my values, as one example)", then "Jev: 0.95
 * that the in chapter of … is “09 · Without a Map” (they share the word
 * “what”) · 95% sure · jev-latest", then two chips naming both records, then
 * Accept, Decline, Not now. Now it is one sentence with its records as
 * links in it, a long name cut and whole on hover, then Yes, No and Later;
 * why it was suggested is behind "Why?", in words, never a probability or a
 * model's name; and several alike are one group, a row each.
 */
const chapter = defineNode("chapter", { fields: z.object({ label: z.string() }), plural: "Chapters" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes", edges: { "in-chapter": { to: ["chapter"], cardinality: "one" } } });
const schema = createSchema([chapter, note]);
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };
const STEER = "What I steer by (my values, as one example)";
const OLD = "Jev: 0.95 that the in chapter of “What I steer by (my values, as one example)” is “09 · Without a Map” (both are about direction)";

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

function storeOf(notes: readonly string[]) {
  const store = new Store({
    schema,
    snapshot: {
      nodes: [{ id: "ch9", kind: "chapter", label: "09 · Without a Map" }, { id: "steer", kind: "note", label: STEER }, { id: "home", kind: "note", label: "Leaving home" }, { id: "first", kind: "note", label: "First job" }] as never,
      edges: [],
    },
  });
  for (const id of notes) suggest(store, [{ name: "connect-note-in-chapter", args: { id, to: "ch9" } }], { author: actor, lineage: { basis: OLD, confidence: 0.95, model: "jev-latest", actor: "missing-links" } });
  return store;
}

async function inbox(store: Store<typeof schema>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={nora}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  await settled(() => expect(document.querySelector('[data-testid="inbox-button"]')).not.toBeNull());
  await act(async () => document.querySelector<HTMLElement>('[data-testid="inbox-button"]')!.click());
  await settled(() => expect(document.querySelector('[data-testid="suggested"] [data-testid="suggestion"]')).not.toBeNull());
  return host;
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string, inside: ParentNode = document) => inside.querySelector<T>(selector);
const shown = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>("*")].filter((one) => !one.closest("[hidden]") && one.style.position !== "absolute" && one.childNodes.length > 0).map((one) => [...one.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join("")).join("");

describe("a placement in the inbox", () => {
  it("is one sentence with its records in it, then Why?, Yes, No and Later", async () => {
    const host = await inbox(storeOf(["steer"]));
    const row = $('[data-testid="suggestion"]')!;
    expect($("[data-graview-suggestion-words]", row)!.textContent).toBe(`Put “${STEER}” in 09 · Without a Map?`);
    expect([...row.querySelectorAll("button")].map((button) => button.textContent)).toEqual([STEER, "09 · Without a Map", "Why?", "Yes", "No", "Don't suggest this kind of thing", "Later"]);
    // Nothing else is said until Why? is pressed: no maker, no basis, no confidence, no model, no chips.
    expect(shown(row)).not.toMatch(/suggests|Graview, tidying|% sure|0\.95|jev|the in chapter of/i);
    expect($("[data-graview-suggestion-records]", row)).toBeNull();
    const said = await axe.run(host, { rules: { "color-contrast": { enabled: false } } });
    expect(said.violations.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  it("cuts a long name where it stands and keeps it whole for a hover and a screen reader", async () => {
    await inbox(storeOf(["steer"]));
    const name = [...document.querySelectorAll<HTMLElement>('[data-testid="suggestion-record"]')].find((one) => one.getAttribute("data-record") === "steer")!;
    expect(name.textContent).toBe(STEER);
    expect(name.title).toBe(`Go to ${STEER}`);
    expect(name.style.textOverflow).toBe("ellipsis");
    expect(name.style.whiteSpace).toBe("nowrap");
    expect(name.style.maxWidth).toBe("min(24ch, 100%)");
  });

  it("says why behind Why?, in words alone", async () => {
    await inbox(storeOf(["steer"]));
    const why = $('[data-testid="suggestion-why"]')!;
    const because = document.getElementById(why.getAttribute("aria-controls")!)!;
    expect(why.getAttribute("aria-expanded")).toBe("false");
    expect(because.hidden).toBe(true);
    await act(async () => why.click());
    expect(why.getAttribute("aria-expanded")).toBe("true");
    expect(because.hidden).toBe(false);
    expect(because.textContent).toBe("Both are about direction.");
  });

  it("keeps Yes, No and Later as Accept, Decline and Not now", async () => {
    const store = storeOf(["steer", "home"]);
    await inbox(store);
    const before = store.graph.allEdges().length;
    await act(async () => $('[data-testid="suggestion-decline"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="suggestion"]')).toHaveLength(1));
    expect(declined(store, [{ name: "connect-note-in-chapter", args: { id: "steer", to: "ch9" } }])?.author).toMatchObject({ id: "nora" });
    await act(async () => $('[data-testid="suggestion-accept"]')!.click());
    await settled(() => expect($('[data-testid="suggestion"]')).toBeNull());
    expect(store.graph.allEdges().length).toBe(before + 1);
    expect(suggestions(store)).toEqual([]);
  });
});

describe("several placements alike", () => {
  it("are one group, a row each", async () => {
    await inbox(storeOf(["steer", "home", "first"]));
    const group = $('[data-testid="suggestion-group"]')!;
    expect(group.firstElementChild!.textContent).toBe("3 notes to put in chapters");
    expect([...group.querySelectorAll("[data-graview-suggestion-words]")].map((one) => one.textContent)).toEqual([`Put “${STEER}” in 09 · Without a Map?`, "Put “Leaving home” in 09 · Without a Map?", "Put “First job” in 09 · Without a Map?"]);
  });
});
