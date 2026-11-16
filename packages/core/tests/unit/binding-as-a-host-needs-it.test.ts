import { describe, expect, it } from "vitest";
import { bindPerson, mayBind } from "../../src/binding.js";
import { aiContextOf } from "../../src/catalog.js";
import { readableFields } from "../../src/schema/reading.js";
import { createSchema, defineNode, FieldRevisions, fieldsWritten, PERSON_SEAT, seatsKept, Store, unseatedOp, writtenBy, z, type AnySchema, type Principal } from "../../src/index.js";

/**
 * BINDING A PERSON AS A HOST NEEDS IT (Roadmap f-binding-dry-run-and-seat-rules).
 * A host asks whether a record may be bound before it has a seat to bind
 * (`mayBind`), strips a raw log by the framework's own rule for a reader
 * (`seatsKept`), and keeps per-field revisions that say nothing of a seat.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string(), age: z.number() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift]);

const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };

function family(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    snapshot: {
      nodes: [
        { id: "participant:bud", kind: "participant", name: "Bud", age: 12 },
        { id: "participant:ann", kind: "participant", name: "Ann", age: 40 },
        { id: "gift:kite", kind: "gift", title: "A kite" },
      ],
      edges: [],
    },
  } as never);
}

describe("asking whether a record may be bound, with no seat yet", () => {
  it("says yes for a person nobody is", () => {
    expect(mayBind(family(), "participant:bud")).toEqual({ ok: true });
  });

  it("says no, with the sentence a binding gives, for a record already someone's", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(mayBind(store, "participant:bud")).toEqual({ ok: false, reason: "Bud is already someone else's record here." });
    expect(() => bindPerson(store, ann, "participant:bud", { author: host })).toThrow("Bud is already someone else's record here.");
  });

  it("says no for a record that is not a person, and for one that is not there", () => {
    const store = family();
    expect(mayBind(store, "gift:kite")).toMatchObject({ ok: false, reason: expect.stringMatching(/A kite is a gift, not a participant/) });
    expect(mayBind(store, "participant:nobody")).toMatchObject({ ok: false, reason: expect.stringMatching(/not there/) });
  });

  it("says no where no kind is the people", () => {
    const store = new Store<AnySchema>({ schema: createSchema([gift]), snapshot: { nodes: [{ id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);
    expect(mayBind(store, "gift:kite")).toMatchObject({ ok: false, reason: expect.stringMatching(/no kind/) });
  });

  it("changes nothing and makes no op", () => {
    const store = family();
    const before = store.log.all().length;
    mayBind(store, "participant:bud");
    expect(store.log.all().length).toBe(before);
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty(PERSON_SEAT);
  });
});

describe("a raw log stripped by the framework's own rule", () => {
  it("keeps the seat for the host and the seat's own account, and for nobody else", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    const op = store.log.all().at(-1)!;
    expect(JSON.stringify(unseatedOp(op, seatsKept(host)))).toContain("acct-bud");
    expect(JSON.stringify(unseatedOp(op, seatsKept(bud)))).toContain("acct-bud");
    expect(JSON.stringify(unseatedOp(op, seatsKept(ann)))).not.toContain("acct-bud");
  });
});

describe("per-field revisions", () => {
  it("say nothing of whose record a person is", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, { author: host });
    const ops = store.log.all();
    expect(ops.flatMap((op) => op.primitives.flatMap((one) => fieldsWritten(one))).map(([, field]) => field)).not.toContain(PERSON_SEAT);
    expect([...writtenBy(ops)].some((key) => key.includes(PERSON_SEAT))).toBe(false);
    const revisions = FieldRevisions.of(ops);
    expect(revisions.of("participant:bud", "age")).toBe(ops.at(-1)!.seq);
    expect(revisions.baseFor(ops).map((one) => one.field)).not.toContain(PERSON_SEAT);
  });
});

describe("what is said of a bound person", () => {
  it("never reads the seat as one of its fields, even to the host", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    const node = store.graph.getNode("participant:bud")!;
    expect(node).toHaveProperty(PERSON_SEAT, "acct-bud");
    expect(JSON.stringify(readableFields(node, schema.tryDefinition("participant")))).not.toContain("acct-bud");
  });

  it("tells a model nothing of a seat in the state the inline AI reads", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    bindPerson(store, ann, "participant:ann", { author: host });
    for (const principal of [host, bud, ann]) {
      for (const target of [{ on: "record", id: "participant:bud" }, { on: "list", kind: "participant" }, { on: "selection", ids: ["participant:bud", "participant:ann"] }] as const) {
        expect(JSON.stringify(aiContextOf(store, target, { principal }))).not.toMatch(/acct-|\$seat/);
      }
    }
  });
});
