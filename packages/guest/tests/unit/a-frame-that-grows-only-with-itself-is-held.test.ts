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

/**
 * A frame and the guard over it, with the clock in hand: `quiet()` lets what
 * would happen after a moment happen. `moved` is the guest's own answer to
 * its frame moving, for a page sized by its frame.
 */
function framed(view: string) {
  const said: [string, number][] = [];
  const waiting: (() => void)[] = [];
  let frame = 160;
  let moved = () => {};
  const guard = growthGuard(view, {
    say: (words, height) => said.push([words, height]),
    apply: (height) => {
      frame = height;
      moved();
    },
    later: (then) => {
      waiting.push(then);
      return () => {
        const at = waiting.indexOf(then);
        if (at >= 0) waiting.splice(at, 1);
      };
    },
  });
  const ask = (height: number) => {
    const asked = Math.min(CAP, height);
    if (guard.takes(asked) && asked !== frame) {
      frame = asked;
      moved();
    }
  };
  return {
    guard,
    said,
    ask,
    frame: () => frame,
    quiet: () => waiting.splice(0).forEach((then) => then()),
    /** The guest is a page as tall as its frame and `margin` more: it asks again whenever its frame moves. */
    sizedByItsFrame(margin: number | ((frame: number) => number)) {
      const more = typeof margin === "number" ? (at: number) => at + margin : margin;
      moved = () => ask(more(frame));
      ask(more(frame));
    },
  };
}

describe("the growth guard", () => {
  it("holds a page as tall as its frame and 16px more once it asks again after it is given what it refused, and says so", () => {
    const page = framed("tall-card");
    page.sizedByItsFrame(16);
    expect(page.frame(), "refused a few rounds in").toBe(160 + 16 * (GROWTH_ROUNDS + 1));
    expect(page.said).toEqual([]);
    page.quiet();
    const held = 160 + 16 * (GROWTH_ROUNDS + 2);
    expect(page.frame(), "given what it asked, it asked again by the same step, and is held").toBe(held);
    expect(page.said).toEqual([[`The view "tall-card" asked to be 16px taller than its frame each time its frame was made taller, ${GROWTH_ROUNDS + 2} times running, so it is held at ${held}px: a page sized by its own frame (100vh) grows with it. Size the page by its content, or ask for a height (guest.size).`, held]]);
    page.quiet();
    expect(page.frame(), "and stays held").toBe(held);
  });

  it("holds one that asks for the same share more each time (110vh)", () => {
    const page = framed("share");
    page.sizedByItsFrame((at) => Math.round(at * 1.1));
    for (let moment = 0; moment < 6 && page.said.length === 0; moment += 1) page.quiet();
    expect(page.frame(), "rounded to whole pixels, a few rounds more").toBeLessThan(1_000);
    expect(page.said).toHaveLength(1);
  });

  it("gives a gallery whose pictures of one height stop arriving just where it would be held all of its height, and says nothing", () => {
    const gallery = framed("gallery");
    for (const height of [100, 300, 500, 700, 900]) gallery.ask(height);
    expect(gallery.frame(), "900 refused for a moment").toBe(700);
    gallery.quiet();
    expect(gallery.frame(), "given after all").toBe(900);
    gallery.quiet();
    expect(gallery.frame()).toBe(900);
    expect(gallery.said).toEqual([]);
  });

  it("is armed again after content that grew: the same gallery, then sized by its frame, is held", () => {
    const page = framed("gallery-then-tall");
    for (const height of [100, 300, 500, 700, 900]) page.ask(height);
    page.quiet();
    page.quiet();
    page.sizedByItsFrame(16);
    page.quiet();
    expect(page.said).toHaveLength(1);
    expect(page.frame()).toBeLessThan(1_100);
  });

  it("lets a guest whose content grows by steps of its own grow to the cap, and says nothing", () => {
    const page = framed("growing");
    let content = 160;
    for (const step of [240, 90, 410, 1200, 75, 3300, 640, 5100, 220, 9000]) page.ask((content += step));
    page.quiet();
    page.quiet();
    expect(page.frame()).toBe(CAP);
    expect(page.said).toEqual([]);
  });

  it("lets rows of one height, 25,000px of them, grow to the cap: a row refused a moment is taken when the next asks another height", () => {
    const page = framed("rows");
    for (let content = 1_001; content <= 25_025; content += 1_001) page.ask(content);
    page.quiet();
    page.quiet();
    expect(page.frame()).toBe(CAP);
    expect(page.said).toEqual([]);
  });

  it("lets content that grows in equal steps grow where each step follows something pushed", () => {
    const page = framed("pushed");
    page.ask(400);
    for (let row = 1; row <= 30; row += 1) {
      page.guard.pushed();
      page.ask(400 + row * 40);
    }
    expect(page.frame()).toBe(400 + 30 * 40);
  });

  it("while held, refuses the height it was refused, and takes one lower", () => {
    const page = framed("held");
    page.sizedByItsFrame(16);
    page.quiet();
    const held = page.frame();
    expect(page.guard.takes(held + 16)).toBe(false);
    expect(page.guard.takes(held - 40), "lower").toBe(true);
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
    /* A page as tall as its frame and a margin: it asks again whenever its frame moves. */
    for (let round = 0; round < 200 && !iframe.hasAttribute("data-guest-view-held"); round += 1) {
      ask(height(iframe) + 16);
      await tick(20);
    }
    expect(height(iframe)).toBeLessThan(300);
    expect(problems).toHaveLength(1);
    expect(iframe.getAttribute("data-guest-view-held")).toBe(iframe.style.height);
    expect(problems[0]).toContain('The view "card" asked to be 16px taller than its frame each time its frame was made taller');
  });

  it("is given all of a gallery whose pictures of one height stop arriving just where it would be held, and says nothing", async () => {
    const problems: string[] = [];
    const { iframe, ask } = mounted(problems);
    for (const content of [100, 300, 500, 700, 900]) {
      ask(content);
      await tick();
    }
    await tick(2 * GROWTH_QUIET_MS + 200);
    expect(height(iframe)).toBe(900);
    expect(iframe.hasAttribute("data-guest-view-held")).toBe(false);
    expect(problems).toEqual([]);
  });

  it("grows to the cap where its content grows, and is not held", async () => {
    const problems: string[] = [];
    const { iframe, ask } = mounted(problems);
    for (let content = 1_001; content <= 25_025; content += 1_001) {
      ask(content);
      await tick();
    }
    await tick(2 * GROWTH_QUIET_MS + 200);
    expect(height(iframe)).toBe(CAP);
    expect(iframe.hasAttribute("data-guest-view-held")).toBe(false);
    expect(problems).toEqual([]);
  });
});
