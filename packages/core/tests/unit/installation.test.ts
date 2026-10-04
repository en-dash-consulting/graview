import { describe, expect, it } from "vitest";
import {
  checkApp,
  createSchema,
  declareInstallation,
  defineApp,
  INSTALLATION_MODULE,
  PermissionDeniedError,
  Store,
  type Principal,
} from "../../src/index.js";

/*
 * The installation is in the graph: users and invitations are nodes, the
 * acts on them are ordinary mutations, and the policy says who may. What
 * these tests pin down is that nothing here is special-cased — the checker
 * reads it, the store refuses it, the derived edit is the profile.
 */

const installation = declareInstallation({ roles: ["coordinator", "gardener"], admin: "coordinator" });
const schema = createSchema([...installation.kinds]);
// The app's own policy names the gardener and grants nothing beyond what the
// installation gives everyone: their own profile. That is enough to be a role.
const app = defineApp({
  name: "Garden",
  schema,
  mutations: installation.mutations as never,
  modules: installation.modules,
  policy: installation.withPolicy({ roles: ["gardener"], grants: [] }),
});
const june: Principal = { kind: "human", id: "june", roles: ["coordinator"] };
const ravi: Principal = { kind: "human", id: "ravi", roles: ["gardener"] };
const store = () =>
  new Store({
    schema,
    mutations: installation.mutations as never,
    modules: installation.modules,
    policy: app.policy,
    snapshot: {
      nodes: [
        { id: "june", kind: "user", label: "June", email: "june@garden.test", roles: ["coordinator"], status: "active" },
        { id: "ravi", kind: "user", label: "Ravi", email: "ravi@garden.test", roles: ["gardener"], status: "active" },
      ],
      edges: [],
    },
  });

describe("the installation, declared", () => {
  it("passes the checker like any declaration — both readings on its edge, a title on every act", () => {
    const result = checkApp(app);
    expect(result.findings.map((f) => `${f.severity}:${f.code}`)).toEqual([]);
  });

  it("is a module drawn only for those who administer it", () => {
    const s = store();
    expect([...s.modules.administered.keys()]).toEqual([INSTALLATION_MODULE]);
    expect(s.mayAdminister(INSTALLATION_MODULE, june)).toBe(true);
    expect(s.mayAdminister(INSTALLATION_MODULE, ravi)).toBe(false);
    // A gardener never sees a district for people or invitations.
    expect([...s.kindsKeptFrom(ravi)].sort()).toEqual(["invitation", "user"]);
    expect([...s.kindsKeptFrom(june)]).toEqual([]);
  });
});

describe("who is here", () => {
  it("invite, then welcome: an invitation becomes a person with the roles it carried", () => {
    const s = store();
    s.apply({ name: "invite", args: { email: "sam@garden.test", roles: ["gardener"] } }, { author: june });
    const [asked] = s.graph.nodesOfKind("invitation");
    expect((asked as { status: string }).status).toBe("pending");
    s.apply({ name: "welcome", args: { invitationId: asked!.id, label: "Sam" } }, { author: june });
    const sam = s.graph.nodesOfKind("user").find((u) => (u as { label: string }).label === "Sam")!;
    expect((sam as { roles: string[] }).roles).toEqual(["gardener"]);
    expect((s.graph.getNode(asked!.id) as { status: string }).status).toBe("accepted");
    expect(s.graph.out(asked!.id, "became")[0]?.id).toBe(sam.id);
    // Accepted is behind the horizon: the invitation is not current any more.
    expect(s.log.all().map((op) => op.author.id)).toEqual(["june", "june"]);
  });

  it("a welcomed invitation cannot be welcomed twice", () => {
    const s = store();
    s.apply({ name: "invite", args: { email: "sam@garden.test", roles: ["gardener"] } }, { author: june });
    const [asked] = s.graph.nodesOfKind("invitation");
    s.apply({ name: "welcome", args: { invitationId: asked!.id, label: "Sam" } }, { author: june });
    expect(() => s.apply({ name: "welcome", args: { invitationId: asked!.id, label: "Sam again" } }, { author: june })).toThrow(
      /pending/,
    );
  });

  it("grant and revoke change what a person holds, once", () => {
    const s = store();
    s.apply({ name: "grant", args: { userId: "ravi", role: "coordinator" } }, { author: june });
    s.apply({ name: "grant", args: { userId: "ravi", role: "coordinator" } }, { author: june });
    expect((s.graph.getNode("ravi") as { roles: string[] }).roles).toEqual(["gardener", "coordinator"]);
    s.apply({ name: "revoke", args: { userId: "ravi", role: "gardener" } }, { author: june });
    expect((s.graph.getNode("ravi") as { roles: string[] }).roles).toEqual(["coordinator"]);
  });

  it("only the administering role may run the acts, and the refusal says who could", () => {
    const s = store();
    expect(() => s.apply({ name: "invite", args: { email: "x@y.z", roles: ["gardener"] } }, { author: ravi })).toThrow(
      PermissionDeniedError,
    );
    const verdict = s.permits({ name: "remove-user", args: { userId: "june" } }, ravi);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.message).toContain("coordinator can");
  });
});

describe("a profile is yours", () => {
  it("anyone may change their own name through the derived edit, and nobody else's", () => {
    const s = store();
    // The derived edit of a user exists because label and email are never written by a declared act.
    expect(s.allMutations().map((m) => m.name)).toContain("edit-user");
    s.apply({ name: "edit-user", args: { id: "ravi", label: "Ravi K." } }, { author: ravi });
    expect((s.graph.getNode("ravi") as { label: string }).label).toBe("Ravi K.");
    expect(() => s.apply({ name: "edit-user", args: { id: "june", label: "Nope" } }, { author: ravi })).toThrow(
      PermissionDeniedError,
    );
    // The verdict is the store's own, so a page asking before drawing gets the same answer.
    expect(s.permits({ name: "edit-user", args: { id: "june", label: "Nope" } }, ravi).ok).toBe(false);
    expect(s.permits({ name: "edit-user", args: { id: "ravi", label: "Fine" } }, ravi).ok).toBe(true);
  });

  it("the administering role may edit anyone's profile as well", () => {
    const s = store();
    s.apply({ name: "edit-user", args: { id: "ravi", label: "Ravi" } }, { author: june });
    expect((s.graph.getNode("ravi") as { label: string }).label).toBe("Ravi");
  });
});
