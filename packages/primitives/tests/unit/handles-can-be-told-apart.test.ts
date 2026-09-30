import { describe, expect, it } from "vitest";
import { handles } from "../../src/index.js";

/**
 * A QUICK-SELECT CHIP IS A HANDLE, AND TWO HANDLES THAT READ THE SAME ARE ONE.
 *
 * A dealership's customer has three test drives, each named for the
 * customer and the vehicle. Cut at eighteen characters every chip read
 * "Wei Haddad in the…", and each button was named that too.
 */
describe("the quick-select handles", () => {
  const drives = [
    "Wei Haddad in the 2017 Jeep Wrangler Rubicon 392",
    "Wei Haddad in the 2027 Chevrolet Equinox LT",
    "Wei Haddad in the 2027 Honda Accord Touring 2.0T",
  ];

  it("cuts the words they share rather than the words that tell them apart", () => {
    const shown = handles(drives);
    expect(new Set(shown).size).toBe(3);
    expect(shown[0]).toMatch(/^…2017 Jeep/);
    expect(shown[1]).toMatch(/^…2027 Chevrolet/);
    for (const handle of shown) expect(handle.length).toBeLessThanOrEqual(18);
  });

  it("leaves names that fit, or that are already told apart, as they were", () => {
    expect(handles(["Priya Raman", "Tomás Herrera"])).toEqual(["Priya Raman", "Tomás Herrera"]);
    expect(handles(["Main Street showroom", "Pre-owned lot on Route 9"])).toEqual(["Main Street showr…", "Pre-owned lot on…"]);
  });
});
