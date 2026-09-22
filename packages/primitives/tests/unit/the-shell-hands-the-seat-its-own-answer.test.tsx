// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import type { Responder } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";

/**
 * THE SHELL HANDS THE CHAT THE APP'S OWN RESPONDER.
 *
 * `ChatPanel` has always taken one, and writing one is what the agent-seat
 * skill is about — but `Shell`, which every app uses and the scaffolder
 * wires up, owned the panel and exposed it as a boolean. So an app with a
 * domain responder could turn the chat off and rebuild that part of the
 * shell, or leave the generic answer in the surface most people type into.
 * A seam is only as reachable as the most convenient component on top of it.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const schema = createSchema([zone]);

const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: { nodes: [{ id: "lawn", kind: "zone", label: "Back Lawn" }] as never, edges: [] },
  });

const ours: Responder<typeof schema> = async () => ({
  say: "Mosquitoes are covered on the Back Lawn — the fortnightly damp sweep does it.",
  proposals: [],
});

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  /* jsdom lays nothing out and has no scrollTo; the log scrolls itself to
     the newest turn, which is a browser's job rather than this test's. */
  if (!("scrollTo" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: () => {} });
  }
});
afterEach(() => host.remove());

const ask = async (chat: boolean | { respond?: Responder<typeof schema> }) => {
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider
        store={store()}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, focusId: "lawn" }}
      >
        <Shell<typeof schema> scheme="light" onScheme={() => {}} chat={chat} />
      </GraviewProvider>,
    );
  });
  /* The conversation lives in the companion now, open with the rail — no pill to press. */
  const input = host.querySelector<HTMLInputElement>('[data-testid="chat-panel"] input');
  const form = host.querySelector<HTMLFormElement>('[data-testid="chat-panel"] form');
  if (!input || !form) return { root, said: null };
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "why do I still have mosquitoes?");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  /* The answer arrives a microtask later, whoever gave it. */
  await act(async () => {
    await Promise.resolve();
  });
  return { root, said: host.querySelector('[data-testid="chat-panel"]')?.textContent ?? "" };
};

describe("the chat in the scene", () => {
  it("answers with the app's own responder when the shell is given one", async () => {
    const { root, said } = await ask({ respond: ours });
    expect(said).toContain("the fortnightly damp sweep");
    await act(async () => root.unmount());
  });

  it("still answers from the graph when the app says nothing", async () => {
    const { root, said } = await ask(true);
    expect(said).not.toContain("the fortnightly damp sweep");
    await act(async () => root.unmount());
  });

  it("is still absent altogether when the app says no", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider
          store={store()}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={{ ...EMPTY_VIEW, focusId: "lawn" }}
        >
          <Shell<typeof schema> scheme="light" onScheme={() => {}} chat={false} />
        </GraviewProvider>,
      );
    });
    // No seat asked for, no conversation in the rail — the acts and the relations stand.
    expect(host.querySelector('[data-testid="chat-panel"]')).toBeNull();
    expect(host.querySelector('[data-testid="companion"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
