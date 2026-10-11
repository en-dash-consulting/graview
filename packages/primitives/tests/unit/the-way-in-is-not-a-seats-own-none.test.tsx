// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Begin, registerDefaultViews } from "../../src/index.js";

/**
 * THE WAY IN IS NOT A SEAT'S OWN "NONE YET" (W-183). A tool library of 379
 * tools, 280 members and twenty holds opened, for a member with no holds of
 * their own, on "Begin — what has to exist before the rest of it can … Holds
 * none yet"; for somebody browsing, "Members none yet". Neither was true of
 * the library, and the home that should have been there was not.
 */
const tool = defineNode("tool", { fields: z.object({ label: z.string() }), plural: "Tools" });
const member = defineNode("member", { fields: z.object({ label: z.string() }), plural: "Members" });
const hold = defineNode("hold", { fields: z.object({ label: z.string() }), plural: "Holds", edges: { "held-for": { to: ["member"], description: "who it is for", inverse: "their holds" } } });
const schema = createSchema([tool, member, hold]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-tool", { creates: ["tool"], input: z.object({ label: z.string() }), apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "tool"), kind: "tool", label: args.label }) });
const join = defineMutation("join", { title: "Join the library", creates: ["member"], input: z.object({ label: z.string() }), apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "member"), kind: "member", label: args.label }) });
const place = defineMutation("place-hold", {
  title: "Place a hold",
  creates: ["hold"],
  subject: { kinds: ["member"], arg: "memberId" },
  input: z.object({ memberId: nodeRef(["member"]), label: z.string() }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "hold");
    ctx.addNode({ id, kind: "hold", label: args.label });
    ctx.addEdge({ kind: "held-for", from: id, to: args.memberId });
  },
});
const policy = {
  roles: ["member", "librarian"],
  sees: [
    { roles: "*" as const, kinds: ["tool"] },
    { roles: ["librarian"], kinds: ["member", "hold"] },
    { roles: ["member"], kinds: ["member", "hold"], own: true },
  ],
  grants: [
    { roles: ["librarian"], mutations: "*" as const },
    { roles: "*" as const, mutations: ["join"] },
    { roles: ["member"], mutations: ["place-hold"], self: true },
  ],
};

async function homeAs(principal: Principal) {
  const store = new Store({
    schema,
    mutations: [add, join, place],
    policy,
    snapshot: {
      nodes: [
        { id: "drill", kind: "tool", label: "Hammer drill" },
        { id: "ana", kind: "member", label: "Ana" },
        { id: "ben", kind: "member", label: "Ben" },
        { id: "h1", kind: "hold", label: "Ben's hold" },
      ] as never,
      edges: [{ kind: "held-for", from: "h1", to: "ben" }],
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} principal={principal} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        <Begin whenFull={<p data-testid="home">The home</p>} />
      </GraviewProvider>,
    ),
  );
  const said = host.textContent ?? "";
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("the way in, for a seat that sees only its own", () => {
  it("is the home for a member with no holds of their own, in a library with some", async () => {
    const said = await homeAs({ kind: "human", id: "ana", roles: ["member"] });
    expect(said).toBe("The home");
  });

  it("is the home for somebody browsing, who sees no members at all", async () => {
    const said = await homeAs({ kind: "human", id: "browsing", roles: [] });
    expect(said).not.toContain("none yet");
    expect(said).toBe("The home");
  });
});
