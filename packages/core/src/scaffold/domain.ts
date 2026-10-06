import { type Ids, escapeString, escapeTemplate } from "./names.js";

/*
 * THE DECLARATION A NEW PROJECT STARTS WITH: one kind, its acts, its rule,
 * its brand, the app that holds them, and the test that proves they hold.
 */

/* --------------------------------------------------------------- domain */

export function schemaTs(ids: Ids): string {
  return `import { createSchema, defineNode } from "@graview/core";
import { z } from "@graview/core";

/**
 * The first kind. Model one thing well before modelling the domain: the
 * loop that matters on day one is declare → \`graview check\` → look at it →
 * declare more.
 */
export const ${ids.kindVar} = defineNode("${ids.kind}", {
  description: "${ids.ASpoken}: something ${escapeString(ids.name)} keeps track of.",
  fields: z.object({
    // A name, bounded: a model filling it writes a name, not a paragraph.
    label: z.string().min(1).max(60),
    status: z.enum(["open", "closed"]),
  }),
  edges: {
    // An edge to a kind nobody declared is a typecheck failure, not a
    // runtime surprise.
    // One edge, two readings: each end is captioned in its own words.
    "depends-on": {
      to: ["${ids.kind}"],
      description: "what has to be closed first",
      inverse: "what is waiting on this",
    },
  },
  plural: "${ids.Plural}",
  label: (node) => node.label,
  /*
   * The horizon: a closed ${ids.spoken} leaves the counts but never the graph.
   * Districts say "+N past" instead of drowning, and \`past=1\` widens the view.
   */
  lifecycle: { field: "status", retired: ["closed"] },
});

export const ${ids.schemaVar} = createSchema([${ids.kindVar}]);
export type ${ids.SchemaType} = typeof ${ids.schemaVar};
`;
}

export function mutationsTs(ids: Ids): string {
  return `import { bindSchema, nodeRef, type GraphReader } from "@graview/core";
import { z } from "@graview/core";
import { ${ids.schemaVar} } from "./schema.js";

const { defineMutation } = bindSchema(${ids.schemaVar});

type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;
const nameOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;
};

/**
 * Every change is a named act. The title is the label in the strip and the
 * instruction in an agent's tool schema, so an opaque one costs twice.
 */

export const add${ids.KindPascal} = defineMutation("add-${ids.kind}", {
  title: "Add ${ids.aSpoken}",
  description: "Bring a new ${ids.spoken} into ${escapeString(ids.name)}.",
  // Says what it brings into existence: an EMPTY district offers this act
  // as its own beginning, which is the whole onboarding of a blank graph.
  creates: ["${ids.kind}"],
  input: z.object({ label: z.string().min(1).max(60) }),
  describe: (args) => \`Add \${args.label}\`,
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "${ids.kind}"),
      kind: "${ids.kind}",
      label: args.label,
      status: "open",
    });
  },
});

export const link${ids.KindPascal} = defineMutation("link-${ids.kind}", {
  title: "Depends on",
  description: "Say one ${ids.spoken} has to be closed before another.",
  subject: { kinds: ["${ids.kind}"], arg: "id" },
  // Names the edge kind it makes: the drawn line becomes selectable, and
  // the act is offered from either end.
  connects: ["depends-on"],
  input: z.object({ id: nodeRef(["${ids.kind}"]), dependsOn: nodeRef(["${ids.kind}"]) }),
  describe: (args, graph) =>
    \`\${nameOf(graph as Reader, args.id)} depends on \${nameOf(graph as Reader, args.dependsOn)}\`,
  apply(ctx, args) {
    if (args.id === args.dependsOn) return;
    ctx.addEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});

export const unlink${ids.KindPascal} = defineMutation("unlink-${ids.kind}", {
  title: "No longer depends on",
  description: "Take back a dependency between two ${ids.spokenPlural}.",
  subject: { kinds: ["${ids.kind}"], arg: "id" },
  // Names the edge kind it breaks: a relation you can make but never unmake
  // is a check warning, and a drawn line with nothing to sever hides the act.
  severs: ["depends-on"],
  input: z.object({ id: nodeRef(["${ids.kind}"]), dependsOn: nodeRef(["${ids.kind}"]) }),
  describe: (args, graph) =>
    \`\${nameOf(graph as Reader, args.id)} no longer depends on \${nameOf(graph as Reader, args.dependsOn)}\`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});

export const close${ids.KindPascal} = defineMutation("close-${ids.kind}", {
  title: "Close it",
  description: "Mark ${ids.aSpoken} closed. It leaves the picture, never the record.",
  subject: { kinds: ["${ids.kind}"], arg: "id" },
  // Writes the status without asking for it, and says so.
  writes: ["status"],
  input: z.object({ id: nodeRef(["${ids.kind}"]) }),
  describe: (args, graph) => \`Close \${nameOf(graph as Reader, args.id)}\`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "closed" });
  },
});

export const mutations = [add${ids.KindPascal}, link${ids.KindPascal}, unlink${ids.KindPascal}, close${ids.KindPascal}];
`;
}

export function invariantsTs(ids: Ids): string {
  return `import { bindSchema, type Violation } from "@graview/core";
import { ${ids.schemaVar} } from "./schema.js";

const { defineInvariant } = bindSchema(${ids.schemaVar});

/**
 * The first rule, and the repair it names. A rule that only complains is
 * half a rule: the repairs below become one-click fixes in the interface
 * and legal moves for an agent, so name the mutation that resolves it.
 *
 * It judges the OPEN ${ids.spoken}: a closed one is behind the horizon, and
 * the horizon is exactly the promise that what is closed stops asking for
 * attention. What is wrong here is that something closed still leans on
 * something open.
 */
export const closedInOrder = defineInvariant("closed-in-order", {
  label: "Closed in order",
  description: "Nothing closed may still depend on an open ${ids.spoken}.",
  scope: { kind: "${ids.kind}" },
  repairs: ["close-${ids.kind}"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.status === "closed") return [];
    const closed = graph
      .in(subject.id, "depends-on")
      .filter((other) => (other as { status: string }).status === "closed");
    if (closed.length === 0) return [];
    return [
      {
        invariant: "closed-in-order",
        subjectId: subject.id,
        label: subject.label,
        message: \`\${subject.label} is still open, but \${closed.length} closed \${closed.length === 1 ? "${ids.spoken} depends" : "${ids.spokenPlural} depend"} on it\`,
        nodeIds: [subject.id, ...closed.map((other) => other.id)],
        repairs: [
          {
            mutation: "close-${ids.kind}",
            args: { id: subject.id },
            label: \`Close \${subject.label}\`,
          },
        ],
      },
    ];
  },
});

export const invariants = [closedInOrder];
`;
}

export function brandTs(ids: Ids): string {
  return `import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/**
 * One accent, and both schemes derived from it. \`graview check\` measures
 * every text pair against AA rather than trusting the colour; if the accent
 * cannot label a pending action legibly, the derivation says which pair
 * failed and why instead of shipping it.
 */
const ACCENT = "${ids.accent}";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(
    \`${escapeTemplate(ids.name)} cannot be derived from \${ACCENT} alone. Needs: \${derived.missing.join(", ")} — \${derived.why}\`,
  );
}

export const ${ids.brandVar}: Brand = {
  name: "${escapeString(ids.name)}",
  // A mark: replace it with your own. Sixteen pixels, currentColor.
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  typography: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  shape: { radius: 10, density: 1 },
  // Colour-by-kind, declared rather than hashed: one hue per kind.
  accents: { "${ids.kind}": 150 },
  schemes: derived.schemes,
};
`;
}

export function appTs(ids: Ids): string {
  return `import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
import { ${ids.brandVar} } from "./brand.js";
import { invariants } from "./invariants.js";
import { mutations } from "./mutations.js";
import { ${ids.schemaVar}, type ${ids.SchemaType} } from "./schema.js";

/**
 * The whole surface, in one object. \`graview check\` reads this; so do the
 * docs generator, the tool surface, the pages face and the scene. Keep React
 * out of this directory and the declaration stays inspectable by a build, a
 * CLI and an agent.
 */
export const ${ids.appVar} = defineApp({
  name: "${escapeString(ids.name)}",
  schema: ${ids.schemaVar},
  mutations,
  invariants,
  brand: ${ids.brandVar},
  /*
   * What belongs to the READER rather than to this installation: how big
   * the words are, and whether things move. The profile pane on the bar
   * draws exactly what is declared here, and the shell has already carried
   * the answer to the root element — every surface is sized in \`rem\`, so
   * one answer resizes the picture, the panes and the pages together.
   */
  settings: readerSettings(),
  /*
   * The intelligence, declared. The starter provider proposes first data
   * from the schema alone (no key, no model); a real model plugs the same
   * seam with one completion function. Both may only call what is listed.
   */
  intelligence: [
    {
      name: "starter",
      kind: "graph",
      description: "Proposes first data and open repairs from the declaration alone.",
      may: ["add-${ids.kind}", "link-${ids.kind}", "unlink-${ids.kind}", "close-${ids.kind}"],
    },
  ],
});

export type ${ids.StoreType} = Store<${ids.SchemaType}>;

export function createStore(options: Partial<StoreOptions<${ids.SchemaType}>> = {}): ${ids.StoreType} {
  return new Store<${ids.SchemaType}>({ schema: ${ids.schemaVar}, mutations, invariants, ...options });
}

export default ${ids.appVar};
`;
}

/* ---------------------------------------------------------------- tests */

export function domainTest(ids: Ids): string {
  return `import { checkApp } from "@graview/core/check";
import { kindCardId } from "@graview/layout";
import { deriveAffordances } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { ${ids.appVar}, createStore } from "../src/domain/app.js";

/**
 * The domain tier has no DOM in it, so these run headless. The test worth
 * having is the one that catches a real regression: the rule fires on a
 * graph that breaks it, and the repair it names resolves it.
 */

describe("the declaration", () => {
  it("passes its own check", () => {
    const result = checkApp(${ids.appVar});
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("offers an empty district its own beginnings, through creates", () => {
    const store = createStore();
    const { affordances } = deriveAffordances(store, [kindCardId("${ids.kind}")], {
      kindSelection: ["${ids.kind}"],
    });
    expect(affordances.map((a) => a.mutation)).toContain("add-${ids.kind}");
  });
});

describe("the rule", () => {
  const broken = () => {
    const store = createStore();
    store.apply({ name: "add-${ids.kind}", args: { label: "First" } });
    store.apply({ name: "add-${ids.kind}", args: { label: "Second" } });
    const [first, second] = store.graph.nodesOfKind("${ids.kind}");
    store.apply({ name: "link-${ids.kind}", args: { id: second!.id, dependsOn: first!.id } });
    store.apply({ name: "close-${ids.kind}", args: { id: second!.id } });
    return store;
  };

  it("fires when a closed ${ids.spoken} still depends on an open one", () => {
    // One rule at a time: the second rule you declare must not fail this test.
    const violations = broken().violations().filter((v) => v.invariant === "closed-in-order");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/still open, but 1 closed/);
    expect(violations[0]?.repairs).toHaveLength(1);
  });

  it("is resolved by the repair it names", () => {
    const store = broken();
    const repair = store.violations().find((v) => v.invariant === "closed-in-order")!.repairs[0]!;
    store.apply({ name: repair.mutation, args: { ...repair.args } });
    expect(store.violations().filter((v) => v.invariant === "closed-in-order")).toEqual([]);
  });

  it("keeps a closed ${ids.spoken} in the record, behind the horizon", () => {
    const store = broken();
    const closed = store.graph.nodesOfKind("${ids.kind}").filter((n) => n.status === "closed");
    expect(closed).toHaveLength(1);
  });
});
`;
}
