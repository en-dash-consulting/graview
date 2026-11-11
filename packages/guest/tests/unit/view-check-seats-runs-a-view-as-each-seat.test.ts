import { describe, expect, it, vi } from "vitest";

/*
 * `graview view check --seats` (Roadmap f-view-check-draws-for-each-seat):
 * the view run once as each seat the app's policy names, or the ones
 * listed, each said in a line. The survey declares no policy, so every
 * seat sees all of it, and its one seat is the owner.
 */
const fixture = (name: string) => new URL(`../fixtures/survey/${name}`, import.meta.url).pathname;
const args = (...more: string[]) => ["check", fixture("contact-sheet.js"), "--app", fixture("app.mjs"), "--manifest", fixture("contact-sheet.manifest.json"), "--seed", fixture("seed.json"), "--no-presses", ...more];

async function said(argv: readonly string[]) {
  const { view } = await import("../../src/cli.js");
  const written: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
  const error = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
  try {
    return { code: await view(argv), text: written.join("") };
  } finally {
    write.mockRestore();
    error.mockRestore();
  }
}

describe("graview view check --seats", () => {
  it("runs the view as each seat the app's policy names, and says each in a line", async () => {
    const { code, text } = await said(args("--seats"));
    expect(code).toBe(0);
    expect(text).toMatch(/^owner: drew \d+ parts?\.\n$/);
  });

  it("says each seat as JSON, without the run behind it", async () => {
    const { code, text } = await said(args("--seats", "--json"));
    expect(code).toBe(0);
    const checked = JSON.parse(text) as { ok: boolean; seats: { seat: string; outcome: string; result?: unknown }[] };
    expect(checked.ok).toBe(true);
    expect(checked.seats.map((one) => [one.seat, one.outcome, one.result])).toEqual([["owner", "drew", undefined]]);
  });

  it("refuses a seat the app does not have, naming the ones it has", async () => {
    const { code, text } = await said(args("--seats", "visitor"));
    expect(code).toBe(1);
    expect(text).toContain('"visitor" is no seat of this app; its seats are owner.');
  });
});
