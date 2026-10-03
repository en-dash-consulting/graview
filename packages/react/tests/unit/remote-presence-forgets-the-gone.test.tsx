// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, REMOTE_PRESENCE_TTL_MS, Store, z, type Presence, type PresenceChannel } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createViews, GraviewProvider, useGraview } from "../../src/index.js";

/**
 * REMOTE PRESENCE FORGETS THE GONE (FR-13). A host's own channel (a hosted
 * room's socket, say) hands over a list of who is here and may never say
 * that somebody left: their tab crashed, their laptop shut. The provider
 * drew them for as long as the channel kept quiet. Now what arrives is
 * folded through a TTL, and swept again while anybody stands.
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

const seen: string[][] = [];
function Who() {
  const { who } = useGraview();
  seen.push([...who.keys()]);
  return <span data-testid="who">{[...who.keys()].join(",")}</span>;
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-03T12:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("presence from a host's channel", () => {
  it("drops a remote participant older than the TTL, though the channel never says they left", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const wire = channel();
    const store = new Store({ schema, mutations: [], invariants: [] });
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={createViews(schema)} presence={wire} principal={{ kind: "human", id: "me" }}>
          <Who />
        </GraviewProvider>,
      ),
    );
    await act(async () => wire.say([{ participant: "human:ann:t1", name: "Ann", hue: 30, stop: "#focus=agg:task", at: new Date().toISOString() }]));
    expect(host.querySelector("[data-testid=who]")?.textContent).toBe("human:ann:t1");

    await act(async () => {
      vi.advanceTimersByTime(REMOTE_PRESENCE_TTL_MS + 1500);
    });
    expect(host.querySelector("[data-testid=who]")?.textContent).toBe("");
    await act(async () => root.unmount());
    host.remove();
  });

  it("never draws a word that was already stale when it arrived", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const wire = channel();
    const store = new Store({ schema, mutations: [], invariants: [] });
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={createViews(schema)} presence={wire} principal={{ kind: "human", id: "me" }}>
          <Who />
        </GraviewProvider>,
      ),
    );
    const old = new Date(Date.now() - REMOTE_PRESENCE_TTL_MS - 1000).toISOString();
    await act(async () => wire.say([{ participant: "human:bo:t2", name: "Bo", hue: 90, stop: "", at: old }]));
    expect(host.querySelector("[data-testid=who]")?.textContent).toBe("");
    await act(async () => root.unmount());
    host.remove();
  });
});
