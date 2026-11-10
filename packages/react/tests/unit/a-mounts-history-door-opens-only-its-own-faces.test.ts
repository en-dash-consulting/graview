import { describe, expect, it } from "vitest";
import { createHistoryDoor } from "../../src/provider.js";

/**
 * A MOUNT'S HISTORY DOOR OPENS ONLY ITS OWN FACES (Roadmap
 * f-host-opens-history). `handle.showHistory()` asks the door its mount
 * made: the faces listening there open, a face not yet drawn opens as it
 * arrives, and a door closed with its mount waits for nothing and opens
 * nothing again.
 */
describe("a mount's history door", () => {
  it("opens every face listening, and says it was heard", () => {
    const door = createHistoryDoor();
    let opened = 0;
    const stop = door.listen(() => (opened += 1));
    expect(door.show()).toBe(true);
    expect(opened).toBe(1);
    stop();
    expect(door.show()).toBe(false);
    expect(opened).toBe(1);
  });

  it("asked before a face is drawn, opens the first to arrive, once", () => {
    const door = createHistoryDoor();
    expect(door.show()).toBe(false);
    let opened = 0;
    door.listen(() => (opened += 1));
    expect(opened).toBe(1);
    door.listen(() => (opened += 1));
    expect(opened).toBe(1);
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

  it("is one mount's: another door over the same store is not asked", () => {
    const one = createHistoryDoor();
    const other = createHistoryDoor();
    let heard = 0;
    other.listen(() => (heard += 1));
    one.show();
    expect(heard).toBe(0);
  });
});
