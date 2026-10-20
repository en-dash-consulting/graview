import { describe, expect, it, vi } from "vitest";

/**
 * A VIEW OF ONE RECORD IS CHECKED OVER A RECORD (W-242, the thirteenth
 * walk, a camera-trap survey). The survey's contact sheet, a pictures view
 * of one station that reads the detections and the edge saying which camera
 * took each, was run by `graview view check` with no station at all: it
 * said "No station.", which judges nothing. And the picture budget it
 * reported was spent on every detection of the app in the order they were
 * kept, so the station's own photographs were left out for the pictures of
 * cameras it never draws. Now a view of one is run over one record of its
 * kind — the first the seat sees, or `--record <id>` — and the records it
 * reads come linked to its record first, so its pictures are reckoned over
 * what it draws before anything else it is handed.
 */
const fixture = (name: string) => new URL(`../fixtures/survey/${name}`, import.meta.url).pathname;
const args = (...more: string[]) => ["check", fixture("contact-sheet.js"), "--app", fixture("app.mjs"), "--manifest", fixture("contact-sheet.manifest.json"), "--seed", fixture("seed.json"), ...more];

async function said(argv: readonly string[]) {
  const { view } = await import("../../src/cli.js");
  const written: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
  try {
    return { code: await view(argv), text: written.join("") };
  } finally {
    write.mockRestore();
  }
}

describe("graview view check, for a view of one record", () => {
  it("runs over the first record of its kind the seat sees, and says which", async () => {
    const { code, text } = await said(args());
    expect(code).toBe(0);
    expect(text).not.toContain("No station.");
    expect(text).toContain("North ridge");
    expect(text).toContain('over "North ridge" (station:north)');
  });

  it("runs over the record --record names", async () => {
    const { code, text } = await said(args("--record", "station:creek"));
    expect(code).toBe(0);
    expect(text).toContain("Creek bend");
    expect(text).toContain("Creek 10");
    expect(text).not.toContain("- Ridge 1");
  });

  it("refuses a --record that is no record of its kind", async () => {
    const { code, text } = await said(args("--record", "detection:c1"));
    expect(code).toBe(1);
    expect(text).toContain('detection:c1 is no station the seat sees');
  });

  it("reckons the pictures over the record's own before the rest it reads", async () => {
    const { text } = await said(args("--json"));
    const described = JSON.parse(text) as { problems?: readonly { at: string; says: string }[] };
    const left = (described.problems ?? []).filter((one) => one.at === "pictures").map((one) => one.says);
    expect(left.length).toBeGreaterThan(0);
    expect(left.some((says) => says.includes('"Ridge'))).toBe(false);
  });
});
