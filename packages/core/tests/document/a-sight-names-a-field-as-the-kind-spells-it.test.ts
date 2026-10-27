import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { DocumentSpec, type GraviewDocument } from "../../src/document/index.js";

/**
 * A SIGHT NAMES A FIELD AS THE KIND SPELLS IT. Fields are one word or
 * camelCase (`startsAt`), so a rule says them bare; a sight's `fields` and
 * `hide` were read as kebab-case names, like a kind's, so a sight could
 * name `title` but never `startsAt` — it was refused "field names are
 * kebab-case" and told to call it "starts-at", a field no kind could have.
 */
const shifts = (sight: Record<string, unknown>): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Shifts",
    kinds: { shift: { label: "{title}", fields: { title: { type: "string" }, startsAt: { type: "datetime" }, payRate: { type: "number" } } } },
    roles: ["staff", "public"],
    acts: { "add-shift": { title: "Add a shift", creates: "shift" } },
    policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["staff"], kinds: ["shift"] }, { roles: ["public"], kinds: ["shift"], ...sight }] },
  }) as unknown as GraviewDocument;

describe("a sight names a field as the kind spells it", () => {
  it("takes a camelCase field in fields", () => {
    expect(DocumentSpec.safeParse(shifts({ fields: ["title", "startsAt"] })).success).toBe(true);
    expect(compileDocument(shifts({ fields: ["title", "startsAt"] })).ok).toBe(true);
  });

  it("takes a camelCase field in hide", () => {
    expect(DocumentSpec.safeParse(shifts({ hide: ["payRate"] })).success).toBe(true);
    expect(compileDocument(shifts({ hide: ["payRate"] })).ok).toBe(true);
  });

  it("still refuses a name no field could have, as a kind's fields do", () => {
    expect(DocumentSpec.safeParse(shifts({ hide: ["pay-rate"] })).success).toBe(false);
    expect(DocumentSpec.safeParse(shifts({ hide: ["id"] })).success).toBe(false);
  });
});
