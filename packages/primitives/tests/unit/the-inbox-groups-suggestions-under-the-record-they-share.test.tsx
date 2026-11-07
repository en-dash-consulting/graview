// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Author, type Principal } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
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
 * THE INBOX GROUPS SUGGESTIONS UNDER THE RECORD THEY SHARE (Roadmap
 * f-suggestions-grouped-by-record). Placing a note in a chapter, linking it
 * to another and setting it aside were three cards, each saying the note's
 * name again. Now the note is named once, a link heading a list, and each
 * row under it says only what differs, with its own Why?, Yes, No and
 * Later. Placements alike about other notes still stand under one line by
 * kind.
 */
const chapter = defineNode("chapter", { fields: z.object({ label: z.string() }), plural: "Chapters" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes", edges: { "in-chapter": { to: ["chapter"], cardinality: "one" }, "waits-for": { to: ["note"] } } });
const schema = createSchema([chapter, note]);
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };
const STEER = "What I steer by";

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

/** Three suggestions about one note, and two placements alike about two others. */
function storeOf() {
  const store = new Store({
    schema,
    snapshot: {
      nodes: [{ id: "ch9", kind: "chapter", label: "09 · Without a Map" }, { id: "steer", kind: "note", label: STEER }, { id: "home", kind: "note", label: "Leaving home" }, { id: "first", kind: "note", label: "First job" }] as never,
      edges: [],
    },
  });
  const ask = (name: string, args: Record<string, unknown>, by: string) => suggest(store, [{ name, args }], { author: actor, lineage: { basis: "Both are about direction", confidence: 0.8, actor: by } });
  ask("connect-note-in-chapter", { id: "steer", to: "ch9" }, "missing-links");
  ask("connect-note-waits-for", { id: "steer", to: "first" }, "missing-links");
  ask("archive-note", { id: "steer" }, "archive");
  ask("connect-note-in-chapter", { id: "home", to: "ch9" }, "missing-links");
  ask("connect-note-in-chapter", { id: "first", to: "ch9" }, "missing-links");
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
const words = (inside: ParentNode) => [...inside.querySelectorAll("[data-graview-suggestion-words]")].map((one) => one.textContent);
const group = () => $('[data-testid="suggestion-record-group"]');

describe("suggestions about one record", () => {
  it("stand under its name, said once as a link heading a list", async () => {
    await inbox(storeOf());
    const heading = $('[data-testid="suggestion-record-heading"]', group()!)!;
    expect(group()!.getAttribute("data-record")).toBe("steer");
    expect(heading.getAttribute("role") ?? heading.tagName.toLowerCase()).toMatch(/^(heading|h\d)$/);
    const link = $<HTMLButtonElement>('[data-testid="suggestion-record"]', heading)!;
    expect(link.textContent).toBe(STEER);
    expect(link.getAttribute("data-record")).toBe("steer");
    const list = $("ol", group()!)!;
    expect(list.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(list.querySelectorAll(':scope > [data-testid="suggestion"]')).toHaveLength(3);
  });

  it("say only what differs, never the record's name again", async () => {
    await inbox(storeOf());
    expect(words(group()!)).toEqual(["Put in 09 · Without a Map?", "Wait for First job?", "Set aside?"]);
    expect(group()!.textContent!.split(STEER)).toHaveLength(2);
  });

  it("keep each its own Why?, Yes, No and Later, described with the record's name", async () => {
    await inbox(storeOf());
    const rows = [...group()!.querySelectorAll<HTMLElement>('[data-testid="suggestion"]')];
    for (const row of rows)
      expect([...row.querySelectorAll("button")].map((one) => one.getAttribute("data-testid")).filter((id) => id !== "suggestion-record")).toEqual(["suggestion-why", "suggestion-accept", "suggestion-decline", "suggestion-stop-kind", "suggestion-not-now"]);
    const accept = $('[data-testid="suggestion-accept"]', rows[0])!;
    const described = accept.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)!.textContent).join(" ");
    expect(described).toBe(`${STEER} Put in 09 · Without a Map?`);
  });

  it("are answered one row at a time", async () => {
    const store = storeOf();
    await inbox(store);
    const before = store.graph.allEdges().length;
    await act(async () => $('[data-testid="suggestion-accept"]', group()!)!.click());
    await settled(() => expect(words(group()!)).toEqual(["Wait for First job?", "Set aside?"]));
    expect(store.graph.allEdges().length).toBe(before + 1);
    expect(suggestions(store)).toHaveLength(4);
  });

  it("leave the placements alike about other records under one line by kind, and the tray passes axe", async () => {
    const host = await inbox(storeOf());
    const alike = $('[data-testid="suggestion-group"]')!;
    expect(alike.firstElementChild!.textContent).toBe("2 notes to put in chapters");
    expect(words(alike)).toEqual(["Put “Leaving home” in 09 · Without a Map?", "Put “First job” in 09 · Without a Map?"]);
    const said = await axe.run(host, { rules: { "color-contrast": { enabled: false } } });
    expect(said.violations.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  it("is said whole again once only one about the record is left", async () => {
    await inbox(storeOf());
    await act(async () => $('[data-testid="suggestion-decline"]', group()!)!.click());
    await settled(() => expect(words(group()!)).toHaveLength(2));
    await act(async () => $('[data-testid="suggestion-decline"]', group()!)!.click());
    await settled(() => expect(group()).toBeNull());
    expect(words(document)).toContain(`Set “${STEER}” aside?`);
  });
});
