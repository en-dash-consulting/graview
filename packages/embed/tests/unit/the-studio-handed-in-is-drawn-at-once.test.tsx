// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FR-63: THE STUDIO HANDED IN IS DRAWN AT ONCE, AND THE EMBED FETCHES NONE.
 *
 * The embed imports its own studio when it is first drawn — right for a
 * page that may never open it, a round trip for one whose whole point is
 * the studio. Handed `studio: { onApply, place: StudioPlace }`, the embed
 * draws the host's studio in the same render and never asks for its own:
 * counted at the module, which the stand-in below makes countable.
 */
const imported = vi.hoisted(() => ({ times: 0 }));
vi.mock("@graview/studio", () => {
  imported.times += 1;
  return { StudioPlace: () => <button type="button" data-testid="studio-place">Studio</button> };
});

const { mount } = await import("../../src/index.js");

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter" }], edges: [] };

const handed: { props: Record<string, unknown> | null } = { props: null };
function HandedIn(props: Record<string, unknown>) {
  handed.props = props;
  return <button type="button" data-testid="studio-place-handed-in">Studio</button>;
}

const unmounts: (() => void)[] = [];
afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await act(async () => unmount());
  document.body.innerHTML = "";
});

describe("the studio a host hands in", () => {
  it("is drawn in the render that mounts the embed, with the host's options, and the embed's own studio is never imported", async () => {
    const element = document.createElement("div");
    document.body.append(element);
    const onApply = () => {};
    // No act, no waiting: mount's first render is synchronous, and the studio is in it.
    const handle = mount(element, { app, seed, face: "graview", fonts: false, studio: { onApply, offered: true, place: HandedIn as never } });
    unmounts.push(() => handle.unmount());
    expect(element.querySelector('[data-testid="studio-place-handed-in"]')).not.toBeNull();
    expect(handed.props).toMatchObject({ app, within: "box", onApply, offered: true });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(imported.times).toBe(0);
    expect(element.querySelector('[data-testid="studio-place"]')).toBeNull();
  });
});
