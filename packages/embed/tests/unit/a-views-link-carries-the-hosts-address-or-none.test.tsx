// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type AnySchema } from "@graview/core";
import { useGoTo, type ReactViewRegistry } from "@graview/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A VIEW'S LINK CARRIES THE HOST'S ADDRESS, OR NONE. A worker view's
 * `<a data-record>` carries the address the routed face goes to as its
 * `href` (`GoTo.href`, 0.1.47), so Cmd-click opens it in a new tab. In an
 * embed whose host keeps its own addresses — memory routing, a chat's
 * widget, an article — that was the face's base and path, `/tasks/t1`,
 * which opened a page of the HOST's site that may not exist. Now the host
 * says its own address for a path (`hrefOf`), and where it says none under
 * memory routing the link carries no `href` — a link by its role and the
 * keyboard, as on the scene. Under address routing it is the face's own.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };

/* What a worker view's link is given as its address, read where the view is drawn: the home's body. */
const said: (string | undefined)[] = [];
function Home() {
  const goTo = useGoTo();
  said.push(goTo.href?.({ record: "t1" }, { section: "notes" }));
  return <p>home</p>;
}
const withHome = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => {
  registry.home?.(Home as never);
  return registry;
};

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
  said.length = 0;
});

async function linkOf(options: Partial<EmbedOptions>): Promise<string | undefined> {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", views: withHome, ...options } as EmbedOptions);
  });
  for (let turn = 0; turn < 200 && said.length === 0; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(said.length).toBeGreaterThan(0);
  return said.at(-1);
}

describe("a worker view's link, in an embed", () => {
  it("carries no address under memory routing when the host says none", async () => {
    expect(await linkOf({})).toBeUndefined();
  });

  it("carries the host's own address for the path where the host says one", async () => {
    expect(await linkOf({ hrefOf: (path) => `https://chat.example/c/42?open=${encodeURIComponent(path)}` })).toBe(`https://chat.example/c/42?open=${encodeURIComponent("/tasks/t1#notes")}`);
  });

  it("carries the face's own address under address routing", async () => {
    window.history.replaceState(null, "", "/apps/a1/");
    expect(await linkOf({ routing: "address", basePath: "/apps/a1/" })).toBe("/apps/a1/tasks/t1#notes");
    window.history.replaceState(null, "", "/");
  });
});
