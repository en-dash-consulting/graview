// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/index.js";
import { createGuestLogo, type GuestBrand } from "../../src/host/theme.js";
import { GUEST_PROTOCOL, type GuestProps, type GuestTheme, type HostHello, type HostMessage } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A VIEW IS HANDED THE WHOLE BRAND, LOGO INCLUDED (FR-127).
 *
 * A view got the colours and the body and mono fonts, and drew headings and
 * the app's name its own way: nothing said what the app's wordmark is
 * drawn in, how round its panels are, or what its logo looks like, and a
 * view may load nothing, so a logo the app keeps at a path of its own was
 * out of reach. `props.theme` now carries `fontDisplay` and `radius`
 * beside the rest, the app's `name`, and its `logo` as a URL the HOST made:
 * a `data:` image for a frame, which is another origin, and for a worker
 * view drawn in the host's page a `blob:` of the page's own — or `data:`
 * where the page's policy refuses `blob:` images. That each matches the
 * app's wordmark and headings in a browser, under Claude's and ChatGPT's
 * policies, is `guest-sandbox --transport=brand`.
 */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20"><rect width="40" height="20" fill="#0a5"/></svg>`;
const OTHER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#a50"/></svg>`;
const decode = (url: string) => {
  const [head, body] = url.split(",", 2) as [string, string];
  return head.endsWith(";base64") ? atob(body) : decodeURIComponent(body);
};

function frameWith(brand: { current: GuestBrand | undefined }) {
  const element = document.createElement("div");
  element.style.setProperty("--graview-font-display", "Fraunces, Georgia, serif");
  element.style.setProperty("--graview-radius", "4px");
  document.body.appendChild(element);
  const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), brand: () => brand.current });
  const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
  window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
  const [, , [port]] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
  const themes: GuestTheme[] = [];
  port!.onmessage = (event) => {
    const message = event.data as HostMessage;
    if (message.type === "props") themes.push((message.props as GuestProps).theme!);
  };
  return {
    frame,
    themes,
    done() {
      port!.close();
      frame.dispose();
      element.remove();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window.URL as { createObjectURL?: unknown }).createObjectURL;
  delete (window.URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

describe("a frame guest's theme", () => {
  it("carries the display face and the radius the app is drawn with", async () => {
    const { themes, done } = frameWith({ current: undefined });
    await vi.waitFor(() => expect(themes).toHaveLength(1));
    expect(themes[0]).toMatchObject({ fontDisplay: "Fraunces, Georgia, serif", radius: "4px" });
    expect(themes[0]).not.toHaveProperty("logo");
    expect(themes[0]).not.toHaveProperty("name");
    done();
  });

  it("carries the app's name, and its inline SVG logo as a data: image of the same bytes, made by the host", async () => {
    const { themes, done } = frameWith({ current: { name: "En Dash", logo: LOGO } });
    await vi.waitFor(() => expect(themes.at(-1)?.logo).toBeDefined());
    const theme = themes.at(-1)!;
    expect(theme.name).toBe("En Dash");
    expect(theme.logo).toMatch(/^data:image\/svg\+xml[;,]/);
    expect(decode(theme.logo!)).toBe(LOGO);
    done();
  });

  it("is pushed the new logo when the brand changes, without the frame being made again", async () => {
    const brand = { current: { name: "En Dash", logo: LOGO } as GuestBrand };
    const { frame, themes, done } = frameWith(brand);
    const iframe = frame.iframe;
    await vi.waitFor(() => expect(themes.at(-1)?.logo).toBeDefined());
    brand.current = { name: "En Dash Consulting", logo: OTHER };
    frame.update();
    await vi.waitFor(() => expect(decode(themes.at(-1)?.logo ?? "")).toBe(OTHER));
    expect(themes.at(-1)!.name).toBe("En Dash Consulting");
    expect(frame.iframe).toBe(iframe);
    done();
  });

  it("fetches a logo at an address on the page's own origin, and hands its bytes as data:", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const fetched = vi.spyOn(window, "fetch").mockImplementation(async () => new Response(bytes, { headers: { "content-type": "image/png" } }));
    const { themes, done } = frameWith({ current: { name: "En Dash", logo: "/graview/assets/abc.png" } });
    await vi.waitFor(() => expect(themes.at(-1)?.logo).toBeDefined());
    expect(fetched).toHaveBeenCalledWith(`${location.origin}/graview/assets/abc.png`, { credentials: "same-origin" });
    expect(themes.at(-1)!.logo).toMatch(/^data:image\/png;base64,/);
    expect([...decode(themes.at(-1)!.logo!)].map((c) => c.charCodeAt(0))).toEqual([...bytes]);
    done();
  });

  it("hands no logo from another origin, and never asks for it", async () => {
    const fetched = vi.spyOn(window, "fetch");
    const { themes, done } = frameWith({ current: { name: "En Dash", logo: "https://elsewhere.example/logo.png" } });
    await vi.waitFor(() => expect(themes).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetched).not.toHaveBeenCalled();
    expect(themes.every((theme) => theme.logo === undefined && theme.name === "En Dash")).toBe(true);
    done();
  });
});

describe("a worker view's logo", () => {
  /** jsdom draws no images: the page's answer to `<img src=blob:>` is stood in for. */
  function page(answer: "load" | "error") {
    let made = 0;
    const revoked: string[] = [];
    Object.assign(window.URL, { createObjectURL: () => `blob:${location.origin}/${++made}`, revokeObjectURL: (url: string) => void revoked.push(url) });
    vi.spyOn(window, "Image").mockImplementation(function (this: { onload?: () => void; onerror?: () => void }) {
      const image = { onload: undefined as undefined | (() => void), onerror: undefined as undefined | (() => void) };
      return Object.defineProperty(image, "src", { set: () => queueMicrotask(() => (answer === "load" ? image.onload?.() : image.onerror?.())) });
    } as never);
    return { revoked };
  }

  it("is a blob: URL of the host's own page, revoked once the next brand's is ready and when the view goes", async () => {
    const { revoked } = page("load");
    const moved = vi.fn();
    const logo = createGuestLogo(window, moved, "blob");
    expect(logo.url(LOGO)).toBeUndefined();
    await vi.waitFor(() => expect(moved).toHaveBeenCalledTimes(1));
    const first = logo.url(LOGO)!;
    expect(first).toMatch(new RegExp(`^blob:${location.origin}/`));
    // Until the next logo is ready, the last one is still handed: the view is not left with none.
    expect(logo.url(OTHER)).toBe(first);
    await vi.waitFor(() => expect(moved).toHaveBeenCalledTimes(2));
    const second = logo.url(OTHER)!;
    expect(second).not.toBe(first);
    expect(revoked).toEqual([first]);
    logo.dispose();
    expect(revoked).toEqual([first, second]);
  });

  it("is a data: image where the page's policy refuses blob: images, as ChatGPT's does", async () => {
    const { revoked } = page("error");
    const moved = vi.fn();
    const logo = createGuestLogo(window, moved, "blob");
    logo.url(LOGO);
    await vi.waitFor(() => expect(moved).toHaveBeenCalled());
    const url = logo.url(LOGO)!;
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(decode(url)).toBe(LOGO);
    expect(revoked).toHaveLength(1);
  });

  it("is a data: image handed on as it is, and nothing once the brand drops its logo", async () => {
    page("load");
    const moved = vi.fn();
    const logo = createGuestLogo(window, moved, "blob");
    const given = `data:image/svg+xml;base64,${btoa(LOGO)}`;
    logo.url(given);
    await vi.waitFor(() => expect(moved).toHaveBeenCalled());
    expect(logo.url(given)).toBe(given);
    expect(logo.url(undefined)).toBeUndefined();
  });
});
