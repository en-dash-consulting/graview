// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type HostFiles } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { nana, weekendApp as app } from "../../../../scripts/fixtures/weekend-app.js";
import { PagesApp, recordPath, type PageContext } from "../../src/index.js";

/**
 * AN EMPTY VIDEO FIELD OFFERS A WAY TO ADD ONE (FR-193, from Graview Cloud's
 * family weekend). An owner opened a moment whose `video` field held
 * nothing, on a host whose files take `video/*`, and was said to see no
 * control to add a video. The record's page draws the field it holds none
 * in yet as its editor — a picker asking for videos — beside the picture it
 * does hold; a host that takes no files at all (`maxBytes` 0) offers none
 * and says so, never "up to 0 bytes".
 */
const harbor = { href: "/graview/files/harbor.jpg", name: "harbor.jpg", type: "image/jpeg", bytes: 2_000, width: 40, height: 30 };

async function page(files: HostFiles) {
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    policy: app.policy!,
    snapshot: { nodes: [{ id: "day:saturday", kind: "day", name: "Saturday" }, { id: "moment:harbor", kind: "moment", caption: "The harbor", photo: harbor }], edges: [{ kind: "takenOn", from: "moment:harbor", to: "day:saturday" }] } as never,
  });
  const context: PageContext<AnySchema> = { store, principal: nana, views: registerDefaultViews(store.schema, createViews(store.schema)), files };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={recordPath(store.schema, "moment", "moment:harbor")} />));
  const until = async <T,>(read: () => T | null | undefined): Promise<T | undefined> => {
    for (let tries = 0; tries < 200; tries++) {
      const found = read();
      if (found) return found;
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    return undefined;
  };
  return { host, until, done: async () => (await act(async () => root.unmount()), host.remove()) };
}

describe("an empty video field on a record's page", () => {
  it("is drawn as its editor, asking for videos, where the host takes them", async () => {
    const { host, until, done } = await page({ maxBytes: 50_000_000, kinds: ["image/*", "video/*"], upload: async () => harbor });
    const input = await until(() => host.querySelector<HTMLInputElement>('[data-graview-files="clip"] input[data-graview-file-input]'));
    expect(input?.accept).toBe("video/*");
    expect(host.querySelector('[data-graview-files="clip"] [data-graview-file-choose]')?.textContent).toBe("Choose a video");
    await done();
  });

  it("offers nothing and says the host takes no files where it takes none at all, never “up to 0 bytes”", async () => {
    const { host, until, done } = await page({ maxBytes: 0, kinds: [], upload: async () => harbor });
    const none = await until(() => host.querySelector('[data-graview-files="clip"] [data-graview-file-none]'));
    expect(none?.textContent).toBe("This host doesn’t take files, so none can be added here.");
    expect(host.textContent).not.toContain("up to 0 bytes");
    expect(host.querySelector("input[data-graview-file-input]")).toBeNull();
    await done();
  });
});
