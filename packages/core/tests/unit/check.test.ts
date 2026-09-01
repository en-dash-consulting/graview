import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  checkApp,
  createSchema,
  defineApp,
  defineNode,
  formatFindings,
  generateAgentsMd,
  generateLlmsTxt,
  nodeRef,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", {
  fields: z.object({ label: z.string(), at: z.number(), until: z.number() }),
  fieldRoles: { start: "at", end: "until" },
});
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const reassign = bound.defineMutation("reassign", {
  title: "Reassign run",
  description: "Move a run to a different person.",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]), toPersonId: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.setSingleSource("assigned-to", args.dutyId, args.toPersonId);
  },
});

const clash = bound.defineInvariant("clash", {
  scope: { kind: "duty" },
  description: "Two runs must not collide.",
  repairs: ["reassign"],
  evaluate: () => [],
});

function findings(app: Parameters<typeof checkApp>[0]) {
  return checkApp(app).findings.map((f) => `${f.severity}:${f.code}`);
}

describe("checkApp", () => {
  it("passes a well-formed app", () => {
    const app = defineApp({
      name: "test",
      schema,
      mutations: [reassign],
      invariants: [clash],
    });
    const result = checkApp(app);
    expect(result.ok).toBe(true);
    expect(result.errors).toBe(0);
    expect(formatFindings(result)).toContain("no problems found");
  });

  it("reports a repair naming a mutation nobody registered", () => {
    const app = defineApp({ name: "test", schema, mutations: [], invariants: [clash] });
    expect(findings(app)).toContain("error:repair-unknown-mutation");
    const finding = checkApp(app).findings[0]!;
    // The message has to be actionable on its own — an agent reading only
    // this line must know which file-level thing to change.
    expect(finding.where).toBe('defineInvariant("clash").repairs');
    expect(finding.fix).toContain('Register a mutation called "reassign"');
  });

  it("reports a mutation whose subject argument is not in its input", () => {
    const broken = bound.defineMutation("broken", {
      subject: { kinds: ["duty"], arg: "missingArg" },
      input: z.object({ dutyId: nodeRef(["duty"]) }),
      apply: () => {},
    });
    const app = defineApp({ name: "test", schema, mutations: [broken] });
    expect(findings(app)).toContain("error:mutation-subject-arg-missing");
  });

  it("reports a field role pointing at a field that does not exist", () => {
    const wrong = defineNode("wrong", {
      fields: z.object({ at: z.number() }),
      fieldRoles: { start: "startsAt" },
    });
    const app = defineApp({ name: "test", schema: createSchema([wrong]) });
    expect(findings(app)).toContain("error:field-role-missing-field");
  });

  it("reports a lens role the app never bound", () => {
    const app = defineApp({
      name: "test",
      schema,
      lenses: [
        {
          name: "timeline",
          requiredRoles: ["start", "end"],
          bindings: { duty: { start: "at" } },
        },
      ],
    });
    expect(findings(app)).toContain("error:lens-role-unbound");
  });

  it("warns about a kind with no view, and errors on a view for no kind", () => {
    const views = bound.createViews<string>();
    views.register("person", { cardinality: "one", fidelity: "full" }, "PersonFull");
    const app = defineApp({ name: "test", schema, views });
    const codes = findings(app);
    expect(codes).toContain("warning:kind-without-view");
    expect(codes).not.toContain("error:view-for-undeclared-kind");

    // Registering for an undeclared kind is normally a typecheck failure;
    // this covers a registry assembled dynamically.
    views.register("vehicle" as never, { cardinality: "one", fidelity: "full" }, "V");
    expect(findings(defineApp({ name: "test", schema, views }))).toContain(
      "error:view-for-undeclared-kind",
    );
  });

  it("warns when a kind demands an invariant nobody registered", () => {
    const constraint = defineNode("constraint", {
      fields: z.object({ spec: z.object({ type: z.string() }) }),
      requiresInvariant: (node) => node.spec.type,
    });
    const app = defineApp({ name: "test", schema: createSchema([constraint]) });
    expect(findings(app)).toContain("warning:required-invariant-unregistered");
  });
});

describe("generated agent docs", () => {
  const app = defineApp({
    name: "test",
    schema,
    mutations: [reassign],
    invariants: [clash],
  });

  it("names every kind, edge and mutation in llms.txt", () => {
    const text = generateLlmsTxt(app);
    expect(text).toContain("### person");
    expect(text).toContain("edge `assigned-to` -> duty");
    expect(text).toContain("### reassign");
    expect(text).toContain("acts on: duty (argument `dutyId`)");
    expect(text).toContain("field roles: start=at, end=until");
    expect(text).toContain("**clash** (each duty)");
    // The tool schema comes from the same declaration as the TS types.
    expect(text).toContain('"toPersonId"');
  });

  it("tells an agent the three rules and the mutations it may use", () => {
    const text = generateAgentsMd(app);
    expect(text).toContain("**Only these mutations exist:** reassign");
    expect(text).toContain("Preview before you apply");
    expect(text).toContain("graview check");
  });
});

/**
 * A title is the whole label a person gets; a description is the whole
 * instruction an agent gets.
 *
 * `mutationToolSchema` falls back from description to title to name, so a
 * mutation that says nothing hands an agent a label where an instruction
 * belongs — and the same opaque string is what a person reads in the actions
 * strip. An unreadable one costs twice, which is why it is a build-time
 * question rather than something noticed in use.
 */
describe("what a mutation calls itself", () => {
  const app = (mutation: Parameters<typeof defineApp>[0]["mutations"][number]) =>
    defineApp({
      name: "test",
      schema,
      mutations: [mutation],
      invariants: [],
    });

  it("refuses a mutation with no title, because the interface would show its slug", () => {
    const untitled = bound.defineMutation("reword-thing", {
      description: "Change the wording.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      input: z.object({ dutyId: nodeRef(["duty"]) }),
      apply: () => {},
    });
    expect(findings(app(untitled))).toContain("error:mutation-untitled");
  });

  it("warns when a title reads as a name in the source rather than a label", () => {
    const sluggish = bound.defineMutation("reword-thing", {
      title: "reword-thing",
      description: "Change the wording.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      input: z.object({ dutyId: nodeRef(["duty"]) }),
      apply: () => {},
    });
    expect(findings(app(sluggish))).toContain("warning:mutation-title-is-an-identifier");
  });

  it("leaves an ordinary title alone even when it matches its slug", () => {
    // "Add person" is a perfectly good label. Slug-similarity is not the
    // signal; looking like an identifier is.
    const plain = bound.defineMutation("add-person", {
      title: "Add person",
      description: "Put a new person in the household.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      input: z.object({ dutyId: nodeRef(["duty"]) }),
      apply: () => {},
    });
    expect(findings(app(plain))).toEqual([]);
  });

  it("warns when a description is missing, since an agent then reads a label", () => {
    const bare = bound.defineMutation("reword-thing", {
      title: "Reword it",
      subject: { kinds: ["duty"], arg: "dutyId" },
      input: z.object({ dutyId: nodeRef(["duty"]) }),
      apply: () => {},
    });
    expect(findings(app(bare))).toContain("warning:mutation-undescribed");
  });

  it("warns when two mutations answer to the same title", () => {
    const twin = bound.defineMutation("reword-thing", {
      title: "Reassign run",
      description: "Something else entirely.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      input: z.object({ dutyId: nodeRef(["duty"]) }),
      apply: () => {},
    });
    const both = defineApp({
      name: "test",
      schema,
      mutations: [reassign, twin],
      invariants: [],
    });
    expect(findings(both)).toContain("warning:mutation-title-ambiguous");
  });
});

describe("a relation you can make but never unmake", () => {
  const maker = bound.defineMutation("assign", {
    title: "Assign run",
    description: "Tie a person to a run.",
    subject: { kinds: ["duty"], arg: "dutyId" },
    connects: ["assigned-to"],
    input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
    apply: () => {},
  });

  it("warns about an edge kind with a connecting act and no severing one", () => {
    const app = defineApp({ name: "test", schema, mutations: [maker] });
    expect(findings(app)).toContain("warning:edge-without-severer");
    const finding = checkApp(app).findings.find((f) => f.code === "edge-without-severer")!;
    expect(finding.where).toBe('defineMutation("assign").connects');
    expect(finding.message).toContain('"assigned-to"');
    // The fix names both honest ways out: a severer, or the declaration
    // that says the asymmetry is on purpose.
    expect(finding.fix).toContain('severs: ["assigned-to"]');
    expect(finding.fix).toContain('defineNode("person").edges["assigned-to"]');
    expect(finding.fix).toContain("appendOnly");
  });

  it("stays quiet once any mutation declares the severer", () => {
    const breaker = bound.defineMutation("unassign", {
      title: "Take them off it",
      description: "Break the tie between a person and a run.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      severs: ["assigned-to"],
      input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
      apply: () => {},
    });
    const app = defineApp({ name: "test", schema, mutations: [maker, breaker] });
    expect(findings(app)).not.toContain("warning:edge-without-severer");
  });

  it("is suppressed by an explicit appendOnly declaration on the edge", () => {
    const chronicler = defineNode("person", {
      fields: z.object({ label: z.string() }),
      // The suppression is the documentation: this edge is a record on
      // purpose, not an oversight.
      edges: { "assigned-to": { to: ["duty"], appendOnly: true } },
    });
    const appendOnlySchema = createSchema([chronicler, duty]);
    const boundAppendOnly = bindSchema(appendOnlySchema);
    const historian = boundAppendOnly.defineMutation("assign", {
      title: "Assign run",
      description: "Tie a person to a run, for good.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      connects: ["assigned-to"],
      input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
      apply: () => {},
    });
    const app = defineApp({ name: "test", schema: appendOnlySchema, mutations: [historian] });
    expect(findings(app)).not.toContain("warning:edge-without-severer");
  });
});
