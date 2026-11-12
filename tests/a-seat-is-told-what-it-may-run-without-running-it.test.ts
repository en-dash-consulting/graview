import { ActRefusal, bindSchema, nodeRef, profilePersonId, refusalOf, Store, z, type AnySchema, type Principal } from "@graview/core";
import "@graview/core/field-sight";
import { compileDocument } from "@graview/core/check";
import { coach, MUTATIONS, parent, schema as rosterSchema, world } from "../packages/core/tests/support/hidden-phones.js";
import { formFields, type FormField } from "@graview/core/forms";
import { mayRun, mayRunEach, type MayRunAnswer } from "@graview/core/seat";
import { describe, expect, it, vi } from "vitest";
import { createRotaStore } from "../apps/rota/src/domain/app.js";
import rotaExample from "../apps/rota/src/data/example.json";
import { createTodoStore } from "../apps/todo/src/domain/app.js";
import todoExample from "../apps/todo/src/data/example.json";

/**
 * MAY THIS SEAT RUN THIS ACT ON THIS RECORD (HQ feature
 * f-may-seat-run-act-on-record). A host's route tool offered a chat's seat
 * only the acts it could run by rehearsing each in a copy of the store,
 * capped at three a call. `mayRun` asks the store's own judgment — the
 * policy, the own-records rule, the seat's sight, the act's own rule — and
 * runs nothing. Held here to what applying says, over every seat, act and
 * record of the two examples with a policy.
 */



/*
 * AN APP BUILT TO BE AWKWARD: a document whose sight keeps a field from a
 * member, shows them only the ideas they lead (`via`) and the ones they
 * made (`own`), whose `lead` act is granted only on the seat's own end,
 * whose conditions read the record and an argument, and a seat with a
 * profile whose person is not made yet — and beside it a roster whose sight
 * hides a phone, with a code act that refuses on what it is handed.
 */
const ideasDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Ideas",
  roles: ["lead", "member"],
  kinds: {
    member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } },
    idea: {
      noun: "idea",
      plural: "ideas",
      fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"], default: "open", required: true }, secret: { type: "string" }, note: { type: "string" } },
      edges: { ledBy: { to: ["member"], cardinality: "one", description: "who leads it", inverse: "what they lead" } },
    },
  },
  acts: {
    "add-idea": { title: "Add an idea", creates: "idea", description: "Put an idea on the board." },
    "close-idea": { title: "Close it", on: "idea", sets: { status: "done" }, allowedWhen: "status == 'open'", refusal: "{title} is already closed", description: "Say it is done." },
    "note-idea": { title: "Note it", on: "idea", args: { words: { type: "string", required: true } }, sets: { note: "$words" }, allowedWhen: "words != 'nope'", refusal: "not that note", description: "Note something about it." },
    // Conditions that read an argument a call may leave out: one optional, one with a default.
    "explain-idea": { title: "Explain it", on: "idea", args: { words: { type: "string", required: true }, why: { type: "string" } }, sets: { note: "$words" }, allowedWhen: "present(why)", refusal: "say why", description: "Explain it, saying why." },
    "push-idea": { title: "Push it", on: "idea", args: { words: { type: "string", required: true }, force: { type: "boolean", default: false } }, sets: { note: "$words" }, allowedWhen: "force", refusal: "only when forced", description: "Push it, when forced." },
    "set-secret": { title: "Set the secret", on: "idea", args: { value: { type: "string", required: true } }, sets: { secret: "$value" }, description: "Keep the secret." },
    lead: { title: "Lead it", fromTheOtherEnd: "Lead this idea", on: "idea", effects: [{ connect: "ledBy", from: "$subject", to: "$leader" }], description: "Say who leads it." },
  },
  policy: {
    grants: [
      { roles: ["lead"], mutations: "*" },
      { roles: ["member"], mutations: ["add-idea", "close-idea", "note-idea", "explain-idea", "push-idea", "set-secret"] },
      { roles: "*", mutations: ["lead"], ownEnd: true },
    ],
    sees: [
      { roles: ["lead"], kinds: ["member", "idea"] },
      { roles: ["member"], kinds: ["member"] },
      { roles: ["member"], kinds: ["idea"], via: "ledBy", hide: ["secret"] },
      { roles: ["member"], kinds: ["idea"], own: true, hide: ["secret"] },
    ],
  },
};
function ideas(): Store<AnySchema> {
  const compiled = compileDocument(ideasDocument as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app;
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: {
      nodes: [
        { id: "member:lee", kind: "member", name: "Lee" },
        { id: "member:mo", kind: "member", name: "Mo" },
        { id: "idea:picnic", kind: "idea", title: "A picnic", status: "open", secret: "in the rain" },
        { id: "idea:quiz", kind: "idea", title: "A quiz", status: "done", $leftAlone: true },
        { id: "idea:fair", kind: "idea", title: "A fair", status: "open" },
      ],
      edges: [{ kind: "ledBy", from: "idea:picnic", to: "member:mo" }],
    } as never,
  });
  // Mo made the fair: their own record, by the log.
  store.apply({ name: "note-idea", args: { id: "idea:fair", words: "bring a tent" } }, { author: { kind: "human", id: "member:lee", roles: ["lead"] } });
  return store;
}

/** The roster whose sight hides a player's phone from a parent, with a code act that refuses on what it is handed and fills a default. */
const { defineMutation } = bindSchema(rosterSchema);
const sizePlayer = defineMutation("size-player", {
  title: "Size the shirt",
  subject: { kinds: ["player"], arg: "id" },
  writes: ["team"],
  input: z.object({ id: nodeRef(["player"]), size: z.number().default(3), reason: z.string() }),
  apply(ctx, args) {
    if (args.reason === "no") throw new ActRefusal("No reason, no shirt.");
    if (args.size === undefined) throw new ActRefusal("No size.");
    ctx.patchNode(args.id, { team: `size ${args.size}` });
  },
});
/** A code act that goes wrong: the act's own fault, not what it was handed. */
const jamPlayer = defineMutation("jam-player", {
  title: "Jam",
  subject: { kinds: ["player"], arg: "id" },
  writes: ["team"],
  input: z.object({ id: nodeRef(["player"]) }),
  apply() {
    throw new Error("The jam went wrong.");
  },
});
function roster(): Store<AnySchema> {
  const built = world("555 0101");
  return new Store<AnySchema>({ schema: built.schema, mutations: [...(MUTATIONS as never[]), sizePlayer as never, jamPlayer as never], policy: built.policy!, snapshot: built.graph.snapshot() as never });
}

/** A plan whose events follow their plan items (`derives`): a change to one is kept in step in the other, in the same op. */
function followed(): Store<AnySchema> {
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: "Plans",
    roles: ["planner", "viewer"],
    kinds: {
      "plan-item": { fields: { name: { type: "string", required: true }, date: { type: "date" }, place: { type: "string" } } },
      event: {
        fields: { title: { type: "string", required: true }, start: { type: "date" }, where: { type: "string" } },
        edges: { source: { to: ["plan-item"], cardinality: "one" } },
        derives: { from: "plan-item", via: "source", set: { title: { expr: "name" }, start: { expr: "date" }, where: { expr: "concat(place, '')" } } },
      },
    },
    acts: { "add-plan-item": { creates: "plan-item", description: "Plan something." }, "add-event": { creates: "event", description: "Put it on the calendar." } },
    policy: { grants: [{ roles: ["planner"], mutations: "*" }, { roles: ["viewer"], mutations: ["add-event"] }] },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: {
      nodes: [
        { id: "i1", kind: "plan-item", name: "Park", date: "2026-11-01", place: "Riverside" },
        { id: "e1", kind: "event", title: "Park", start: "2026-11-01", where: "Riverside" },
        { id: "e2", kind: "event", title: "Something else", start: "2026-10-01" },
      ],
      edges: [{ kind: "source", from: "e1", to: "i1" }],
    } as never,
  });
}

const apps: { readonly name: string; readonly fresh: () => Store<AnySchema>; readonly seats: readonly Principal[] }[] = [
  {
    name: "a plan whose events follow their items",
    fresh: followed,
    seats: [
      { kind: "human", id: "pat", roles: ["planner"] },
      { kind: "human", id: "vic", roles: ["viewer"] },
    ],
  },
  {
    name: "a document app with field sight, own and via sight, an own-end grant and a profile seat",
    fresh: ideas,
    seats: [
      { kind: "human", id: "member:lee", roles: ["lead"] },
      { kind: "human", id: "member:mo", roles: ["member"] },
      { kind: "human", id: "acct-new", name: "Nia", roles: ["member"], profile: { id: "prf_nia", name: "Nia" } } as Principal,
      // The app's own actor, held to what people said: a record left alone is not changed by it.
      { kind: "system", id: "app:tidier", name: "Tidying", automated: true, tidying: true } as Principal,
      { kind: "human", id: "a-passer-by", roles: [] },
    ],
  },
  {
    name: "a roster that hides a phone, with a code act that refuses on an argument",
    fresh: roster,
    seats: [coach, parent, { kind: "human", id: "a-passer-by", roles: [] }],
  },
  {
    name: "rota",
    fresh: () => createRotaStore({ snapshot: rotaExample as never }) as unknown as Store<AnySchema>,
    seats: [
      { kind: "human", id: "user-jo", roles: ["coordinator"] },
      { kind: "human", id: "user-ada", roles: ["volunteer"] },
      { kind: "human", id: "user-sam", roles: ["viewer"] },
      { kind: "human", id: "a-passer-by", roles: [] },
    ],
  },
  {
    name: "todo",
    fresh: () => createTodoStore({ snapshot: todoExample as never }) as unknown as Store<AnySchema>,
    seats: [
      { kind: "human", id: "user-nora", roles: ["keeper"] },
      { kind: "human", id: "user-sam", roles: ["member"] },
      { kind: "human", id: "a-passer-by", roles: [] },
    ],
  },
];

/** A value for each argument an act cannot do without, as a person filling its form might give: the first record of a kind, a choice's first option. */
function filled(store: Store<AnySchema>, fields: readonly FormField[], given: Readonly<Record<string, unknown>>, every = false): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...given };
  for (const field of fields) {
    if (out[field.name] !== undefined || (field.optional && !every)) continue;
    // Every argument given, an optional one and one with a default too: a yes where a default is no.
    if (field.optional && every && !["text", "number", "date", "time", "choice", "boolean"].includes(field.control)) continue;
    switch (field.control) {
      case "text":
        out[field.name] = field.holds === "duration" ? 30 : "Filled in";
        break;
      case "number":
        out[field.name] = field.min ?? 1;
        break;
      case "date":
        out[field.name] = field.time ? "2026-11-12T09:00" : "2026-11-12";
        break;
      case "time":
        out[field.name] = "09:00";
        break;
      case "choice":
        out[field.name] = field.multiple ? [field.options?.[0]] : field.options?.[0];
        break;
      case "boolean":
        out[field.name] = every;
        break;
      case "list":
        out[field.name] = [];
        break;
      case "node": {
        const kinds = field.kinds.includes("*") ? store.schema.kinds : field.kinds;
        const first = kinds.flatMap((kind) => store.graph.nodesOfKind(kind as never)).find((node) => node.id !== given[Object.keys(given)[0] ?? ""]) ?? kinds.flatMap((kind) => store.graph.nodesOfKind(kind as never))[0];
        if (!first) return undefined;
        out[field.name] = first.id;
        break;
      }
      default:
        return undefined;
    }
  }
  return out;
}

/** Every act a store has, with every record it could be on (every record of its subject's kinds), or none for an act that makes one. */
function asks(store: Store<AnySchema>): { act: string; record?: string; subject?: string; fields: readonly FormField[] }[] {
  const out: { act: string; record?: string; subject?: string; fields: readonly FormField[] }[] = [];
  for (const mutation of store.allMutations()) {
    const fields = formFields(mutation.input);
    const subject = mutation.subject;
    if (!subject) {
      out.push({ act: mutation.name, fields });
      continue;
    }
    const kinds = subject.kinds === "*" ? store.schema.kinds : subject.kinds;
    for (const kind of kinds) {
      for (const node of store.graph.nodesOfKind(kind as never)) out.push({ act: mutation.name, record: node.id, subject: subject.arg, fields });
      for (const node of store.graph.nodesOfKind(kind as never, { archived: true } as never)) if (!out.some((one) => one.act === mutation.name && one.record === node.id)) out.push({ act: mutation.name, record: node.id, subject: subject.arg, fields });
    }
  }
  return out;
}

/** What applying the call says: it ran, or the reason it was refused. */
function applied(make: () => Store<AnySchema>, seat: Principal, name: string, args: Record<string, unknown>): { ok: true } | { ok: false; reason: string; sentence: string } {
  const store = make();
  try {
    store.apply({ name, args }, { author: seat });
    return { ok: true };
  } catch (error) {
    const said = refusalOf(error);
    return { ok: false, reason: said.reason, sentence: said.sentence };
  }
}

describe("whether a seat may run an act on a record", () => {
  for (const { name, fresh, seats } of apps) {

    it(`agrees with applying it, for every seat, act and record of ${name}`, () => {
      const store = fresh();
      const disagreements: string[] = [];
      let compared = 0;
      const answers = new Set<string>();
      for (const seat of seats) {
        for (const every of [false, true]) for (const ask of asks(store)) {
          const given = ask.subject && ask.record ? { [ask.subject]: ask.record } : {};
          const args = filled(store, ask.fields, given, every);
          if (!args) continue;
          const told = mayRun(store, seat, { act: ask.act, args });
          const did = applied(fresh, seat, ask.act, args);
          compared += 1;
          answers.add(told.answer === "refused" ? `refused:${told.rule}` : told.answer);
          const at = `${seat.id} · ${ask.act}${ask.record ? ` · ${ask.record}` : ""}`;
          // Told to fill: only of a call applying refuses for what it was not handed (an edit given nothing to change), naming arguments it was not given.
          if (told.answer === "fill" && (did.ok || did.reason !== "invalid" || told.toFill.some((one) => args[one] !== undefined))) disagreements.push(`${at}: asked to fill ${told.toFill.join(", ")}, and applying said ${did.ok ? "it runs" : did.reason}`);
          else if (told.answer === "allowed" && !did.ok) disagreements.push(`${at}: told allowed, and applying refused it (${did.reason}: ${did.sentence})`);
          else if (told.answer === "refused" && did.ok) disagreements.push(`${at}: told refused (${told.rule}: ${told.message}), and applying ran it`);
          else if (told.answer === "refused" && !did.ok && told.reason !== did.reason) disagreements.push(`${at}: told ${told.reason}, and applying said ${did.reason}`);
        }
      }
      expect(disagreements).toEqual([]);
      expect(compared).toBeGreaterThan(100);
      // It said more than one thing: some acts are allowed, and some refused by the policy.
      expect(answers.has("allowed")).toBe(true);
      expect([...answers].some((one) => one.startsWith("refused:"))).toBe(true);
    });

    it(`on ${name}, handed only the record, names what is still to fill and refuses only what applying would`, () => {
      const store = fresh();
      const wrong: string[] = [];
      for (const seat of seats) {
        for (const every of [false, true]) for (const ask of asks(store)) {
          const given = ask.subject && ask.record ? { [ask.subject]: ask.record } : {};
          const told = mayRun(store, seat, { act: ask.act, ...(ask.record ? { record: ask.record } : {}) });
          const args = filled(store, ask.fields, given, every);
          if (!args) continue;
          const did = applied(fresh, seat, ask.act, args);
          const at = `${seat.id} · ${ask.act}${ask.record ? ` · ${ask.record}` : ""}`;
          // A refusal said before the arguments are given holds whatever they are; an allowed or a fill is one the filled call can meet.
          if (told.answer === "refused" && did.ok) wrong.push(`${at}: refused (${told.rule}) before its arguments, and applying them ran it`);
          if (told.answer === "fill" && told.toFill.some((one) => given[one] !== undefined)) wrong.push(`${at}: asked to fill what it was given`);
          // Nor is it told to fill, or allowed, an act applying refuses whatever it is handed: who may, what the seat may see of the record, the kind it acts on.
          // (Where the filled call names another record, its refusal may be that record's, which a call not given it cannot know.)
          const othersNamed = Object.entries(args).some(([key, value]) => key !== ask.subject && typeof value === "string" && store.graph.getNode(value) !== undefined);
          const always = !did.ok && !othersNamed && (did.reason === "forbidden" || did.reason === "missing" || / not on /.test(did.sentence));
          if (told.answer !== "refused" && always) wrong.push(`${at}: told ${told.answer}, and applying refused it whatever it was handed (${did.reason}: ${did.sentence})`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }

  it("refuses before its arguments an act that writes a field the seat's sight keeps, as applying does", () => {
    const store = ideas();
    const mo: Principal = { kind: "human", id: "member:mo", roles: ["member"] };
    expect(applied(ideas, mo, "set-secret", { id: "idea:picnic", value: "sunny" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(mayRun(store, mo, { act: "set-secret", record: "idea:picnic" })).toMatchObject({ answer: "refused", rule: "arguments", reason: "invalid" });
    expect(mayRun(store, mo, { act: "set-secret", record: "idea:picnic", args: { value: "sunny" } })).toMatchObject({ answer: "refused", reason: "invalid" });
    // The lead, who is shown the secret, may set it.
    expect(mayRun(store, { kind: "human", id: "member:lee", roles: ["lead"] }, { act: "set-secret", record: "idea:picnic" })).toEqual({ answer: "fill", toFill: ["value"] });
  });

  it("judges a condition on part of a call only where it reads no argument left out, optional or with a default", () => {
    const store = ideas();
    const mo: Principal = { kind: "human", id: "member:mo", roles: ["member"] };
    expect(mayRun(store, mo, { act: "explain-idea", record: "idea:picnic" })).toEqual({ answer: "fill", toFill: ["words"] });
    expect(applied(ideas, mo, "explain-idea", { id: "idea:picnic", words: "w", why: "because" })).toEqual({ ok: true });
    expect(mayRun(store, mo, { act: "push-idea", record: "idea:picnic" })).toEqual({ answer: "fill", toFill: ["words"] });
    expect(applied(ideas, mo, "push-idea", { id: "idea:picnic", words: "w", force: true })).toEqual({ ok: true });
    // Given whole, it is what applying says of it.
    expect(mayRun(store, mo, { act: "push-idea", record: "idea:picnic", args: { words: "w" } })).toMatchObject({ answer: "refused", rule: "condition", message: (applied(ideas, mo, "push-idea", { id: "idea:picnic", words: "w" }) as { sentence: string }).sentence });
  });

  it("judges a proposal and a vote as applying does, and tells nobody it asked", () => {
    const store = ideas();
    const lee: Principal = { kind: "human", id: "member:lee", roles: ["lead"] };
    let heard = 0;
    store.subscribe(() => (heard += 1));
    const before = JSON.stringify([store.version, store.log.length, store.graph.snapshot()]);
    const one = { name: "add-idea", args: { title: "A swap" } };
    for (const args of [{ calls: Array.from({ length: 501 }, () => one) }, { calls: [one] }, { calls: [] }]) {
      const told = mayRun(store, lee, { act: "propose-changes", args });
      expect(told.answer === "allowed", JSON.stringify(told)).toBe(applied(ideas, lee, "propose-changes", args).ok);
    }
    const anonymous = { kind: "human", roles: [] } as unknown as Principal;
    const signedOut = mayRun(store, anonymous, { act: "propose-changes", args: { calls: [one] } });
    expect(signedOut.answer === "allowed").toBe(applied(ideas, anonymous, "propose-changes", { calls: [one] }).ok);
    const vote = { suggestion: "op:nowhere", vote: "for" };
    expect(mayRun(store, lee, { act: "vote-suggestion", args: vote }).answer === "allowed").toBe(applied(ideas, lee, "vote-suggestion", vote).ok);
    expect(heard).toBe(0);
    expect(JSON.stringify([store.version, store.log.length, store.graph.snapshot()])).toBe(before);
    expect((store as unknown as { rehearsing: boolean }).rehearsing).toBe(false);
  });

  it("answers a whole call its input refuses with that refusal, and names only required arguments to fill", () => {
    const store = ideas();
    const lee: Principal = { kind: "human", id: "member:lee", roles: ["lead"] };
    for (const [act, args] of [
      ["note-idea", { id: "idea:picnic", words: "w", bogus: 1 }],
      ["edit-idea", { id: "idea:picnic", bogus: 1 }],
    ] as const) {
      const did = applied(ideas, lee, act, args);
      expect(did).toMatchObject({ ok: false, reason: "invalid" });
      expect(mayRun(store, lee, { act, args })).toMatchObject({ answer: "refused", rule: "arguments", reason: "invalid", message: (did as { sentence: string }).sentence });
    }
    // A field the seat's sight hides, written whole: refused as applying refuses it.
    const rosterStore = roster();
    const did = applied(roster, parent, "set-phone", { id: "player:ann", phone: "1" });
    expect(mayRun(rosterStore, parent, { act: "set-phone", args: { id: "player:ann", phone: "1" } })).toMatchObject({ answer: "refused", reason: (did as { reason: string }).reason });
    // An edit handed only its record changes nothing: at least one of what it may take is to give, and nothing is required.
    expect(mayRun(store, lee, { act: "edit-idea", record: "idea:picnic" })).toMatchObject({ answer: "fill", toFill: [], anyOf: ["title"] });
    expect(mayRun(store, lee, { act: "explain-idea", record: "idea:picnic" })).toEqual({ answer: "fill", toFill: ["words"] });
  });

  it("fills a code act's defaults and believes no refusal while arguments are still to give", () => {
    const store = roster();
    expect(mayRun(store, coach, { act: "size-player", record: "player:ann" })).toEqual({ answer: "fill", toFill: ["reason"] });
    expect(mayRun(store, coach, { act: "size-player", record: "player:ann", args: { reason: "growing" } })).toEqual({ answer: "allowed" });
    expect(mayRun(store, coach, { act: "size-player", record: "player:ann", args: { reason: "no" } })).toMatchObject({ answer: "refused", rule: "condition", message: "No reason, no shirt." });
    expect(mayRun(store, coach, { act: "size-player", record: "player:ann", args: { id: "player:bea" } })).toMatchObject({ answer: "refused", rule: "arguments", reason: "invalid" });
    // An act that goes wrong is the act's, not its arguments'.
    expect(mayRun(store, coach, { act: "jam-player", record: "player:ann" })).toMatchObject({ answer: "refused", rule: "act", message: "The jam went wrong." });
  });

  it("judges a seat whose profile's person is not made yet as the person applying makes first", () => {
    const store = ideas();
    const nia = { kind: "human", id: "acct-new", name: "Nia", roles: ["member"], profile: { id: "prf_nia", name: "Nia" } } as Principal;
    const person = profilePersonId("acct-new", { id: "prf_nia" });
    // Nia's own new idea: made as hers, and the person she is is the one `lead` may name at her end.
    expect(mayRun(store, nia, { act: "add-idea", args: { title: "A walk" } })).toEqual({ answer: "allowed" });
    expect(applied(ideas, nia, "add-idea", { title: "A walk" })).toEqual({ ok: true });
    const told = mayRun(store, nia, { act: "lead", record: "idea:fair", args: { leader: person } });
    const did = applied(ideas, nia, "lead", { id: "idea:fair", leader: person });
    expect(told.answer === "allowed").toBe(did.ok);
  });

  it("says allowed, the arguments still to fill, or the rule and the words that refused it", () => {
    const store = createTodoStore({ snapshot: todoExample as never }) as unknown as Store<AnySchema>;
    const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
    const passerBy: Principal = { kind: "human", id: "a-passer-by", roles: [] };
    const task = store.graph.nodesOfKind("task" as never)[0]!;
    const create = store.allMutations().find((one) => !one.subject && formFields(one.input).some((field) => !field.optional))!;
    // Handed nothing, a creating act names what it needs.
    const fill = mayRun(store, keeper, { act: create.name });
    expect(fill.answer).toBe("fill");
    expect((fill as Extract<MayRunAnswer, { answer: "fill" }>).toFill.length).toBeGreaterThan(0);
    // A derived remove riding the grant to everybody reaches only what the seat made.
    const removed = mayRun(store, passerBy, { act: "remove-task", record: task.id });
    expect(removed).toMatchObject({ answer: "refused", rule: "own-records", reason: "forbidden" });
    expect((removed as { message: string }).message.length).toBeGreaterThan(0);
    // The keeper may.
    expect(mayRun(store, keeper, { act: "remove-task", record: task.id })).toEqual({ answer: "allowed" });
    // A record that is not there is not there, as applying says.
    expect(mayRun(store, keeper, { act: "remove-task", record: "task:nowhere" })).toMatchObject({ answer: "refused", rule: "sight", reason: "missing" });
    // An act nobody declared.
    expect(mayRun(store, keeper, { act: "launch-rocket" })).toMatchObject({ answer: "refused", rule: "act" });
  });

  it("refuses by an act's own condition (allowedWhen) in the words it refuses in, before its arguments are given", async () => {
    const { compileDocument } = await import("@graview/core/check");
    const compiled = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "Errands",
      kinds: { errand: { fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"], default: "open" }, note: { type: "string" } } } },
      acts: {
        "add-errand": { title: "Add an errand", creates: "errand" },
        "finish-errand": { title: "Finish", on: "errand", sets: { status: "done" }, allowedWhen: "status == 'open'", refusal: "{name} is already done" },
        "note-errand": { title: "Note", on: "errand", args: { words: { type: "string", required: true } }, sets: { note: "$words" }, allowedWhen: "words != 'nope'", refusal: "not that" },
      },
    } as never);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const app = compiled.app;
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [] });
    const seat: Principal = { kind: "human", id: "me", roles: [] };
    store.apply({ name: "add-errand", args: { name: "Post" } }, { author: seat });
    const errand = store.graph.allNodes()[0]!;
    expect(mayRun(store, seat, { act: "finish-errand", record: errand.id })).toEqual({ answer: "allowed" });
    store.apply({ name: "finish-errand", args: { id: errand.id } }, { author: seat });
    expect(mayRun(store, seat, { act: "finish-errand", record: errand.id })).toEqual({ answer: "refused", rule: "condition", reason: "refused", message: "Post is already done" });
    // A condition that reads an argument not given yet is judged once it is.
    expect(mayRun(store, seat, { act: "note-errand", record: errand.id })).toEqual({ answer: "fill", toFill: ["words"] });
    expect(mayRun(store, seat, { act: "note-errand", record: errand.id, args: { words: "nope" } })).toMatchObject({ answer: "refused", rule: "condition", message: "not that" });
  });

  it("makes no rehearsal store, and answers a hundred acts on rota in under 50 ms", () => {
    const store = createRotaStore({ snapshot: rotaExample as never }) as unknown as Store<AnySchema>;
    const seat: Principal = { kind: "human", id: "user-ada", roles: ["volunteer"] };
    const all = asks(store).map((ask) => ({ act: ask.act, ...(ask.record ? { record: ask.record } : {}) }));
    const hundred = Array.from({ length: 100 }, (_, at) => all[at % all.length]!);
    const rehearsal = vi.spyOn(Store.prototype as unknown as { rehearsal(): unknown }, "rehearsal");
    mayRunEach(store, seat, hundred);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const answers = mayRunEach(store, seat, hundred);
      runs.push(performance.now() - start);
      expect(answers).toHaveLength(100);
    }
    expect(rehearsal).not.toHaveBeenCalled();
    // A seat whose profile has no person yet is judged on one copy with that person made, kept while the store stands — however many it asks.
    const nia = { kind: "human", id: "acct-new", name: "Nia", roles: ["member"], profile: { id: "prf_nia", name: "Nia" } } as Principal;
    const board = ideas();
    const its = asks(board).map((ask) => ({ act: ask.act, ...(ask.record ? { record: ask.record } : {}) }));
    mayRunEach(board, nia, its);
    mayRunEach(board, nia, its);
    expect(rehearsal.mock.calls.length).toBeLessThanOrEqual(1);
    rehearsal.mockRestore();
    expect(Math.min(...runs)).toBeLessThan(50);
  });
});
