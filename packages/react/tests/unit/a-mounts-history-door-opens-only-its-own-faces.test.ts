import { describe, expect, it } from "vitest";
import { createHistoryDoor } from "../../src/provider.js";

/**
 * A MOUNT'S HISTORY DOOR OPENS ONLY WHERE A TIMELINE WILL DRAW (Roadmap
 * f-host-opens-history). `handle.showHistory()` asks the door its mount
 * made: the timelines listening there open, and it says so; one asked for
 * before the face has drawn opens as it arrives, unless the face draws no
 * timeline; a request kept for an app swapped out is dropped; and a door
 * closed with its mount waits for nothing and opens nothing again.
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("a mount's history door", () => {
  it("opens every timeline listening, with the keyboard where it was asked for, and says it was heard", () => {
    const door = createHistoryDoor();
    const asked: boolean[] = [];
    const stop = door.listen(({ focus }) => asked.push(focus));
    expect(door.show({ focus: true })).toBe(true);
    expect(door.show()).toBe(true);
    expect(asked).toEqual([true, false]);
    stop();
    expect(door.show()).toBe(false);
    expect(asked).toEqual([true, false]);
  });

  it("asked before the face has drawn, opens the first timeline to arrive, once", () => {
    const door = createHistoryDoor();
    expect(door.show({ focus: true })).toBe(false);
    const asked: boolean[] = [];
    door.listen(({ focus }) => asked.push(focus));
    door.listen(({ focus }) => asked.push(focus));
    expect(asked).toEqual([true]);
  });

  it("drops a request no timeline heard once the face has drawn without one, and keeps none after", async () => {
    const door = createHistoryDoor();
    door.show();
    door.settle();
    await tick();
    let opened = 0;
    door.listen(() => (opened += 1));
    expect(opened).toBe(0);
    // A face drawn: a request nobody hears now is not kept for one drawn later.
    const later = createHistoryDoor();
    later.settle();
    expect(later.show()).toBe(false);
    later.listen(() => (opened += 1));
    expect(opened).toBe(0);
  });

  it("keeps a request for a timeline drawn with the face, in the commit the face is said to have drawn", async () => {
    const door = createHistoryDoor();
    door.show();
    door.settle();
    let opened = 0;
    door.listen(() => (opened += 1));
    await tick();
    expect(opened).toBe(1);
  });

  it("drops a request kept for an app swapped out", () => {
    const door = createHistoryDoor();
    door.show();
    door.forget();
    let opened = 0;
    door.listen(() => (opened += 1));
    expect(opened).toBe(0);
  });

  it("closed with its mount, forgets what it was asked and opens nothing again", () => {
    const door = createHistoryDoor();
    door.show();
    door.close();
    let opened = 0;
    door.listen(() => (opened += 1));
    expect(door.show()).toBe(false);
    expect(opened).toBe(0);
  });
});
