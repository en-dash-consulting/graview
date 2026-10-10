import { readFileSync } from "node:fs";
import { bindSchema, createSchema, declaredLenses, defineNode, nodeRef, placesOf, Store, type AnySchema, type Policy, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { movesFromNames, NOTHING_BY_THAT_NAME, placesFromViews, resolveAsk, type AskAnswer, type AskContext, type SeatMove } from "../../src/go.js";
import { graphResponder, llmResponder, openAiCompatibleCompletion, seatResponder } from "../../src/index.js";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";
import { seedbedApp, createSeedbedStore } from "../../../../apps/seedbed/src/domain/app.js";

/**
 * THE SEAT TAKES YOU WHERE YOU ASK (B2 of the seat as a guide). An ask is
 * read against what the declaration and the graph already name — a place,
 * a record, a kind with a date or a status, the problems, what is here —
 * and answered by MOVES both faces apply, each said in a sentence, without
 * a model. What the seat may not see is never found, and asking for it is
 * answered exactly as asking for nothing.
 */

const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const member: Principal = { kind: "human", id: "user-sam", roles: ["member"] };
// 2026-09-01 is a Tuesday: the week is Monday 31 August to Sunday 6 September.
const TODAY = "2026-09-01";

function todo(principal: Principal = keeper) {
  const store = createTodoStore({ snapshot: example });
  const context: AskContext = { principal, places: placesOf(todoApp), today: TODAY };
  return { store, context, ask: (text: string, more: Partial<AskContext> = {}) => resolveAsk(store, text, { ...context, ...more }) };
}

const moved = (answer: AskAnswer): readonly SeatMove[] => ("moves" in answer ? answer.moves : []);
const only = (answer: AskAnswer): SeatMove => {
  const moves = moved(answer);
  expect(moves, JSON.stringify(answer)).toHaveLength(1);
  return moves[0]!;
};

describe("the places a face holds", () => {
  it("are the places the declaration makes, at the same addresses, from the schema and the registered pictures alone", () => {
    const registered = declaredLenses(todoApp).drawn.flatMap((lens) => lens.kinds.map((kind) => ({ kind, title: lens.title, as: lens.as })));
    const fromViews = placesFromViews(todoApp.schema as AnySchema, registered);
    const said = (places: readonly { slug: string; title: string; kind: string | null; address: string }[]) => places.map(({ slug, title, kind, address }) => ({ slug, title, kind, address })).sort((a, b) => a.address.localeCompare(b.address));
    expect(said(fromViews)).toEqual(said(placesOf(todoApp)));
  });
});

describe("1. a place by its title", () => {
  it("goes to a declared lens as a picture of its kind, on both faces, and says so", () => {
    const answer = todo().ask("go to The week");
    expect(only(answer)).toEqual({ to: "picture", kind: "task", as: "the-week", title: "The week", address: "/places/the-week", said: "Went to The week." });
    expect("say" in answer && answer.say).toBe("Went to The week.");
  });

  it("reads the title however it is asked: without 'the', in lower case, bare, or with 'open' or 'show me'", () => {
    for (const text of ["take me to the month", "open The month", "show me the month", "The month", "go to month", "the month view"]) {
      expect(only(todo().ask(text)), text).toMatchObject({ to: "picture", as: "the-month" });
    }
  });

  it("goes to a kind's list, the home and the scene by their names", () => {
    expect(only(todo().ask("go to tasks"))).toMatchObject({ to: "kind", kind: "task", address: "/tasks", said: "Went to Tasks." });
    expect(only(todo().ask("go home"))).toMatchObject({ to: "place", slug: "home", address: "/" });
    expect(only(todo().ask("go to the scene"))).toMatchObject({ to: "place", slug: "overview", face: "scene", address: "/places/overview" });
  });

  it("never finds a place over a kind the seat may not see: a member has no 'Who may do what'", () => {
    expect(only(todo(keeper).ask("go to Who may do what"))).toMatchObject({ to: "picture", kind: "user" });
    expect(todo(member).ask("go to Who may do what")).toEqual({ unresolved: true, say: NOTHING_BY_THAT_NAME });
  });
});

describe("2. a record by its name", () => {
  it("goes to the record, with its address on the routed face", () => {
    const move = only(todo().ask("go to Pay the deposit"));
    expect(move).toEqual({ to: "record", id: "t-deposit", kind: "task", label: "Pay the deposit", address: "/tasks/t-deposit", said: "Went to Pay the deposit." });
  });

  it("a place outranks a record of the same words, and a record's whole name outranks a filter", () => {
    // "This week" is a list here; "tasks due this week" is a filter.
    expect(only(todo().ask("go to This week"))).toMatchObject({ to: "record", id: "week" });
    expect(only(todo().ask("tasks due this week"))).toMatchObject({ to: "kind", kind: "task" });
  });

  it("offers the records the words find when no one is meant, and moves nowhere", () => {
    const answer = todo().ask("go to the");
    expect(moved(answer)).toEqual([]);
  });

  it("names several records sharing words as picks, each a press", () => {
    const answer = todo().ask("open the paint");
    expect(only(answer)).toMatchObject({ to: "record", id: "t-paint" });
    const several = todo().ask("open move");
    expect(moved(several)).toEqual([]);
    expect("picks" in several && several.picks?.map((hit) => hit.id).sort()).toEqual(["t-broadband", "t-piano"]);
  });

  it("never finds a record of a kind the seat may not see — answered exactly as a name that is nothing", () => {
    expect(only(todo(keeper).ask("go to Nora"))).toMatchObject({ to: "record", id: "user-nora" });
    const hidden = todo(member).ask("go to Nora");
    const absent = todo(member).ask("go to Zebedee");
    expect(hidden).toEqual({ unresolved: true, say: NOTHING_BY_THAT_NAME });
    expect(absent).toEqual(hidden);
  });
});

describe("3. a kind with a date or a status", () => {
  it("'tasks due this week' lands on the tasks' list narrowed to this week, in the words a page and a stop both carry", () => {
    const answer = todo().ask("show me the tasks due this week");
    const move = only(answer);
    expect(move).toMatchObject({ to: "kind", kind: "task", filter: "due:after:2026-08-30,due:before:2026-09-07", address: "/tasks?filter=due%3Aafter%3A2026-08-30%2Cdue%3Abefore%3A2026-09-07" });
    expect(move.said).toBe("Went to the tasks due this week.");
    // Every one of them is due this week, and the done ones too: "due" is not "open".
    expect("picks" in answer && answer.picks?.map((hit) => hit.id)).toEqual(["t-book", "t-notice", "t-meter", "t-post", "t-broadband", "t-keys"]);
  });

  it("'overdue tasks' is before today and not finished, said with the yes/no the kind declares", () => {
    const answer = todo().ask("overdue tasks");
    expect(only(answer)).toMatchObject({ to: "kind", filter: "due:before:2026-09-01,done:false" });
    expect("say" in answer && answer.say).toBe("Went to the overdue tasks. One task is overdue: Pay the deposit.");
  });

  it("'what's due today' finds the one kind whose date the words name", () => {
    expect(only(todo().ask("what's due today?"))).toMatchObject({ kind: "task", filter: "due:after:2026-08-31,due:before:2026-09-02" });
    expect(only(todo().ask("tasks due next week"))).toMatchObject({ filter: "due:after:2026-09-06,due:before:2026-09-14" });
    expect(only(todo().ask("tasks due tomorrow"))).toMatchObject({ filter: "due:after:2026-09-01,due:before:2026-09-03" });
  });

  it("a week can start on Sunday", () => {
    expect(only(todo().ask("tasks due this week", { weekStartsOn: 0 }))).toMatchObject({ filter: "due:after:2026-08-29,due:before:2026-09-06" });
  });

  it("'done tasks' and 'unfinished tasks' read the yes/no by its name", () => {
    expect(only(todo().ask("done tasks"))).toMatchObject({ filter: "done:true" });
    expect(only(todo().ask("unfinished tasks"))).toMatchObject({ filter: "done:false" });
    expect(only(todo().ask("tasks not done"))).toMatchObject({ filter: "done:false" });
  });

  it("a sentence that is more than a kind and a filter is not read as one", () => {
    expect(todo().ask("mark the overdue tasks done").unresolved).toBe(true);
    expect(todo().ask("show tasks as a board by list")).toEqual({ unresolved: true });
  });
});

describe("4. what's wrong", () => {
  it("goes to the problems and says them", () => {
    const answer = todo().ask("what's wrong?");
    expect(only(answer)).toEqual({ to: "problems", address: "/problems", said: "Went to the problems." });
    expect("say" in answer && answer.say).toMatch(/^Went to the problems\. \d+ rules? broken( in \d+ places)?: /);
  });

  it("'what's wrong with' a record goes to the record and says its trouble", () => {
    const answer = todo().ask("what's wrong with Order boxes?");
    expect(only(answer)).toMatchObject({ to: "record", id: "t-boxes" });
    expect("say" in answer && answer.say).toContain('Trouble: "Order boxes" is done, but it waits for "Find someone who moves pianos".');
  });

  it("with nothing wrong, says so and moves nowhere", () => {
    const store = createSeedbedStore();
    const answer = resolveAsk(store, "what's wrong", { places: placesOf(seedbedApp) });
    expect(answer).toMatchObject({ about: "problems", moves: [], say: "Nothing is wrong — every rule holds." });
  });
});

describe("5. tell me about it, and what is here", () => {
  it("'tell me about' a record goes there and describes it", () => {
    const answer = todo().ask("tell me about Pay the deposit");
    expect(only(answer)).toMatchObject({ to: "record", id: "t-deposit" });
    expect("say" in answer && answer.say).toMatch(/^Went to Pay the deposit\. Pay the deposit — a task \(/);
  });

  it("'tell me about' a place goes there and says what it draws", () => {
    const answer = todo().ask("tell me about the week");
    expect(only(answer)).toMatchObject({ to: "picture", as: "the-week" });
    expect("say" in answer && answer.say).toBe("Went to The week. It draws the tasks as a timeline — 12 of them. 2 have a problem.");
  });

  it("'what is here' describes the selection, else the place the reader stands in, and moves nowhere", () => {
    const selected = todo().ask("what is here?", { selection: ["t-book"] });
    expect(selected).toMatchObject({ about: "here", moves: [], subject: "t-book" });
    expect("say" in selected && selected.say).toMatch(/^Book the van — a task/);
    const standing = todo().ask("where am I", { place: "tasks" });
    expect("say" in standing && standing.say).toMatch(/^Tasks\. \d+ tasks are here\./);
    const home = todo(member).ask("what's here");
    expect("say" in home && home.say).toMatch(/^Home\. It holds /);
    expect("say" in home && home.say).not.toMatch(/user|invitation/i);
  });

  it("'tell me about' something hidden is nothing by that name, as an absent name is", () => {
    expect(todo(member).ask("tell me about Nora")).toEqual(todo(member).ask("tell me about Zebedee"));
    expect(todo(member).ask("tell me about Nora")).toEqual({ unresolved: true, say: NOTHING_BY_THAT_NAME });
  });

  it("a question that names nothing is left for a model", () => {
    expect(todo().ask("what should I do first?")).toEqual({ unresolved: true });
    expect(todo().ask("Erin tends that plot")).toEqual({ unresolved: true });
  });
});

describe("on seedbed, which starts empty and has a lifecycle", () => {
  const garden = () => {
    const store = createSeedbedStore({
      snapshot: {
        nodes: [
          { id: "plot-a", kind: "plot", label: "Bed A", beds: 2 },
          { id: "p-beans", kind: "planting", label: "Runner beans", sown: "2026-08-31", status: "growing" },
          { id: "p-kale", kind: "planting", label: "Kale", sown: "2026-07-01", status: "growing" },
          { id: "p-peas", kind: "planting", label: "Peas", sown: "2026-04-01", harvested: "2026-07-01", status: "harvested" },
        ],
        edges: [],
      } as never,
    });
    return (text: string) => resolveAsk(store, text, { places: placesOf(seedbedApp), today: TODAY });
  };

  it("reads a choice's own value: 'growing plantings'", () => {
    expect(only(garden()("growing plantings"))).toMatchObject({ kind: "planting", filter: "status:growing", address: "/plantings?filter=status%3Agrowing" });
  });

  it("reads the date the words name: 'plantings sown this week'", () => {
    const answer = garden()("plantings sown this week");
    expect(only(answer)).toMatchObject({ filter: "sown:after:2026-08-30,sown:before:2026-09-07" });
    expect("picks" in answer && answer.picks?.map((hit) => hit.id)).toEqual(["p-beans"]);
  });

  it("goes to a record of an empty-at-first app by name", () => {
    expect(only(garden()("go to Bed A"))).toMatchObject({ to: "record", id: "plot-a", address: "/plots/plot-a" });
  });
});

describe("on Graview Cloud's workshop document", () => {
  const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../../scripts/fixtures/${path}`, import.meta.url), "utf8"));
  function workshop(folder: "desk-bar" | "drawn-once") {
    const compiled = compileDocument(read(`${folder}/workshop.gdd.json`), { today: () => TODAY });
    if (!compiled.ok) throw new Error("the workshop compiles");
    const store = new Store<AnySchema>({ schema: compiled.app.schema as AnySchema, mutations: compiled.app.mutations as never, snapshot: read(`${folder}/workshop.seed.json`) });
    const owner: Principal = { kind: "human", id: "owner", roles: ["owner"] };
    return (text: string) => resolveAsk(store, text, { principal: owner, places: placesOf(compiled.app), today: TODAY });
  }

  it("goes to a picture written in blocks by its title", () => {
    expect(only(workshop("desk-bar")("go to Email to Todd"))).toMatchObject({ to: "picture", kind: "deliverable", as: "email-to-todd", address: "/places/email-to-todd" });
  });

  it("'open decisions' lands on the decisions still open", () => {
    const answer = workshop("desk-bar")("open decisions");
    expect(only(answer)).toMatchObject({ to: "kind", kind: "decision", filter: "status:open" });
    expect("picks" in answer && answer.picks?.map((hit) => hit.label)).toEqual(["Who signs for the county"]);
  });

  it("'deliverables due this week' goes to the deliverables and says they carry no date", () => {
    const answer = workshop("desk-bar")("show me the deliverables due this week");
    expect(only(answer)).toMatchObject({ to: "kind", kind: "deliverable" });
    expect("say" in answer && answer.say).toBe("Deliverables carry no date, so I can't tell which are due this week. Went to the deliverables.");
  });

  it("'go to Ongoing support' goes to that part of the workshop", () => {
    expect(only(workshop("drawn-once")("go to Ongoing support"))).toMatchObject({ to: "record", id: "segment:ongoing-support" });
  });
});

describe("a seat that sees only its own", () => {
  const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
  const enquiry = defineNode("enquiry", {
    fields: z.object({ label: z.string(), status: z.enum(["open", "answered"]) }),
    plural: "Enquiries",
    edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" } },
  });
  const schema = createSchema([shopper, enquiry]);
  const { defineMutation } = bindSchema(schema);
  const ask = defineMutation("ask", {
    title: "Ask",
    creates: ["enquiry"],
    input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
    apply(ctx, args) {
      const id = ctx.freshId(args.label, "enquiry");
      ctx.addNode({ id, kind: "enquiry", label: args.label, status: "open" });
      ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
    },
  });
  const policy: Policy = { grants: [{ roles: ["shopper"], mutations: "*" }], sees: [{ roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true }] };
  const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
  const freya: Principal = { kind: "human", id: "shopper:freya", roles: ["shopper"] };
  function showroom() {
    const store = new Store({
      schema,
      mutations: [ask],
      policy,
      snapshot: { nodes: [{ id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo" }, { id: "shopper:freya", kind: "shopper", label: "Freya Davies" }] as never, edges: [] },
    });
    store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }, { author: freya });
    store.apply({ name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there" } }, { author: bethan });
    return store;
  }

  it("finds its own records and never another's, whichever way it asks", () => {
    const store = showroom();
    expect(only(resolveAsk(store, "go to Is it still there", { principal: bethan }))).toMatchObject({ to: "record", id: "enquiry:is-it-still-there" });
    for (const text of ["go to Finance on the Golf", "tell me about Finance on the Golf", "what's wrong with Finance on the Golf", "open Finance"]) {
      const hidden = resolveAsk(store, text, { principal: bethan });
      const absent = resolveAsk(store, text.replace(/Finance on the Golf|Finance/, "Something else"), { principal: bethan });
      expect(hidden, text).toEqual({ unresolved: true, say: NOTHING_BY_THAT_NAME });
      expect(absent, text).toEqual(hidden);
    }
  });

  it("counts only its own in a narrowed kind: 'open enquiries' is one, not two", () => {
    const answer = resolveAsk(showroom(), "open enquiries", { principal: bethan });
    expect(only(answer)).toMatchObject({ filter: "status:open" });
    expect("picks" in answer && answer.picks?.map((hit) => hit.id)).toEqual(["enquiry:is-it-still-there"]);
    expect(JSON.stringify(answer)).not.toContain("Finance");
  });

  it("the graph's reply is the same for a hidden name and an absent one", async () => {
    const respond = graphResponder<AnySchema>();
    const store = () => showroom() as unknown as Store<AnySchema>;
    const hidden = await respond(store(), "go to Finance on the Golf", { principal: bethan });
    const absent = await respond(store(), "go to Something else", { principal: bethan });
    expect(hidden).toEqual(absent);
    expect(hidden.say).toBe(NOTHING_BY_THAT_NAME);
    expect(hidden.moves).toBeUndefined();
  });
});

describe("the conversation answers with moves", () => {
  const places = placesOf(todoApp);

  it("graphResponder returns the moves, grounded, for each of the five", async () => {
    const respond = graphResponder({ today: TODAY });
    const store = createTodoStore({ snapshot: example }) as unknown as Store<AnySchema>;
    const cases: [string, Partial<SeatMove>][] = [
      ["go to The week", { to: "picture", as: "the-week" }],
      ["go to Pay the deposit", { to: "record", id: "t-deposit" }],
      ["overdue tasks", { to: "kind", filter: "due:before:2026-09-01,done:false" }],
      ["what's wrong?", { to: "problems" }],
      ["tell me about Book the van", { to: "record", id: "t-book" }],
    ];
    for (const [text, move] of cases) {
      const reply = await respond(store, text, { principal: keeper, places });
      expect(reply.grounded, text).toBe(true);
      expect(reply.moves, text).toHaveLength(1);
      expect(reply.moves![0], text).toMatchObject(move);
      expect(reply.say.startsWith(reply.moves![0]!.said), `${text}: ${reply.say}`).toBe(true);
    }
  });

  it("keeps the fuller answers it had: the problems with their repairs, a record with its relations", async () => {
    const respond = graphResponder({ today: TODAY });
    const store = createTodoStore({ snapshot: example }) as unknown as Store<AnySchema>;
    const problems = await respond(store, "what's wrong?", { principal: keeper, places });
    expect(problems.say).toMatch(/^Went to the problems\. \d+ rules? broken( in \d+ places)?:/);
    const record = await respond(store, "tell me about Pay the deposit", { principal: keeper, places });
    expect(record.say).toMatch(/^Went to Pay the deposit\. Pay the deposit — a task/);
    expect(record.say).toContain("The list it is on: Today");
  });

  it("asks no model for an ask the graph resolves, and asks one for a question it cannot", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"say": "Start with the deposit.", "proposals": []}' } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const respond = seatResponder({ complete: openAiCompatibleCompletion({ baseUrl: "https://model.test/v1", apiKey: "k", model: "m" }) });
    const store = createTodoStore({ snapshot: example }) as unknown as Store<AnySchema>;
    for (const text of ["go to The week", "go to Pay the deposit", "tasks due this week", "what's wrong", "tell me about Book the van", "what is here", "go to Zebedee"]) {
      const reply = await respond(store, text, { principal: keeper, places });
      expect(reply.say, text).not.toContain("Start with the deposit");
    }
    expect(fetch).not.toHaveBeenCalled();
    const free = await respond(store, "what should I do first?", { principal: keeper, places });
    expect(free.say).toContain("Start with the deposit");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("a model's answer may move the app too, only where the resolver itself would", async () => {
    const store = createTodoStore({ snapshot: example }) as unknown as Store<AnySchema>;
    const complete = async (prompt: string) => {
      expect(prompt).toContain("Places in the app: Home, Scene, The month, The week");
      expect(prompt).not.toContain("Who may do what");
      return JSON.stringify({ say: "The week shows when you planned it.", proposals: [], go: ["The week", "Nora", "Nowhere at all"] });
    };
    const reply = await llmResponder({ complete })(store, "where do I plan?", { principal: member, places });
    expect(reply.say).toBe("The week shows when you planned it.");
    expect(reply.moves).toEqual([{ to: "picture", kind: "task", as: "the-week", title: "The week", address: "/places/the-week", said: "Went to The week." }]);
  });

  it("movesFromNames drops what a seat cannot see and what does not exist", () => {
    const store = createTodoStore({ snapshot: example }) as unknown as Store<AnySchema>;
    expect(movesFromNames(store, ["Nora", "Pay the deposit", { to: "The month" }, 7, ""], { principal: member, places }).map((move) => move.said)).toEqual([
      "Went to Pay the deposit.",
      "Went to The month.",
    ]);
  });
});
