import {
  bindSchema,
  createSchema,
  defineInvariant,
  defineNode,
  nodeRef,
  type GraviewApp,
  type Principal,
} from "@graview/core";
import { figureFaults } from "@graview/core/figures";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { resolveProposal } from "@graview/tools";
import { createStudio, declarationFiles, declarationToGraph, graphToDeclaration, studioResponder, typeFromName } from "../../src/index.js";

/*
 * A ROTA, declared the way a checkout declares one — with a drawn kind and
 * an undrawn one, so the seat has something honest to say about figures.
 */
const volunteer = defineNode("volunteer", {
  description: "Somebody who turns up.",
  fields: z.object({ label: z.string().min(1) }),
  plural: "volunteers",
  label: (node) => node.label,
  figure: "person",
});
const shift = defineNode("shift", {
  description: "A stretch of time somebody covers.",
  fields: z.object({ label: z.string().min(1), day: z.string() }),
  edges: {
    "covered-by": { to: ["volunteer"], description: "who covers it", inverse: "what they cover" },
  },
  plural: "shifts",
  label: (node) => node.label,
});
const schema = createSchema([volunteer, shift]);
const bound = bindSchema(schema);

const cover = bound.defineMutation("cover", {
  title: "Cover the shift",
  fromTheOtherEnd: "Take a shift",
  description: "Put a volunteer on a shift.",
  subject: { kinds: ["shift"], arg: "shift" },
  connects: ["covered-by"],
  input: z.object({ shift: nodeRef(["shift"]), volunteer: nodeRef(["volunteer"]) }),
  describe: (args) => `${args.shift} covered by ${args.volunteer}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "covered-by", from: args.shift, to: args.volunteer });
  },
});
const addShift = bound.defineMutation("add-shift", {
  title: "Add a shift",
  description: "Put a stretch of time on the rota.",
  creates: ["shift"],
  input: z.object({ label: z.string().min(1), day: z.string() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "shift"), kind: "shift", label: args.label, day: args.day });
  },
});
const covered = defineInvariant("shift-is-covered", {
  label: "Every shift is covered",
  description: "A shift nobody covers is a shift nobody turns up to.",
  scope: { kind: "shift" },
  repairs: ["cover"],
  evaluate: () => [],
});

const rota: GraviewApp<typeof schema> = {
  name: "Rota",
  schema,
  mutations: [cover, addShift],
  invariants: [covered],
  policy: {
    roles: ["keeper", "helper"],
    grants: [
      { roles: ["keeper"], mutations: "*", describe: "the keeper may do anything" },
      { roles: ["helper"], mutations: ["cover"], describe: "a helper may cover a shift" },
    ],
  },
};

const agent: Principal = { kind: "agent", id: "studio-agent", session: "test" };
const ask = async (text: string) => {
  const studio = createStudio(rota);
  const reply = await studioResponder()(studio.store as never, text);
  return { studio, reply };
};

describe("the declaration answers for itself", () => {
  it("says what kinds there are, and never proposes a change to a question", async () => {
    const { reply } = await ask("what kinds are there?");
    expect(reply.say).toContain("volunteer");
    expect(reply.say).toContain("shift");
    expect(reply.grounded).toBe(true);
    expect(reply.proposals).toEqual([]);
  });

  it("says what an act writes, and what it acts on", async () => {
    const { reply } = await ask("what does cover the shift do?");
    expect(reply.say).toContain("covered-by");
    expect(reply.say).toContain("shift");
    expect(reply.proposals).toEqual([]);
  });

  it("says what a rule judges and what puts it right", async () => {
    const { reply } = await ask("what does shift-is-covered judge?");
    expect(reply.say).toContain("shift");
    expect(reply.say.toLowerCase()).toContain("cover");
  });

  it("says who is allowed to take an act", async () => {
    const { reply } = await ask("who is allowed to cover a shift?");
    expect(reply.say).toContain("helper");
  });

  it("names the kinds nobody has drawn", async () => {
    const { reply } = await ask("which kinds have no figure?");
    expect(reply.say).toContain("shift");
    expect(reply.say).not.toContain("volunteer,");
  });
});

describe("words become proposed acts, never writes", () => {
  it("fills a field act from a sentence, reading the type off the name", async () => {
    const { studio, reply } = await ask("add a due date to shifts");
    expect(reply.proposals).toHaveLength(1);
    const proposal = reply.proposals[0]!;
    expect(proposal.mutation).toBe("add-field");
    expect(proposal.args["kind"]).toBe("declared:shift");
    expect(proposal.args["type"]).toBe("date");
    // Optional by default: a required field on records that already exist
    // is a migration nobody asked for.
    expect(proposal.args["required"]).toBe(false);
    // And the declaration has not moved.
    expect(studio.changes()).toHaveLength(0);
    expect(studio.declaration().schema.tryDefinition("shift")).toBeDefined();
  });

  it("names a new role from the sentence, rather than proposing an act with no name", async () => {
    /*
     * The exact sentence that failed: the floor did not recognize it, an
     * on-device model took the turn and proposed `add-role` with no label,
     * and the store refused it for the arguments.
     */
    const { studio, reply } = await ask("add a new Role for Participant");
    expect(reply.proposals).toHaveLength(1);
    expect(reply.proposals[0]).toMatchObject({ mutation: "add-role", args: { label: "Participant" } });
    // And it is a call the store actually accepts.
    const would = studio.would({ name: "add-role", args: { ...reply.proposals[0]!.args } });
    expect(would.ok).toBe(true);
  });

  it("takes a name however it is said, and asks when there is none", async () => {
    expect((await ask('add a role called "Shift lead"')).reply.proposals[0]?.args["label"]).toBe("Shift lead");
    expect((await ask("add a treasurer role")).reply.proposals[0]?.args["label"]).toBe("treasurer");
    expect((await ask("add a kind called Session")).reply.proposals[0]).toMatchObject({
      mutation: "add-kind",
      args: { label: "Session" },
    });
    // No name is a question back, never an act that cannot apply.
    const nameless = await ask("add a new role");
    expect(nameless.reply.proposals).toEqual([]);
    expect(nameless.reply.say).toContain("called");
    // And a question about roles is not a change to them.
    const asking = await ask("what roles are there?");
    expect(asking.reply.proposals).toEqual([]);
  });

  it("says so rather than proposing a duplicate", async () => {
    const { reply } = await ask("add a role called keeper");
    expect(reply.proposals).toEqual([]);
    expect(reply.say).toContain("already");
  });

  /**
   * THE SUBJECT IS WHAT THE SENTENCE POINTS AT, not the longest word in it.
   *
   * "Add details to Meal. The name of the food and the number of people it
   * can feed" put a field on USER: the user kind's plural is "People",
   * "people" sits inside "number of people", and six letters beat four.
   */
  it("reads the kind from the clause that names it, not from a description of something else", async () => {
    const { reply } = await ask("Add details to shift. The name of the job and the number of volunteers it needs");
    expect(reply.proposals[0]?.args["kind"]).toBe("declared:shift");
  });

  it("asks rather than guessing when the kind it points at does not exist", async () => {
    const { reply } = await ask("Add details to Meal. The name of the food and the number of people it can feed");
    expect(reply.proposals).toEqual([]);
    expect(reply.say).toContain("no kind called");
    // And it says what there IS, so the next sentence can be right.
    expect(reply.say).toContain("shift");
  });

  it("proposes a tie, and says which end declares it", async () => {
    const { studio, reply } = await ask("Attach volunteers to shifts");
    expect(reply.proposals[0]).toMatchObject({
      mutation: "add-edge",
      args: { kind: "declared:shift", to: "declared:volunteer", label: "volunteers", cardinality: "many" },
    });
    // Which end is a real decision, and the seat says the one it made.
    expect(reply.say).toContain("declared on shift");
    expect(studio.would({ name: "add-edge", args: { ...reply.proposals[0]!.args } }).ok).toBe(true);
  });

  it("reads a tie out of the way a person actually says it", async () => {
    const { reply } = await ask("a shift has many volunteers");
    expect(reply.proposals[0]).toMatchObject({
      mutation: "add-edge",
      args: { kind: "declared:shift", to: "declared:volunteer" },
    });
  });

  it("proposes a rule when somebody says every X needs a Y", async () => {
    const { reply } = await ask("every shift needs a volunteer");
    expect(reply.proposals[0]?.mutation).toBe("add-rule");
    expect(reply.proposals[0]?.args["kind"]).toBe("declared:shift");
  });

  it("reads a type off a name rather than guessing cleverly", () => {
    expect(typeFromName("due date")).toBe("date");
    expect(typeFromName("how many hours")).toBe("number");
    expect(typeFromName("is urgent")).toBe("boolean");
    expect(typeFromName("notes")).toBe("text");
    expect(typeFromName("nickname")).toBe("string");
  });
});

describe("the checker speaks before the person keeps anything", () => {
  it("says what the declaration would become, without changing it", async () => {
    const studio = createStudio(rota);
    const before = studio.check();
    const would = studio.would({ name: "add-field", args: { kind: "declared:shift", label: "note", type: "string", required: false } });
    expect(would.ok).toBe(true);
    if (!would.ok) return;
    expect(would.check.errors).toBe(before.errors);
    // The real declaration is untouched: `would` is a copy, not a rehearsal
    // the person has to undo.
    expect(studio.changes()).toHaveLength(0);
    expect(studio.declaration().schema.tryDefinition("shift")?.fields).toBeDefined();
  });

  it("gives back the store's own refusal rather than throwing", () => {
    const studio = createStudio(rota);
    const would = studio.would({ name: "add-field", args: { kind: "declared:nothing-here", label: "x", type: "string", required: false } });
    expect(would.ok).toBe(false);
    if (would.ok) return;
    expect(would.reason.length).toBeGreaterThan(0);
  });

  it("condemns a change that would fail the build", () => {
    const studio = createStudio(rota);
    /*
     * Removing the act that repairs the rule leaves a rule naming a repair
     * that is not there — which is exactly what the checker is for, and
     * exactly the sort of change nobody should be offered as a keep.
     */
    const would = studio.would({ name: "remove-act", args: { id: "act:cover" } });
    expect(would.ok).toBe(true);
    if (!would.ok) return;
    expect(would.check.errors).toBeGreaterThan(studio.check().errors);
  });
});

describe("keeping is an ordinary op under the agent's name", () => {
  it("applies as the agent, and undo takes it back", async () => {
    const { studio, reply } = await ask("add a due date to shifts");
    const proposal = reply.proposals[0]!;
    const kept = studio.propose({ name: proposal.mutation, args: { ...proposal.args } }, agent, proposal.why);
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;

    const fields = studio.declaration().schema.tryDefinition("shift")?.fields as { shape: Record<string, unknown> };
    expect(Object.keys(fields.shape)).toContain("due-date");
    expect(studio.proposals()).toHaveLength(1);
    expect(studio.proposals()[0]?.author.kind).toBe("agent");

    expect(studio.decline(kept.batch)).toBe(true);
    const after = studio.declaration().schema.tryDefinition("shift")?.fields as { shape: Record<string, unknown> };
    expect(Object.keys(after.shape)).not.toContain("due-date");
    expect(studio.proposals()).toHaveLength(0);
  });
});

/**
 * ONE LOOSE SENTENCE IS SEVERAL ACTS, AND SOME OF THEM WAIT FOR THE OTHERS.
 *
 * "A Meal kind, with a name and how many it feeds" is one act that creates
 * the kind and two that need it to exist. Judged once on arrival the two
 * fields refuse — they name a kind that is not there yet — so encouraging a
 * model to split a sentence, without re-judging what it split it into,
 * would have produced a pile of dead proposals under a live one.
 */
/**
 * WHAT THE KEYLESS RUNG CANNOT READ, IT SAYS — AND OFFERS THE WAY OUT.
 *
 * The graph-native rung reads a handful of sentence shapes. Saying "I could
 * not read that" is honest and, on its own, a dead end: a person is left
 * guessing which phrasing a pattern-matcher wants, when the rung that reads
 * any phrasing is one press away behind the gear.
 */
describe("a sentence this rung cannot read", () => {
  it("marks itself unsure, so a surface can offer the model", async () => {
    const { reply } = await ask("sort the shifts out a bit, they are a mess");
    expect(reply.unsure).toBe(true);
    expect(reply.proposals).toEqual([]);
  });

  it("is never unsure about something it answered", async () => {
    expect((await ask("what kinds are there?")).reply.unsure).toBeUndefined();
    expect((await ask("add a due date to shifts")).reply.unsure).toBeUndefined();
    expect((await ask("Attach volunteers to shifts")).reply.unsure).toBeUndefined();
  });

  it("is unsure when it knows the shape but not the thing", async () => {
    // It understood "add a field to X" and X is not a kind: a model may do
    // better with the same words, so this is not a dead end either.
    expect((await ask("Add details to Meal. The name of the food")).reply.unsure).toBe(true);
    expect((await ask("add a new role")).reply.unsure).toBe(true);
  });
});

describe("proposals that wait for each other", () => {
  const field = (kind: string) => ({ name: "add-field", args: { kind, label: "serves", type: "number", required: false } });

  it("refuses a field on a kind that does not exist yet, and takes it the moment it does", () => {
    const studio = createStudio(rota);
    // The model names things the way a person does.
    expect(resolveProposal(studio.store as never, { mutation: "add-field", args: { kind: "Meal" } }).args["kind"]).toBe("Meal");
    expect(studio.would(field("Meal")).ok).toBe(false);

    studio.propose({ name: "add-kind", args: { label: "Meal" } }, agent, "you asked for a Meal kind");

    // The same words now mean a node, and the same call now applies.
    const resolved = resolveProposal(studio.store as never, { mutation: "add-field", args: { kind: "Meal" } });
    expect(resolved.args["kind"]).toBe("declared:meal");
    const would = studio.would(field(String(resolved.args["kind"])));
    expect(would.ok).toBe(true);
    if (would.ok) expect(would.check.errors).toBe(0);
  });
});

describe("a figure is a change like any other", () => {
  it("proposes the nearest shipped figure when nothing is behind the seat", async () => {
    const { reply } = await ask("draw a figure for volunteer");
    expect(reply.proposals[0]?.mutation).toBe("set-figure");
    expect(reply.proposals[0]?.args["id"]).toBe("declared:volunteer");
    expect(figureFaults(String(reply.proposals[0]?.args["figure"]))).toEqual([]);
    // And it says which it was, rather than passing a placeholder off as a drawing.
    expect(reply.say).toContain("nearest shipped figure");
  });

  it("draws through the completion seam, and keeps the drawing", async () => {
    const drawn =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 18 12 6l8 12z"/></svg>';
    const studio = createStudio(rota);
    const reply = await studioResponder({ complete: async () => `Here you go:\n${drawn}` })(studio.store as never, "draw a figure for shift");
    expect(reply.proposals[0]?.args["figure"]).toBe(drawn);
    const kept = studio.propose({ name: "set-figure", args: { ...reply.proposals[0]!.args } }, agent);
    expect(kept.ok).toBe(true);
    expect(studio.declaration().schema.tryDefinition("shift")?.figure).toBe(drawn);
    expect(studio.check().errors).toBe(0);
  });

  it("carries a figure through the graph, the declaration and the file", () => {
    const graph = declarationToGraph(rota as never);
    const back = graphToDeclaration(graph, { base: rota as never, name: rota.name });
    expect(back.schema.tryDefinition("volunteer")?.figure).toBe("person");

    const written = declarationFiles(graph, { name: rota.name, base: rota as never });
    const schemaFile = written.find((file) => file.path.endsWith("schema.ts"));
    expect(schemaFile?.contents).toContain('figure: "person"');
  });
});

describe("a studio store is still a store", () => {
  it("hands anything it cannot answer to the graph's own responder", async () => {
    const { reply } = await ask("what is wrong?");
    // The meta-graph holds no violations, and the floor says so in its own words.
    expect(reply.say.toLowerCase()).toContain("nothing is wrong");
  });

  it("never proposes an act the studio does not declare", async () => {
    const studio = createStudio(rota);
    const names = new Set((studio.store.allMutations() as readonly { name: string }[]).map((one) => one.name));
    for (const text of ["add a due date to shifts", "every shift needs a volunteer", "draw a figure for shift"]) {
      const reply = await studioResponder()(studio.store as never, text);
      for (const proposal of reply.proposals) expect(names.has(proposal.mutation)).toBe(true);
    }
  });
});

