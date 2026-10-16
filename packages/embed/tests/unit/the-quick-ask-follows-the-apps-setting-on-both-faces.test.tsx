// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { stubFast } from "@graview/tools/inline-ai";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, quickAskOf, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * THE QUICK ASK IS THE APP'S SETTING, ON EVERY FACE (Roadmap
 * f-quick-ask-framework), and it replaced the Ask box's.
 *
 * The Ask box — a field at the foot of both faces that grew into a chat
 * thread — is drawn on neither face. Its setting, `seat: "field" |
 * "hidden"`, is read onto the quick ask's: a host that kept the old value
 * hands it to `quickAskOf`, and an embed handed the old string reads it
 * the same way. Both faces read one setting, and a host that changes it
 * changes both at once, without mounting again. With AI off, there is no
 * quick ask whatever the setting says.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const app = defineApp({ name: "Errands", schema, mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter" }], edges: [] } as never;
const ai = { fast: stubFast() };

let host: HTMLElement;
let handle: EmbedHandle | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  sessionStorage.clear();
});

const opened = async (options: Partial<EmbedOptions> & Record<string, unknown>) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host, { app, fonts: false, seed, label: "Errands", ai, ...options } as unknown as EmbedOptions);
  });
  await act(async () => handle!.drawn());
  for (let turn = 0; turn < 20; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
};
const hasQuickAsk = () => host.querySelector("[data-graview-quick-ask]") !== null;
const hasAskBox = () => host.querySelector('[data-testid="seat-field"], [data-testid="seat"], [data-testid="page-seat"]') !== null;
const settle = async () => {
  for (let turn = 0; turn < 20; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
};

describe("the Ask box's setting, read onto the quick ask", () => {
  it("maps every value a host stored: the field is on, hidden is off, nothing said is on", () => {
    expect(quickAskOf("field")).toBe(true);
    expect(quickAskOf("hidden")).toBe(false);
    expect(quickAskOf(undefined)).toBe(true);
    expect(quickAskOf(null)).toBe(true);
    expect(quickAskOf(true)).toBe(true);
    expect(quickAskOf(false)).toBe(false);
  });
});

describe("the quick ask follows the app's setting on both faces", () => {
  for (const face of ["scene", "pages"] as const) {
    it(`draws no Ask box on the ${face} face, and the quick ask only where the setting leaves it on`, async () => {
      await opened({ face, quickAsk: false });
      expect(hasQuickAsk()).toBe(false);
      expect(hasAskBox()).toBe(false);
      await act(async () => handle!.unmount());
      host.remove();
      handle = undefined;
      // An old stored value, handed as it was kept: read the same way.
      await opened({ face, ...({ quickAsk: "hidden" } as Record<string, unknown>) });
      expect(hasQuickAsk()).toBe(false);
      await act(async () => handle!.unmount());
      host.remove();
      handle = undefined;
      await opened({ face });
      expect(hasQuickAsk()).toBe(true);
      expect(hasAskBox()).toBe(false);
    });
  }

  it("draws none with AI off, whatever the setting says", async () => {
    await opened({ face: "scene", quickAsk: true, ai: { off: true, fast: stubFast() } });
    expect(hasQuickAsk()).toBe(false);
  });

  it("changes on the face that is open when the host changes the setting, with no new mount", async () => {
    await opened({ face: "pages", path: "/tasks/t1" });
    expect(hasQuickAsk()).toBe(true);
    await act(async () => handle!.setQuickAsk(false));
    await settle();
    expect(hasQuickAsk()).toBe(false);
    await act(async () => handle!.setFace("scene"));
    await act(async () => handle!.drawn());
    await settle();
    expect(hasQuickAsk()).toBe(false);
    await act(async () => handle!.setQuickAsk(true));
    await settle();
    expect(hasQuickAsk()).toBe(true);
    await act(async () => handle!.setFace("pages"));
    await act(async () => handle!.drawn());
    await settle();
    expect(hasQuickAsk()).toBe(true);
  });
});
