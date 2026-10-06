import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineApp,
  defineMutation,
  defineNode,
  nodeRef,
  type AnyMutationDefinition,
  type AnySchema,
  type GraviewApp,
  type LensDeclaration,
} from "../../src/index.js";
import {
  checkApp,
  formatFindings,
  generateAgentsMd,
  generateLlmsTxt,
} from "../../src/check.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  edges: {
    "assigned-to": { to: ["duty"], description: "the runs they do", inverse: "who does the run" },
  },
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

function findings<S extends AnySchema>(app: GraviewApp<S>) {
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

  /*
   * A ROLE IS A FIELD NAME, OR A FIELD AND THE VALUES THAT MAKE IT TRUE.
   *
   * The second shape is how `lifecycle` already reads a state, and a lens
   * role that reads completion has to accept it: the framework argues
   * everywhere that states are enums with names rather than flags, so a role
   * only a boolean can fill is a role most domains cannot bind. The checker
   * asks the same question of both shapes — is that a field this kind
   * declares? — and says so plainly when it is neither.
   */
  // A binding that is neither shape does not typecheck; the checker is held to saying so anyway.
  const predicateBindings = (
    bindings: Readonly<Record<string, Readonly<Record<string, string | { field: string; is?: readonly unknown[] }>>>>,
  ) => bindings as unknown as LensDeclaration["bindings"];

  it("reads a role bound to a field, or to a field and the values that fill it", () => {
    const withField = defineApp({
      name: "test",
      schema,
      lenses: [{ name: "calendar", requiredRoles: ["start"], bindings: { duty: { start: "at" } } }],
    });
    expect(findings(withField)).not.toContain("error:lens-binding-missing-field");

    const withPredicate = defineApp({
      name: "test",
      schema,
      lenses: [
        {
          name: "calendar",
          requiredRoles: ["start"],
          bindings: { duty: { start: "at", done: { field: "until", is: [0] } } },
        },
      ],
    });
    expect(findings(withPredicate)).not.toContain("error:lens-binding-missing-field");
    expect(findings(withPredicate)).not.toContain("error:lens-binding-not-a-field");
  });

  it("still names a predicate pointing at a field the kind does not declare", () => {
    const app = defineApp({
      name: "test",
      schema,
      lenses: [
        {
          name: "calendar",
          requiredRoles: ["start"],
          bindings: { duty: { start: "at", done: { field: "status", is: ["done"] } } },
        },
      ],
    });
    expect(findings(app)).toContain("error:lens-binding-missing-field");
  });

  it("says so when a binding is neither shape", () => {
    const app = defineApp({
      name: "test",
      schema,
      lenses: [
        {
          name: "calendar",
          requiredRoles: ["start"],
          bindings: predicateBindings({ duty: { start: "at", done: { field: "until" } } }),
        },
      ],
    });
    expect(findings(app)).toContain("error:lens-binding-not-a-field");
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
  const app = (mutation: AnyMutationDefinition<typeof schema>) =>
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

  it("leaves a hyphenated word in a sentence alone, because it is English", () => {
    // "Offer a trade-in" is a dealership's button; the kind is called trade-in
    // because the word is. A hyphen in ONE word is a slug, in a sentence it is not.
    for (const title of ["Offer a trade-in", "Book a follow-up", "Re-open it"]) {
      const english = bound.defineMutation("reword-thing", {
        title,
        description: "Change the wording.",
        subject: { kinds: ["duty"], arg: "dutyId" },
        input: z.object({ dutyId: nodeRef(["duty"]) }),
        apply: () => {},
      });
      expect(findings(app(english)), title).not.toContain("warning:mutation-title-is-an-identifier");
    }
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

  it("keeps warning when only ONE of two kinds sharing the edge name is appendOnly", () => {
    // Two kinds can declare the same edge-kind name. A suppression on one
    // must not hide the other's makeable-but-never-unmakeable relation.
    const diarist = defineNode("person", {
      fields: z.object({ label: z.string() }),
      edges: { "assigned-to": { to: ["duty"], appendOnly: true } },
    });
    const roster = defineNode("duty", {
      fields: z.object({ label: z.string(), at: z.number(), until: z.number() }),
      edges: { "assigned-to": { to: ["person"] } },
    });
    const sharedSchema = createSchema([diarist, roster]);
    const sharedBound = bindSchema(sharedSchema);
    const maker = sharedBound.defineMutation("assign", {
      title: "Assign run",
      description: "Tie a person to a run.",
      subject: { kinds: ["duty"], arg: "dutyId" },
      connects: ["assigned-to"],
      input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
      apply: () => {},
    });
    const app = defineApp({ name: "test", schema: sharedSchema, mutations: [maker] });
    expect(findings(app)).toContain("warning:edge-without-severer");
  });
});

describe("an edge reads from both ends", () => {
  it("warns about an edge with the declaring side's words only", () => {
    const oneWay = defineNode("person", {
      fields: z.object({ label: z.string() }),
      edges: { "assigned-to": { to: ["duty"], description: "the runs they do" } },
    });
    const app = defineApp({ name: "test", schema: createSchema([oneWay, duty]), mutations: [] });
    expect(findings(app)).toContain("warning:edge-without-inverse");
    const finding = checkApp(app).findings.find((f) => f.code === "edge-without-inverse")!;
    expect(finding.where).toBe('defineNode("person").edges["assigned-to"]');
    // It says what the other end will be captioned with, and why that is wrong.
    expect(finding.message).toContain('"assigned to"');
    expect(finding.message).toContain("a duty");
    expect(finding.fix).toContain("inverse");
  });

  it("asks for both readings when there are none", () => {
    const wordless = defineNode("person", {
      fields: z.object({ label: z.string() }),
      edges: { "assigned-to": { to: ["duty"] } },
    });
    const app = defineApp({ name: "test", schema: createSchema([wordless, duty]), mutations: [] });
    const finding = checkApp(app).findings.find((f) => f.code === "edge-without-inverse")!;
    expect(finding.message).toContain("either direction");
    expect(finding.fix).toContain("description");
  });

  it("is quiet once the far end has its words", () => {
    expect(findings(defineApp({ name: "test", schema, mutations: [] }))).not.toContain(
      "warning:edge-without-inverse",
    );
  });
});

/**
 * A NOTE IS A QUESTION ASKED OUT LOUD, NOT A PROBLEM.
 *
 * Some things a checker can see are legitimate designs the author should
 * nonetheless have looked at once. Filed as warnings they would be warnings
 * that can only ever be acknowledged, and those are the ones people learn to
 * scroll past — which costs the checker its authority on the warnings that
 * matter.
 */
/**
 * A relationship that runs THROUGH a node is a walk, and every step of it is
 * an edge kind somebody declared — so the whole path is checkable, which is
 * the point of naming it in the declaration rather than reaching for the
 * graph inside a view.
 */
describe("a coverage that runs through a node", () => {
  const thing = defineNode("thing", { fields: z.object({ label: z.string() }) });
  const hinge = defineNode("hinge", {
    fields: z.object({ label: z.string() }),
    edges: {
      applies: { to: ["thing"], description: "what it applies", inverse: "how" },
      covers: { to: ["duty"], description: "what it covers", inverse: "what covers it" },
    },
  });
  const walkSchema = createSchema([thing, hinge, duty]);
  const lens = (path: readonly unknown[]) =>
    defineApp({
      name: "test",
      schema: walkSchema,
      lenses: [
        {
          name: "coverage",
          binds: "entities" as const,
          requiredRoles: ["rows", "columns", "link"],
          bindings: { rows: { kind: "thing" }, columns: { kind: "duty" }, link: { path } } as never,
        },
      ],
    });

  it("accepts a path of declared edge kinds", () => {
    expect(findings(lens(["covers", "applies"]))).not.toContain("error:lens-binding-undeclared-edge");
    expect(findings(lens(["covers", "applies"]))).not.toContain("error:lens-binding-empty");
  });

  it("names a step no kind declares", () => {
    expect(findings(lens(["covers", "sprinkles"]))).toContain("error:lens-binding-undeclared-edge");
  });

  it("refuses a path that reaches nothing", () => {
    expect(findings(lens([]))).toContain("error:lens-binding-empty-path");
  });
});

describe("what the checker says out loud without failing", () => {
  const timed = defineNode("timed", {
    fields: z.object({ label: z.string(), at: z.number(), due: z.string() }),
    fieldRoles: { start: "at" },
  });
  const timedSchema = createSchema([timed]);

  it("notes a lens binding and a fieldRole that disagree about one role", () => {
    const app = defineApp({
      name: "test",
      schema: timedSchema,
      lenses: [{ name: "calendar", requiredRoles: ["start"], bindings: { timed: { start: "due" } } }],
    });
    const result = checkApp(app);
    expect(findings(app)).toContain("note:lens-binding-disagrees-with-field-role");
    /* A note is never a failure, and is counted apart from the warnings. */
    expect(result.ok).toBe(true);
    expect(result.warnings).toBe(0);
    expect(result.notes).toBe(1);
    expect(formatFindings(result)).toContain("note ");
    expect(formatFindings(result)).toContain("1 note(s)");
  });

  /**
   * A LABEL A MODEL WRITES.
   *
   * A product asked one to survey a garden and got back areas called
   * "Pea-gravel corner with river-rock border, log seats and a fire bowl".
   * True, useful, and a terrible name — and the model was never told,
   * because the prompt is generated from the schema and the schema said
   * `z.string().min(1)`.
   */
  const surveyed = (label: z.ZodTypeAny) =>
    defineApp({
      name: "grounds",
      schema: createSchema([
        defineNode("zone", { fields: z.object({ label }), plural: "Zones" }),
        defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" }),
      ]),
      mutations: [
        defineMutation("stake-out", {
          title: "Stake out some ground",
          creates: ["zone"],
          input: z.object({ label: z.string() }),
          apply: () => undefined,
        }),
        defineMutation("jot", {
          title: "Jot something down",
          creates: ["note"],
          input: z.object({ label: z.string() }),
          apply: () => undefined,
        }),
      ],
      intelligence: [{ name: "surveyor", kind: "llm", may: ["stake-out"] }],
    });

  it("notes an unbounded label on a kind a model may create", () => {
    const result = checkApp(surveyed(z.string().min(1)));
    expect(findings(surveyed(z.string().min(1)))).toContain("note:label-unbounded");
    expect(result.ok).toBe(true);
    /* Only the kind the provider may make. Nobody asked a model for notes. */
    const said = formatFindings(result);
    expect(said).toContain("zone");
    expect(said).not.toMatch(/label-unbounded[\s\S]*\bnote\b.*fields\.label/);
  });

  it("says nothing once the label has a ceiling an interface can draw", () => {
    expect(findings(surveyed(z.string().min(1).max(60)))).not.toContain("note:label-unbounded");
  });

  it("says nothing for a ceiling past sixty, because real names are longer and the call was made", () => {
    // A real catalogue's titles run to 78 characters; bounding at 100 is a choice, not an omission.
    expect(findings(surveyed(z.string().min(1).max(100)))).not.toContain("note:label-unbounded");
  });

  it("says nothing at all when no provider can create anything", () => {
    const app = defineApp({
      name: "grounds",
      schema: createSchema([defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" })]),
    });
    expect(findings(app)).not.toContain("note:label-unbounded");
  });

  it("asks out loud whether a lens this app wrote is reusable", () => {
    const app = defineApp({
      name: "grounds",
      schema: timedSchema,
      lenses: [
        { name: "timeline", requiredRoles: ["start"], bindings: { timed: { start: "at" } } },
        { name: "grounds-map", requiredRoles: ["start"], bindings: { timed: { start: "at" } } },
      ],
    });
    const result = checkApp(app);
    expect(findings(app)).toContain("note:lens-authored-here");
    /* The shipped one is not asked about; the app's own is, by name. */
    const note = result.findings.find((finding) => finding.code === "lens-authored-here")!;
    expect(note.message).toContain("grounds-map");
    expect(note.message).not.toContain("timeline");
    expect(note.fix).toContain("it is a view, and there is nothing wrong with a view");
    expect(result.ok).toBe(true);
  });

  it("stops asking once the lens says where its reuse was proved", () => {
    const app = defineApp({
      name: "grounds",
      schema: timedSchema,
      lenses: [
        {
          name: "grounds-map",
          requiredRoles: ["start"],
          bindings: { timed: { start: "at" } },
          provenBy: "tests/lens-reuse.test.ts",
        },
      ],
    });
    expect(findings(app)).not.toContain("note:lens-authored-here");
  });

  it("says nothing about an app that only binds lenses the framework ships", () => {
    const app = defineApp({
      name: "test",
      schema: timedSchema,
      lenses: [{ name: "timeline", requiredRoles: ["start"], bindings: { timed: { start: "at" } } }],
    });
    expect(findings(app)).not.toContain("note:lens-authored-here");
  });

  it("says nothing when they agree", () => {
    const app = defineApp({
      name: "test",
      schema: timedSchema,
      lenses: [{ name: "timeline", requiredRoles: ["start"], bindings: { timed: { start: "at" } } }],
    });
    expect(findings(app)).not.toContain("note:lens-binding-disagrees-with-field-role");
  });
});

describe("one edge name is one relation", () => {
  const artist = defineNode("artist", { fields: z.object({ label: z.string() }) });
  it("refuses one name declared on two kinds in two sets of words", () => {
    const song = defineNode("song", {
      fields: z.object({ label: z.string() }),
      edges: { by: { to: ["artist"], description: "the artist whose song it is", inverse: "their songs" } },
    });
    const album = defineNode("album", {
      fields: z.object({ label: z.string() }),
      edges: { by: { to: ["artist"], description: "the artist whose release it is", inverse: "their releases" } },
    });
    const app = defineApp({ name: "test", schema: createSchema([song, album, artist]), mutations: [] });
    const finding = checkApp(app).findings.find((f) => f.code === "edge-name-shared")!;
    expect(finding.severity).toBe("error");
    expect(finding.message).toContain("their songs");
    expect(finding.message).toContain("their releases");
    expect(finding.fix).toContain("its own name");
  });

  it("is quiet when every declaration says the same thing", () => {
    const words = { to: ["artist"] as ["artist"], description: "who made it", inverse: "what they made" };
    const song = defineNode("song", { fields: z.object({ label: z.string() }), edges: { by: words } });
    const album = defineNode("album", { fields: z.object({ label: z.string() }), edges: { by: words } });
    const app = defineApp({ name: "test", schema: createSchema([song, album, artist]), mutations: [] });
    expect(findings(app)).not.toContain("error:edge-name-shared");
  });

  it("allows each declaring kind its own targets", () => {
    const label = defineNode("label", { fields: z.object({ label: z.string() }) });
    const song = defineNode("song", { fields: z.object({ label: z.string() }), edges: { by: { to: ["artist"] } } });
    const album = defineNode("album", { fields: z.object({ label: z.string() }), edges: { by: { to: ["label"] } } });
    const shared = createSchema([song, album, artist, label]);
    expect(shared.edgeAllowed("by", "album", "label")).toBe(true);
    expect(shared.edgeAllowed("by", "album", "artist")).toBe(false);
    expect(shared.edgeAllowed("by", "song", "artist")).toBe(true);
    expect(shared.edge("by")!.to).toEqual(["artist", "label"]);
  });
});
