// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, REMOTE_PRESENCE_TTL_MS, Store, z, type Presence, type PresenceChannel } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createViews, GraviewProvider, Occupants } from "../../src/index.js";

/**
 * AN AGENT IN THE ROOM SAYS FOR WHOM (FR-47). A host announces an agent
 * that works over MCP or an RPC — no socket, no tab — and the room drew
 * it as "Claude", whoever's Claude it was, and dropped it after a tab's
 * grace though the host had said how long it stands. The figure is now
 * named "Claude, for Ada", and stands until the time the host gave.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);

function channel(): PresenceChannel & { say(who: readonly Presence[]): void } {
  const listeners = new Set<(who: readonly Presence[]) => void>();
  return {
    here() {},
    leave() {},
    onWho(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    say(who) {
      for (const listener of listeners) listener(who);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-03T12:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("an agent in the room", () => {
  it("is named as the agent, for the person it acts for, and stands for as long as the host announced it", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const wire = channel();
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall" }], edges: [] } as never });
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={createViews(schema)} presence={wire} principal={{ kind: "human", id: "me" }}>
          <Occupants width={800} whereIs={() => null} />
        </GraviewProvider>,
      ),
    );
    const now = Date.now();
    await act(async () =>
      wire.say([
        {
          participant: "agent:claude:visit",
          kind: "agent",
          name: "Claude",
          onBehalfOf: "person:ada",
          onBehalfOfName: "Ada",
          hue: 200,
          stop: "#focus=t1",
          at: new Date(now).toISOString(),
          until: new Date(now + REMOTE_PRESENCE_TTL_MS * 3).toISOString(),
        },
      ]),
    );
    const figure = () => host.querySelector<HTMLElement>('[data-graview-person="agent:claude:visit"]');
    expect(figure()?.textContent).toBe("→ Claude, for Ada");
    expect(figure()?.getAttribute("aria-label")).toBe("Claude, for Ada is somewhere else — press to go where they are");

    // Past a remote word's grace, it is still there: the host said how long.
    await act(async () => {
      vi.advanceTimersByTime(REMOTE_PRESENCE_TTL_MS + 1500);
    });
    expect(figure()).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(REMOTE_PRESENCE_TTL_MS * 2);
    });
    expect(figure()).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
