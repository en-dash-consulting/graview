import type { Presence } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createBroadcastPresence, presenceChannelName } from "../../src/presence.js";

/**
 * TWO TABS OF ONE ORIGIN SEE EACH OTHER with no server: Node's own
 * BroadcastChannel stands in for the browser's, and delivers the same way —
 * to every other channel of that name, never to the poster.
 */
const tick = () => new Promise((settle) => setTimeout(settle, 15));
const here = (participant: string, stop = "#focus=aggregate%3Atask"): Presence => ({
  participant,
  name: participant.split(":")[1]!,
  hue: 120,
  stop,
  at: new Date().toISOString(),
});

describe("who is here, between tabs", () => {
  it("is scoped by the store's scope, so two apps on one origin keep apart", () => {
    expect(presenceChannelName("todo")).toBe("graview:who:todo");
  });

  it("tells the other tab where you are, then that you moved, then that you left", async () => {
    const scope = `t-${Math.random().toString(36).slice(2)}`;
    const a = createBroadcastPresence(scope, { ttlMs: 500 });
    const b = createBroadcastPresence(scope, { ttlMs: 500 });
    const seen: string[][] = [];
    b.onWho((who) => seen.push(who.map((p) => `${p.participant}@${p.stop}`)));

    a.here(here("human:nora:a"));
    await tick();
    expect(seen.at(-1)).toEqual(["human:nora:a@#focus=aggregate%3Atask"]);

    a.here(here("human:nora:a", "#focus=t1"));
    await tick();
    expect(seen.at(-1)).toEqual(["human:nora:a@#focus=t1"]);

    // The same word twice is not a change: nobody is told again.
    const told = seen.length;
    a.here(here("human:nora:a", "#focus=t1"));
    await tick();
    expect(seen.length).toBe(told);

    a.leave();
    await tick();
    expect(seen.at(-1)).toEqual([]);
    b.leave();
  });

  it("keeps somebody here on heartbeats alone, past the TTL, while they say nothing new", async () => {
    const scope = `t-${Math.random().toString(36).slice(2)}`;
    const a = createBroadcastPresence(scope, { ttlMs: 150 });
    const b = createBroadcastPresence(scope, { ttlMs: 150 });
    const seen: number[] = [];
    b.onWho((who) => seen.push(who.length));
    const beat = setInterval(() => a.here(here("human:nora:a")), 40);
    await new Promise((settle) => setTimeout(settle, 500));
    clearInterval(beat);
    // Told once — arrival — and never told they left, because they never did.
    expect(seen).toEqual([1]);
    a.leave();
    b.leave();
  });

  it("never draws you on your own map, and forgets a tab that died without a word", async () => {
    const scope = `t-${Math.random().toString(36).slice(2)}`;
    const a = createBroadcastPresence(scope, { ttlMs: 200 });
    const b = createBroadcastPresence(scope, { ttlMs: 200 });
    const seenByA: number[] = [];
    a.onWho((who) => seenByA.push(who.length));
    a.here(here("human:nora:a"));
    b.here(here("human:sam:b"));
    await tick();
    expect(seenByA.at(-1)).toBe(1);
    // b's channel dies mid-sentence: no leave, no heartbeat.
    b.leave();
    // (leave says goodbye; to stand in for a crash, a third tab that simply stops talking)
    const c = createBroadcastPresence(scope, { ttlMs: 200, channel: undefined });
    c.here(here("human:kit:c"));
    await tick();
    expect(seenByA.at(-1)).toBe(1);
    await new Promise((settle) => setTimeout(settle, 350));
    expect(seenByA.at(-1)).toBe(0);
    a.leave();
    c.leave();
  });
});
