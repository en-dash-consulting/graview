import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  declareInstallation,
  defineApp,
  defineInvariant,
  defineNode,
  type AnyMutationDefinition,
  type AnyNodeDefinition,
  type AnySchema,
  type GraviewApp,
  type Schema,
} from "../../src/index.js";

/**
 * A TYPED APP FITS WHEREVER AN APP GOES — held at the type level, now that
 * the tests are typechecked.
 *
 * A consumer's TypeScript met four walls the framework's own code got past
 * with `as never` and `as unknown as GraviewApp<AnySchema>`: the
 * installation's acts would not spread into an app's mutations; a typed
 * app was not an app (`GraviewApp<S>` would not widen, because an act's
 * `apply` and `describe` and a rule's `evaluate` were function-typed
 * properties, checked contravariantly); `schema.definition(kind)` on a
 * schema whose kinds are only `string` was `never`; and an unbound
 * `defineInvariant` handed its rule a `never` subject. None needs a cast now.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string(), beds: z.number() }) });
const installation = declareInstallation({ roles: ["keeper", "visitor"], admin: "keeper" });
const schema = createSchema([plot, ...installation.kinds]);
const { defineMutation } = bindSchema(schema);
const sow = defineMutation("sow", { title: "Sow", input: z.object({}), describe: () => "Sow", apply() {} });

describe("a typed app fits where an app goes", () => {
  it("spreads the installation's acts into a typed app's mutations without a cast", () => {
    const app = defineApp({ name: "plots", schema, mutations: [sow, ...installation.mutations] });
    expectTypeOf(app).toEqualTypeOf<GraviewApp<typeof schema>>();
    expectTypeOf(installation.mutations).toMatchTypeOf<readonly AnyMutationDefinition<typeof schema>[]>();
  });

  it("widens a typed app to GraviewApp<AnySchema>, and takes an AnySchema app as it is", () => {
    const typed = defineApp({ name: "plots", schema, mutations: [sow] });
    const takes = (app: GraviewApp<AnySchema>) => app.name;
    expectTypeOf(takes).toBeCallableWith(typed);
    const wide: GraviewApp<AnySchema> = typed;
    expectTypeOf(takes).toBeCallableWith(wide);
  });

  it("names a kind's definition on any schema, and only a declared kind on a typed one", () => {
    expectTypeOf(schema.definition("plot").kind).toEqualTypeOf<"plot">();
    const any: AnySchema = schema;
    expectTypeOf(any.definition("plot")).not.toBeNever();
    expectTypeOf(any.definition("plot")).toMatchTypeOf<AnyNodeDefinition>();
    expectTypeOf<Schema>().toEqualTypeOf<AnySchema>();
    // @ts-expect-error a typed schema has no kind called "dance".
    void (() => schema.definition("dance"));
  });

  it("hands an unbound rule a subject of its kind, not never", () => {
    defineInvariant("every-plot-named", {
      scope: { kind: "plot" },
      evaluate: ({ subject }) => {
        expectTypeOf(subject).not.toBeNever();
        expectTypeOf(subject.kind).toEqualTypeOf<"plot">();
        expectTypeOf(subject.id).toEqualTypeOf<string>();
        return [];
      },
    });
    // Bound, the subject is the kind's own node.
    bindSchema(schema).defineInvariant("beds-counted", {
      scope: { kind: "plot" },
      evaluate: ({ subject }) => {
        expectTypeOf(subject.beds).toEqualTypeOf<number>();
        return [];
      },
    });
  });
});
