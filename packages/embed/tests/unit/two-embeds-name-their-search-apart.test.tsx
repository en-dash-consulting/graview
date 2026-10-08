// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import axe from "axe-core";
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";

beforeAll(() => preload());

/**
 * TWO EMBEDS ON ONE PAGE NAME THEIR SEARCH APART. The routed face's Find
 * box is a search landmark, "Find anything", and every other landmark
 * inside an embed is named after the embed (FR-128) — but the sweep that
 * names them did not reach `role=search`. A page with two embeds on the
 * routed face (the long version of graview.dev has sixteen) carried two
 * search landmarks of one name, which is axe's `landmark-unique`.
 */
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const schema = createSchema([duty]);
const app = defineApp({ name: "Field notes", schema, mutations: [] });
const seed = { nodes: [{ id: "morning", kind: "duty", label: "Morning run" }], edges: [] } as never;

describe("two embeds on one page", () => {
  it("name each Find box after its own embed, so no two landmarks share a name", async () => {
    const hosts = [document.createElement("div"), document.createElement("div")];
    for (const host of hosts) document.body.appendChild(host);
    const handles: EmbedHandle[] = [];
    await act(async () => {
      handles.push(mount(hosts[0]!, { app, fonts: false, face: "pages", seed, label: "The notes" } as unknown as EmbedOptions));
      handles.push(mount(hosts[1]!, { app, fonts: false, face: "pages", seed, label: "The log" } as unknown as EmbedOptions));
    });
    try {
      for (let turn = 0; turn < 200 && document.querySelectorAll("[role=search]").length < 2; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
      const searches = [...document.querySelectorAll("[role=search]")].map((el) => el.getAttribute("aria-label"));
      expect(searches).toEqual(["The notes · Find anything", "The log · Find anything"]);
      const result = await axe.run(document.body, { runOnly: { type: "rule", values: ["landmark-unique"] } });
      expect(result.violations.flatMap((violation) => violation.nodes.map((node) => node.target.join(" ")))).toEqual([]);
    } finally {
      await act(async () => {
        for (const handle of handles) handle.unmount();
      });
      for (const host of hosts) host.remove();
    }
  });
});

/*
 * ⌘K IS THE HOST'S WHERE THE HOST'S PAGE HAS THE KEYBOARD (FR-131). The
 * scene's Find stands in the embed's bar now, on somebody else's page, and
 * it listened for ⌘K and `/` on the whole window: ⌘K in the host's own
 * editor ("insert a link") was taken from it and the page scrolled to the
 * embed, and with two embeds both answered.
 */
describe("the scene's Find on somebody else's page", () => {
  it("leaves ⌘K and / to the host's own fields, and answers ⌘K only for its own embed", async () => {
    const editor = document.createElement("textarea");
    const hosts = [document.createElement("div"), document.createElement("div")];
    document.body.append(editor, ...hosts);
    const handles: EmbedHandle[] = [];
    await act(async () => {
      handles.push(mount(hosts[0]!, { app, fonts: false, face: "scene", seed, label: "The notes" } as unknown as EmbedOptions));
      handles.push(mount(hosts[1]!, { app, fonts: false, face: "scene", seed, label: "The log" } as unknown as EmbedOptions));
    });
    try {
      for (let turn = 0; turn < 200 && document.querySelectorAll("[data-testid='find-input'], [data-graview-app-bar] input").length < 2; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
      const press = (target: Element, key: string, chord: boolean) =>
        act(async () => {
          const event = new KeyboardEvent("keydown", { key, metaKey: chord, ctrlKey: false, bubbles: true, cancelable: true });
          target.dispatchEvent(event);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return event;
        });
      editor.focus();
      const chord = await press(editor, "k", true);
      expect(chord.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(editor);
      editor.blur();
      const slash = await press(document.body, "/", false);
      expect(slash.defaultPrevented).toBe(false);
      const inSecond = hosts[1]!.querySelector<HTMLElement>("[data-graview-app-bar] button")!;
      inSecond.focus();
      const own = await press(inSecond, "k", true);
      expect(own.defaultPrevented).toBe(true);
      expect(hosts[1]!.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.tagName).toBe("INPUT");
    } finally {
      await act(async () => {
        for (const handle of handles) handle.unmount();
      });
      for (const host of [editor, ...hosts]) host.remove();
    }
  });
});
