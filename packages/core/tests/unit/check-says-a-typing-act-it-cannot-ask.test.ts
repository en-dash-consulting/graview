import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { bindSchema, createSchema, defineApp, defineNode, z } from "../../src/index.js";

/**
 * CHECK SAYS A TYPING ACT IT CANNOT ASK. A keystroke into a field typed
 * together rides an act that writes it only where that act would run on the
 * record, and a TypeScript act with no `allowedOn` is asked by running it
 * with its subject and the field's value alone. One that needs another
 * argument is run without it, so a rule that reads that argument is never
 * asked: `typing-act-without-allowed-on` warns, naming the act, the field
 * and the arguments, and says to declare `allowedOn`.
 */
const note = defineNode("note", {
  fields: z.object({ title: z.string(), body: z.string().max(5000).optional() }),
  plural: "Notes",
});
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const amend = (name: string, extra: Record<string, z.ZodType>, allowedOn?: () => boolean) =>
  defineMutation(name, {
    title: name,
    subject: { kinds: ["note"], arg: "id" },
    writes: ["body"],
    input: z.object({ id: z.string(), body: z.string().max(5000), ...extra }),
    ...(allowedOn ? { allowedOn } : {}),
    apply(ctx, args) {
      ctx.patchNode(args.id, { body: args.body });
    },
  });
const findings = (...mutations: ReturnType<typeof amend>[]) =>
  checkApp(defineApp({ name: "Notes", schema, mutations } as never)).findings.filter((one) => one.code === "typing-act-without-allowed-on");

describe("an act typing rides", () => {
  it("is warned of where it needs an argument a keystroke never gives it and declares no allowedOn", () => {
    const found = findings(amend("amend-with-reason", { reason: z.string() }));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "warning", where: "amend-with-reason" });
    expect(found[0]!.message).toContain('"reason"');
    expect(found[0]!.message).toContain("body");
    expect(found[0]!.fix).toContain("allowedOn");
  });

  it("is not warned of where it needs nothing else, takes the rest as optional, or says allowedOn", () => {
    expect(findings(amend("amend", {}))).toEqual([]);
    expect(findings(amend("amend-maybe", { reason: z.string().optional() }))).toEqual([]);
    expect(findings(amend("amend-said", { reason: z.string() }, () => true))).toEqual([]);
  });
});
