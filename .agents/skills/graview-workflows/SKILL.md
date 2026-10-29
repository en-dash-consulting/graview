---
name: graview-workflows
description: Have a Graview app do something on its own — fill next week from a pattern, keep one record in step with another, set aside what is done, send what is public each morning — declared as a workflow (or a kind that follows another), checked by graview check and proven by a dry run before anything is kept.
---

# Let the app do it on its own

A person says one sentence — "fill out next week's events every Sunday" —
and expects it to keep happening. Writing that as an outside script loses
everything the app already knows: who may do what, what a rerun must not
duplicate, what a person changed by hand, what Activity says happened. A
**workflow** is the app's own actor given a clock and a list of steps, in
the declaration (`workflows`, beside `kinds`), so the checker reads it, the
Scene draws it, and every run is one row in Activity that undo takes back.

```jsonc
"workflows": {
  "next-weeks-events": {
    "title": "Fill out next week's events",          // what a person reads
    "when": [{ "every": "sunday 18:00" }],            // or cron, made, changed, synced, byHand
    "approve": "apply",                               // or "suggest", "ask"
    "steps": [ /* in order */ ]
  }
}
```

`when` is one or several: `{ "every": "day 03:00" | "weekday 09:00" |
"sunday 18:00" | "month 1 09:00" | "hour" }` or `{ "cron": "0 18 * * 0" }`,
both on the brand's `timeZone`; `{ "made": "<kind>", "where"? }`,
`{ "changed": "<kind>", "fields"? }`, `{ "synced": "<connection>" }`,
`{ "byHand": true }`. A step is one of a closed set: `act` (run an act,
once or `over` the records a rule picks), `agent` (a model proposes acts
from a list), `generate` (dated records from a pattern), `archive` (set
aside by a rule). Read `packages/core/src/workflow-shape.ts` for every key.

## Do this

Pick the recipe that matches the sentence. Each ends the same way: check,
then a dry run, then the real one.

1. **"Fill out next week's events every Sunday."** A `generate` step: for
   each day of the window a source's date falls on — a date, a date that
   repeats, a set of weekdays — one record, linked back to its source,
   made once per key (`"{source}:{date}"` unless you say one):
   ```json
   { "title": "Fill out next week's events", "when": [{ "every": "sunday 18:00" }],
     "steps": [{ "generate": "event",
       "from": [{ "kind": "routine", "where": "active", "dates": "startsAt" }],
       "window": "next week",
       "set": { "name": { "expr": "name" }, "startsAt": "$date" },
       "link": "pattern" }] }
   ```
   A rerun changes what the source changed and never what a person changed
   on an event, unless the step says `"overwrite": true`; a skipped or moved
   occurrence stays as the person left it. Another source is another entry
   in `from` (a plan item's `date`, a drive's weekdays `"days"`).

2. **"Keep events in step with plan items."** Not a workflow: the event
   kind follows its source, in the same change as the edit, so it needs no
   clock and is never a minute behind:
   ```json
   "event": { "edges": { "plan": { "to": ["plan-item"], "cardinality": "one" } },
     "derives": { "from": "plan-item", "via": "plan", "set": { "name": { "expr": "name" } } }, … }
   ```
   Renaming the plan item renames its event in that change; an edit on the
   event to a field set from a source field as it is flows back; archiving
   the source archives the event. A `changed` trigger on a workflow would
   do the same thing later, and twice — reach for `derives` first.

3. **"Archive done grocery lists after 3 days."** An `archive` step sets
   aside, never deletes — the list is still there, Unarchive brings it back:
   ```json
   { "title": "Set aside done grocery lists", "when": [{ "every": "day 03:00" }],
     "steps": [{ "archive": "grocery-list", "where": "status == 'done'", "after": "3 days" }] }
   ```
   A record a person said to leave alone is left; one a person brought back
   after a run is not set aside again.

4. **"Sync what's public each morning."** The connection does the sending
   (`graview-sync`); the workflow decides what goes. An act step over the
   records a rule picks, keyed so a rerun changes the listing it made
   rather than making another:
   ```json
   { "title": "Send what's public each morning", "when": [{ "every": "day 07:00" }],
     "steps": [{ "act": "add-listing", "over": { "kind": "event", "where": "public" },
       "args": { "name": { "expr": "name" }, "startsAt": { "expr": "startsAt" } },
       "key": "{id}" }] }
   ```
   A workflow whose steps write a kind a connection sends out defaults to
   `"approve": "ask"`: each run waits in the Suggested tray as one
   suggestion, and a person approves it before anything leaves the app.
   Say `"approve": "apply"` only when the person asked for it unattended;
   the checker then warns `workflow-sends-out-unasked` — allowed, but said.

**What its changes become.** `apply` makes them. `suggest` makes what it
is sure enough of and puts the rest in the Suggested tray. `ask` gathers a
run into one suggestion a person approves whole or item by item. A step
may say its own `approve`. An `agent` step — `{ "agent": "<instruction>",
"reads": [...], "acts": [...] }` — needs the host's model; with none lent
the step is skipped and the run says so, never fails.

**Labeling each record.** A `classify` step — `{ "classify": "feedback",
"field": "category" }` — asks the model which option fits each record.
`"otherwise": "needs-look"` labels a record no option clears (else it is
left unlabeled for a person); `"applyAt": { "spam": 0.85 }` sets a label
at least that sure without asking, and asks below it. An option in
`confirm` is always asked. An option the field lacks, or a number past 0
to 1, is a `workflow-classify-*` finding.

**Say it in TypeScript** the same way: `defineApp({ workflows })` takes the
same objects.

## Then find out whether it worked

```sh
npx graview check                     # the workflow-* findings, each with its fix
npx graview workflow ./app.json       # every workflow in a sentence, paused or not, when it next runs
npx graview workflow ./app.json next-weeks-events --data ./data --dry --now 2026-11-01T18:00:00
```

`graview check` refuses a name that is not there — `workflow-act-unknown`,
`workflow-kind-unknown`, `workflow-field-unknown`,
`workflow-connection-unknown`, `workflow-key-field-unknown` — a rule it
cannot read (`workflow-where-invalid`), a clock it cannot read
(`workflow-schedule-invalid`, naming what it can), and a step list or an
agent's acts left empty. Each says the edit that fixes it.

The dry run prints what the run **would** make, change, set aside and
suggest, and keeps nothing. Read it against the sentence: next week's
seven days, not this week's; the done lists, not the open ones. Then run
it without `--dry` twice: the first after a change is dry whatever you
ask (it says "First run after a change: nothing was kept"), the next keeps
what it does, and a third over the same records says `nothing-new` — the
proof a rerun makes nothing twice. The runs are kept beside the store in
`workflow-runs.json`.

From altitude the Scene draws each workflow in the street beside the
district it writes, wired to what it reads and writes, a paused one dimmed,
saying its last run when the host hands `workflowRuns`. An owner's seat
runs, pauses and resumes one through `run_workflow`, `pause_workflow` and
`resume_workflow` when its host hands `seatWorkflows(…)` (`graview mcp
--workflows`); Graview Cloud's chat does it through `propose_change` with
`add-workflow`, `set-workflow`, `pause-workflow`, `resume-workflow`.

A host runs workflows on their clocks itself: `nextRunAt(workflow, after,
zone)` and `triggeredBy(workflow, commit, app)` from
`@graview/core/workflows` say when, `runWorkflow` from
`@graview/tools/workflows` runs one, and its `WorkflowLog` keeps the runs.
A run says what its model steps spent (`spent`: calls and tokens, by step
and in all) — meter from that, never by wrapping the model. Pass a
trigger's `by` (the workflow whose run fired it) into the run: it carries
its `chain`, and one deeper than `chainLimit` (3) is held and says so, so
two workflows that wake each other stop. `workflowRuns` takes counts
(`made: 3`) as well as ids.

## What the check cannot see

- **Whether the sentence was understood.** `graview check` holds every name
  to the declaration; only the dry run shows the step picks the records
  the person meant. Read its `made` and `archived`, not just its outcome.
- **Time zones in the person's head.** "Sunday at six" is the brand's
  `timeZone`; an app with none runs on UTC. Say the zone.
- **A model's judgment.** An `agent` step proposes; whether its proposals
  are right is a person's to judge in the tray. Keep it on `suggest` or
  `ask` until it has earned `apply`.
- **That anything runs it.** A declaration is not a cron. `graview serve`,
  Graview Cloud or your own host must call `runWorkflow` on its clock; a
  local folder only runs when you run `graview workflow`.
