import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actsOn,
  arrange,
  bindSchema,
  createSchema,
  defineApp,
  defineInvariant,
  defineNode,
  describeApp,
  describeSearched,
  fold,
  generateLlmsTxt,
  Graph,
  isoDate,
  parseQuery,
  search,
  searchableFields,
  Store,
  type Hit,
  type Principal,
} from "../../src/index.js";
import { awkwardApp, awkwardGraph } from "../../src/testing.js";

/**
 * ONE MATCHER, and the graph is the result list.
 *
 * A record by a word in it, a kind by its plural, a place by its title, a
 * rule by its name, an act on the thing highlighted — one function answers
 * all of them, derived from the declaration and honest about the seat that
 * asks. The worked example pins the sentences; the properties hold the
 * ranking over a declaration nobody tuned it for.
 */

const list = defineNode("list", {
  fields: z.object({ label: z.string().min(1), order: z.number().int() }),
  edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } },
  display: { hide: ["order"] },
});
const task = defineNode("task", {
  fields: z.object({
    label: z.string().min(1),
    done: z.boolean(),
    due: isoDate.optional(),
    notes: z.string().optional(),
    secret: z.string().optional(),
  }),
  display: { hide: ["secret"] },
  lifecycle: { field: "done", retired: [true] },
});
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  input: z.object({ taskId: z.string() }),
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const drop = defineMutation("drop", {
  title: "Drop it",
  destructive: true,
  input: z.object({ taskId: z.string() }),
  subject: { kinds: ["task"], arg: "taskId" },
  apply(ctx, args) {
    ctx.removeNode(args.taskId);
  },
});
const addTask = defineMutation("add-task", {
  title: "Add a task",
  input: z.object({ label: z.string() }),
  creates: ["task"],
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false });
  },
});
const overdue = defineInvariant<typeof schema, "task">("overdue", {
  scope: { kind: "task" },
  label: "Nothing overdue",
  evaluate: ({ subject }) =>
    subject.due && subject.due < "2026-09-28"
      ? [{ invariant: "overdue", label: "Overdue", message: `${subject.label} is overdue`, nodeIds: [subject.id], repairs: [] }]
      : [],
});

const snapshot = {
  nodes: [
    { id: "today", kind: "list", label: "Today", order: 0 },
    { id: "week", kind: "list", label: "This week", order: 1 },
    { id: "t-van", kind: "task", label: "Book the van", done: false, due: "2026-10-02" },
    { id: "t-vans", kind: "task", label: "Van", done: false },
    { id: "t-call", kind: "task", label: "Call the agent", done: false, notes: "Ask whether the van fits the sofa on Friday", due: "2026-09-20" },
    { id: "t-caravan", kind: "task", label: "Return the caravan", done: false },
    { id: "t-milk", kind: "task", label: "Buy milk", done: true },
    { id: "t-cafe", kind: "task", label: "Meet at the Café-Noir", done: false },
    { id: "t-elbow", kind: "task", label: "Rest the elbow", done: false, secret: "van" },
  ],
  edges: [
    { kind: "holds", from: "today", to: "t-van" },
    { kind: "holds", from: "week", to: "t-call" },
  ],
};
const places = [{ kind: "task", title: "The month", as: "the-month" }];
const make = () =>
  new Store({
    schema,
    mutations: [finish, drop, addTask],
    invariants: [overdue],
    snapshot: snapshot as never,
    invariantOptions: { today: "2026-09-28" },
  });
const today = "2026-09-28";
const nodes = (hits: readonly Hit[]) => hits.filter((hit) => hit.about === "node").map((hit) => hit.id);

describe("the worked example", () => {
  const store = make();

  it("finds a record by a word of its name or a field, and says which", () => {
    const found = search(store, "van", { today, places });
    // Exact label, then a whole word of a label, then a field; "caravan" is not a van.
    expect(nodes(found.hits)).toEqual(["t-vans", "t-van", "t-call"]);
    const call = found.hits.find((hit) => hit.about === "node" && hit.id === "t-call");
    expect(call?.why).toMatchObject({ field: "notes", reading: "Notes", strength: "field" });
    expect(call?.why.fragment).toContain("van");
    // A hidden field is not searched: the elbow's secret says van and it is not a hit.
    expect(nodes(found.hits)).not.toContain("t-elbow");
    expect(found.byKind).toEqual({ task: 3 });
    expect(found.searched).toEqual({ kinds: ["list", "task"], past: false });
  });

  it("matches the start of words, case, diacritics and punctuation aside, and never inside one", () => {
    expect(nodes(search(store, "CAFE noir", { today }).hits)).toEqual(["t-cafe"]);
    expect(nodes(search(store, "bo", { today }).hits)).toEqual(["t-van"]);
    expect(nodes(search(store, "book the", { today }).hits)).toEqual(["t-van"]);
    expect(search(store, "vna", { today }).hits).toEqual([]);
  });

  it("leaves the past out unless is:any says otherwise, and says it did", () => {
    expect(nodes(search(store, "milk", { today }).hits)).toEqual([]);
    const widened = search(store, "milk is:any", { today });
    expect(nodes(widened.hits)).toEqual(["t-milk"]);
    expect(widened.searched.past).toBe(true);
    expect(widened.hits[0]).toMatchObject({ current: false });
    expect(nodes(search(store, "buy is:past", { today }).hits)).toEqual(["t-milk"]);
    expect(describeSearched(schema, search(store, "milk", { today }).searched)).toBe(
      "Lists and tasks, current ones; add is:any for past ones.",
    );
  });

  it("reads a condition that names a retired state as asking for the past (W-104)", () => {
    // "status:demo" on a discography whose demos are past found nothing, and
    // told somebody who had just named the past to add is:any.
    expect(nodes(search(store, "done:true", { today }).hits)).toEqual(["t-milk"]);
    expect(nodes(search(store, "milk done:true", { today }).hits)).toEqual(["t-milk"]);
    expect(nodes(search(store, "done:false milk", { today }).hits)).toEqual([]);
  });

  it("reads key:value tokens as the arrangement's conditions, admitted per kind", () => {
    const narrowed = search(store, "the holds:week", { today });
    expect(nodes(narrowed.hits)).toEqual(["t-call"]);
    expect(narrowed.conditions).toEqual([{ key: "holds", value: "week", admittedBy: ["list", "task"] }]);
    const byDate = search(store, "due:before:2026-10-01", { today });
    expect(nodes(byDate.hits)).toEqual(["t-call"]);
    // A condition only one kind offers narrows that kind and is ignored by the other.
    const onlyTasks = search(store, "this done:false", { today });
    expect(onlyTasks.conditions[0]?.admittedBy).toEqual(["task"]);
    expect(nodes(onlyTasks.hits)).toEqual(["week"]);
    expect(nodes(search(store, "the kind:tasks", { today }).hits)).not.toContain("today");
    expect(nodes(search(store, "flagged is:flagged", { today }).hits)).toEqual([]);
    expect(nodes(search(store, "the is:flagged", { today }).hits)).toEqual(["t-call"]);
  });

  it("names a kind, a place and a rule, ahead of records only when the words name them outright", () => {
    const tasks = search(store, "tasks", { today, places });
    expect(tasks.hits[0]).toMatchObject({ about: "kind", kind: "task", label: "Tasks" });
    expect(search(store, "month", { today, places }).hits).toEqual([
      expect.objectContaining({ about: "place", title: "The month", as: "the-month" }),
    ]);
    expect(search(store, "overdue", { today }).hits).toEqual([expect.objectContaining({ about: "rule", name: "overdue" })]);
    expect(search(store, "nothing over", { today }).hits[0]).toMatchObject({ about: "rule", label: "Nothing overdue" });
  });

  it("offers acts only on a highlighted node, the named one first and the destructive last", () => {
    expect(search(store, "finish", { today }).hits.some((hit) => hit.about === "act")).toBe(false);
    const acts = search(store, "van finish", { today, subject: "t-van" }).hits.filter((hit) => hit.about === "act");
    // Named first; then the rest the seat may run, the derived edit among them; the destructive last.
    expect(acts.map((hit) => hit.about === "act" && hit.name)).toEqual(["finish", "edit-task", "drop", "remove-task"]);
    expect(acts[0]?.why).toMatchObject({ field: "title", fragment: "Finish it" });
    expect(acts.every((hit) => hit.about === "act" && hit.subject === "t-van")).toBe(true);
  });

  it("ranks the record near the subject first within its tier, then recently touched", () => {
    // "the" is a whole word of five names: the overdue call first, then alphabetical.
    expect(nodes(search(store, "the", { today }).hits)).toEqual(["t-call", "t-van", "t-cafe", "t-elbow", "t-caravan"]);
    // Standing on today's list, the van on it comes first — nearness outranks the flag.
    expect(nodes(search(store, "the", { today, from: ["today"] }).hits)[0]).toBe("t-van");

    const touched = make();
    touched.apply({ name: "add-task", args: { label: "Tidy the shed" } });
    expect(nodes(search(touched, "the", { today }).hits)[0]).toBe("task:tidy-the-shed");
  });

  it("finds with the arrangement's q the same way, conditions included", () => {
    const graph = Graph.from(schema, snapshot as never);
    const ctx = { schema, graph, today };
    const tasks = graph.nodesOfKind("task");
    expect(arrange(tasks, { query: "van" }, ctx).nodes.map((node) => node.id)).toEqual(["t-van", "t-vans", "t-call"]);
    expect(arrange(tasks, { query: "van holds:week" }, ctx).nodes.map((node) => node.id)).toEqual(["t-call"]);
    expect(arrange(tasks, { query: "cafe" }, ctx).nodes.map((node) => node.id)).toEqual(["t-cafe"]);
  });

  it("splits words from conditions", () => {
    expect(parseQuery("  van  done:false due:before:2026-10-01 ")).toEqual({
      words: "van",
      conditions: [
        { key: "done", value: "false" },
        { key: "due", value: "before:2026-10-01" },
      ],
    });
  });
});

describe("what the review found", () => {
  const store = make();

  it("never finds a record by the Yes or No a boolean reads as", () => {
    // "n" is the first letter of anything; every open task reads "Done: No".
    expect(nodes(search(store, "n", { today }).hits)).toEqual(["t-cafe"]);
    expect(nodes(search(store, "no", { today }).hits)).toEqual(["t-cafe"]);
    const graph = Graph.from(schema, snapshot as never);
    expect(arrange(graph.nodesOfKind("task"), { query: "no" }, { schema, graph, today }).nodes.map((node) => node.id)).toEqual(["t-cafe"]);
  });

  it("counts and names every match in `matched`, past the strip's limit", () => {
    const few = search(store, "the", { today, limit: 2 });
    expect(few.hits.filter((hit) => hit.about === "node")).toHaveLength(2);
    expect(few.matched).toHaveLength(few.total);
    expect(few.matched).toEqual(nodes(search(store, "the", { today, limit: 100 }).hits));
  });

  it("agrees with a list's q on words made only of conditions", () => {
    const graph = Graph.from(schema, snapshot as never);
    const ctx = { schema, graph, today, flagged: new Set(["t-call"]) };
    const tasks = graph.nodesOfKind("task");
    const listed = (query: string) => arrange(tasks, { query }, ctx).nodes.map((node) => node.id);
    // A token nothing here offers finds nothing, in both — not everything in one of them.
    expect(search(store, "foo:bar", { today }).hits).toEqual([]);
    expect(listed("foo:bar")).toEqual([]);
    expect(listed("https://example.com")).toEqual([]);
    // A lone is:flagged narrows in both.
    expect(nodes(search(store, "is:flagged", { today }).hits)).toEqual(["t-call"]);
    expect(listed("is:flagged")).toEqual(["t-call"]);
    // is:any alone is a horizon, not a search: a list keeps everything, the Find box finds nothing.
    expect(listed("is:any")).toHaveLength(tasks.length);
    expect(search(store, "is:any", { today }).hits).toEqual([]);
  });

  it("lists a record's acts on their own, without a search of the graph", () => {
    expect(actsOn(store, "t-van", "finish").map((hit) => hit.name)).toEqual(["finish", "edit-task", "drop", "remove-task"]);
    expect(actsOn(store, "t-van", "", { limit: 2 })).toHaveLength(2);
    expect(actsOn(store, "nobody", "finish")).toEqual([]);
  });
});

describe("held to properties over the awkward declaration", () => {
  const app = awkwardApp({ kinds: 8 });
  const graph = awkwardGraph(app, 3);
  const store = new Store({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.modules ? { modules: app.modules } : {}),
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: graph as never,
  });
  const keeper: Principal = { kind: "human", id: "k", roles: ["keeper"] };
  const helper: Principal = { kind: "human", id: "h", roles: ["helper"] };
  const every = graph.nodes as readonly { id: string; kind: string; label: string }[];

  it("finds every record by its exact name, first among the records", () => {
    for (const node of every) {
      const found = search(store, node.label, { principal: keeper });
      const first = found.hits.find((hit) => hit.about === "node");
      expect(first, node.label).toMatchObject({ id: node.id, why: { strength: "exact" } });
    }
  });

  it("keeps finding a record as its name is typed, a letter at a time", () => {
    for (const node of every.slice(0, 6)) {
      for (let end = 1; end <= node.label.length; end += 1) {
        const typed = node.label.slice(0, end);
        if (typed.endsWith(" ")) continue;
        expect(nodes(search(store, typed, { principal: keeper, limit: 1000 }).hits), typed).toContain(node.id);
      }
    }
  });

  it("returns node hits in tier order, with a why whose fragment carries the words", () => {
    for (const words of ["0", "zone", "expectation 1", "user", "a"]) {
      const hits = search(store, words, { principal: keeper, limit: 1000 }).hits.filter((hit) => hit.about === "node");
      const tiers = hits.map((hit) => ["exact", "prefix", "word", "part", "field"].indexOf(hit.why.strength));
      expect([...tiers].sort((a, b) => a - b), words).toEqual(tiers);
      for (const hit of hits) expect(fold(hit.why.fragment), `${words} → ${hit.label}`).toContain(fold(words).split(" ")[0]!);
    }
  });

  it("is stable: the same words give the same list", () => {
    for (const words of ["e", "1", "qualification"]) {
      expect(search(store, words, { principal: keeper })).toEqual(search(store, words, { principal: keeper }));
    }
  });

  it("counts before it limits", () => {
    const all = search(store, "0", { principal: keeper, limit: 1000 });
    const few = search(store, "0", { principal: keeper, limit: 3 });
    expect(few.hits.length).toBe(3);
    expect(few.total).toBe(all.total);
    expect(Object.values(all.byKind).reduce((sum, count) => sum + count, 0)).toBe(all.total);
  });

  it("returns nothing of a kind the seat may not see — not a record, not the kind", () => {
    const kept = store.kindsKeptFrom(helper);
    expect(kept.size).toBeGreaterThan(0);
    for (const words of ["user", "invitation", "0", "people"]) {
      const seen = search(store, words, { principal: helper, limit: 1000 });
      for (const hit of seen.hits) {
        if (hit.about === "node" || hit.about === "kind" || hit.about === "place") expect(kept.has(hit.kind), `${words}: ${JSON.stringify(hit)}`).toBe(false);
      }
      expect(seen.searched.kinds.some((kind) => kept.has(kind))).toBe(false);
    }
    expect(search(store, "people", { principal: keeper }).hits[0]).toMatchObject({ about: "kind", kind: "user", label: "People" });
  });
});

describe("an agent that cannot see is told what the words reach", () => {
  const app = defineApp({ name: "lists", schema, mutations: [finish, drop, addTask], invariants: [overdue], version: 1 });

  it("derives the searchable fields: the name and what a person reads, never what is hidden", () => {
    // A boolean is a state asked as a condition (done:false), not a word to find.
    expect(searchableFields(schema, "task").map((field) => field.key)).toEqual(["label", "due", "notes"]);
    expect(searchableFields(schema, "list").map((field) => field.key)).toEqual(["label"]);
  });

  it("says so in describe and llms.txt, with is:any for the past", () => {
    const said = describeApp(app);
    expect(said).toContain("## What can be found");
    expect(said).toContain("task: label (name), due (due) and notes (notes); past records only with is:any.");
    expect(said).toContain("list: label (name).");
    const llms = generateLlmsTxt(app);
    expect(llms).toContain("- searched by: label, due, notes; past records only with is:any");
    expect(llms).toContain("## Finding a thing");
    expect(llms).toContain("`search_graph`");
  });
});
