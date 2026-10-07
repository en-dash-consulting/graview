import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  PermissionDeniedError,
  Store,
  type Principal,
} from "../../src/index.js";

/**
 * `may` IS A PROMISE, AND A PROMISE IS KEPT ON EVERY PATH.
 *
 * `graview check` confirms every act in `intelligence[].may` exists. The
 * store never read the list. `validateProposals` honored it for proposals
 * that went through the tool runtime — and a plan applied by the app's own
 * code goes through `store.apply`, where there was no `may` at all. So an
 * agent principal could run any act its ROLES allowed, whatever the
 * declaration said it was brought in for, and every app would have had to
 * remember to re-implement the allowlist itself.
 *
 * The allowlist is a promise to the person who typed a key in: it may
 * describe the ground and may not touch the record.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string(), note: z.string() }), plural: "Zones" });
const schema = createSchema([zone]);
const { defineMutation } = bindSchema(schema);

const describeZone = defineMutation("describe-zone", {
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), note: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.zoneId, { note: args.note });
  },
});
const renameZone = defineMutation("rename-zone", {
  subject: { kinds: ["zone"], arg: "zoneId" },
  input: z.object({ zoneId: nodeRef(["zone"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.zoneId, { label: args.label });
  },
});

const store = (may?: readonly string[]) =>
  new Store({
    schema,
    mutations: [describeZone, renameZone],
    ...(may ? { intelligence: [{ name: "surveyor", kind: "llm" as const, may }] } : {}),
    snapshot: { nodes: [{ id: "lawn", kind: "zone", label: "Back Lawn", note: "" }] as never, edges: [] },
  });

const surveyor: Principal = { kind: "agent", id: "surveyor", roles: ["keeper"] };
const june: Principal = { kind: "human", id: "june", roles: ["keeper"] };

describe("an agent the app declared", () => {
  it("may do what it was declared able to do", () => {
    const at = store(["describe-zone"]);
    at.apply({ name: "describe-zone", args: { zoneId: "lawn", note: "Damp at the north end." } }, { author: surveyor });
    expect(at.graph.getNode("lawn")).toMatchObject({ note: "Damp at the north end." });
  });

  it("is refused anything else, in a sentence that says what it was for", () => {
    const at = store(["describe-zone"]);
    expect(() =>
      at.apply({ name: "rename-zone", args: { zoneId: "lawn", label: "The Lawn" } }, { author: surveyor }),
    ).toThrow(PermissionDeniedError);
    try {
      at.apply({ name: "rename-zone", args: { zoneId: "lawn", label: "The Lawn" } }, { author: surveyor });
    } catch (error) {
      expect((error as PermissionDeniedError).refusal.message).toContain("declared able to “describe-zone”");
    }
    /* Refused means nothing happened, not partly happened. */
    expect(at.graph.getNode("lawn")).toMatchObject({ label: "Back Lawn" });
  });

  it("refuses a whole gesture when one of its acts is outside the list", () => {
    const at = store(["describe-zone"]);
    expect(() =>
      at.applyAll(
        [
          { name: "describe-zone", args: { zoneId: "lawn", note: "Damp." } },
          { name: "rename-zone", args: { zoneId: "lawn", label: "The Lawn" } },
        ],
        { author: surveyor },
      ),
    ).toThrow(PermissionDeniedError);
    expect(at.graph.getNode("lawn")).toMatchObject({ note: "" });
  });

  it("does not narrow a person, who has no allowlist", () => {
    const at = store(["describe-zone"]);
    at.apply({ name: "rename-zone", args: { zoneId: "lawn", label: "The Lawn" } }, { author: june });
    expect(at.graph.getNode("lawn")).toMatchObject({ label: "The Lawn" });
  });

  it("does not narrow an agent the app declared no list for", () => {
    const at = store();
    at.apply({ name: "rename-zone", args: { zoneId: "lawn", label: "The Lawn" } }, { author: surveyor });
    expect(at.graph.getNode("lawn")).toMatchObject({ label: "The Lawn" });
  });
});
