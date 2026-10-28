import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { toDocument } from "../../src/document/index.js";

/**
 * AN APP SAYS A SUGGESTION IS MADE AT SO MANY VOTES (Roadmap
 * f-suggestion-votes): `tidying.autoAcceptAt` at the top of a document, a
 * whole number from 1, compiled into the app (`app.tidying`), given back by
 * `toDocument`, and refused as a shape when it is anything else. The
 * checker says, as a warning, when the number could never be reached: an
 * app with no policy refuses nobody a suggestion's change, so nobody ever
 * votes.
 */
const RSVP = JSON.parse(readFileSync(new URL("../document/fixtures/rsvp.gdd.json", import.meta.url), "utf8")) as Record<string, unknown>;
const withTidying = (tidying: unknown, base: Record<string, unknown> = RSVP) => ({ ...structuredClone(base), tidying });
const codes = (document: unknown) => compileDocument(document).findings.filter((f) => f.code.includes("tidying-votes")).map((f) => f.code);

describe("tidying.autoAcceptAt", () => {
  it("is compiled into the app and given back by toDocument", () => {
    const result = compileDocument(withTidying({ autoAcceptAt: 3 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.app.tidying).toEqual({ autoAcceptAt: 3 });
    expect(toDocument(result.app).document.tidying).toEqual({ autoAcceptAt: 3 });
    // A document that says nothing of it compiles to an app that says nothing of it.
    const plain = compileDocument(structuredClone(RSVP));
    expect(plain.ok && plain.app.tidying).toBeUndefined();
  });

  it("is a whole number from 1, and nothing else under tidying", () => {
    expect(compileDocument(withTidying({ autoAcceptAt: 0 })).ok).toBe(false);
    expect(compileDocument(withTidying({ autoAcceptAt: 2.5 })).ok).toBe(false);
    expect(compileDocument(withTidying({ autoAcceptAt: "two" })).ok).toBe(false);
    expect(compileDocument(withTidying({ autoAcceptAt: 2, autoDeclineAt: 2 })).ok).toBe(false);
    expect(compileDocument(withTidying({})).ok).toBe(true);
  });

  it("is said to be unreachable, as a warning, in an app with no policy", () => {
    // Without its policy — and without the visitor form the policy keeps, which has no sight to stand on otherwise.
    const { policy: _policy, forms: _forms, ...withoutPolicy } = RSVP;
    expect(RSVP["policy"]).toBeDefined();
    expect(codes(withTidying({ autoAcceptAt: 2 }))).toEqual([]);
    const result = compileDocument(withTidying({ autoAcceptAt: 2 }, withoutPolicy));
    expect(result.ok).toBe(true);
    const warning = result.findings.find((f) => f.code === "check:tidying-votes-unreachable");
    expect(warning).toMatchObject({ severity: "warning", path: "tidying.autoAcceptAt" });
    expect(warning?.message).toContain("has no policy");
    expect(codes(withTidying({}, withoutPolicy))).toEqual([]);
  });
});
