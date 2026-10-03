import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSchema,
  defineMutation,
  defineNode,
  MissingRecordError,
  nodeRef,
  PermissionDeniedError,
  REFUSAL_REASONS,
  refusalOf,
  Store,
  UndoBlockedError,
  type Principal,
} from "../../src/index.js";

/**
 * A REFUSAL A PROGRAM CAN BRANCH ON (FR-46).
 *
 * A refusal used to reach a client as a sentence and nothing else, so an
 * MCP tool and an interface told "you may not" from "it is gone" by
 * matching words. `refusalOf` reads the store's own errors into a reason
 * from a closed set — `forbidden`, `missing`, `invalid`, `limit` — and,
 * when the policy knows who could, the roles that would.
 */
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const drop = defineMutation("drop", {
  title: "Drop it",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const keeper: Principal = { kind: "human", id: "kim", roles: ["keeper"] };
const admin: Principal = { kind: "human", id: "ada", roles: ["admin"] };

function store() {
  return new Store({
    schema: createSchema([task]),
    mutations: [finish, rename, drop],
    policy: {
      roles: ["keeper", "admin"],
      grants: [
        { roles: ["keeper"], mutations: ["finish"] },
        { roles: ["admin"], mutations: ["finish", "rename", "drop"] },
      ],
    },
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }], edges: [] } as never,
  });
}
const thrown = (act: () => unknown): unknown => {
  try {
    act();
  } catch (error) {
    return error;
  }
  throw new Error("It did not refuse.");
};

describe("a refusal names its reason", () => {
  it("is one of a closed set of four codes", () => {
    expect([...REFUSAL_REASONS]).toEqual(["forbidden", "missing", "invalid", "limit"]);
  });

  it("forbidden: the policy refused the seat, and names the roles that could", () => {
    const error = thrown(() => store().applyAll([{ name: "rename", args: { id: "t1", label: "Hall" } }], { author: keeper }));
    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(refusalOf(error)).toEqual({ reason: "forbidden", sentence: (error as Error).message, wouldNeed: ["admin"] });
  });

  it("forbidden: with no role that could, wouldNeed is left out rather than empty", () => {
    const refusal = refusalOf(thrown(() => store().applyAll([{ name: "nothing-declared", args: {} }], { author: admin })));
    expect(refusal.reason).toBe("forbidden");
    expect(refusal).not.toHaveProperty("wouldNeed");
  });

  it("missing: the call names a record that is not there", () => {
    const patched = thrown(() => store().applyAll([{ name: "finish", args: { id: "gone" } }], { author: keeper }));
    expect(patched).toBeInstanceOf(MissingRecordError);
    expect((patched as MissingRecordError).id).toBe("gone");
    expect(refusalOf(patched)).toEqual({ reason: "missing", sentence: (patched as Error).message });
    expect(refusalOf(thrown(() => store().applyAll([{ name: "drop", args: { id: "gone" } }], { author: admin }))).reason).toBe("missing");
  });

  it("missing: an undo of a batch with nothing live in it", () => {
    const error = thrown(() => store().undo(["never-made"], { author: admin }));
    expect(error).toBeInstanceOf(UndoBlockedError);
    expect(refusalOf(error).reason).toBe("missing");
  });

  it("invalid: arguments the act does not take, and a record its kind does not allow", () => {
    expect(refusalOf(thrown(() => store().applyAll([{ name: "rename", args: { id: "t1", label: 4 } }], { author: admin }))).reason).toBe("invalid");
    expect(refusalOf(thrown(() => store().applyAll([{ name: "rename", args: { id: "t1", label: "" } }], { author: admin }))).reason).toBe("invalid");
  });

  it("invalid: anything else that is not one of the store's own refusals, in its own words", () => {
    expect(refusalOf(new Error("The rule said no."))).toEqual({ reason: "invalid", sentence: "The rule said no." });
    expect(refusalOf("a bare string")).toEqual({ reason: "invalid", sentence: "a bare string" });
  });
});
