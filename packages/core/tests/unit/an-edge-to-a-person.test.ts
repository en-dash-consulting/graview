import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, declareInstallation, defineNode, Store } from "../../src/index.js";

/**
 * AN APP CAN POINT AT A PERSON AND KEEP ITS OWN KIND NAMES.
 *
 * `declareInstallation` widened its kinds to `AnyNodeDefinition[]`, so an app
 * that spread them the documented way lost every kind name in its schema
 * type. Every app therefore spread them as `as unknown as readonly []`, which
 * put `user` in the graph and not in the type — and `ValidateEdgeTargets` is
 * a TYPE-level check, so `to: ["user"]` was refused by tsc while the runtime
 * resolved the edge perfectly. No first-party app had ever pointed at a
 * person, which is why it lasted: the examples model people as something the
 * installation HAS rather than something the domain refers to. "Who looks
 * after this ground", "whose round is this", "who reported it" are the first
 * three things any multi-person app wants, and all of them are this edge.
 *
 * What makes this a test rather than a type comment: it compiles. A widened
 * `kinds` puts `__graviewError: "Edge declared to an undeclared node kind"`
 * on the line below, and the suite goes red at build.
 */
const installation = declareInstallation({ roles: ["keeper", "helper"], admin: "keeper" });

const zone = defineNode("zone", {
  fields: z.object({ label: z.string() }),
  plural: "Zones",
  edges: {
    "kept-by": { to: ["user"], description: "who looks after it", inverse: "the ground they keep" },
  },
});

const schema = createSchema([zone, ...installation.kinds]);

describe("a domain that refers to people", () => {
  it("declares the edge with no cast, and the schema keeps every kind name", () => {
    /* The narrowing the empty-tuple workaround used to cost: `kind` is the
       union of the app's kinds and the installation's, not `string`. */
    const kinds: readonly ("zone" | "user" | "invitation")[] = schema.kinds;
    expect([...kinds].sort()).toEqual(["invitation", "user", "zone"]);
  });

  it("resolves the edge at runtime, which it always did", () => {
    const store = new Store({
      schema,
      mutations: [],
      snapshot: {
        nodes: [
          { id: "lawn", kind: "zone", label: "Back Lawn" },
          { id: "ada", kind: "user", label: "Ada", email: "ada@example.com", roles: ["keeper"], status: "active" },
        ] as never,
        edges: [{ kind: "kept-by", from: "lawn", to: "ada" }],
      },
    });
    expect(store.graph.outEdges("lawn", "kept-by").map((edge) => edge.to)).toEqual(["ada"]);
    /* And the other reading: the ground they keep. */
    expect(store.graph.in("ada").map((node) => node.id)).toEqual(["lawn"]);
  });

  it("still names the two kinds it declares, in order", () => {
    expect(installation.kinds.map((kind) => kind.kind)).toEqual(["user", "invitation"]);
  });
});
