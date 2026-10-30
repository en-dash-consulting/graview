import type { Presence } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createBroadcastPresence } from "../../src/presence.js";

/**
 * A PAGE SAYS THE APP'S AI HERE BESIDE ITSELF (Roadmap f-menu-type-anything):
 * "Graview, for Ada" while it thinks, a word of its own on the channel
 * (`alsoHere`) — told to the other tabs, gone once said with its time up,
 * and never taking this page's own word, or its leaving, from it.
 */
type Word = { type: "here"; presence: Presence } | { type: "leave"; participant: string };
function pair() {
  const posted: Word[] = [];
  const listeners: ((event: { data: unknown }) => void)[] = [];
  const make = (mine: boolean) => ({
    postMessage: (word: Word) => {
      if (mine) posted.push(word);
      for (const listener of listeners) listener({ data: word });
    },
    set onmessage(listener: (event: { data: unknown }) => void) {
      if (!mine) listeners.push(listener);
    },
    close: () => {},
  });
  return { posted, mine: make(true), theirs: make(false) };
}
const at = (offset = 0) => new Date(Date.now() + offset).toISOString();
const ada: Presence = { participant: "human:ada:s1", kind: "human", name: "Ada", hue: 1, stop: "/", at: at() };
const graview: Presence = { participant: "agent:graview-for-ada:s1", kind: "agent", name: "Graview", onBehalfOf: "ada", onBehalfOfName: "Ada", hue: 2, stop: "/", robot: { at: "t1", mode: "thinking" }, at: at() };

describe("the app's AI said here", () => {
  it("is told to the other tabs beside the page's own word, and goes when said with its time up", () => {
    const { posted, mine, theirs } = pair();
    const here = createBroadcastPresence("tasks", { channel: mine as never });
    const there = createBroadcastPresence("tasks", { channel: theirs as never });
    const seen: string[][] = [];
    there.onWho((who) => seen.push(who.map((one) => one.participant).sort()));
    here.here(ada);
    here.alsoHere!(graview);
    expect(seen.at(-1)).toEqual(["agent:graview-for-ada:s1", "human:ada:s1"]);
    here.alsoHere!({ ...graview, at: at(), until: at(-1) });
    expect(seen.at(-1)).toEqual(["human:ada:s1"]);
    // The page's leaving is still its own.
    here.leave();
    expect(posted.at(-1)).toEqual({ type: "leave", participant: "human:ada:s1" });
  });
});
