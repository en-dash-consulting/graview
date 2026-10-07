// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/index.js";
import { GUEST_PROTOCOL, type GuestProps, type GuestTheme, type HostHello, type HostMessage } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME GUEST GETS THE APP'S LOOK, AND FOLLOWS THE APP'S TOGGLE (FR-86).
 * The worker form is FR-91, and the frame now reads it the same way
 * (host/theme.ts): the `--graview-*` tokens the frame's element inherits,
 * and the scheme the app's own toggle stamps (`data-graview-scheme`, which
 * the embed writes) — never the system's preference over the app's. When
 * the toggle moves, the frame is pushed again. That a guest drawing from
 * `props.theme` matches the app in a browser is `guest-sandbox
 * --transport=client`.
 */
const DARK = { accent: "#6fdcea", ground: "#080d12", panel: "#141f27", ink: "#e8f3f6", inkMuted: "#9fb6bf", edge: "#1d3a44", fontBody: "Inter, system-ui", fontDisplay: "Georgia, serif", fontMono: "ui-monospace", radius: "4px" };

function frameIn(scheme: "light" | "dark") {
  const app = document.createElement("div");
  app.setAttribute("data-graview-scheme", scheme);
  const element = document.createElement("div");
  for (const [key, value] of Object.entries(DARK)) element.style.setProperty(`--graview-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
  app.appendChild(element);
  document.body.appendChild(app);
  const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }) });
  const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
  window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
  const [, , [port]] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
  const themes: GuestTheme[] = [];
  port!.onmessage = (event) => {
    const message = event.data as HostMessage;
    if (message.type === "props") themes.push((message.props as GuestProps).theme!);
  };
  return {
    app,
    themes,
    done() {
      port!.close();
      frame.dispose();
      app.remove();
    },
  };
}

describe("a frame guest's props", () => {
  it("carry the app's look: its scheme, and each of its tokens", async () => {
    const { themes, done } = frameIn("dark");
    await vi.waitFor(() => expect(themes).toHaveLength(1));
    expect(themes[0]).toEqual({ scheme: "dark", ...DARK });
    done();
  });

  it("are pushed again when the app's own toggle changes the scheme, even against what the system prefers", async () => {
    const prefers = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: query.includes("dark"), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    const { app, themes, done } = frameIn("dark");
    await vi.waitFor(() => expect(themes).toHaveLength(1));
    app.setAttribute("data-graview-scheme", "light");
    await vi.waitFor(() => expect(themes).toHaveLength(2));
    expect(themes[1]!.scheme).toBe("light");
    app.setAttribute("data-graview-scheme", "dark");
    await vi.waitFor(() => expect(themes).toHaveLength(3));
    expect(themes[2]!.scheme).toBe("dark");
    done();
    prefers.mockRestore();
  });

  it("are not pushed again for a change that leaves the look as it was", async () => {
    const { app, themes, done } = frameIn("dark");
    await vi.waitFor(() => expect(themes).toHaveLength(1));
    app.setAttribute("data-theme", "anything");
    app.setAttribute("data-graview-scheme", "dark");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(themes).toHaveLength(1);
    done();
  });
});
