import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSchema, defineApp, defineNode, z } from "../../src/index.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { editDocument, readDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { deviceScreensOf, LONGEST_SCREEN_LABEL, MOST_DEVICE_SCREENS } from "../../src/devices.js";

/**
 * AN APP DECLARES WHICH PLACES A DEVICE OFFERS AS SCREENS (Roadmap
 * f-device-nav-bar): `devices.screens`, each a place and the word under its
 * press, in order. `graview check` refuses a screen naming a place the app
 * does not have, a word too long for the strip and more screens than the
 * strip holds, each in words with the fix — for a document and a TypeScript
 * app alike — and the edits add, move and take one away.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const withScreens = (screens: unknown): GraviewDocument => ({ ...vendors, devices: { screens } }) as GraviewDocument;
const errorsOf = (document: GraviewDocument) => {
  const compiled = compileDocument(document);
  // What is said of the screens: the vendors fixture has warnings of its own.
  return compiled.findings.filter((finding) => finding.severity === "error" && finding.path.startsWith("devices"));
};

describe("a document's device screens", () => {
  it("compiles, carries them to the app in order, and gives them back as the document said them", () => {
    const screens = [
      { place: "home", label: "Today" },
      { place: "vendors", label: "Vendors" },
      { place: "/categories", label: "Categories" },
    ];
    const compiled = compileDocument(withScreens(screens));
    expect(compiled.ok, JSON.stringify(compiled.ok ? [] : compiled.findings)).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.findings.filter((finding) => finding.code.startsWith("device"))).toEqual([]);
    expect(compiled.app.devices?.screens).toEqual(screens);
    expect(toDocument(compiled.app).document.devices).toEqual({ screens });
    expect(deviceScreensOf(compiled.app).map((screen) => [screen.go, screen.label, screen.from])).toEqual([
      ["/", "Today", "declared"],
      ["/vendors", "Vendors", "declared"],
      ["/categories", "Categories", "declared"],
    ]);
  });

  it("refuses a screen naming a place the app does not have, in words, naming the places it has", () => {
    const [finding] = errorsOf(withScreens([{ place: "venues", label: "Venues" }]));
    expect(finding).toMatchObject({ code: "device-screen-place", path: "devices.screens.0.place" });
    expect(finding!.message).toBe('Device screen 1 ("Venues") names "venues", which is not a place of this app.');
    expect(finding!.fix).toMatch(/^Name one of its places: "home", .*"vendors"/);
    expect(errorsOf(withScreens([{ place: "overview", label: "Map" }]))[0]!.message).toMatch(/names the scene, which moves/);
  });

  it(`refuses a word too long for the strip — more than ${LONGEST_SCREEN_LABEL} characters — with one that fits`, () => {
    const [finding] = errorsOf(withScreens([{ place: "vendors", label: "Everyone we might hire" }]));
    expect(finding).toMatchObject({ code: "device-screen-label", path: "devices.screens.0.label" });
    expect(finding!.message).toBe(`Device screen 1 ("Everyone we might hire") is 22 characters, and the strip has room for ${LONGEST_SCREEN_LABEL} under each press.`);
    expect(finding!.fix).toBe(`Say it in ${LONGEST_SCREEN_LABEL} characters or fewer, like "Everyone we".`);
  });

  it(`refuses more screens than the strip holds — ${MOST_DEVICE_SCREENS} beside Refresh — and one place twice`, () => {
    const five = ["home", "vendors", "categories", "/vendors", "/categories"].map((place, at) => ({ place, label: `Screen ${at + 1}` }));
    const findings = errorsOf(withScreens(five));
    expect(findings.find((finding) => finding.code === "device-screens-too-many")).toMatchObject({
      path: "devices.screens",
      message: `The app offers 5 device screens; the strip holds ${MOST_DEVICE_SCREENS} beside Refresh, each wide enough for a finger.`,
      fix: `Keep the ${MOST_DEVICE_SCREENS} people go to most; the others stay a press away from those.`,
    });
    expect(findings.find((finding) => finding.code === "device-screen-twice")).toMatchObject({ path: "devices.screens.3.place" });
  });

  it("refuses a screen that is not one, by its shape", () => {
    expect(errorsOf(withScreens([{ place: "home", label: "Home", icon: "🏠" }]))[0]).toMatchObject({ code: "unknown-key", path: "devices.screens.0" });
  });
});

describe("a TypeScript app's device screens", () => {
  const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
  const app = (screens: readonly { place: string; label: string }[]) => defineApp({ name: "notes", schema: createSchema([note]), devices: { screens } });

  it("are judged in the same words, at defineApp's path", () => {
    expect(checkApp(app([{ place: "home", label: "Home" }, { place: "notes", label: "Notes" }])).findings.filter((f) => f.code.startsWith("device"))).toEqual([]);
    const findings = checkApp(app([{ place: "jots", label: "A label far too long" }])).findings.filter((f) => f.code.startsWith("device"));
    expect(findings.map((f) => [f.code, f.where])).toEqual([
      ["device-screen-place", "defineApp(…).devices.screens[0].place"],
      ["device-screen-label", "defineApp(…).devices.screens[0].label"],
    ]);
    expect(findings[0]!.fix).toContain('"notes"');
  });
});

describe("an app that declares no screens", () => {
  it("gets them from its jobs: the home, then each job under its name", () => {
    const withJobs = compileDocument({ ...vendors, purpose: { jobs: [{ name: "unbooked", ask: "Who is still unbooked?", kind: "vendor", where: "status != 'booked'" }] } });
    if (!withJobs.ok) throw new Error(JSON.stringify(withJobs.findings));
    expect(deviceScreensOf(withJobs.app).map((screen) => [screen.go, screen.label, screen.from])).toEqual([
      ["/", "Home", "jobs"],
      ["job:unbooked", "Unbooked", "jobs"],
    ]);
  });

  it("else from its bar: the home, then the places it stands", () => {
    const plain = compileDocument(vendors);
    if (!plain.ok) throw new Error(JSON.stringify(plain.findings));
    const screens = deviceScreensOf(plain.app);
    expect(screens[0]).toEqual({ go: "/", label: "Home", from: "bar" });
    expect(screens.map((screen) => screen.go)).toEqual(expect.arrayContaining(["/vendors", "/categories"]));
    expect(screens.every((screen) => screen.from === "bar")).toBe(true);
    expect(screens.length).toBeLessThanOrEqual(MOST_DEVICE_SCREENS);
  });
});

describe("the edits", () => {
  it("add a screen, last or where it is put, judged as the checker judges it", () => {
    const added = editDocument(vendors, [
      { op: "add-device-screen", screen: { place: "vendors", label: "Vendors" } },
      { op: "add-device-screen", screen: { place: "home", label: "Today" }, at: 0 },
    ]);
    if (!added.ok) throw new Error(JSON.stringify(added.findings));
    expect(added.document.devices).toEqual({ screens: [{ place: "home", label: "Today" }, { place: "vendors", label: "Vendors" }] });
    expect(added.said).toEqual(['A device screen, "Vendors", shows "vendors".', 'A device screen, "Today", shows "home", first along the strip.']);
    const wrong = editDocument(vendors, [{ op: "add-device-screen", screen: { place: "venues", label: "Venues" } }]);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.findings[0]).toMatchObject({ code: "device-screen-place", path: "edits.0.screen.place" });
    const long = editDocument(vendors, [{ op: "add-device-screen", screen: { place: "vendors", label: "Everyone we might hire" } }]);
    if (!long.ok) expect(long.findings[0]).toMatchObject({ code: "device-screen-label" });
    expect(long.ok).toBe(false);
  });

  it("reorder a screen and take one away", () => {
    const three = withScreens([
      { place: "home", label: "Today" },
      { place: "vendors", label: "Vendors" },
      { place: "categories", label: "Categories" },
    ]);
    const moved = editDocument(three, [{ op: "move-device-screen", place: "categories", to: 0 }]);
    if (!moved.ok) throw new Error(JSON.stringify(moved.findings));
    expect(moved.document.devices?.screens?.map((screen) => screen.place)).toEqual(["categories", "home", "vendors"]);
    expect(moved.said).toEqual(['The device screen "Categories" is now first along the strip.']);
    const removed = editDocument(moved.document, [{ op: "remove-device-screen", place: "home" }, { op: "remove-device-screen", place: "vendors" }, { op: "remove-device-screen", place: "categories" }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    // With none left, the document says nothing of devices, and a device offers the jobs or the bar again.
    expect(removed.document.devices).toBeUndefined();
    const missing = editDocument(three, [{ op: "remove-device-screen", place: "venues" }]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.findings[0]!.message).toBe('no device screen shows "venues"; the screens show "home", "vendors", "categories"');
  });
});
