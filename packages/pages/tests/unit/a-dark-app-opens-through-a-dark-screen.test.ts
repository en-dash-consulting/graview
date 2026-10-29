import { describe, expect, it } from "vitest";
import { splashHtml, splashScheme, type SplashBrand } from "../../src/splash.js";

/**
 * A DARK APP OPENS THROUGH A DARK SCREEN (Roadmap f-splash-follows-declared-scheme).
 * TECH N9NE's brand says `scheme: "dark"`; on a light device the opening
 * screen drew a cream veil with dark ink, then the app opened dark. The
 * scheme an app declares — the brand's, else the screen's own — is the
 * screen's, and a host's `auto` is no choice that overrides it; a reader's
 * own choice (`light`, `dark`) still wins. And the screen's image under
 * `/graview/assets/` is drawn where the host serves the app's own images.
 */
const IMAGE = "/graview/assets/8edab0c83edd9a44bf2659cbf426f25a746690709b2adbd2cf131fe8702844cd.png";
const N9NE: SplashBrand = { name: "TECH N9NE", accent: "#d7192f", scheme: "dark", splash: { style: "editorial", image: IMAGE, kicker: "Every song, every release" } };
const schemeOf = (html: string) => /data-scheme="(\w+)"/.exec(html)?.[1];

describe("the scheme the opening screen opens in", () => {
  it("is the brand's where it pins one, whatever a host's auto says", () => {
    expect(schemeOf(splashHtml(N9NE).html)).toBe("dark");
    expect(schemeOf(splashHtml(N9NE, { scheme: "auto" }).html)).toBe("dark");
    expect(splashScheme(N9NE, { scheme: "light" })).toBe("light");
  });

  it("is the screen's own where the brand pins none, and the device's for device or unsaid", () => {
    const own = (scheme?: "light" | "dark" | "device") => ({ ...N9NE, scheme: "auto" as const, splash: { ...N9NE.splash!, ...(scheme ? { scheme } : {}) } });
    expect(splashScheme(own("dark"))).toBe("dark");
    expect(splashScheme(own("light"), { scheme: "auto" })).toBe("light");
    expect(splashScheme(own("device"))).toBe("auto");
    expect(splashScheme(own())).toBe("auto");
    expect(splashScheme({ ...N9NE, splash: { ...N9NE.splash!, scheme: "light" } })).toBe("dark");
  });

  it("draws its image where the host serves the app's own images, and as given without one", () => {
    expect(splashHtml(N9NE, { assetsAt: (path) => `/a/tech-n9ne-discography${path}` }).html).toContain(`src="/a/tech-n9ne-discography${IMAGE}"`);
    expect(splashHtml(N9NE).html).toContain(`src="${IMAGE}"`);
  });
});
