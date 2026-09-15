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
  const definitions = names.map(({ kind, plural }, index) =>
    defineNode(kind, {
      fields: z.object({ label: z.string() }),
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
    mutations: [...acts, ...(people ? installation.mutations : [])] as never,
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
  }) as unknown as GraviewApp;
}

/** A graph with `per` of each kind the app declares, and the edges between them. */
export function awkwardGraph(app: GraviewApp, per = 3): GraphSnapshot {
  const nodes: Record<string, unknown>[] = [];
  for (const kind of app.schema.kinds as readonly string[]) {
    const definition = app.schema.tryDefinition(kind);
    const shape = (definition?.fields.shape ?? {}) as Record<string, unknown>;
    for (let index = 0; index < per; index += 1) {
      const node: Record<string, unknown> = { id: `${kind}-${index}`, kind, label: `${kind} ${index}` };
      /* Whatever else the kind declares, filled with something parseable. */
      if ("email" in shape) node["email"] = `${kind}${index}@example.test`;
      if ("roles" in shape) node["roles"] = ["helper"];
      if ("status" in shape) node["status"] = kind === "user" ? "active" : "pending";
      nodes.push(node);
    }
  }
  return { nodes: nodes as never, edges: [] };
}
