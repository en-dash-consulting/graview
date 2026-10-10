import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { expressionRule } from "../../src/document/index.js";
import { judgeWithLines, problemWords, ruleLine, ruleLineWords, ruleSpoken, ruleText, withLines } from "../../src/lines.js";
import { judgedWith } from "../../src/invariants/engine.js";
import { brokenWords, createSchema, defineNode, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A RULE SAYS ITS SHAPE.
 *
 * Nick, from Graview Cloud, over a rule line "A scenario keeps the target
 * margin": "we have a lot of 'keeps' throughout this, and it technically
 * makes sense but it's awkward and unfamiliar." A rule written in the rule
 * language has a structure a person can read, so it is drawn from the
 * declaration — the kind it judges, then the requirement in symbols a person
 * knows from arithmetic, in the declaration's own labels: "margin ≥ target
 * margin". Broken, the same line carries the record's values, the
 * comparison turned the way it stands: "margin 44% < target margin 50%".
 * Every symbol has words a screen reader says instead.
 */

/** Every shape the rule language writes, over a small model of plans, scenarios, vendors and chores. */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Shapes",
  kinds: {
    assumptions: {
      noun: "assumptions sheet",
      plural: "assumptions sheets",
      fields: { name: { type: "string" }, targetMargin: { type: "number", format: "percent" } },
      label: "{name}",
    },
    plan: {
      fields: { name: { type: "string" }, price: { type: "number", format: "money", unit: "USD" } },
      label: "{name}",
    },
    scenario: {
      fields: { name: { type: "string" }, revenue: { type: "number", format: "money", unit: "USD" }, cost: { type: "number", format: "money", unit: "USD" } },
      computed: { margin: { expr: "if(revenue > 0, (revenue - cost) / revenue, 0)", label: "Margin" } },
      edges: { plan: { to: ["plan"], cardinality: "one", description: "the plan it is on", inverse: "scenarios on it" } },
      label: "{name}",
    },
    category: { fields: { name: { type: "string" }, budget: { type: "number", format: "money", unit: "USD" } }, label: "{name}" },
    vendor: {
      fields: { name: { type: "string" }, status: { type: "enum", options: ["shortlisted", "booked", "dropped"] }, quote: { type: "number", format: "money", unit: "USD" } },
      edges: { fills: { to: ["category"], cardinality: "one" } },
      label: "{name}",
    },
    issue: {
      fields: { title: { type: "string" }, severity: { type: "enum", options: ["blocker", "minor"] }, status: { type: "enum", options: ["open", "fixing", "done"] }, owner: { type: "string" }, done: { type: "boolean" } },
      label: "{title}",
    },
    chore: { fields: { title: { type: "string" }, lastDone: { type: "date" }, due: { type: "date" } }, label: "{title}" },
  },
  rules: {
    "scenario-margin": { title: "A scenario keeps the target margin", over: "scenario", when: "plan.price > 0", require: "margin >= first(all('assumptions')).targetMargin", says: "{name} keeps {margin|percent}, below the target" },
    "booked-has-quote": { title: "A booked vendor has a quote", over: "vendor", when: "status == 'booked'", require: "quote != null" },
    "one-booked": { title: "One vendor booked per category", over: "category", require: "count(in('fills') where status == 'booked') <= 1" },
    "fits-budget": { over: "category", when: "present(budget)", require: "sum(in('fills') where status == 'booked', 'quote') <= budget" },
    "blocker-owned": { over: "issue", when: "severity == 'blocker' && (status == 'open' || status == 'fixing')", require: "present(owner)" },
    "issue-settled": { over: "issue", require: "status in ['done', 'fixing'] or not done" },
    "chore-recent": { over: "chore", when: "present(lastDone)", require: "days(lastDone, today()) <= 7" },
    "chore-coming": { over: "chore", when: "present(due)", require: "due >= today()" },
    "vendor-placed": { over: "vendor", require: "exists(out('fills')) and not (status == 'dropped')" },
    "one-sheet": { title: "There is exactly one assumptions sheet", over: "graph", require: "count(all('assumptions')) == 1" },
  },
};

const SEED = {
  nodes: [
    { id: "a1", kind: "assumptions", name: "Our numbers", targetMargin: 0.5 },
    { id: "a2", kind: "assumptions", name: "Old numbers", targetMargin: 0.4 },
    { id: "p1", kind: "plan", name: "Team", price: 99 },
    { id: "s1", kind: "scenario", name: "A club on Team", revenue: 100, cost: 56 },
    { id: "s2", kind: "scenario", name: "A planner on Team", revenue: 100, cost: 20 },
    { id: "c1", kind: "category", name: "Venue", budget: 5000 },
    { id: "v1", kind: "vendor", name: "The Barn", status: "booked", quote: 4000 },
    { id: "v2", kind: "vendor", name: "The Mill", status: "booked", quote: 3000 },
    { id: "v3", kind: "vendor", name: "The Loft", status: "dropped" },
    { id: "i1", kind: "issue", title: "Login fails", severity: "blocker", status: "open", done: true },
    { id: "h1", kind: "chore", title: "Water the plants", lastDone: "2026-09-20", due: "2026-10-01" },
  ],
  edges: [
    { id: "e1", kind: "plan", from: "s1", to: "p1" },
    { id: "e2", kind: "plan", from: "s2", to: "p1" },
    { id: "e3", kind: "fills", from: "v1", to: "c1" },
    { id: "e4", kind: "fills", from: "v2", to: "c1" },
  ],
};

function opened() {
  const result = compileDocument(DOCUMENT, { today: () => "2026-10-09" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  const app = result.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: structuredClone(SEED) as never });
  const rule = (name: string) => {
    const found = store.allInvariants().find((one) => one.name === name);
    const line = found ? ruleLine(found, store.schema) : undefined;
    if (!line) throw new Error(`${name} has a line`);
    return line;
  };
  const broken = (name: string, subject?: string) => {
    const found = withLines(store, store.violations()).find((one) => one.invariant === name && (subject === undefined || one.subjectId === subject));
    if (!found) throw new Error(`${name} is broken${subject ? ` by ${subject}` : ""}`);
    return found;
  };
  return { store, rule, broken };
}

describe("a rule says its shape", () => {
  const { rule, broken } = opened();

  it("a comparison is a symbol between two of the declaration's labels, the one assumptions sheet's field said as its own", () => {
    const line = rule("scenario-margin");
    expect(line.kind).toBe("scenario");
    expect(ruleText(line.parts)).toBe("margin ≥ target margin");
    expect(ruleText(line.when!)).toBe("plan's price > $0");
    expect(ruleLineWords(line)).toBe("margin ≥ target margin, when plan's price > $0");
  });

  it("each symbol has the words a screen reader says instead", () => {
    expect(ruleSpoken(rule("scenario-margin").parts)).toBe("margin at least target margin");
    expect(ruleSpoken(rule("booked-has-quote").parts)).toBe("quote is not empty");
    expect(ruleSpoken(rule("one-booked").parts)).toBe("number of vendors with status is booked at most 1");
  });

  it("absence is a dash: present, exists and != null all read ≠ —", () => {
    expect(ruleText(rule("booked-has-quote").parts)).toBe("quote ≠ —");
    expect(ruleText(rule("blocker-owned").parts)).toBe("owner ≠ —");
  });

  it("an and, an or of one field's values, a count and a sum read as words and sets", () => {
    expect(ruleText(rule("blocker-owned").when!)).toBe("severity = blocker and status ∈ {open, fixing}");
    expect(ruleText(rule("one-booked").parts)).toBe("number of vendors with status = booked ≤ 1");
    expect(ruleText(rule("fits-budget").parts)).toBe("total quote of vendors with status = booked ≤ budget");
  });

  it("enum membership is ∈, a yes/no field is itself, not is its own word", () => {
    expect(ruleText(rule("issue-settled").parts)).toBe("status ∈ {done, fixing} or not done");
  });

  it("dates read relative to today", () => {
    expect(ruleText(rule("chore-recent").parts)).toBe("days since last done ≤ 7");
    expect(ruleText(rule("chore-coming").parts)).toBe("due ≥ today");
  });

  it("a relation's presence and a negated comparison", () => {
    expect(ruleText(rule("vendor-placed").parts)).toBe("fills ≠ — and status ≠ dropped");
  });

  it("a rule over the whole graph has no kind", () => {
    const line = rule("one-sheet");
    expect(line.kind).toBeUndefined();
    expect(ruleText(line.parts)).toBe("number of assumptions sheets = 1");
  });

  describe("broken, the same line carries the record's values, turned the way it stands", () => {
    it("a margin below its target, in the formats the declaration and the sentence give", () => {
      const violation = broken("scenario-margin", "s1");
      expect(violation.line?.record).toBe("A club on Team");
      expect(ruleText(violation.line!.parts)).toBe("margin 44% < target margin 50%");
      expect(problemWords(violation)).toBe("A club on Team — margin 44% < target margin 50%");
      expect(problemWords(violation, true)).toBe("A club on Team — margin 44% less than target margin 50%");
      // The author's sentence is still the message: a program that matched it still matches.
      expect(violation.message).toBe("A club on Team keeps 44%, below the target");
    });

    it("a count and a sum say how many and how much", () => {
      expect(ruleText(broken("one-booked").line!.parts)).toBe("number of vendors with status = booked 2 > 1");
      expect(ruleText(broken("fits-budget").line!.parts)).toBe("total quote of vendors with status = booked $7,000 > budget $5,000");
    });

    it("a missing value is a dash, and a rule that wrote no sentence says it in its message after its title (FR-159)", () => {
      const violation = broken("blocker-owned");
      expect(ruleText(violation.line!.parts)).toBe("owner = —");
      expect(problemWords(violation)).toBe("Login fails — owner = —");
      expect(violation.message).toBe("Login fails: blocker owned — owner = —");
    });

    it("every side of an or that failed, with its value", () => {
      expect(ruleText(broken("issue-settled").line!.parts)).toBe("status open ∉ {done, fixing} and done");
    });

    it("a day as a person reads it", () => {
      expect(ruleText(broken("chore-recent").line!.parts)).toBe("days since last done 19 > 7");
      expect(ruleText(broken("chore-coming").line!.parts)).toBe("due 1 Oct 2026 < today");
    });

    it("each side of an and that broke, and only those", () => {
      expect(ruleText(broken("vendor-placed", "v3").line!.parts)).toBe("fills = — and status = dropped");
      expect(ruleText(broken("blocker-owned", "i1").line!.parts)).toBe("owner = —");
    });

    it("the whole graph's count", () => {
      const violation = broken("one-sheet");
      expect(ruleText(violation.line!.parts)).toBe("number of assumptions sheets 2 ≠ 1");
      expect(violation.line?.record).toBeUndefined();
    });
  });

  /*
   * A RULE'S SHAPE IS ON EVERY JUDGMENT ONCE THE WORDS ARE HERE (FR-159).
   * 0.1.20 drew the line on the framework's own surfaces only: a host that
   * read `store.violations()` and handed a chat the message read "A
   * wedding planner on Small: Margin above target", with no values, once
   * authors had shortened their titles to let the shape speak.
   */
  describe("judged once the words are loaded, every violation carries its line, and its message the values", () => {
    it("the store's own violations carry the line, without asking withLines", () => {
      const { store } = opened();
      const violation = store.violations().find((one) => one.invariant === "one-booked")!;
      expect(ruleText(violation.line!.parts)).toBe("number of vendors with status = booked 2 > 1");
      expect(violation.message).toBe("Venue: One vendor booked per category — number of vendors with status = booked 2 > 1");
    });

    it("a rule's own sentence stays as its author wrote it, its line beside it", () => {
      const { store } = opened();
      const violation = store.violations().find((one) => one.invariant === "scenario-margin")!;
      expect(violation.message).toBe("A club on Team keeps 44%, below the target");
      expect(problemWords(violation)).toBe("A club on Team — margin 44% < target margin 50%");
    });

    it("withLines over violations already lined changes nothing: the message says its values once", () => {
      const { store } = opened();
      const once = store.violations();
      expect(withLines(store, once)).toEqual(once);
    });

    it("before the words are here a judgment carries none, and says its sentence until they are asked for", () => {
      const { store } = opened();
      judgedWith(undefined);
      try {
        const violation = store.violations().find((one) => one.invariant === "blocker-owned")!;
        expect(violation.line).toBeUndefined();
        expect(violation.message).toBe("Login fails: blocker owned");
        expect(withLines(store, [violation])[0]!.message).toBe("Login fails: blocker owned — owner = —");
      } finally {
        judgeWithLines();
      }
    });

    it("an act that changes a broken rule's values but leaves it broken neither resolves nor introduces it", () => {
      const { store } = opened();
      const result = store.preview({ name: "edit-scenario", args: { id: "s1", cost: 60 } } as never);
      expect(result.violationsAfter.find((one) => one.invariant === "scenario-margin")?.line?.text).toBe("margin 40% < target margin 50%");
      expect(result.resolves.map((one) => one.invariant)).not.toContain("scenario-margin");
      expect(result.introduces.map((one) => one.invariant)).not.toContain("scenario-margin");
    });

  });

  it("a count of problems is a count of rules broken", () => {
    expect(brokenWords([])).toBe("All rules hold");
    expect(brokenWords([{ invariant: "a" }])).toBe("1 rule broken");
    expect(brokenWords([{ invariant: "a" }, { invariant: "b" }])).toBe("2 rules broken");
    expect(brokenWords([{ invariant: "a" }, { invariant: "a" }, { invariant: "b" }])).toBe("2 rules broken in 3 places");
  });
});

describe("a rule written in TypeScript with the rule language says its shape too", () => {
  const task = defineNode("task", { fields: z.object({ title: z.string(), dueOn: z.string().optional(), done: z.boolean() }), label: (node) => node.title });
  const schema = createSchema([task]);
  const rule = expressionRule("task-dated", { over: "task", when: "not done", require: "present(dueOn)" });

  it("its line reads the field's words", () => {
    expect(ruleText(ruleLine(rule, schema as AnySchema)!.parts)).toBe("due on ≠ —");
    expect(ruleText(ruleLine(rule, schema as AnySchema)!.when!)).toBe("not done");
  });

  it("broken, it says the record and what it found", () => {
    const store = new Store<AnySchema>({ schema: schema as AnySchema, invariants: [rule as never], snapshot: { nodes: [{ id: "t1", kind: "task", title: "Pay", done: false }], edges: [] } as never });
    const violation = withLines(store, store.violations())[0]!;
    expect(problemWords(violation)).toBe("Pay — due on = —");
  });

  it("a rule that is a function has no line, and says its own sentence", () => {
    const plain = { name: "plain", label: "Plain", scope: "graph" as const, evaluate: () => [{ invariant: "plain", label: "Plain", message: "Something is off", nodeIds: [], repairs: [] }] };
    const store = new Store<AnySchema>({ schema: schema as AnySchema, invariants: [plain as never], snapshot: { nodes: [], edges: [] } as never });
    expect(ruleLine(plain as never, schema as AnySchema)).toBeUndefined();
    expect(problemWords(withLines(store, store.violations())[0]!)).toBe("Something is off");
  });
});
