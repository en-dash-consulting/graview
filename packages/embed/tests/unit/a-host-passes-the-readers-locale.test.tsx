// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, isoDate, sayIn, SCHEMES, Store, z, type AnySchema, type GraviewApp } from "@graview/core";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";

/**
 * A HOST PASSES THE READER'S LOCALE (FR-178). Graview Cloud knows where its
 * reader is; the embed's `locale` says days, times and numbers their way,
 * over the app's own `brand.locale`, and en-US when neither says.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), due: isoDate }), plural: "Tasks" });
const schema = createSchema([task]);
const app = defineApp({ name: "Errands", schema, mutations: [], brand: { name: "Errands", schemes: SCHEMES } } as never) as unknown as GraviewApp<AnySchema>;
const store = () => new Store<AnySchema>({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Buy stamps", due: "2023-09-10" }], edges: [] } as never });

const opened: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of opened.splice(0)) await done();
  sayIn({});
});

async function open(locale?: string): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: PagesEmbedHandle | undefined;
  await act(async () => {
    handle = mountPages(host, { app, store: store(), fonts: false, path: "/tasks/t1", ...(locale ? { locale } : {}) } as never);
  });
  for (let tick = 0; tick < 40 && !/2023/.test(host.textContent ?? ""); tick++) await act(async () => new Promise((wait) => setTimeout(wait, 20)));
  opened.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return host;
}

describe("the embed's locale", () => {
  it("says a day for en-US when the host says none", async () => {
    expect((await open()).textContent).toContain("Sep 10, 2023");
  });

  it("says it the reader's way when the host passes theirs", async () => {
    const text = (await open("en-GB")).textContent ?? "";
    expect(text).toMatch(/10 Sept? 2023/);
    expect(text).not.toContain("Sep 10, 2023");
  });
});
