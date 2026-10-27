// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * A HOST'S BUTTONS ARE IN THE APP BAR ON BOTH FACES (FR-227, Roadmap
 * f-host-buttons-in-the-app-bar).
 *
 * Graview Cloud's "Send feedback" was two taps away in the person's menu.
 * `barActions` draws a host's presses on the bar itself — the scene's and
 * the pages' — and `setBarActions` changes them live, as `setHostActions`
 * does the menu's. jsdom lays nothing out, so the bar here is a phone's and
 * the buttons are folded into one control: what stands on a desk is the
 * primitives' test and the chrome harness's.
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
  for (let tries = 0; tries < 40 && !host.querySelector('[data-testid="app-bar"]'); tries += 1) await act(async () => new Promise((wait) => setTimeout(wait, 25)));
  try {
    await run(host, handle!);
  } finally {
    await act(async () => handle!.unmount());
    host.remove();
  }
}

/** The host's buttons as the bar offers them: standing, or behind the one control, opened. */
function offered(host: HTMLElement): string[] {
  const more = host.querySelector<HTMLButtonElement>('[data-testid="app-bar"] [data-testid="host-bar-actions-open"]');
  if (more && host.querySelector('[data-testid="host-bar-actions"]')?.hasAttribute("hidden") !== false) act(() => more.click());
  return [...host.querySelectorAll<HTMLButtonElement>('[data-testid="host-bar-action"]')].map((button) => button.textContent ?? "");
}

describe("a host's buttons on the app bar (FR-227)", () => {
  it.each([
    ["the embed's pages", mount, { face: "pages" as const }],
    ["the embed's scene", mount, { face: "graview" as const }],
    ["the pages alone", mountPages as unknown as typeof mount, {} as { face?: "pages" }],
  ])("are on the bar of %s, in the order given, and run their onSelect", async (_, mounter, face) => {
    const feedback = vi.fn();
    await opened(mounter, { ...face, barActions: [{ label: "Send feedback", icon: "✉", onSelect: feedback }, { label: "Share", onSelect: () => undefined }] }, (host) => {
      expect(offered(host)).toEqual(["✉Send feedback", "Share"]);
      const button = host.querySelector<HTMLButtonElement>('[data-testid="host-bar-action"]')!;
      expect(button.closest('[data-testid="app-bar"]')).not.toBeNull();
      act(() => button.click());
      expect(feedback).toHaveBeenCalledTimes(1);
    });
  });

  it("change live with setBarActions, on the whole embed and on the pages alone", async () => {
    await opened(mount, { face: "pages", barActions: [{ label: "Send feedback", onSelect: () => undefined }] }, async (host, handle) => {
      expect(offered(host)).toEqual(["Send feedback"]);
      await act(async () => handle.setBarActions([{ label: "Share", onSelect: () => undefined }, { label: "Send feedback", onSelect: () => undefined }]));
      expect(offered(host)).toEqual(["Share", "Send feedback"]);
      await act(async () => handle.setBarActions(undefined));
      expect(host.querySelector('[data-testid="host-bar-actions-open"]')).toBeNull();
      expect(host.querySelector('[data-testid="host-bar-action"]')).toBeNull();
    });
    await opened(mountPages as unknown as typeof mount, {}, async (host, handle) => {
      expect(host.querySelector('[data-testid="host-bar-actions-open"]')).toBeNull();
      await act(async () => (handle as unknown as PagesEmbedHandle).setBarActions([{ label: "Send feedback", onSelect: () => undefined }]));
      expect(offered(host)).toEqual(["Send feedback"]);
    });
  });

  it("are not there when the host gives none", async () => {
    await opened(mount, { face: "pages" }, (host) => {
      expect(host.querySelector('[data-testid="host-bar-actions-open"]')).toBeNull();
      expect(host.querySelector('[data-testid="host-bar-action"]')).toBeNull();
    });
  });
});
