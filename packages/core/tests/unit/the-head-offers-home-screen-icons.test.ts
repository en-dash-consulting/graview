import { describe, expect, it } from "vitest";
import { homeScreenOf, themeColorsOf } from "../../src/head.js";
import { SCHEMES } from "../../src/index.js";
import type { Brand } from "../../src/index.js";

/**
 * THE HEAD OFFERS HOME-SCREEN ICONS (Roadmap f-app-icons-home-screen).
 * From the brand and the base the app is served under: an icon typed by
 * what it is (a PNG is image/png, never served as an SVG), an
 * apple-touch-icon and the manifest's PNG sizes where a PNG can be had, a
 * theme-color for each scheme — one where the brand pins a scheme — and a
 * manifest whose start and scope are the base. An SVG or an emoji is a PNG
 * only through a host's rasterizer, so without `png: true` it is offered as
 * SVG alone.
 */
const brand = (more: Partial<Brand>): Brand => ({ name: "TECH N9NE", schemes: SCHEMES, ...more });
const PNG = "/graview/assets/787c51a451b98a18befd06ebdf1b2b6f3ea3a9d0dc7b96fe395608231b8a3521.png";
const INLINE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#d7192f"></rect></svg>';
const link = (screen: ReturnType<typeof homeScreenOf>, rel: string) => screen.tags.find((tag) => tag.attributes["rel"] === rel)?.attributes;

describe("an app's head on a home screen", () => {
  it("types a PNG page icon as a PNG under the app's base, and names its PNG sizes for the host to serve", () => {
    const screen = homeScreenOf(brand({ favicon: PNG, scheme: "dark" }), { base: "/a/tech-n9ne-discography/" });
    expect(link(screen, "icon")).toEqual({ rel: "icon", type: "image/png", href: `/a/tech-n9ne-discography${PNG}` });
    expect(link(screen, "apple-touch-icon")).toEqual({ rel: "apple-touch-icon", sizes: "180x180", href: "/a/tech-n9ne-discography/apple-touch-icon.png" });
    expect(link(screen, "manifest")).toEqual({ rel: "manifest", href: "/a/tech-n9ne-discography/manifest.webmanifest" });
    expect(screen.manifest).toMatchObject({ name: "TECH N9NE", short_name: "TECH N9NE", display: "standalone", start_url: "/a/tech-n9ne-discography/", scope: "/a/tech-n9ne-discography/" });
    expect(screen.manifest.icons).toEqual([
      { src: "/a/tech-n9ne-discography/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/a/tech-n9ne-discography/icon-512.png", type: "image/png", sizes: "512x512" },
      { src: "/a/tech-n9ne-discography/icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ]);
    expect(screen.files.find((file) => file.path === "/icon-192.png")).toEqual({ path: "/icon-192.png", type: "image/png", size: 192, from: { png: `/a/tech-n9ne-discography${PNG}` } });
    expect(JSON.parse(screen.files.find((file) => file.path === "/manifest.webmanifest")!.body!)).toEqual(screen.manifest);
  });

  it("draws a PNG where the host serves the app's own images, when it says", () => {
    const screen = homeScreenOf(brand({ favicon: PNG }), { base: "/a/x", assetsAt: (path) => `https://cdn.example${path}` });
    expect(link(screen, "icon")?.["href"]).toBe(`https://cdn.example${PNG}`);
  });

  it("offers an inline SVG or an emoji as SVG alone, with no apple-touch-icon, unless the host makes PNGs", () => {
    for (const favicon of [INLINE, { emoji: "🎤" }] as const) {
      const screen = homeScreenOf(brand({ favicon }), { base: "/a/x" });
      expect(link(screen, "icon")).toEqual({ rel: "icon", type: "image/svg+xml", href: "/a/x/icon.svg" });
      expect(link(screen, "apple-touch-icon")).toBeUndefined();
      expect(screen.manifest.icons).toEqual([{ src: "/a/x/icon.svg", type: "image/svg+xml", sizes: "any" }]);
      expect(screen.files.find((file) => file.path === "/icon.svg")?.body).toContain("<svg");
      const made = homeScreenOf(brand({ favicon }), { base: "/a/x", png: true });
      expect(link(made, "apple-touch-icon")?.["href"]).toBe("/a/x/apple-touch-icon.png");
      expect(made.files.find((file) => file.path === "/icon-512.png")?.from).toEqual({ svg: expect.stringContaining("<svg") });
    }
  });

  it("falls back to the logo's light face, and offers no icon for a mark that could act", () => {
    expect(link(homeScreenOf(brand({ logo: { light: INLINE } })), "icon")?.["href"]).toBe("/icon.svg");
    const acting = homeScreenOf(brand({ favicon: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' }));
    expect(link(acting, "icon")).toBeUndefined();
    expect(acting.files.map((file) => file.path)).toEqual(["/manifest.webmanifest"]);
  });

  it("says one theme-color where the brand pins a scheme, and one for each scheme where it follows the device", () => {
    const pinned = themeColorsOf(brand({ scheme: "dark" }));
    expect(pinned).toHaveLength(1);
    expect(pinned[0]!.media).toBeUndefined();
    const both = themeColorsOf(brand({}));
    expect(both.map((one) => one.media)).toEqual(["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"]);
    expect(both.every((one) => /^#[0-9a-f]{6}$/.test(one.color))).toBe(true);
    expect(homeScreenOf(brand({})).html).toContain('<meta name="theme-color" content="');
  });
});
