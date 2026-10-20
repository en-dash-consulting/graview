import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, z } from "../../src/index.js";

/**
 * A DESCRIBE IN CODE THAT RETURNS A TEMPLATE IS WARNED OF (carried from the
 * twelfth walk, a film society). One sentence of the walk's app said
 * `{startsAt | datetime}` to a person, braces and all: template filters
 * belong to a document's strings, and a describe written in code is shown
 * as it returns. The watch caught it on the page; `graview check` said
 * nothing. Now it warns, naming the kind (or the act) and the fix.
 */
type Screening = { id: string; title: string; startsAt: string };
const appOf = (describe: (node: Screening) => string, actSays?: (args: { id: string; startsAt: string }) => string) => {
  const screening = defineNode("screening", {
    fields: z.object({ title: z.string(), startsAt: z.string() }),
    label: (node) => node.title,
    describe,
  });
  const schema = createSchema([screening]);
  const { defineMutation } = bindSchema(schema);
  const mutations = actSays
    ? [
        defineMutation("move-screening", {
          title: "Move",
          description: "Move a screening",
          input: z.object({ id: nodeRef(["screening"]), startsAt: z.string() }),
          describe: actSays,
          apply(ctx, args) {
            ctx.patchNode(args.id, { startsAt: args.startsAt });
          },
        }),
      ]
    : [];
  return defineApp({ name: "Film society", schema, mutations } as never);
};
const warned = (app: unknown) => checkApp(app as never).findings.filter((one) => one.code === "describe-template-in-code");

describe("a describe written in code", () => {
  it("is warned of when it returns a {field | filter} template, naming the kind and the fix", () => {
    const found = warned(appOf((node) => `${node.title} at {startsAt | datetime}`));
    expect(found.map((one) => [one.severity, one.where])).toEqual([["warning", 'defineNode("screening").describe']]);
    expect(found[0]!.message).toContain('"{startsAt | datetime}"');
    expect(found[0]!.fix).toContain("momentAsRead(node.startsAt)");
  });

  it("is warned of when it returns a bare {field} of its kind", () => {
    expect(warned(appOf(() => "{title}, showing")).map((one) => one.where)).toEqual(['defineNode("screening").describe']);
  });

  it("is warned of on an act's describe, at the act", () => {
    const found = warned(appOf((node) => node.title, (args) => `Move ${args.id} to {startsAt}`));
    expect(found.map((one) => one.where)).toEqual(['defineMutation("move-screening").describe']);
    expect(found[0]!.fix).toContain("args.startsAt");
  });

  it("is not warned of when it says the value in code, or destructures it", () => {
    expect(warned(appOf(({ title, startsAt }) => `${title} at ${startsAt}`))).toEqual([]);
    expect(warned(appOf((node) => `${node.title} {sic}`))).toEqual([]);
  });
});
