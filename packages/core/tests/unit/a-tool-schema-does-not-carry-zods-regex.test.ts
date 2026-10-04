import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mutationToolSchema, toJsonSchema } from "../../src/index.js";

/**
 * A TOOL'S SCHEMA DOES NOT DEPEND ON ZOD'S MINOR VERSION. An agent tool's
 * input schema is on the stability surface, and zod writes its own regex
 * for a string format (`z.email()`, `z.uuid()`, `z.iso.datetime()`) beside
 * the format's name — a regex zod changes between minor versions, so a
 * snapshot of the tools moved when nothing in the app did. A format string
 * says its JSON-schema `format` and no `pattern`; a pattern an author wrote
 * (`z.string().regex(…)`) is the author's, and stays.
 */
const input = z.object({
  email: z.email(),
  link: z.url(),
  ref: z.uuid(),
  at: z.iso.datetime(),
  day: z.iso.date(),
  maybe: z.email().optional(),
  code: z.string().regex(/^[A-Z]{3}$/),
  work: z.email().regex(/@example\.com$/),
});

type Property = { type?: string; format?: string; pattern?: string; allOf?: { pattern?: string }[] };

describe("a tool schema does not carry zod's regex", () => {
  const properties = (toJsonSchema(input)["properties"] ?? {}) as Record<string, Property>;

  it("says a format by its name, with no pattern", () => {
    expect(properties["email"]).toEqual({ type: "string", format: "email" });
    expect(properties["link"]).toEqual({ type: "string", format: "uri" });
    expect(properties["ref"]).toEqual({ type: "string", format: "uuid" });
    expect(properties["at"]).toEqual({ type: "string", format: "date-time" });
    expect(properties["day"]).toEqual({ type: "string", format: "date" });
    expect(properties["maybe"]).toEqual({ type: "string", format: "email" });
  });

  it("keeps the pattern an author wrote", () => {
    expect(properties["code"]).toEqual({ type: "string", pattern: "^[A-Z]{3}$" });
    expect(properties["work"]).toEqual({ type: "string", format: "email", pattern: "@example\\.com$" });
  });

  it("an act's tool schema says the same", () => {
    const tool = mutationToolSchema({ name: "invite", input: z.object({ email: z.email() }) });
    expect((tool.inputSchema["properties"] as Record<string, Property>)["email"]).toEqual({ type: "string", format: "email" });
  });
});
