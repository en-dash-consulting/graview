// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";
import { mount as mountPages } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * A PLACE FOR A HOST'S OWN ACTIONS (FR-72).
 *
 * Graview Cloud put "Change the app", "Your apps" and "Report this app" in a
 * `<details>` of its own, fixed over the corner of the scene, because the
 * embed had nowhere for them. They belong where a person looks for things
 * about the app and themselves: the profile menu.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const app = defineApp({ name: "Field notes", schema: createSchema([note]), mutations: [] });
const hostActions = [
  { label: "Change the app", href: "https://cloud.example/apps/notes/change" },
  { label: "Your apps", href: "https://cloud.example/apps" },
  { label: "Report this app", href: "https://cloud.example/report?app=notes" },
];

async function opened(mounter: typeof mount, options: Partial<EmbedOptions>, run: (host: HTMLElement) => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: { unmount(): void } | undefined;
  await act(async () => {
    handle = mounter(host, { app, fonts: false, ...options } as EmbedOptions) as EmbedHandle;
  });
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="profile-button"]')!.click());
  try {
    run(host);
  } finally {
    await act(async () => handle!.unmount());
    host.remove();
  }
}

describe("a host's own actions", () => {
  it.each([
    ["the whole embed", mount],
    ["the pages alone", mountPages as unknown as typeof mount],
  ])("are links in the profile menu of %s, in the order given, each one a stop for the keyboard", async (_, mounter) => {
    await opened(mounter, { face: "pages", hostActions }, (host) => {
      const pane = host.querySelector('[data-testid="profile"]')!;
      const links = [...pane.querySelectorAll<HTMLAnchorElement>('[data-testid="host-action"]')];
      expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(hostActions.map((action) => [action.label, action.href]));
      for (const link of links) expect(link.tabIndex).toBe(0);
    });
  });

  it("can be a press rather than a link, which closes the menu", async () => {
    const onSelect = vi.fn();
    await opened(mount, { face: "pages", hostActions: [{ label: "Sign out", onSelect }] }, (host) => {
      const button = host.querySelector<HTMLButtonElement>('[data-testid="profile"] button[data-testid="host-action"]')!;
      act(() => button.click());
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[data-testid="profile"]')!.hasAttribute("hidden")).toBe(true);
    });
  });

  it("are not there when the host gives none", async () => {
    await opened(mount, { face: "pages" }, (host) => {
      expect(host.querySelector('[data-testid="host-action"]')).toBeNull();
    });
  });
});
