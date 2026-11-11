import { refusalOf, Store, type AnySchema, type Principal } from "@graview/core";
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

type Make = (options: { snapshot: never }) => Store<AnySchema>;
const apps: { readonly name: string; readonly make: Make; readonly snapshot: unknown; readonly seats: readonly Principal[] }[] = [
  {
    name: "rota",
    make: createRotaStore as unknown as Make,
    snapshot: rotaExample,
    seats: [
      { kind: "human", id: "user-jo", roles: ["coordinator"] },
      { kind: "human", id: "user-ada", roles: ["volunteer"] },
      { kind: "human", id: "user-sam", roles: ["viewer"] },
      { kind: "human", id: "a-passer-by", roles: [] },
    ],
  },
  {
    name: "todo",
    make: createTodoStore as unknown as Make,
    snapshot: todoExample,
    seats: [
      { kind: "human", id: "user-nora", roles: ["keeper"] },
      { kind: "human", id: "user-sam", roles: ["member"] },
      { kind: "human", id: "a-passer-by", roles: [] },
    ],
  },
];

/** A value for each argument an act cannot do without, as a person filling its form might give: the first record of a kind, a choice's first option. */
function filled(store: Store<AnySchema>, fields: readonly FormField[], given: Readonly<Record<string, unknown>>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...given };
  for (const field of fields) {
    if (out[field.name] !== undefined || field.optional) continue;
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
        out[field.name] = false;
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
  for (const { name, make, snapshot, seats } of apps) {
    const fresh = () => make({ snapshot: snapshot as never });

    it(`agrees with applying it, for every seat, act and record of ${name}`, () => {
      const store = fresh();
      const disagreements: string[] = [];
      let compared = 0;
      const answers = new Set<string>();
      for (const seat of seats) {
        for (const ask of asks(store)) {
          const given = ask.subject && ask.record ? { [ask.subject]: ask.record } : {};
          const args = filled(store, ask.fields, given);
          if (!args) continue;
          const told = mayRun(store, seat, { act: ask.act, args });
          const did = applied(fresh, seat, ask.act, args);
          compared += 1;
          answers.add(told.answer === "refused" ? `refused:${told.rule}` : told.answer);
          const at = `${seat.id} · ${ask.act}${ask.record ? ` · ${ask.record}` : ""}`;
          if (told.answer === "fill") disagreements.push(`${at}: asked to fill ${told.toFill.join(", ")} of a whole call`);
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
        for (const ask of asks(store)) {
          const given = ask.subject && ask.record ? { [ask.subject]: ask.record } : {};
          const told = mayRun(store, seat, { act: ask.act, ...(ask.record ? { record: ask.record } : {}) });
          const args = filled(store, ask.fields, given);
          if (!args) continue;
          const did = applied(fresh, seat, ask.act, args);
          const at = `${seat.id} · ${ask.act}${ask.record ? ` · ${ask.record}` : ""}`;
          // A refusal said before the arguments are given holds whatever they are; an allowed or a fill is one the filled call can meet.
          if (told.answer === "refused" && did.ok) wrong.push(`${at}: refused (${told.rule}) before its arguments, and applying them ran it`);
          if (told.answer === "fill" && told.toFill.some((one) => given[one] !== undefined)) wrong.push(`${at}: asked to fill what it was given`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }

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
    rehearsal.mockRestore();
    expect(Math.min(...runs)).toBeLessThan(50);
  });
});
