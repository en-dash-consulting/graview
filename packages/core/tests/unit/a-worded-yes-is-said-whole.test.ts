import { describe, expect, it } from "vitest";
import { defineNode, readableFields, z } from "../../src/index.js";

/**
 * A YES OR NO THE KIND WORDS ITSELF IS SAID WHOLE (W-187). A member's
 * `inducted` is declared as "Inducted" or "Not yet inducted"; every row and
 * card of 280 members read "Inducted: not yet inducted" — the label, then
 * the declared words that already say it, lowered. A bare yes or no still
 * says what it is about: "Explicit: yes".
 */
const member = defineNode("member", {
  fields: z.object({ label: z.string(), inducted: z.boolean(), explicit: z.boolean() }),
  plural: "Members",
  display: { labels: { inducted: "Inducted" }, format: { inducted: (value) => (value ? "Inducted" : "Not yet inducted") } },
});

describe("a yes or no on a glance", () => {
  it("is said in the kind's words, once, when the kind words it; and with its label when it does not", () => {
    const said = readableFields({ id: "m1", kind: "member", label: "Ana", inducted: false, explicit: true }, member, { glance: true });
    expect(said.find((field) => field.key === "inducted")?.alone).toBe("Not yet inducted");
    expect(said.find((field) => field.key === "explicit")?.alone).toBe("Explicit: yes");
  });
});
