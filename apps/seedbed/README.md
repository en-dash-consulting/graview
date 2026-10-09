# Seedbed — the community garden

A community garden: gardeners, plots, plantings, the years a bed turns through, and one rule
the garden can choose to hold itself to. It is also where the docs' chapters come from
(`src/domain/chapters.ts`).

```sh
pnpm --filter @graview/seedbed dev   # http://localhost:5194
```

**It opens planted**, on the example garden — the one the chapters grow into
(`src/domain/example.ts`), so there is something to look at and ask about. The framework's
real first screen — a declared schema with nothing in it — is one press away:

- **Start empty** (the person menu) or `?empty=1` opens the garden with nothing in it, and
  this browser remembers that choice;
- **Load the example garden** (the person menu), **Start fresh** or `?fresh=1` plants the
  example again.

From an empty garden, **filling it in is the framework's onboarding walkthrough**:

## The walkthrough: from nothing to a rule-checked graph

1. **You land at altitude.** An empty garden opens on the Graview: a city of empty districts,
   each kind a card saying "none yet". This is the map of what *could* exist — the shape of
   the domain before any of it does.

2. **An empty kind offers its own beginnings.** Click the Gardeners district. The inspector
   opens with "Welcome a gardener …" — derived, not wired: the mutation declares
   `creates: ["gardener"]`, and a selected kind with no members asks exactly one question,
   "how does the first one get here". Add a gardener or two. Add a plot from the Plots
   district the same way.

3. **Some doors wait, honestly.** "Sow something" needs a plot to sow into, so the Plantings
   district offers nothing until the first plot exists — a button whose every answer would
   fail is not offered, rather than offered and broken.

4. **Adopt the rule.** The Rules district offers "Agree every plot has a caretaker". The
   rule is *data* — a node on the map — and it starts judging the moment it lands: every
   untended plot becomes a violation, each carrying repairs that name real gardeners.
   Standing (top right) counts the problems; each repair is one click.

5. **Or let the seat do the first pass.** The Activity rail holds an agent seat: "Plant a
   starter garden". It proposes gardeners, plots, and the rule — as ordinary mutations
   through the derived tool surface, attributed to the seat in the op log, reviewable and
   undoable. It deliberately plants *half* a garden: the rule fires immediately, so the
   first thing the seat teaches is not "data appeared" but "the graph argues back".

6. **The horizon works from day one.** Sow something, then harvest it. The planting leaves
   the counts ("none yet, +1 past") but never the graph — last season is one `past=1` stop
   away, not deleted.

## What this app is for

- **Holding the framework to zero.** Kind cards, views, the overview, the inspector, the
  seat — all must render honestly with no data. The integration tests and UI harnesses pin
  this.
- **The `creates` seam.** Mutations declare what they bring into existence; the empty state
  derives its offers from that, with no app-side menu wiring.
- **The intelligence integration point.** An empty declared graph plus a seat that proposes
  starter data is the "describe your domain, get a working app" moment the hosted-product
  plans depend on (see `../graview-cloud`).
