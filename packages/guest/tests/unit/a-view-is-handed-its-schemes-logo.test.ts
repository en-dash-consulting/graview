import { describe, expect, it } from "vitest";
import { themeWithBrand, type GuestLogo } from "../../src/host/theme.js";
import type { GuestTheme } from "../../src/protocol.js";

/**
 * A VIEW IS HANDED ITS SCHEME'S LOGO. A brand may give a logo for each
 * scheme (`{ light, dark }`), and a view drawn in the dark is handed the
 * dark one — the light one where there is none — made into a URL as the
 * one logo always was.
 */
const look = (scheme: "light" | "dark") => ({ scheme }) as unknown as GuestTheme;
const asGiven: GuestLogo = { url: (logo: string | undefined) => logo, moved: () => {} } as unknown as GuestLogo;

describe("the logo a view is handed", () => {
  it("is the dark one in the dark and the light one in the light", () => {
    const brand = () => ({ name: "Recon", logo: { light: "/graview/assets/a.jpg", dark: "/graview/assets/b.png" } });
    expect(themeWithBrand(() => look("dark"), brand, asGiven).logo).toBe("/graview/assets/b.png");
    expect(themeWithBrand(() => look("light"), brand, asGiven).logo).toBe("/graview/assets/a.jpg");
  });

  it("is the light one in the dark where there is no dark one, and the one logo as before", () => {
    expect(themeWithBrand(() => look("dark"), () => ({ logo: { light: "/graview/assets/a.jpg" } }), asGiven).logo).toBe("/graview/assets/a.jpg");
    expect(themeWithBrand(() => look("dark"), () => ({ logo: "/graview/assets/a.jpg" }), asGiven).logo).toBe("/graview/assets/a.jpg");
  });
});
