import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, DARK, defineApp, defineNode, LIGHT } from "../../src/index.js";
import { checkApp, describeApp } from "../../src/check.js";

/**
 * `graview describe` AND `graview check` AGREE ON HUES. Kinds whose hues sit
 * within 12° of each other read as one color; describe says so, and check
 * asks it out loud from the same answer — never one without the other, and
 * measured round the wheel, so 358° and 2° are as close as they look.
 */
const app = (accents: Record<string, number>) =>
  defineApp({
    name: "Hues",
    schema: createSchema([defineNode("zone", { fields: z.object({ label: z.string() }) }), defineNode("feature", { fields: z.object({ label: z.string() }) })]),
    brand: { name: "Hues", accents, schemes: { dark: DARK, light: LIGHT } },
  });

const said = (accents: Record<string, number>) => ({
  describe: describeApp(app(accents)).includes("will read as one color"),
  check: checkApp(app(accents)).findings.some((f) => f.code === "brand-hues-crowded"),
});

describe("describe and check agree on crowded hues", () => {
  it("both say it of two kinds 4° apart", () => {
    expect(said({ zone: 120, feature: 124 })).toEqual({ describe: true, check: true });
  });

  it("both say it of two kinds either side of 0°", () => {
    expect(said({ zone: 358, feature: 2 })).toEqual({ describe: true, check: true });
  });

  it("neither says it of two kinds far apart", () => {
    expect(said({ zone: 120, feature: 300 })).toEqual({ describe: false, check: false });
  });

  it("names the kinds and their hues in the check's sentence", () => {
    const finding = checkApp(app({ zone: 120, feature: 124 })).findings.find((f) => f.code === "brand-hues-crowded")!;
    expect(finding.where).toBe("brand.accents");
    expect(finding.message).toContain("zone (120°)");
    expect(finding.message).toContain("feature (124°)");
  });
});
