// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, useGraview, type SeatTalk } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * THE CONVERSATION BELONGS TO THE APP, NOT TO ONE FACE.
 *
 * A question asked on the scene was gone on Pages: each face drew a seat of
 * its own, and the turns went with the one that was put away. The provider
 * holds them now, so a conversation drawn again (`ChatPanel shared`, where
 * a product places one) — on the other face, or inside a provider of its
 * own — is the same conversation.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }] as never, edges: [] },
  });
const views = () => registerDefaultViews(schema, createViews(schema));

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  sessionStorage.clear();
});

async function mount(tree: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(tree));
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, root };
}

const settle = () => act(async () => new Promise<void>((done) => setTimeout(done, 80)));
const said = (host: HTMLElement) => [...host.querySelectorAll('[data-testid="talk"] ol li')].map((li) => li.textContent);

let held: SeatTalk | undefined;
function Hold() {
  held = useGraview().seatTalk;
  return null;
}

describe("the conversation belongs to the app", () => {
  it("is still there when the conversation is drawn again, as a face switch draws it", async () => {
    const kept = store();
    const app = (seat: boolean) => (
      <GraviewProvider store={kept} views={views()} initialView={EMPTY_VIEW} initialSelection={["t1"]}>
        <Hold />
        {seat ? <div data-testid="talk"><ChatPanel<typeof schema> shared /></div> : <p>the other face</p>}
      </GraviewProvider>
    );
    const { host, root } = await mount(app(true));
    await act(async () => held!.ask("tell me about this"));
    for (let tries = 0; tries < 20 && said(host).length < 2; tries++) await settle();
    expect(said(host)[0]).toBe("tell me about this");
    // Put away with the face, and drawn again with the next one.
    await act(async () => root.render(app(false)));
    expect(host.querySelector('[data-testid="talk"]')).toBeNull();
    await act(async () => root.render(app(true)));
    for (let tries = 0; tries < 20 && said(host).length < 2; tries++) await settle();
    expect(said(host)[0]).toBe("tell me about this");
    expect(said(host).length).toBe(2);
  });

  it("is one conversation under a provider drawn inside another, as the routed face is in an embed", async () => {
    let inner: SeatTalk | undefined;
    function HoldInner() {
      inner = useGraview().seatTalk;
      return null;
    }
    await mount(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
        <Hold />
        <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
          <HoldInner />
        </GraviewProvider>
      </GraviewProvider>,
    );
    expect(inner).toBe(held);
  });
});
