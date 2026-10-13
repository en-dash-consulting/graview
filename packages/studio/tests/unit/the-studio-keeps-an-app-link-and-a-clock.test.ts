import { appLinkField, bindSchema, createSchema, defineApp, defineNode, isAppLinkField, isoDate } from "@graview/core";
import { clockReaders } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/**
 * THE STUDIO KEEPS AN APP-LINK AND A RULE THAT READS THE CLOCK (the ninth
 * walk, W-199). Through the studio and back, the co-op's yard lost two
 * things it had said: its `lease`, another app's address (FR-171), came back
 * as a string with a length and a pattern — drawn as text on every face —
 * and its rules, functions that say `readsTheClock: true` (FR-176), came
 * back without it, so `graview check` stopped saying a host owes them a tick.
 */
const apiary = defineNode("apiary", {
  fields: z.object({ label: z.string(), established: isoDate, lease: appLinkField().optional() }),
  label: (node) => node.label,
});
const schema = createSchema([apiary]);
const { defineInvariant } = bindSchema(schema);
const old = defineInvariant("not-too-old", {
  label: "Not too old",
  scope: { kind: "apiary" },
  readsTheClock: true,
  evaluate: ({ subject, today }) => (today && subject.established < "2000-01-01" && today > "2026-01-01" ? [{ invariant: "not-too-old", subjectId: subject.id, label: subject.label, message: "old", nodeIds: [subject.id], repairs: [] }] : []),
});
const app = defineApp({ name: "Yards", schema, invariants: [old] });

describe("an app-link and a rule that reads the clock, through the studio", () => {
  const studio = createStudio(app);
  const files = studio.files({ schemaVar: "schema" }) as readonly { path: string; contents: string }[];
  const said = (part: string) => files.find((file) => file.path.endsWith(part))!.contents;

  it("writes the app-link back as one, imported", () => {
    expect(said("schema.ts")).toContain("lease: appLinkField().optional(),");
    expect(said("schema.ts")).toMatch(/^import \{ appLinkField, createSchema, defineNode, isoDate, z \} from "@graview\/core";/m);
  });

  it("writes the rule back saying it reads the clock", () => {
    expect(said("invariants.ts")).toContain("readsTheClock: true,");
  });

  it("hands back a declaration whose field is still an app-link and whose rule still reads the clock", () => {
    const back = studio.declaration() as typeof app;
    const lease = (back.schema.definition("apiary").fields as { shape: Record<string, unknown> }).shape["lease"];
    expect(isAppLinkField(lease)).toBe(true);
    expect(clockReaders(back.schema as never, (back.invariants ?? []) as never).rules).toEqual(["not-too-old"]);
  });
});
