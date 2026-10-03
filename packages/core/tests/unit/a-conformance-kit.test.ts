import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANNOUNCED, conformance, FIXTURES, THIS_BUILD } from "../../src/conformance/index.js";

/**
 * FR-32. A host proves a new version reads, compiles and derives what the
 * last one did by running the framework's own fixtures against it.
 */
describe("the conformance kit", () => {
  it("passes on the version that ships it", () => {
    const result = conformance();
    expect(result.differences).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(FIXTURES.length);
    expect(FIXTURES.some((fixture) => fixture.kind === "document")).toBe(true);
    expect(FIXTURES.some((fixture) => fixture.kind === "log")).toBe(true);
  });

  it("lists, by fixture id, what a deliberately broken build makes differently", () => {
    const broken = conformance({
      // A fold that hashes differently (as a changed snapshot shape would)…
      snapshotHash: (snapshot) => `${THIS_BUILD.snapshotHash(snapshot)}-changed`,
      // …an act whose argument was renamed…
      toolSchemas: (app) => {
        const tools = { ...THIS_BUILD.toolSchemas(app) } as Record<string, { properties?: Record<string, unknown> }>;
        const quote = tools["set-quote"];
        if (quote?.properties?.["quote"]) tools["set-quote"] = { ...quote, properties: { ...quote.properties, price: quote.properties["quote"], quote: undefined } };
        return tools;
      },
      // …and a check that gives one more finding.
      checkCodes: (app) => [...THIS_BUILD.checkCodes(app), "warning:new-finding"].sort(),
    });
    expect(broken.ok).toBe(false);
    const said = broken.differences.map((difference) => `${difference.fixture} ${difference.what}`);
    expect(said).toContain("log:vendors-booked-then-taken-back hash");
    expect(said).toContain("log:two-lines-made-and-done hash");
    expect(said).toContain("document:vendors#set-quote tools");
    expect(said).toContain("document:vendors findings");
    expect(said).toContain("document:two-lines findings");
  });

  it("is append-only: a recorded fixture is as recorded, unless a difference is announced with its version", () => {
    const lock = JSON.parse(readFileSync(new URL("../conformance.lock.json", import.meta.url), "utf8")) as Record<string, string>;
    const canonical = (value: unknown): string =>
      Array.isArray(value)
        ? `[${value.map(canonical).join(",")}]`
        : value && typeof value === "object"
          ? `{${Object.keys(value as object).filter((key) => (value as Record<string, unknown>)[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
          : JSON.stringify(value);
    for (const [id, hash] of Object.entries(lock)) {
      const fixture = FIXTURES.find((one) => one.id === id);
      expect(fixture, `${id} was recorded and is gone`).toBeDefined();
      const now = `sha256:${createHash("sha256").update(canonical(fixture)).digest("hex")}`;
      if (now === hash) continue;
      const announced = ANNOUNCED.find((one) => one.fixture === id);
      expect(announced, `${id} changed with no announcement`).toBeDefined();
      expect(announced!.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
    for (const fixture of FIXTURES) expect(lock[fixture.id], `${fixture.id} is not in the lock`).toBeDefined();
  });
});
