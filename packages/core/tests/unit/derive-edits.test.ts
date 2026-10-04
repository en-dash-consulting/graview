import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  checkApp,
  createSchema,
  defineApp,
  deriveEditMutations,
  editVia,
  fieldWriters,
  nodeRef,
  PermissionDeniedError,
  Store,
  unwrittenFields,
  type GraviewApp,
  type Policy,
} from "../../src/index.js";

/**
 * A field you could set at creation, you can change — through a derived,
 * titled act per kind that flows through the policy like any other, with
 * `fixed` as the declared way out and `graview check` holding the line.
 */

const drill = defineNode2("drill", {
  label: z.string().min(1),
  minutes: z.number().int().min(1).max(180),
  minPlayers: z.number().int().min(1).max(40),
  intensity: z.enum(["low", "medium", "high"]),
});
const requirement = defineNode2(
  "requirement",
  { ref: z.string(), text: z.string(), priority: z.enum(["must", "should"]) },
  { ref: "the client's reference", text: "the client's words" },
);
const task = defineNode2("task", { label: z.string(), done: z.boolean() });
const schema = createSchema([drill, requirement, task]);
const { defineMutation } = bindSchema(schema);

import { defineNode } from "../../src/index.js";
function defineNode2<const K extends string, F extends z.ZodRawShape>(kind: K, shape: F, fixed?: Readonly<Record<string, string>>) {
  return defineNode(kind, { fields: z.object(shape), ...(fixed ? { fixed } : {}) });
}

const resizeDrill = defineMutation("resize-drill", {
  title: "Change how long it runs",
  description: "Re-time a drill.",
  subject: { kinds: ["drill"], arg: "drillId" },
  input: z.object({ drillId: nodeRef(["drill"]), minutes: z.number().int().min(1).max(180) }),
  apply(ctx, args) {
    ctx.patchNode(args.drillId, { minutes: args.minutes });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["drill", "task"], arg: "id" },
  input: z.object({ id: nodeRef(["drill", "task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const finish = defineMutation("finish", {
  title: "Mark it done",
  description: "Say a task is finished.",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const explain = defineMutation("explain", {
  title: "Note why this is here",
  description: "Attach a reason.",
  subject: { kinds: "*", arg: "id" },
  writes: [],
  input: z.object({ id: nodeRef("*"), text: z.string() }),
  apply() {
    // Would add a rationale node; irrelevant here.
  },
});
const mutations = [resizeDrill, rename, finish, explain];
const seed = {
  nodes: [
    { id: "d1", kind: "drill", label: "Rondo", minutes: 20, minPlayers: 6, intensity: "medium" },
    { id: "r1", kind: "requirement", ref: "R1", text: "Must work", priority: "must" },
    { id: "t1", kind: "task", label: "Buy milk", done: false },
  ],
  edges: [],
};

describe("what writes what", () => {
  it("reads declared writes over the name-match guess", () => {
    const writers = fieldWriters(schema, mutations);
    expect(writers.get("task")?.get("done")).toEqual(["finish"]);
    expect(writers.get("drill")?.get("minutes")).toEqual(["resize-drill"]);
    expect(writers.get("drill")?.get("label")).toEqual(["rename"]);
    // `explain` takes `text` and declares it writes nothing: believed.
    expect(writers.get("requirement")?.get("text")).toBeUndefined();
  });

  it("names the settable fields nobody writes, minus the fixed ones", () => {
    expect(unwrittenFields(schema, mutations, "drill")).toEqual(["minPlayers", "intensity"]);
    expect(unwrittenFields(schema, mutations, "requirement")).toEqual(["priority"]);
    expect(unwrittenFields(schema, mutations, "task")).toEqual([]);
  });
});

describe("the derived edit act", () => {
  it("exists per kind with something to change, titled and declaring its writes", () => {
    const derived = deriveEditMutations(schema, mutations);
    expect(derived.map((m) => m.name)).toEqual(["edit-drill", "edit-requirement"]);
    const edit = derived[0]!;
    expect(edit.title).toBe("Change the drill");
    expect(edit.description).toBe("Change what was set when this drill was made: min players, intensity.");
    expect(edit.subject).toEqual({ kinds: ["drill"], arg: "id" });
    expect(edit.writes).toEqual(["minPlayers", "intensity"]);
    expect(edit.derived).toEqual({ kind: "drill", act: "edit" });
  });

  it("is registered by the store and lands in the log as a named act", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    expect(store.allMutations().map((m) => m.name)).toContain("edit-drill");
    const result = store.apply({ name: "edit-drill", args: { id: "d1", minPlayers: 8 } });
    expect((store.graph.getNode("d1") as { minPlayers: number }).minPlayers).toBe(8);
    expect(result.intent).toBe("Change Rondo: min players → 8");
    expect(store.canUndo(result.batch).ok).toBe(true);
    store.undo(result.batch);
    expect((store.graph.getNode("d1") as { minPlayers: number }).minPlayers).toBe(6);
  });

  it("validates with the kind's own field schema and refuses an empty change", () => {
    const store = new Store({ schema, mutations, snapshot: seed as never });
    expect(() => store.apply({ name: "edit-drill", args: { id: "d1", minPlayers: 400 } })).toThrow(
      /Invalid arguments/,
    );
    expect(() => store.apply({ name: "edit-drill", args: { id: "d1" } })).toThrow(/Nothing to change/);
  });

  it("stands aside for an app's own act of the same name", () => {
    const own = defineMutation("edit-drill", {
      title: "Edit the drill",
      description: "The app's own.",
      subject: { kinds: ["drill"], arg: "id" },
      input: z.object({ id: nodeRef(["drill"]), intensity: z.enum(["low", "medium", "high"]) }),
      apply(ctx, args) {
        ctx.patchNode(args.id, { intensity: args.intensity });
      },
    });
    expect(deriveEditMutations(schema, [...mutations, own]).map((m) => m.name)).toEqual([
      "edit-requirement",
    ]);
  });
});

describe("through the policy, with no second list", () => {
  const policy: Policy = {
    roles: ["coach", "analyst", "player"],
    grants: [
      { roles: ["coach"], mutations: "*" },
      { roles: ["analyst"], mutations: ["resize-drill", "explain"] },
      { roles: ["player"], mutations: ["explain"] },
    ],
  };
  const guarded = () => new Store({ schema, mutations, policy, snapshot: seed as never });
  const as = (role: string) => ({ kind: "human" as const, id: role, roles: [role] });

  it("resolves who may edit a kind through the acts that already write or create it", () => {
    expect(editVia(schema, mutations, "drill")).toEqual(["resize-drill", "rename"]);
    // `explain` writes nothing on its subject, so it is nobody's way in.
    expect(editVia(schema, mutations, "requirement")).toEqual([]);
  });

  it("an analyst may retime a drill, so may change it; a player may not", () => {
    const store = guarded();
    expect(store.permits({ name: "edit-drill", args: { id: "d1", minPlayers: 8 } }, as("analyst")).ok).toBe(true);
    const refused = store.permits({ name: "edit-drill", args: { id: "d1", minPlayers: 8 } }, as("player"));
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.refusal.wouldNeed).toEqual(["analyst", "coach"]);
      // Roles and acts in words (W-143): never "one of analyst, coach can" beside "edit-drill".
      expect(refused.refusal.message).toContain("“Change the drill” on a drill — an analyst or a coach can");
    }
    expect(() =>
      store.apply({ name: "edit-drill", args: { id: "d1", minPlayers: 8 } }, { author: as("player") }),
    ).toThrow(PermissionDeniedError);
    store.apply({ name: "edit-drill", args: { id: "d1", minPlayers: 8 } }, { author: as("analyst") });
    expect((store.graph.getNode("d1") as { minPlayers: number }).minPlayers).toBe(8);
  });

  it("narrows the offered surface the same way", () => {
    const store = guarded();
    const names = (role: string) => store.permittedMutations(as(role)).map((m) => m.name).sort();
    expect(names("analyst")).toEqual(["edit-drill", "explain", "resize-drill"]);
    expect(names("player")).toEqual(["explain"]);
    // Nobody writes or creates a requirement, so its edit rides no act —
    // but a grant that says `*` names it directly, like any act.
    expect(names("coach")).toContain("edit-requirement");
    expect(editVia(schema, mutations, "requirement")).toEqual([]);
  });
});

describe("graview check", () => {
  const app = (over: Partial<GraviewApp<typeof schema>> = {}) =>
    defineApp({ name: "t", schema, mutations, invariants: [], ...over });
  const codes = (result: ReturnType<typeof checkApp>) => result.findings.map((f) => `${f.severity}:${f.code}`);

  it("passes when every settable field is reachable", () => {
    expect(checkApp(app()).ok).toBe(true);
    expect(codes(checkApp(app()))).toEqual([]);
  });

  it("warns field-without-writer when a policy leaves the derived edit nobody's", () => {
    const policy: Policy = {
      roles: ["coach"],
      grants: [{ roles: ["coach"], mutations: ["resize-drill", "rename", "finish", "explain"] }],
    };
    const result = checkApp(app({ policy }));
    // `requirement.priority`: no act writes or creates a requirement.
    const found = result.findings.filter((f) => f.code === "field-without-writer");
    expect(found.map((f) => f.where)).toEqual(['defineNode("requirement").fields.priority']);
    expect(found[0]?.fix).toContain('fixed: { priority: "why it never changes" }');
    expect(result.ok).toBe(true); // a warning, symmetric with edge-without-severer
  });

  it("warns when an app's own edit act leaves derived fields stranded", () => {
    const own = defineMutation("edit-drill", {
      title: "Edit the drill",
      description: "Only the intensity.",
      subject: { kinds: ["drill"], arg: "id" },
      input: z.object({ id: nodeRef(["drill"]), intensity: z.enum(["low", "medium", "high"]) }),
      apply() {},
    });
    const result = checkApp(app({ mutations: [...mutations, own] }));
    expect(result.findings.filter((f) => f.code === "field-without-writer").map((f) => f.where)).toEqual([
      'defineNode("drill").fields.minPlayers',
    ]);
  });

  it("refuses writes and fixed that name nothing, and notices a fixed field someone writes", () => {
    const liar = defineMutation("liar", {
      title: "Lie",
      description: "Claims a field.",
      subject: { kinds: ["drill"], arg: "id" },
      writes: ["speed"],
      input: z.object({ id: nodeRef(["drill"]) }),
      apply() {},
    });
    expect(codes(checkApp(app({ mutations: [...mutations, liar] })))).toContain("error:writes-unknown-field");

    const contradiction = createSchema([
      defineNode("drill", { fields: drill.fields, fixed: { minutes: "never", nope: "not a field" } }),
      task,
    ]);
    const result = checkApp(defineApp({ name: "c", schema: contradiction, mutations: [resizeDrill, rename, finish], invariants: [] } as never));
    expect(codes(result)).toContain("error:fixed-unknown-field");
    expect(codes(result)).toContain("warning:fixed-but-written");
    expect(result.findings.find((f) => f.code === "fixed-but-written")?.message).toContain("resize-drill writes it");
  });

  it("lets a grant name the derived act", () => {
    const policy: Policy = { grants: [{ roles: ["coach"], mutations: ["edit-drill", "rename", "resize-drill", "finish"] }] };
    expect(codes(checkApp(app({ policy })))).not.toContain("error:grant-unknown-mutation");
  });
});
