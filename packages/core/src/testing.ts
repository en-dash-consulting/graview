import { z } from "zod";
import { defineApp, type GraviewApp } from "./app.js";
import { declareInstallation } from "./installation.js";
import { bindSchema } from "./bind.js";
import { nodeRef } from "./mutations/node-ref.js";
import { createSchema } from "./schema/schema.js";
import { defineNode } from "./schema/define-node.js";
import type { GraphSnapshot } from "./graph/types.js";

/**
 * A DECLARATION BUILT TO BE AWKWARD.
 *
 * The framework derives an interface from a declaration, so the framework's
 * correctness IS the derivation's correctness — and the derivation was only
 * ever tested against the three apps in this repository, all of which have
 * four or five kinds, short plurals, no chain worth the name, and people who
 * are not part of the domain. A second product with ten kinds found thirty
 * of the consequences in an afternoon, and every one of them was the same
 * sentence: this holds for the examples and stops just past them.
 *
 * So: a generator of the shapes the examples never had, and properties
 * asserted over the derivations rather than screenshots taken of three apps.
 * It ships rather than hiding in a test directory because a PRODUCT wants it
 * too — a lens claiming to be reusable can be built against this, and an
 * app's own views can be held to the same properties as the framework's.
 *
 * Nothing here is random. A generated declaration is a pure function of its
 * options, so a property that fails names a shape rather than a seed.
 */

export interface AwkwardOptions {
  /** How many domain kinds. The examples have four; real domains have ten. */
  readonly kinds?: number;
  /**
   * Whether each kind's creating act needs the one before it — the chain
   * that makes a blank installation a queue rather than a menu.
   */
  readonly chain?: boolean;
  /** Include the installation's kinds, and an edge from the domain to a person. */
  readonly people?: boolean;
  /** A kind nothing creates: the catalogue that arrives with the data. */
  readonly unreachable?: boolean;
  /** Plural length. Long ones are what a district row actually has to hold. */
  readonly plurals?: "short" | "long";
  /**
   * How many fields each kind carries, its name among them. The examples'
   * records have two to five; a car for sale has sixteen, and a record page
   * that stopped at ten dropped its price without a word.
   */
  readonly fields?: number;
}

/* Plurals of the length a real domain has. The district row breaks on these
   and never on "Jobs", which is why the examples never found it. */
const LONG: readonly (readonly [string, string])[] = [
  ["responsibility", "Responsibilities"],
  ["consideration", "Considerations"],
  ["practicality", "Practicalities"],
  ["arrangement", "Arrangements"],
  ["requirement", "Requirements"],
  ["observation", "Observations"],
  ["preparation", "Preparations"],
  ["description", "Descriptions"],
  ["measurement", "Measurements"],
  ["instruction", "Instructions"],
  ["expectation", "Expectations"],
  ["certification", "Certifications"],
  ["qualification", "Qualifications"],
  ["recommendation", "Recommendations"],
];
const SHORT: readonly (readonly [string, string])[] = [
  ["zone", "Zones"],
  ["bed", "Beds"],
  ["tool", "Tools"],
  ["job", "Jobs"],
  ["note", "Notes"],
  ["run", "Runs"],
  ["plot", "Plots"],
  ["crew", "Crews"],
  ["kit", "Kits"],
  ["bay", "Bays"],
  ["dock", "Docks"],
  ["lane", "Lanes"],
  ["yard", "Yards"],
  ["gate", "Gates"],
];

/** A name for kind number `index`, and the plural a district has to draw. */
function named(index: number, plurals: "short" | "long"): { kind: string; plural: string } {
  const words = plurals === "long" ? LONG : SHORT;
  const [singular, plural] = words[index % words.length]!;
  const suffix = index >= words.length ? String(index) : "";
  return { kind: `${singular}${suffix}`, plural: `${plural}${suffix}` };
}

/**
 * An app of the shape a real product has: several kinds, a chain between
 * them, people in the domain, and a kind nothing can make.
 */
export function awkwardApp(options: AwkwardOptions = {}): GraviewApp {
  const count = Math.max(1, options.kinds ?? 10);
  const plurals = options.plurals ?? "long";
  const people = options.people ?? true;
  const installation = declareInstallation({ roles: ["keeper", "helper"], admin: "keeper", required: true });

  const names = Array.from({ length: count }, (_, index) => named(index, plurals));
  // Past the name, each a fact of its own: "detail-1", "detail-2", …
  const details = Object.fromEntries(Array.from({ length: Math.max(0, (options.fields ?? 1) - 1) }, (_, index) => [`detail${index + 1}`, z.string()]));
  const definitions = names.map(({ kind, plural }, index) =>
    defineNode(kind, {
      fields: z.object({ label: z.string(), ...details }),
      plural,
      ...(index === 0 && people
        ? {
            edges: {
              "kept-by": { to: ["user"], description: "who looks after it", inverse: "what they keep" },
            },
          }
        : {}),
    }),
  );
  const catalogue = options.unreachable
    ? [defineNode("almanac", { fields: z.object({ label: z.string() }), plural: "Almanacs" })]
    : [];

  const schema = createSchema([
    ...definitions,
    ...catalogue,
    ...(people ? [...installation.kinds] : []),
  ] as never);
  const { defineMutation } = bindSchema(schema as never);

  const acts = names.map(({ kind }, index) => {
    const needs = options.chain !== false && index > 0 ? names[index - 1]!.kind : undefined;
    return defineMutation(`add-${kind}`, {
      title: `Add ${kind}`,
      /* Well-formed in every way but its SHAPE: a fixture that trips the
         checker on its own carelessness proves nothing about the shapes it
         exists to test. */
      description: `Adds ${kind} to the graph.`,
      creates: [kind],
      /* A real chain: the argument is a nodeRef, which is what makes the
         act unofferable until something exists to point it at. */
      input: needs
        ? z.object({ label: z.string(), [`${needs}Id`]: nodeRef([needs]) })
        : z.object({ label: z.string() }),
      apply(ctx: { freshId: (from: string, kind: string) => string; addNode: (node: unknown) => void }, args: Record<string, unknown>) {
        ctx.addNode({ id: ctx.freshId(String(args["label"]), kind), kind, label: args["label"] });
      },
    } as never);
  });

  return defineApp({
    name: "awkward",
    schema: schema as never,
    mutations: [...acts, ...(people ? installation.mutations : [])],
    ...(people
      ? {
          modules: installation.modules,
          policy: installation.withPolicy({
            roles: ["keeper", "helper"],
            grants: [
              {
                roles: ["keeper"],
                mutations: "*",
                describe: "The keeper keeps all of it.",
              },
            ],
          }),
        }
      : {}),
  });
}

/** A graph with `per` of each kind the app declares, and the edges between them. */
/**
 * A VALUE THAT PARSES, found rather than known.
 *
 * The first version of this filled three field names it had met — `email`,
 * `roles`, `status` — which was enough for the fixtures it was written
 * beside and enough for nothing else. The first real product to reach for
 * it got `zone 0 does not match what zone declares`, because a zone has a
 * surface and nobody had told this about surfaces.
 *
 * So it asks. Each candidate is offered to the field's own schema and the
 * first one accepted is used, which means a kind can declare whatever it
 * likes — an enum, a date, a tuple of numbers — without this having to
 * have heard of it. `undefined` goes first so an optional field stays
 * unset: the awkward graph should be the SPARSEST one that parses, not the
 * fullest.
 */
function parseable(field: unknown, hint: string): { found: boolean; value?: unknown } {
  const schema = field as { safeParse?: (value: unknown) => { success: boolean }; def?: { entries?: unknown } };
  if (typeof schema?.safeParse !== "function") return { found: false };
  const entries = schema.def?.entries;
  const enumerated = entries && typeof entries === "object" ? Object.values(entries as Record<string, unknown>) : [];
  const candidates: unknown[] = [
    undefined,
    ...enumerated,
    hint,
    "2026-05-04",
    `${hint}@example.test`,
    1,
    0,
    true,
    [],
    [hint],
    {},
    { x: 0.5, y: 0.5 },
    null,
  ];
  for (const candidate of candidates) {
    if (schema.safeParse(candidate).success) return { found: true, value: candidate };
  }
  return { found: false };
}

/**
 * Three of every kind, joined to nothing, every field filled with the least
 * interesting value that parses.
 *
 * It is the state a real installation passes through on its second
 * afternoon — some ground named, some concerns raised, none of it joined up
 * — and it is the state that breaks anything written while looking at a
 * finished graph.
 */
export interface AwkwardGraphOptions {
  readonly per?: number;
  /**
   * Values for fields this cannot guess — a discriminated union, a tuple
   * with a meaning. Keyed `kind.field`, and each is offered to the field's
   * own schema like any other candidate, so a wrong one is a refusal here
   * rather than a mystery three layers down.
   */
  readonly fill?: Readonly<Record<string, unknown>>;
}

export function awkwardGraph(app: GraviewApp, options: number | AwkwardGraphOptions = {}): GraphSnapshot {
  const { per = 3, fill = {} } = typeof options === "number" ? { per: options, fill: {} } : options;
  const nodes: Record<string, unknown>[] = [];
  for (const kind of app.schema.kinds as readonly string[]) {
    const definition = app.schema.tryDefinition(kind);
    const shape = (definition?.fields.shape ?? {}) as Record<string, unknown>;
    for (let index = 0; index < per; index += 1) {
      const node: Record<string, unknown> = { id: `${kind}-${index}`, kind, label: `${kind} ${index}` };
      for (const [name, field] of Object.entries(shape)) {
        if (name === "id" || name === "kind" || name === "label") continue;
        const given = fill[`${kind}.${name}`];
        const answer =
          given === undefined
            ? parseable(field, `${kind}-${index}`)
            : (field as { safeParse: (value: unknown) => { success: boolean } }).safeParse(given).success
              ? { found: true, value: given }
              : { found: false };
        if (!answer.found) {
          throw new Error(
            given === undefined
              ? `awkwardGraph cannot fill ${kind}.${name}: none of the values it knows how to offer were accepted. ` +
                `Pass one it cannot guess as fill: { "${kind}.${name}": … }.`
              : `awkwardGraph was given a fill for ${kind}.${name} that ${kind} does not accept.`,
          );
        }
        if (answer.value !== undefined) node[name] = answer.value;
      }
      nodes.push(node);
    }
  }
  return { nodes: nodes as never, edges: [] };
}
