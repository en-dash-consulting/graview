// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * A HOST'S STATUS IS ON THE APP BAR AND CHANGES WITHOUT A RELOAD (Roadmap
 * f-bar-status-item). Graview Cloud says who can open an app — "Only you",
 * "Public" — beside its tools, explained on hover rather than on a press,
 * and says it again with `setStatus` when sharing changes.
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

const status = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-testid="app-bar"] [data-testid="app-status"]');

describe("a host's status on the app bar (Roadmap f-bar-status-item)", () => {
  it.each([
    ["the embed's pages", mount, { face: "pages" as const }],
    ["the embed's scene", mount, { face: "graview" as const }],
    ["the pages alone", mountPages as unknown as typeof mount, {} as { face?: "pages" }],
  ])("is on the bar of %s, its sentence on hover and as its description", async (_, mounter, face) => {
    await opened(mounter, { ...face, status: { label: "Only you", icon: "lock", description: "Only you can open this app." } }, (host) => {
      const item = status(host)!;
      expect(item.textContent).toBe("Only you");
      expect(item.getAttribute("title")).toBe("Only you can open this app.");
      expect(document.getElementById(item.getAttribute("aria-describedby")!)?.textContent).toBe("Only you can open this app.");
    });
  });

  it("changes with setStatus without a reload, and is taken off with undefined", async () => {
    await opened(mount, { face: "pages" }, async (host, handle) => {
      expect(status(host)).toBeNull();
      await act(async () => handle.setStatus({ label: "Public", icon: "globe", description: "Anyone can find and open this app.", href: "/sharing" }));
      expect(status(host)?.textContent).toBe("Public");
      expect(status(host)?.getAttribute("href")).toBe("/sharing");
      await act(async () => handle.setStatus(undefined));
      expect(status(host)).toBeNull();
    });
    await opened(mountPages as unknown as typeof mount, {}, async (host, handle) => {
      await act(async () => (handle as unknown as PagesEmbedHandle).setStatus({ label: "Workspace", description: "Everyone in the workspace can open this app." }));
      expect(status(host)?.textContent).toBe("Workspace");
    });
  });
});
