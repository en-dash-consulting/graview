import "@graview/core/field-sight";
import { createSchema, defineNode, Store, z, type AnySchema, type Policy, type Principal } from "@graview/core";

/**
 * A club whose sight keeps something from every seat but a member's: the
 * vendors are members' alone; parents see each player without a phone, and
 * each memo without its code, which a memo cannot be without, so a parent
 * is handed no memo at all; a parent sees only their own shifts. A visitor
 * is shown the players' names and nothing more.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), plural: "Vendors" });
const player = defineNode("player", { fields: z.object({ label: z.string(), phone: z.string().optional() }), plural: "Players" });
const memo = defineNode("memo", { fields: z.object({ label: z.string(), code: z.string() }), plural: "Memos" });
const shift = defineNode("shift", { fields: z.object({ label: z.string() }), plural: "Shifts" });
export const clubSchema = createSchema([vendor, player, memo, shift]);
export const clubPolicy: Policy = {
  roles: ["member", "parent"],
  grants: [{ roles: ["member"], mutations: "*" }],
  sees: [
    { roles: ["member"], kinds: ["vendor", "player", "memo", "shift"] },
    { roles: ["parent"], kinds: ["player"], hide: ["phone"] },
    { roles: "*", kinds: ["player"], fields: ["label"] },
    { roles: ["parent"], kinds: ["memo"], hide: ["code"] },
    { roles: ["parent"], kinds: ["shift"], own: true },
  ],
};
export const club = () =>
  new Store<AnySchema>({
    schema: clubSchema as AnySchema,
    mutations: [],
    policy: clubPolicy,
    snapshot: {
      nodes: [
        { id: "vendor:bakery", kind: "vendor", label: "Hart's Bakery" },
        { id: "vendor:kits", kind: "vendor", label: "Kit Shack" },
        { id: "player:ada", kind: "player", label: "Ada", phone: "555 0101" },
        { id: "memo:gate", kind: "memo", label: "Gate", code: "7731" },
        { id: "shift:sat", kind: "shift", label: "Saturday bar" },
        { id: "shift:sun", kind: "shift", label: "Sunday gate" },
      ] as never,
      edges: [],
    },
  });
export const member: Principal = { kind: "human", id: "member:mo", roles: ["member"] };
export const parent: Principal = { kind: "human", id: "parent:pat", roles: ["parent"] };
export const visitor: Principal = { kind: "human", shared: true, roles: [] };
