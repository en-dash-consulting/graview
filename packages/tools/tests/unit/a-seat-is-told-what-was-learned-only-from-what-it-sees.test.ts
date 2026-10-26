import { bindSchema, createSchema, defineApp, defineNode, Store, z, type AnySchema, type GraviewApp, type Policy, type Principal } from "@graview/core";
import "@graview/core/field-sight";
import { describe, expect, it } from "vitest";
import { createMcpAdapter } from "../../src/agent/adapters.js";
import { createToolRuntime } from "../../src/agent/tools.js";
import { learningOf } from "../../src/learn-cli.js";

/*
 * A SEAT IS TOLD WHAT WAS LEARNED ONLY FROM WHAT IT SEES (Roadmap
 * f-learned-suggestions). What the app's own actor learned from use names
 * the values people keep writing in a field ("Make the vendor's tier a
 * choice of Gold and Silver"). `graview mcp` hands a seat that list
 * (`list_app_suggestions`), and it was learned over the whole store: an
 * agent seated as a member, whose sight hides a vendor's tier and every
 * contract, read the tiers and the contracts' statuses in it. Learned for
 * a seat, it is learned from that seat's sight — the records and the log as
 * they are served to it — so a hidden field or kind says nothing, and two
 * stores that differ only in what it may not see tell it the same.
 */
const vendor = defineNode("vendor", { fields: z.object({ name: z.string(), tier: z.string().optional() }), plural: "Vendors" });
const contract = defineNode("contract", { fields: z.object({ title: z.string(), status: z.string().optional() }), plural: "Contracts" });
const schema = createSchema([vendor, contract]);
const { defineMutation } = bindSchema(schema);
const addVendor = defineMutation("add-vendor", {
  title: "Add a vendor",
  creates: ["vendor"],
  input: z.object({ name: z.string(), tier: z.string().optional() }),
  describe: (args) => `Add ${args.name}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "vendor"), kind: "vendor", name: args.name, ...(args.tier ? { tier: args.tier } : {}) });
  },
});
const addContract = defineMutation("add-contract", {
  title: "Add a contract",
  creates: ["contract"],
  input: z.object({ title: z.string(), status: z.string().optional() }),
  describe: (args) => `Add ${args.title}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.title, "contract"), kind: "contract", title: args.title, ...(args.status ? { status: args.status } : {}) });
  },
});
const policy = {
  roles: ["owner", "member"],
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["owner"], kinds: ["vendor", "contract"] },
    { roles: ["member"], kinds: ["vendor"], hide: ["tier"] },
  ],
} as unknown as Policy;
const mutations = [addVendor, addContract] as never;
const app = defineApp({ name: "Vendors", schema, mutations, policy } as never) as unknown as GraviewApp<AnySchema>;
const member: Principal = { kind: "agent", id: "agent:helper", roles: ["member"] };
const owner: Principal = { kind: "human", id: "person:p1", roles: ["owner"] };

function world(tiers: readonly [string, string], statuses: readonly [string, string]) {
  const store = new Store<AnySchema>({ schema: schema as unknown as AnySchema, mutations, policy });
  let n = 0;
  for (const id of ["p1", "p2", "p3"]) {
    const author: Principal = { kind: "human", id: `person:${id}`, roles: ["owner"] };
    for (const at of [0, 1]) {
      n += 1;
      store.apply({ name: "add-vendor", args: { name: `V${n}`, tier: tiers[at] } }, { author });
      store.apply({ name: "add-contract", args: { title: `C${n}`, status: statuses[at] } }, { author });
    }
  }
  return store;
}

/** The seat's list, wired as `graview mcp` wires it. */
async function told(store: Store<AnySchema>, seat: Principal): Promise<string> {
  const runtime = createToolRuntime(store, { author: seat, app, learned: () => learningOf(app, store, [], [], { seat }).suggestions });
  const answer = await createMcpAdapter(runtime).callTool("list_app_suggestions", {});
  return answer.content.map((part) => part.text).join("");
}

describe("what the app's own actor learned, told to a seat", () => {
  it("names the values of a field the seat sees: an owner is told the tiers and the statuses", async () => {
    const said = await told(world(["DUMMY-T1", "DUMMY-T2"], ["DUMMY-S1", "DUMMY-S2"]), owner);
    expect(said).toContain("DUMMY-T1");
    expect(said).toContain("DUMMY-S1");
  });

  it("names no value of a field the seat's sight hides, nor of a kind it does not see", async () => {
    const said = await told(world(["DUMMY-T1", "DUMMY-T2"], ["DUMMY-S1", "DUMMY-S2"]), member);
    expect(said).not.toContain("DUMMY-T");
    expect(said).not.toContain("DUMMY-S");
  });

  it("is the same for two stores that differ only in what the seat may not see", async () => {
    expect(await told(world(["DUMMY-T1", "DUMMY-T2"], ["DUMMY-S1", "DUMMY-S2"]), member)).toBe(await told(world(["DUMMY-X1", "DUMMY-X2"], ["DUMMY-Y1", "DUMMY-Y2"]), member));
  });
});
