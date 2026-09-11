import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  checkApp,
  createSchema,
  defineApp,
  defineNode,
  nodeRef,
  PermissionDeniedError,
  Store,
  whyNot,
  type Policy,
} from "../../src/index.js";

/**
 * Permission is another input to a derivation the framework already does.
 *
 * The two things that must not be got wrong: enforcement belongs at the
 * STORE, because the tool runtime calls the same mutations a person does and
 * a check in a component is a suggestion; and an action you may not take
 * should SAY SO rather than vanish.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  edges: {
    "assigned-to": { to: ["duty"], description: "the runs they do", inverse: "who does the run" },
  },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }) });
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

const rename = bound.defineMutation("rename", {
  title: "Rename",
  description: "Change what something is called.",
  subject: { kinds: ["person", "duty"], arg: "id" },
  input: z.object({ id: nodeRef(["person", "duty"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const policy: Policy = {
  roles: ["parent", "child"],
  grants: [
    { roles: ["parent"], mutations: "*", describe: "A parent keeps the rota." },
    // A child may rename a duty and nothing else.
    { roles: ["child"], mutations: ["rename"], kinds: ["duty"], describe: "A child names their own runs." },
  ],
};

const snapshot = {
  nodes: [
    { id: "ana", kind: "person" as const, label: "Ana" },
    { id: "d1", kind: "duty" as const, label: "Mon run" },
  ],
  edges: [],
};

const store = (withPolicy = true) =>
  new Store({
    schema,
    mutations: [reassign, rename],
    ...(withPolicy ? { policy } : {}),
    snapshot,
  });

const parent = { kind: "human" as const, id: "p", roles: ["parent"] };
const child = { kind: "human" as const, id: "c", roles: ["child"] };

describe("who may do what", () => {
  it("permits everything when no policy is declared", () => {
    /*
     * The absence of a policy is not "nothing works", it is "permission is
     * not a concern here yet". Anything else would make every app pay for
     * users it does not have.
     */
    const open = store(false);
    expect(open.permits({ name: "reassign", args: { dutyId: "d1" } }, child).ok).toBe(true);
  });

  it("refuses at the store, where nothing can go around it", () => {
    const live = store();
    expect(() =>
      live.apply({ name: "reassign", args: { dutyId: "d1", toPersonId: "ana" } }, { author: child }),
    ).toThrow(PermissionDeniedError);
    // And the graph is untouched, not half-changed.
    expect(live.graph.out("d1", "assigned-to")).toEqual([]);
    expect(live.log.length).toBe(0);
  });

  it("narrows by the subject's kind, not only by the mutation", () => {
    const live = store();
    // A child may rename a duty...
    expect(live.permits({ name: "rename", args: { id: "d1" } }, child).ok).toBe(true);
    // ...and not a person, though it is the same mutation.
    expect(live.permits({ name: "rename", args: { id: "ana" } }, child).ok).toBe(false);
  });

  it("names who could, so a refusal says something useful", () => {
    const verdict = store().permits({ name: "rename", args: { id: "ana" } }, child);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.wouldNeed).toEqual(["parent"]);
    expect(verdict.refusal.message).toContain("parent can");
  });

  /*
   * `describe` on a grant has been documented from the day it was added as
   * "shown when an action is withheld, so a refusal can say something
   * useful" — and nothing read it. Every refusal on every surface was a
   * mutation id and a list of role names: what the declaration says, not what
   * the organisation means.
   */
  it("repeats the policy's own sentence, which is why the grant has one", () => {
    const verdict = store().permits({ name: "reassign", args: { id: "d1" } }, child);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.message).toContain("A parent keeps the rota.");
    expect(whyNot(policy, "reassign")).toEqual(["A parent keeps the rota."]);
  });

  it("says nothing extra when the grants have nothing to say", () => {
    const quiet = {
      roles: ["parent", "child"],
      grants: [{ roles: ["parent"], mutations: "*" }],
    };
    expect(whyNot(quiet, "rename")).toEqual([]);
  });

  it("speaks the subject kind rather than spelling it", () => {
    const verdict = store().permits({ name: "rename", args: { id: "ana" } }, child);
    if (verdict.ok) return;
    expect(verdict.refusal.message).toContain("on a person");
  });

  it("refuses a whole gesture before running any of it", () => {
    /*
     * A batch that applied three of five and then refused the fourth would
     * leave the graph in a state nobody asked for — and the answer to "may
     * I" must not depend on how far through the list you got.
     */
    const live = store();
    expect(() =>
      live.applyAll(
        [
          { name: "rename", args: { id: "d1", label: "Fine" } },
          { name: "rename", args: { id: "ana", label: "Not fine" } },
        ],
        { author: child },
      ),
    ).toThrow(PermissionDeniedError);
    expect((live.graph.getNode("d1") as { label: string }).label).toBe("Mon run");
  });

  it("hands a principal only the mutations they may run", () => {
    expect(store().permittedMutations(child).map((m) => m.name)).toEqual(["rename"]);
    expect(store().permittedMutations(parent).map((m) => m.name).sort()).toEqual([
      "reassign",
      "rename",
    ]);
  });

  it("judges an undo, because undo is otherwise the way around the policy", () => {
    /*
     * A child who may not reassign could otherwise take back a parent's
     * reassignment and arrive at exactly the state they were refused. What
     * you may undo is what you may have done.
     */
    const live = store();
    const done = live.apply(
      { name: "reassign", args: { dutyId: "d1", toPersonId: "ana" } },
      { author: parent },
    );
    expect(() => live.undo(done.batch, { author: child })).toThrow(PermissionDeniedError);
    // The parent can, and the state comes back.
    live.undo(done.batch, { author: parent });
    expect(live.graph.out("d1", "assigned-to")).toEqual([]);
  });

  it("is the same fact as attribution, so the log blames who was judged", () => {
    const live = store();
    live.apply({ name: "rename", args: { id: "d1", label: "Tuesday run" } }, { author: child });
    const op = live.log.all().at(-1)!;
    expect(op.author).toMatchObject({ kind: "human", id: "c", roles: ["child"] });
  });
});

describe("graview check reads the policy", () => {
  const app = (declared: Policy) =>
    defineApp({ name: "test", schema, mutations: [reassign, rename], policy: declared });
  const findings = (declared: Policy) =>
    checkApp(app(declared)).findings.map((f) => `${f.severity}:${f.code}`);

  it("passes a policy where every role and every mutation is reachable", () => {
    expect(findings(policy)).toEqual([]);
  });

  it("reports a mutation no role can ever run", () => {
    expect(
      findings({ roles: ["child"], grants: [{ roles: ["child"], mutations: ["rename"] }] }),
    ).toContain("error:mutation-unreachable-by-any-role");
  });

  it("reports a role that may do nothing", () => {
    expect(
      findings({
        roles: ["parent", "guest"],
        grants: [{ roles: ["parent"], mutations: "*" }],
      }),
    ).toContain("warning:role-may-do-nothing");
  });

  it("reports a grant naming a mutation or kind nobody declared", () => {
    const said = findings({
      grants: [
        { roles: ["parent"], mutations: ["teleport"] },
        { roles: ["parent"], mutations: ["rename"], kinds: ["unicorn"] },
      ],
    });
    expect(said).toContain("error:grant-unknown-mutation");
    expect(said).toContain("error:grant-unknown-kind");
  });
});
