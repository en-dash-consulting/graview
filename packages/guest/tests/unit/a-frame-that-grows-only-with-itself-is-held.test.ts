// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountGuestView, type GuestFrame } from "../../src/host/frame.js";
import { GROWTH_QUIET_MS, GROWTH_ROUNDS, growthGuard } from "../../src/host/session.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME THAT GROWS ONLY WITH ITSELF IS HELD (Roadmap
 * f-guest-growth-guard). A frame takes the height its guest asks for, up to
 * `maxHeight`, and Graview Cloud lets a frame of many views be 20,000px. A
 * guest whose page is `height: 100vh` with a margin asks for a little more
 * than its frame each time the frame is made taller, so it grew with itself
 * to the cap. The guest session now holds a frame whose every height tracks
 * the one it was last given a few times running, watches it, and — when it
 * asks nothing new of its own accord — says so in words; a frame whose
 * content really grows, rows of one height among it, still grows to the cap.
 */
const CAP = 20_000;

/** The guard with its clock in hand: what it would say later is said when `quiet()` is called. */
function guarded(view: string) {
  const said: [string, number][] = [];
  const waiting: (() => void)[] = [];
  const guard = growthGuard(view, (words, height) => said.push([words, height]), (then) => {
    waiting.push(then);
    return () => waiting.splice(waiting.indexOf(then), 1);
  });
  return { guard, said, quiet: () => waiting.splice(0).forEach((then) => then()) };
}

/** A guest sized by its own frame: each height it asks for is the frame's, and 16px of margin. A frame not moved asks the same again. */
const runaway = (take: (height: number) => boolean, from = 160, rounds = 40) => {
  let frame = from;
  for (let round = 0; round < rounds; round += 1) {
    const asked = Math.min(CAP, frame + 16);
    if (take(asked)) frame = asked;
  }
  return frame;
};

/** A guest sized by its content: it asks a height only when its content changes, whatever its frame. */
const rows = (take: (height: number) => boolean, row: number, count: number) => {
  let frame = 0;
  for (let content = row; content <= row * count; content += row) if (take(Math.min(CAP, content))) frame = Math.min(CAP, content);
  return frame;
};

describe("the growth guard", () => {
  it("holds a guest that asks for its own frame's height and 16px more, a few rounds in, and says so once it asks nothing new", () => {
    const { guard, said, quiet } = guarded("tall-card");
    const held = runaway((height) => guard.takes(height));
    expect(held).toBe(160 + 16 * (GROWTH_ROUNDS + 1));
    expect(said, "not until it has been quiet").toEqual([]);
    quiet();
    expect(said).toEqual([[`The view "tall-card" asked to be 16px taller than its frame each time its frame was made taller, ${GROWTH_ROUNDS + 1} times running, so it is held at ${held}px: a page sized by its own frame (100vh) grows with it. Size the page by its content, or ask for a height (guest.size).`, held]]);
  });

  it("holds one that asks for the same share more each time (110vh)", () => {
    const { guard } = guarded("share");
    let frame = 200;
    for (let round = 0; round < 40; round += 1) {
      const asked = Math.round(frame * 1.1);
      if (guard.takes(asked)) frame = asked;
    }
    expect(frame).toBeLessThan(400);
  });

  it("lets a guest whose content grows by steps of its own grow to the cap, and says nothing", () => {
    const { guard, said, quiet } = guarded("growing");
    let frame = 160;
    for (const step of [240, 90, 410, 1200, 75, 3300, 640, 5100, 220, 9000]) if (guard.takes(Math.min(CAP, frame + step))) frame = Math.min(CAP, frame + step);
    quiet();
    expect(frame).toBe(CAP);
    expect(said).toEqual([]);
  });

  it("lets rows of one height, 25,000px of them, grow to the cap: held a moment, the next row asks another height and it is never held again", () => {
    const { guard, said, quiet } = guarded("rows");
    expect(rows((height) => guard.takes(height), 1_001, 25)).toBe(CAP);
    quiet();
    expect(said).toEqual([]);
  });

  it("lets content that grows in equal steps grow where each step follows something pushed", () => {
    const { guard } = guarded("pushed");
    let frame = 400;
    for (let row = 0; row < 30; row += 1) {
      guard.pushed();
      if (guard.takes(frame + 40)) frame += 40;
    }
    expect(frame).toBe(400 + 30 * 40);
  });

  it("while held, refuses the height it was refused, and takes one lower", () => {
    const { guard } = guarded("held");
    const held = runaway((height) => guard.takes(height));
    expect(guard.takes(held + 16)).toBe(false);
    expect(guard.takes(held - 40), "lower").toBe(true);
  });
});

describe("a frame whose guest is sized by its own frame", () => {
  let frame: GuestFrame | undefined;
  afterEach(() => {
    frame?.dispose();
    frame = undefined;
  });

  const mounted = (problems: string[]) => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), limits: { maxHeight: CAP }, onProblem: (said) => problems.push(said) });
    frame.iframe.style.height = "160px";
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
    const [said, , [port]] = posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
    port!.start();
    return { iframe: frame.iframe, ask: (height: number) => port!.postMessage({ type: "size", nonce: said.nonce, height }) };
  };
  const height = (iframe: HTMLIFrameElement) => Number.parseInt(iframe.style.height, 10);
  const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

  it("stops growing a few rounds in, wears the height it is held at, and says why to the host", async () => {
    const problems: string[] = [];
    const { iframe, ask } = mounted(problems);
    for (let round = 0; round < 30; round += 1) {
      ask(height(iframe) + 16);
      await tick();
    }
    expect(height(iframe)).toBeLessThan(300);
    await vi.waitFor(() => expect(problems).toHaveLength(1), { timeout: GROWTH_QUIET_MS + 1_000 });
    expect(iframe.getAttribute("data-guest-view-held")).toBe(iframe.style.height);
    expect(problems[0]).toContain('The view "card" asked to be 16px taller than its frame each time its frame was made taller');
  });

  it("grows to the cap where its content grows, and is not held", async () => {
    const problems: string[] = [];
    const { iframe, ask } = mounted(problems);
    for (let content = 1_001; content <= 25_025; content += 1_001) {
      ask(content);
      await tick();
    }
    await tick(GROWTH_QUIET_MS + 100);
    expect(height(iframe)).toBe(CAP);
    expect(iframe.hasAttribute("data-guest-view-held")).toBe(false);
    expect(problems).toEqual([]);
  });
});
