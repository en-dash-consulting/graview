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
afterEach(() => {
  host.remove();
  // The conversation is kept for the tab: each case starts a fresh one.
  sessionStorage.clear();
});

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
  /* The seat is a field at the picture's foot: what is typed there is asked, and the panel it opens answers. */
  const input = host.querySelector<HTMLInputElement>('[data-testid="seat-field"]');
  if (!input) return { root, said: null };
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "why do I still have mosquitoes?");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.form!.requestSubmit());
  /* The panel is fetched when the seat first opens, and the answer arrives after it. */
  const waiting = () => host.querySelectorAll('[data-testid="seat-panel"] ol li').length < 2 || (host.querySelector('[data-testid="seat-panel"]')?.textContent ?? "").includes("thinking…");
  for (let tries = 0; tries < 60 && waiting(); tries++) {
    await act(async () => new Promise<void>((done) => setTimeout(done, 40)));
  }
  return { root, said: host.querySelector('[data-testid="seat-panel"]')?.textContent ?? "" };
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
    // No conversation asked for, so no field to ask in at all; the acts stay at the pointer.
    expect(host.querySelector('[data-testid="seat"]')).toBeNull();
    expect(host.querySelector('[data-testid="seat-field"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
