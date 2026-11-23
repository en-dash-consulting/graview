import { bindSchema, createSchema, defineNode, nodeRef, Store, TOUCHED_FIELDS, z, type AnySchema, type Policy, type Principal } from "@graview/core";
import { bindPerson, hostSeat } from "@graview/core/binding";
import { describe, expect, it } from "vitest";
import { factsOf } from "../../src/facts.js";
import { createToolRuntime } from "../../src/index.js";

/**
 * A PAGE OF RECORDS SAYS EACH ONE'S LAST CHANGE ONCE (Graview HQ
 * feature:f-touched-size-on-agent-read-surfaces). Since 0.2.10 every
 * record keeps `createdAt`, `createdBy`, `updatedAt` and `updatedBy`, about
 * 155 characters a record. Where a model reads many records at once — a
 * page of the graph, the facts an ask is told — each says them once,
 * `changed: "3 days ago by Ann"`, the person by name; a page of 50 grows by
 * under 40 characters a record against 0.2.9, which said none. `get_node`,
 * the whole record, keeps all four.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string(), note: z.string().optional() }) } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const renameGift = defineMutation("rename-gift", {
  subject: { kinds: ["gift"], arg: "id" },
  input: z.object({ id: nodeRef(["gift"]), title: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id as string, { title: args.title });
  },
});
const policy: Policy = { grants: [{ roles: ["member"], mutations: ["rename-gift"] }], sees: [{ roles: ["member"], kinds: ["participant", "gift"] }, { roles: ["guest"], kinds: ["gift"] }] };
const host = hostSeat({ id: "host" });
const ann: Principal = { kind: "human", id: "user_ann", roles: ["member"] };
const gus: Principal = { kind: "human", id: "user_gus", roles: ["guest"] };

const DAY = 86_400_000;
const START = Date.now() - 3 * DAY - 3_600_000;

function fifty(): Store<AnySchema> {
  let at = START;
  const store = new Store<AnySchema>({
    schema,
    mutations: [renameGift],
    policy,
    now: () => new Date((at += 1_000)).toISOString(),
    snapshot: { nodes: [{ id: "participant:ann", kind: "participant", name: "Ann" }], edges: [] },
  } as never);
  bindPerson(store, ann, "participant:ann", { author: host });
  store.applyPrimitives(Array.from({ length: 50 }, (_, n) => ({ op: "add-node", node: { id: `gift:${n}`, kind: "gift", title: `Gift ${n}`, note: "wrapped" } })) as never, { author: host });
  for (let n = 0; n < 50; n++) store.apply({ name: "rename-gift", args: { id: `gift:${n}`, title: `Gift number ${n}` } }, { author: ann });
  return store;
}

type Page = { nodes: Record<string, unknown>[]; more?: string };

/** Every gift on every page of `get_graph`, as the seat reads them. */
async function gifts(store: Store<AnySchema>, reader: Principal): Promise<Record<string, unknown>[]> {
  const tools = createToolRuntime(store, { author: reader });
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; ) {
    const answer = (await tools.call("get_graph", { offset })) as { ok: boolean; data: Page };
    expect(answer.ok).toBe(true);
    out.push(...answer.data.nodes);
    offset += answer.data.nodes.length;
    if (!answer.data.more || answer.data.nodes.length === 0) break;
  }
  return out.filter((node) => node["kind"] === "gift");
}

describe("a page of records an agent reads", () => {
  it("says each record's last change once, as the person, and none of the four", async () => {
    for (const reader of [host, ann]) {
      const page = await gifts(fifty(), reader);
      expect(page).toHaveLength(50);
      for (const node of page) {
        for (const field of TOUCHED_FIELDS) expect(node, reader.id).not.toHaveProperty(field);
        expect(node["changed"], reader.id).toBe("3 days ago by Ann");
      }
      expect(JSON.stringify(page)).not.toContain("user_ann");
    }
  });

  it("says nothing of who or when to a seat told none of the four", async () => {
    const page = await gifts(fifty(), gus);
    expect(page).toHaveLength(50);
    for (const node of page) {
      expect(node).not.toHaveProperty("changed");
      for (const field of TOUCHED_FIELDS) expect(node).not.toHaveProperty(field);
    }
    expect(JSON.stringify(page)).not.toMatch(/Ann|user_ann|participant:ann/);
  });

  it("grows a page of 50 by under 40 characters a record against one that said none of them", async () => {
    const page = await gifts(fifty(), host);
    const asBefore = page.map(({ changed: _changed, ...rest }) => rest);
    const grown = (JSON.stringify(page).length - JSON.stringify(asBefore).length) / page.length;
    expect(grown).toBeGreaterThan(0);
    expect(grown).toBeLessThan(40);
  });

  it("keeps all four on get_node, the whole record", async () => {
    const tools = createToolRuntime(fifty(), { author: host });
    const answer = (await tools.call("get_node", { id: "gift:7" })) as { data: { node: Record<string, unknown> } };
    for (const field of TOUCHED_FIELDS) expect(answer.data.node).toHaveProperty(field);
    expect(answer.data.node["updatedBy"]).toBe("participant:ann");
    expect(answer.data.node).not.toHaveProperty("changed");
  });

  it("tells an ask's facts the change once as well", () => {
    const facts = factsOf(fifty(), host, ["gift:3"]);
    expect(facts[0]!.fields).toMatchObject({ changed: "3 days ago by Ann" });
    for (const field of TOUCHED_FIELDS) expect(facts[0]!.fields).not.toHaveProperty(field);
  });
});
