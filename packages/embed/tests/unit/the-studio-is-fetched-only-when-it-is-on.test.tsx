// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * THE STUDIO IS FETCHED ONLY WHEN IT IS ON. The embed imports
 * `@graview/studio` with `import()`, so a page whose embed says
 * `studio: false` never asks for it — counted here at the module itself:
 * the stand-in below is evaluated the first time anything imports it.
 */
const imported = vi.hoisted(() => ({ times: 0 }));
vi.mock("@graview/studio", () => {
  imported.times += 1;
  return { StudioPlace: () => <button type="button" data-testid="studio-place">Studio</button> };
});

const { mount, preload } = await import("../../src/index.js");
// The scene and its strip fetched first, so what is counted below is the studio alone (FR-57).
await preload("graview");

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const app = defineApp({ name: "Errands", schema, mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter" }], edges: [] };

const hosts: { unmount: () => void; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { unmount, host } of hosts.splice(0)) {
    await act(async () => unmount());
    host.remove();
  }
});
async function mounting(studio?: false) {
  const host = document.createElement("div");
  document.body.append(host);
  let handle!: { unmount(): void };
  await act(async () => {
    handle = mount(host, { app, seed, face: "graview", fonts: false, ...(studio === false ? { studio } : {}) });
  });
  hosts.push({ unmount: () => handle.unmount(), host });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  return host;
}

describe("the embed's studio chunk", () => {
  it("is never imported by an embed with studio: false, and is imported once one offers it", async () => {
    const hidden = await mounting(false);
    expect(hidden.querySelector("[data-testid=app-bar]"), "the embed drew").not.toBeNull();
    expect(imported.times).toBe(0);
    const offered = await mounting();
    expect(imported.times).toBe(1);
    expect(offered.querySelector("[data-testid=studio-place]")).not.toBeNull();
  });
});
