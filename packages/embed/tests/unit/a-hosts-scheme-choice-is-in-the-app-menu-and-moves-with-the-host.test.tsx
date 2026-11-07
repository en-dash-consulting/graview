// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, mount, preload, type EmbedHandle, type EmbedOptions, type SchemeChoice } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";
import { closeAppMenu, openAppMenu } from "../support/the-app-menu.js";

beforeAll(() => preload());

/**
 * A HOST'S SCHEME CHOICE IS IN THE APP MENU AND MOVES WITH THE HOST (Roadmap
 * f-scheme-choice-mount). Graview Cloud keeps each person's Appearance —
 * System, Light or Dark — on their account. Handed `schemeChoice`, a mount
 * draws the three in its app menu, the host's own value pressed; a press
 * calls `onChoose` and moves nothing, since the host keeps the choice; and
 * `setSchemeChoice` moves the press without a reload. Unsaid, the menu
 * offers no scheme at all.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const app = defineApp({ name: "Field notes", schema: createSchema([note]), mutations: [] });

async function opened(mounter: typeof mount, options: Partial<EmbedOptions>, run: (host: HTMLElement, handle: EmbedHandle) => Promise<void> | void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mounter(host, { app, fonts: false, ...options } as EmbedOptions) as EmbedHandle;
  });
  for (let tries = 0; tries < 40 && !host.querySelector('[data-testid="app-menu-open"]'); tries += 1) await act(async () => new Promise((wait) => setTimeout(wait, 25)));
  try {
    await run(host, handle!);
  } finally {
    await act(async () => handle!.unmount());
    host.remove();
  }
}

/** The scheme's choices in the open app menu, each with whether it is pressed; none where the bar holds no app menu (the pages alone, with nothing for one). */
async function schemeSaid(host: HTMLElement): Promise<string[]> {
  if (!host.querySelector('[data-testid="app-menu-open"]')) return [];
  const menu = await openAppMenu(host);
  return [...menu.querySelectorAll('[data-testid^="app-menu-scheme-"]')].map((one) => `${one.textContent}${one.getAttribute("aria-pressed") === "true" ? " (pressed)" : ""}`);
}

describe("a host's scheme choice in the app menu (Roadmap f-scheme-choice-mount)", () => {
  it.each([
    ["the embed's pages", mount, { face: "pages" as const }],
    ["the embed's scene", mount, { face: "graview" as const }],
    ["the pages alone", mountPages as unknown as typeof mount, {} as { face?: "pages" }],
  ])("is System, Light and Dark on %s, the host's value pressed, a press heard and the host's setSchemeChoice moving it", async (_, mounter, face) => {
    const chose: SchemeChoice[] = [];
    const onChoose = (value: SchemeChoice) => void chose.push(value);
    await opened(mounter, { ...face, schemeChoice: { value: "light", onChoose } }, async (host, handle) => {
      expect(await schemeSaid(host)).toEqual(["System", "Light (pressed)", "Dark"]);
      const group = host.querySelector('[data-testid="app-menu-scheme"]')!;
      expect(group.getAttribute("role")).toBe("group");
      expect(document.getElementById(group.getAttribute("aria-labelledby")!)?.textContent).toBe("Appearance");
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="app-menu-scheme-dark"]')!.click());
      expect(chose).toEqual(["dark"]);
      // The host keeps the choice: nothing moves until it says so.
      expect(await schemeSaid(host)).toEqual(["System", "Light (pressed)", "Dark"]);
      await act(async () => (handle as unknown as PagesEmbedHandle).setSchemeChoice({ value: "dark", onChoose }));
      expect(await schemeSaid(host)).toEqual(["System", "Light", "Dark (pressed)"]);
      await closeAppMenu(host);
      await act(async () => handle.setSchemeChoice(undefined));
      expect(await schemeSaid(host)).toEqual([]);
    });
  });

  it("offers no scheme where the host hands none", async () => {
    await opened(mount, { face: "pages" }, async (host) => {
      await openAppMenu(host);
      expect(host.querySelector('[data-testid="app-menu-scheme"]')).toBeNull();
    });
  });

  it("is taken on <Embed> as a prop, the same as mount's option", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Embed app={app} fonts={false} face="pages" schemeChoice={{ value: "system", onChoose: () => {} }} />));
    for (let tries = 0; tries < 40 && !host.querySelector('[data-testid="app-menu-open"]'); tries += 1) await act(async () => new Promise((wait) => setTimeout(wait, 25)));
    try {
      expect(await schemeSaid(host)).toEqual(["System (pressed)", "Light", "Dark"]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
