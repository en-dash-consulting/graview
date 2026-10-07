// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AnySchema, Brand } from "@graview/core";
import { createViews, GraviewProvider } from "@graview/react/provider";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { guestView } from "../../src/host/index.js";
import { GUEST_PROTOCOL, type GuestProps, type GuestTheme, type HostHello, type HostMessage } from "../../src/protocol.js";
import { bethan, schema, showroom } from "./showroom.js";

/**
 * `guestView` HANDS A FRAME THE PROVIDER'S BRAND, AND FOLLOWS IT (FR-127).
 * The app's brand is the provider's — the embed's `brand`, or the app's own
 * — and a frame registered with `guestView` is pushed its name and logo,
 * and pushed again when the host re-dresses the app (`handle.setBrand`),
 * the frame kept as it was.
 */
const LOGO = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${fill}"/></svg>`;
const brandOf = (name: string, fill: string) => ({ name, logo: LOGO(fill), schemes: {} }) as unknown as Brand;

describe("a guest view in a branded app", () => {
  it("is pushed the brand's name and logo, and again when the brand changes, in the same frame", async () => {
    const Guest = guestView({ url: "https://cards.example/card.html", name: "card" });
    const store = showroom() as unknown as Parameters<typeof GraviewProvider>[0]["store"];
    const views = createViews(schema) as never;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const draw = (brand: Brand) => root.render(
      <GraviewProvider<AnySchema> store={store} views={views} principal={bethan} brand={brand}>
        <Guest fidelity="full" cardinality="one" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    await act(async () => draw(brandOf("En Dash", "#0a5")));
    const iframe = host.querySelector<HTMLIFrameElement>('iframe[data-guest-view="card"]')!;
    const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: iframe.contentWindow }));
    const [, , [port]] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    const themes: GuestTheme[] = [];
    port!.onmessage = (event) => {
      const message = event.data as HostMessage;
      if (message.type === "props") themes.push((message.props as GuestProps).theme!);
    };
    await vi.waitFor(() => expect(themes.at(-1)?.logo).toBeDefined());
    expect(themes.at(-1)!.name).toBe("En Dash");
    const first = themes.at(-1)!.logo!;
    await act(async () => draw(brandOf("En Dash Consulting", "#a50")));
    await vi.waitFor(() => expect(themes.at(-1)?.logo).not.toBe(first));
    expect(themes.at(-1)!.name).toBe("En Dash Consulting");
    expect(atob(themes.at(-1)!.logo!.split(",")[1]!)).toBe(LOGO("#a50"));
    expect(host.querySelector('iframe[data-guest-view="card"]')).toBe(iframe);
    port!.close();
    await act(async () => root.unmount());
    host.remove();
  });
});
