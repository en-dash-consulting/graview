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
