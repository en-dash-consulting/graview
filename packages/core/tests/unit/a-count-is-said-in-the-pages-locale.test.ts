import { afterEach, describe, expect, it } from "vitest";
import { counted, createSchema, defineNode, sayIn, z } from "../../src/index.js";

/**
 * A COUNT IS SAID IN THE PAGE'S LOCALE (the ninth walk, W-198). FR-178 said
 * every figure a person reads through `Intl`, and the one sentence every
 * face counts with — the home's "7540 inspections", the map's district
 * "7347 inspections → 299 hives", a list's head, a static page — wrote the
 * number as JavaScript prints it. No example has a kind past a thousand.
 */
const inspection = defineNode("inspection", { fields: z.object({ label: z.string() }), plural: "Inspections" });
const schema = createSchema([inspection]);

afterEach(() => sayIn({}));

describe("a count", () => {
  it("is said with the locale's separators", () => {
    expect(counted(schema, "inspection", 7540)).toBe("7,540 inspections");
    expect(counted(schema, "inspection", 1)).toBe("1 inspection");
    sayIn({ app: "de-DE" });
    expect(counted(schema, "inspection", 7540)).toBe("7.540 inspections");
  });
});
