// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, useGraview, type ReaderMemory } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Companion, COMPANION_TAB, registerDefaultViews, type CompanionMode } from "../../src/index.js";

/**
 * THE SEAT CAN BE PUT AWAY (FR-78).
 *
 * The rail took a fifth of the picture on every screen whether anybody was
 * talking to it or not. Put away it is a slim tab; opened again it is the
 * rail; the reader's choice is remembered for the app, over the host's start
 * — except "hidden", which is the host's to say.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);

function memoryOf(): ReaderMemory & { kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return { kept, getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => void kept.set(key, value) };
}

let rail: number | null | undefined;
function Rail() {
  rail = useGraview().railLeft;
  return null;
}

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.replaceChildren();
});

function draw(start: CompanionMode | undefined, memory: ReaderMemory) {
  const host = document.createElement("div");
  const frame = document.createElement("main");
  host.append(frame);
  document.body.append(host);
  const root = createRoot(frame);
  act(() =>
    root.render(
      <GraviewProvider store={new Store({ schema, mutations: [], invariants: [] })} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} memory={memory}>
        <Companion<typeof schema> {...(start ? { start } : {})} rememberAs="Field notes" />
        <Rail />
      </GraviewProvider>,
    ),
  );
  unmount = () => act(() => root.unmount());
  return frame;
}

const $ = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("the seat can be put away", () => {
  it("to a slim tab from its header, and opened again from the tab, the keyboard following the control", () => {
    const memory = memoryOf();
    const frame = draw(undefined, memory);
    expect($("companion")!.getAttribute("data-graview-companion-mode")).toBe("open");
    expect($("companion-dock")!.getAttribute("aria-expanded")).toBe("true");
    expect(rail).toBeNull();

    act(() => $("companion-dock")!.click());
    expect($("companion")!.getAttribute("data-graview-companion-mode")).toBe("collapsed");
    expect($("companion-tab")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe($("companion-tab"));
    // The picture keeps everything but the tab, and lays out into it.
    expect(frame.style.paddingLeft).toBe(`${COMPANION_TAB}px`);
    expect(rail).toBe(8);
    expect(memory.kept.get("graview:companion:Field notes")).toBe("collapsed");

    act(() => $("companion-tab")!.click());
    expect($("companion")!.getAttribute("data-graview-companion-mode")).toBe("open");
    expect(document.activeElement).toBe($("companion-dock"));
    expect(frame.style.paddingLeft).toBe("");
    expect(memory.kept.get("graview:companion:Field notes")).toBe("open");
  });

  it("starts where the host says, and where the reader left it over that", () => {
    draw("collapsed", memoryOf());
    expect($("companion-tab")).not.toBeNull();
    unmount?.();
    const memory = memoryOf();
    memory.setItem("graview:companion:Field notes", "open");
    draw("collapsed", memory);
    expect($("companion-tab")).toBeNull();
    expect($("companion")!.getAttribute("data-graview-companion-mode")).toBe("open");
  });

  it("is not drawn at all when the host hides it, whatever the reader chose, and the picture has its edge", () => {
    const memory = memoryOf();
    memory.setItem("graview:companion:Field notes", "open");
    const frame = draw("hidden", memory);
    expect($("companion")).toBeNull();
    expect(frame.style.paddingLeft).toBe("");
    expect(rail).toBe(8);
  });

  it("keeps working where the page may not remember", () => {
    const refusing: ReaderMemory = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    draw(undefined, refusing);
    act(() => $("companion-dock")!.click());
    expect($("companion-tab")).not.toBeNull();
  });
});
