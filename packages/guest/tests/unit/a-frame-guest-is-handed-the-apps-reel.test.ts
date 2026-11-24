// @vitest-environment jsdom
import type { AppVideo } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/frame.js";
import { GUEST_PROTOCOL, type GuestProps, type GuestTheme, type HostHello, type HostMessage } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME GUEST IS HANDED THE APP'S REEL (HQ f-reel-mount-tests-and-frames).
 *
 * The reel a host keeps for the whole app reaches a frame guest as it
 * reaches a worker view: its facts in `props.theme.reel` — what it is, how
 * long, whether it has a poster and whether it plays — and never its
 * address, its poster's or its captions'. Pushed again when the host hands
 * another, and gone when it hands none.
 */
const DARK = { accent: "#6fdcea", ground: "#080d12", panel: "#141f27", ink: "#e8f3f6", inkMuted: "#9fb6bf", edge: "#1d3a44", fontBody: "Inter, system-ui", fontDisplay: "Georgia, serif", fontMono: "ui-monospace", radius: "4px" };

function frameWith(reel: () => AppVideo | undefined) {
  const app = document.createElement("div");
  app.setAttribute("data-graview-scheme", "dark");
  const element = document.createElement("div");
  for (const [key, value] of Object.entries(DARK)) element.style.setProperty(`--graview-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  app.appendChild(element);
  document.body.appendChild(app);
  const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), reel });
  const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
  window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
  const [, , [port]] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
  const pushed: GuestProps[] = [];
  port!.onmessage = (event) => {
    const message = event.data as HostMessage;
    if (message.type === "props") pushed.push(message.props as GuestProps);
  };
  return {
    frame,
    pushed,
    themes: () => pushed.map((props) => props.theme as GuestTheme),
    done() {
      port!.close();
      frame.dispose();
      app.remove();
    },
  };
}

describe("a frame guest's props", () => {
  it("carry the reel's facts in theme.reel, never its address, its poster's or its captions'", async () => {
    const reel: AppVideo = { href: "/graview/files/reel.mp4", poster: "/graview/files/reel.jpg", captions: "/graview/files/reel.vtt", caption: "The season so far", duration: 30, width: 1920, height: 1080 };
    const { pushed, themes, done } = frameWith(() => reel);
    await vi.waitFor(() => expect(pushed).toHaveLength(1));
    expect(themes()[0]!.reel).toEqual({ name: "reel", caption: "The season so far", type: "video/mp4", duration: 30, poster: true, playable: true, width: 1920, height: 1080, aspect: 1.7778 });
    expect(JSON.stringify(pushed)).not.toContain("/graview/files/");
    done();
  });

  it("are pushed again with the reel the host hands next, and without one once it hands none", async () => {
    let reel: AppVideo | undefined = { href: "/graview/files/reel.mp4", poster: "/graview/files/reel.jpg", duration: 30 };
    const { frame, pushed, themes, done } = frameWith(() => reel);
    await vi.waitFor(() => expect(pushed).toHaveLength(1));
    reel = { href: "https://media.example/other.webm", type: "video/webm", duration: 12 };
    frame.update();
    await vi.waitFor(() => expect(pushed).toHaveLength(2));
    expect(themes()[1]!.reel).toEqual({ name: "reel", type: "video/webm", duration: 12, playable: false });
    expect(JSON.stringify(pushed)).not.toContain("media.example");
    reel = undefined;
    frame.update();
    await vi.waitFor(() => expect(pushed).toHaveLength(3));
    expect(themes()[2]).not.toHaveProperty("reel");
    done();
  });

  it("carry no reel where the host handed one at no address a page plays it from", async () => {
    const { pushed, themes, done } = frameWith(() => ({ href: "javascript:alert(1)", duration: 3 }));
    await vi.waitFor(() => expect(pushed).toHaveLength(1));
    expect(themes()[0]).not.toHaveProperty("reel");
    expect(themes()[0]).toEqual({ scheme: "dark", ...DARK });
    done();
  });
});
