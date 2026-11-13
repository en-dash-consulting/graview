import { describe, expect, it } from "vitest";
import { besideShare, CITY_LEAST, deskPanelWidth, frameSpacing, frameSpacingAt, GUTTER, levelZooms, PANEL_MOST, PANEL_SHARE, panelBox, panelRange, panelStoreKey } from "../../src/one-place-geometry.js";

const laptop = { width: 1440, height: 900, top: 48 };

describe("the panel beside the city opens at 55% of a desk's window, held to a cap, and keeps the width dragged", () => {
  it("opens at 55% of a laptop's window", () => {
    expect(PANEL_SHARE).toBe(0.55);
    expect(deskPanelWidth(laptop)).toBe(Math.round(1440 * 0.55));
    expect(panelBox(laptop).width).toBe(792);
    expect(panelRange(laptop).default).toBe(792);
    // 1280 and 1920 alike.
    expect(deskPanelWidth({ width: 1280, height: 800 })).toBe(704);
    expect(deskPanelWidth({ width: 1920, height: 1080 })).toBe(1056);
  });

  it("is never wider than the page's wide measure, so a wide monitor keeps the city a useful band", () => {
    const wide = { width: 2560, height: 1440, top: 48 };
    expect(deskPanelWidth(wide)).toBe(PANEL_MOST);
    expect(wide.width - panelBox(wide).width).toBeGreaterThan(1300);
    const ultra = { width: 3840, height: 1600 };
    expect(deskPanelWidth(ultra)).toBe(PANEL_MOST);
  });

  it("leaves the city at least its least band, and on a window too narrow for both keeps a page's column", () => {
    const small = { width: 1000, height: 700 };
    expect(deskPanelWidth(small)).toBe(1000 - CITY_LEAST);
    const tablet = { width: 700, height: 900 };
    expect(deskPanelWidth(tablet)).toBe(360);
    const narrow = { width: 620, height: 900 };
    expect(deskPanelWidth(narrow)).toBeLessThanOrEqual(360);
    expect(deskPanelWidth(narrow)).toBeGreaterThanOrEqual(Math.round(620 * 0.55) - 1);
  });

  it("opens at the share a host hands it, held to a quarter and three quarters", () => {
    expect(deskPanelWidth({ ...laptop, share: 0.5 })).toBe(720);
    expect(deskPanelWidth({ ...laptop, share: 0.6 })).toBe(864);
    expect(deskPanelWidth({ ...laptop, share: 0.1 })).toBe(360);
    expect(deskPanelWidth({ ...laptop, share: 0.95 })).toBe(1440 - CITY_LEAST);
    expect(deskPanelWidth({ ...laptop, share: Number.NaN })).toBe(792);
  });

  it("takes the width the person dragged it to over the default, within its range", () => {
    expect(panelBox({ ...laptop, panel: 600 }).width).toBe(600);
    expect(panelBox({ ...laptop, panel: 600, share: 0.7 }).width).toBe(600);
    const range = panelRange(laptop);
    expect(panelBox({ ...laptop, panel: 10 }).width).toBe(range.min);
    expect(panelBox({ ...laptop, panel: 5000 }).width).toBe(range.max);
    expect(range.min).toBeLessThan(range.default);
    expect(range.max).toBeGreaterThan(range.default);
  });

  it("leaves a phone's sheet at 40% of the window above it", () => {
    const phone = { width: 390, height: 844, top: 96 };
    expect(panelRange(phone).default).toBe(0.4);
    expect(panelRange({ ...phone, share: 0.7 }).default).toBe(0.4);
  });

  it("is kept for each app on its own, a desk's and a phone's apart", () => {
    expect(panelStoreKey("/a|Wedding", false)).not.toBe(panelStoreKey("/b|Wedding", false));
    expect(panelStoreKey("/a|Wedding", false)).not.toBe(panelStoreKey("/a|Wedding", true));
    expect(panelStoreKey("/a|Wedding", false)).toMatch(/^graview\.one-face\.panel\.desk\./);
  });
});

describe("the page in the panel takes a panel's spacing, and the frame says the gutter in both places", () => {
  it("sets --graview-gutter to a full page's on a full page, and nothing of the panel's", () => {
    expect(frameSpacing(false)).toEqual({ "--graview-gutter": `${GUTTER.page}px` });
    expect(GUTTER.page).toBe(20);
  });

  it("sets a panel's gutter and room above and below in the panel: about 16px, never the full page's 40, 20 and 96", () => {
    const panel = frameSpacing(true);
    expect(panel["--graview-gutter"]).toBe("16px");
    expect(panel["--graview-frame-top"]).toBe("16px");
    const foot = Number.parseFloat(panel["--graview-frame-foot"]!);
    expect(foot).toBeLessThan(96);
    expect(GUTTER.panel).toBeGreaterThanOrEqual(16);
    expect(GUTTER.panel).toBeLessThanOrEqual(20);
  });

  it("moves from a full page's to a panel's step by step as the page narrows, in whole pixels", () => {
    expect(frameSpacingAt(0)).toEqual({ "--graview-gutter": "20px", "--graview-frame-top": "40px", "--graview-frame-foot": "96px" });
    expect(frameSpacingAt(1)).toEqual(frameSpacing(true));
    expect(frameSpacingAt(2)).toEqual(frameSpacing(true));
    const half = frameSpacingAt(0.5);
    expect(half["--graview-frame-top"]).toBe("28px");
    let last = 40;
    for (let a = 0; a <= 1.0001; a += 0.05) {
      const top = Number.parseFloat(frameSpacingAt(a)["--graview-frame-top"]!);
      expect(top).toBeLessThanOrEqual(last);
      expect(last - top).toBeLessThanOrEqual(2);
      last = top;
    }
  });
});

describe("with the city beside a wider panel narrower, the camera at Nearby stands back by as much", () => {
  const record = { type: "record", id: "r", kind: "k" } as const;
  it("leaves the zoom as it was where the panel left the city its old band, and stands back no further than 72%", () => {
    expect(besideShare({ width: 1280, height: 800, panel: 461 })).toBe(1);
    expect(besideShare({ width: 1280, height: 800 })).toBeCloseTo(0.72, 2);
    expect(besideShare({ width: 390, height: 844 })).toBe(1);
    const zooms = levelZooms(record, { width: 1280, height: 800 });
    expect(zooms[1]).toBeLessThan(2.2);
    expect(zooms[1]).toBeGreaterThanOrEqual(1.25);
    expect(zooms[0]).toBeGreaterThan(zooms[1]);
    expect(zooms[1]).toBeGreaterThan(zooms[2]);
    expect(levelZooms(record, { width: 390, height: 844 })[1]).toBe(2);
  });
});
