import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineApp, defineNode, nodeRef, type Policy } from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A SIGHT THAT HIDES A REQUIRED REFERENCE (FR-55). A record whose required
 * field names a record its seat may not see is withheld from that seat
 * whole — clearing the field would serve a record that fails its own
 * declaration. So a role that may see vendors but not categories, where
 * every vendor must name its category, sees no vendor anybody else wrote:
 * a policy that reads as "editors see vendors" and serves them none. The
 * checker says so before anybody stands in front of an empty list.
 */
const category = defineNode("category", { fields: z.object({ label: z.string() }), plural: "Categories" });
const vendor = defineNode("vendor", { fields: z.object({ label: z.string(), category: nodeRef(["category"]) }), plural: "Vendors" });
const quote = defineNode("quote", { fields: z.object({ label: z.string(), vendor: nodeRef(["vendor"]).optional() }), plural: "Quotes" });
const schema = createSchema([category, vendor, quote]);
const policy = (sees: Policy["sees"]): Policy => ({ grants: [{ roles: ["editor", "planner"], mutations: "*" }], sees });
const findings = (sees: Policy["sees"]) => checkApp(defineApp({ name: "Vendors", schema, policy: policy(sees) })).findings.filter((finding) => finding.code === "sight-hides-required-ref");

describe("a sight that hides a required reference", () => {
  it("warns that a role sees none of a kind whose required field names a kind it may not see", () => {
    const said = findings([
      { roles: ["editor"], kinds: ["vendor", "quote"] },
      { roles: ["planner"], kinds: ["vendor", "category", "quote"] },
    ]);
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ severity: "warning", where: "policy.sees" });
    expect(said[0]!.message).toBe(
      "An editor will never see vendor records somebody else wrote, because each names a category (its required field \"category\") they may not see — a record that names one is withheld whole, since clearing a required field would serve it broken.",
    );
  });

  it("says nothing of an optional reference, a role that sees both, or a role that sees neither", () => {
    expect(findings([{ roles: ["editor"], kinds: ["vendor", "category", "quote"] }])).toEqual([]);
    expect(findings([{ roles: ["editor"], kinds: ["quote"] }, { roles: ["planner"], kinds: ["vendor", "category"] }])).toEqual([]);
    // Everybody, by "*": the same question of every role.
    expect(findings([{ roles: "*", kinds: ["vendor", "quote"] }, { roles: ["planner"], kinds: ["category"] }])).toHaveLength(2);
  });
});
