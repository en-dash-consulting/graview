# graview-invariant

`graview-invariant` is one of Graview's 15 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Write a Graview invariant that judges the graph and NAMES the mutations that would repair it, then verify it with graview check and by making it actually fire.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Write a rule that names its own repairs

An invariant is not a validator. A validator says no; an invariant says what is wrong, which nodes are implicated, and **which mutations would fix it** — and that last part is the seam the whole affordance system rides on. A repair naming a mutation is why selecting an out-of-balance set of duties surfaces "rebalance" without anyone writing a rule to produce that suggestion.

### Do this

1. **Scope it to a kind, or to the graph.** `scope: { kind: "session" }` runs it once per session; `scope: "graph"` runs it once. Use `match` to narrow further — the worked examples scope to a `rule` kind and match on the rule node's own `spec.type`, so the rules a domain enforces are *data* rather than code, and a coach can be told which rule fired by name.

1. **Declare `repairs` statically.** The array of mutation names this rule may propose. `graview check` verifies every one exists, so a repair pointing at a renamed mutation is a build failure rather than a surprise the first time the rule fires.

1. **Return violations that carry their implications.**

```ts export const sessionFits = defineInvariant("session-fits", { scope: { kind: "rule", match: (node) => node.spec.type === "session-fits" }, repairs: ["cut-drill"], evaluate({ graph, subject }) { // ... find the session and its drills ... if (planned <= budget) return []; return [{ invariant: "session-fits", subjectId: subject.id, label: subject.label, // In the app's own words. This is shown in the strip verbatim. message: `${session.label} plans ${planned} minutes into ${budget} — ${planned - budget} over`, // Every node this is ABOUT. Views light these wherever they are // drawn, and selecting the rule lights them — which is the only // reason selecting a rule changes the picture at all. nodeIds: [session.id, ...drills.map((d) => d.id)], repairs: drills.map((drill) => ({ mutation: "cut-drill", args: { sessionId: session.id, drillId: drill.id }, label: `Cut "${drill.label}" — ${drill.minutes} minutes back`, })), }]; }, }); ```

1. **Keep `evaluate` pure.** Same graph and context in, same violations out. No clock, no random source, no DOM. That purity is what lets the whole tier run headlessly, and what lets `preview` say what a change *would* break before it happens.

1. **Fill in `missing` for a repair that cannot be complete.** A repair still needing an argument lists it, and the framework offers real candidates for it — the interface never wires up a picker per mutation.

### A rule said in words

When what must hold is a sentence about the graph, say it in the rule language instead of a function — `expressionRule` from `@graview/core/document` makes the invariant, and the studio and a document can read it:

```ts
export const pricedPackages = expressionRule("priced-packages", {
  over: "package",
  require: "net > 0",
  says: "{name} costs nothing after the discount",
  repairs: ["edit-package"],
});
```

Fields and one-edge hops by name, `out('edge')`, `in('edge')`, `all('kind')` and `S where cond`; `count`, `exists`, `every`/`some(S, cond)`; `sum`/`min`/`max(S, expr)` with an expression per member (`sum(out('includes'), list * units)`); `sort(S, key, 'asc'|'desc')` (a list key sorts by its first value, then its next), `first(S)` for one record, `either(a, b)` for the first that is something; `if(cond, a, b)`, which works out only the branch it takes; `present`, `len`, dates. `out(S, 'edge')` and `in(S, 'edge')` walk from every member of a set and give each record reached once; sets meet with `&`, join with `|` and part with `-` — LifeLogics' coverage is one figure, `count(out(out('includes'), 'answers') & out(client, 'needs'))`, each step read from what the seat may see. (Inside a template's braces, a `|` within brackets joins; the last bar outside them is the formatter's.) A kind's `computed` fields read like stored ones. Every evaluation has a step budget: a rule that reads too much is `over-budget`, never a hang.

The same language works out what a document's act sets, so a repair can be one declared act that does all of it: org's `assign-ownership` is `on: "component"`, `connects: "owns"` (from the person given, as the relation is declared), `replaces: ["owns", "proposedOwner"]` (the links it supersedes), and `sets: { ownership: { expr: "if(to == 'person-nick', 'nick_owns', 'owned_elsewhere')" } }`; `setsOther` sets the record at the link's other end. Each previews and undoes as one act.

### The horizon

A scoped invariant judges only CURRENT subjects — nodes retired under their kind's declared `lifecycle` are skipped, because a rule about last term's agreement is noise, not a violation. An invariant that genuinely audits history says so with `judgesPast: true`.

So a rule about the past and the present — "nothing closed may still depend on something open" — is written from the side that is still current: the subject is the OPEN thing, the violation names what closed against it, and the repair acts on the subject, because that is the node a person can still act on. Judging the closed one would put the violation behind the horizon and the repair on a thing that has already left the picture.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

The checker catches `repair-unknown-mutation`, `invariant-scope-undeclared` and `required-invariant-unregistered`. Report the real output, warnings included.

**And make it fire.** A rule that never returns a violation passes every check and does nothing. Write a test that builds a graph which breaks it:

```ts
it("catches an over-long session and offers a way back", () => {
  const store = createStore({ snapshot: overbooked });
  const violation = store.violations().find((v) => v.invariant === "session-fits")!;
  expect(violation.nodeIds).toContain("s-tue");
  // And the repair actually resolves it, which is the claim that matters.
  const repair = violation.repairs[0]!;
  store.apply({ name: repair.mutation, args: repair.args! });
  expect(store.violations().some((v) => v.invariant === "session-fits")).toBe(false);
});
```

### What the check cannot see

Say so rather than implying otherwise:

- Whether the message reads as something a person would say.
- Whether `nodeIds` names everything the rule is genuinely about. Too few and the picture does not change when you select the rule; too many and it lights the whole screen.
- Whether the repair is one a person would actually want. A technically resolving repair nobody would choose is worse than no repair at all.

---

Write a Graview invariant that judges the graph and NAMES the mutations that would repair it, then verify it with graview check and by making it actually fire.

The page: https://graview.dev/docs/skills/graview-invariant.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
