import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertReadable, FORMATS, formatStamp, FRAMEWORK_VERSION, NewerFormatError, upgradeOp, upgradeSnapshot, type Operation } from "../../src/index.js";

/**
 * FR-31. What a version writes says what wrote it; a reader meeting a newer
 * format says so instead of folding it; an older format is brought up.
 */
const fixture = JSON.parse(readFileSync(new URL("../fixtures/formats/format-1.json", import.meta.url), "utf8")) as {
  snapshot: Parameters<typeof upgradeSnapshot>[0];
  ops: Operation[];
};

describe("stored formats carry their version", () => {
  it("a stamp names the framework that wrote it and every format", () => {
    expect(formatStamp()).toEqual({ framework: FRAMEWORK_VERSION, formats: { snapshot: FORMATS.snapshot, op: FORMATS.op } });
  });

  it("what 0.1.0 wrote, unstamped, reads as format 1 and comes up unchanged", () => {
    expect(() => assertReadable(null)).not.toThrow();
    expect(() => assertReadable({ framework: "0.1.0" })).not.toThrow();
    expect(upgradeSnapshot(fixture.snapshot, 1)).toEqual(fixture.snapshot);
    for (const op of fixture.ops) expect(upgradeOp(op, 1)).toEqual(op);
  });

  it("a newer format is reported, not folded", () => {
    const newer = { framework: "9.0.0", formats: { snapshot: FORMATS.snapshot + 1, op: FORMATS.op } };
    expect(() => assertReadable(newer)).toThrow(NewerFormatError);
    expect(() => assertReadable(newer)).toThrow(/newer format \(2, written by @graview 9\.0\.0\).*Refold it from the log/);
    expect(() => upgradeSnapshot(fixture.snapshot, FORMATS.snapshot + 1)).toThrow(NewerFormatError);
    expect(() => upgradeOp(fixture.ops[0]!, FORMATS.op + 1)).toThrow(NewerFormatError);
  });
});
