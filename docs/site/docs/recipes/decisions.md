# Your decisions, as an app

This recipe is what an agent made of one prompt, in a repository it had never seen. The architecture decision records: what each decided, what it superseded and which modules it affects, with the loose ends flagged.

```sh
Read https://graview.dev/start.md, then turn this repo's decisions into a Graview app.
```

Paste it into Claude Code, Codex or Cursor at the root of your repository. [start.md](https://graview.dev/start.md) is the page the agent reads.

## The app, running

This is the declaration below, compiled in your browser by the same compiler `graview check` uses, over the seed below. Press a district; open the problems; take a repair.

*The app the decisions prompt made, live: a live demo, on the HTML page.*

## What the agent declared

**Larkspur decisions**: Larkspur's architecture decision records (docs/adr): each decision, its status and date, what superseded it, and the modules it affects. 2 kinds, 8 acts and 6 rules, each rule with the act that repairs it.

| Kind | Fields | Relations | Records in the seed |
| --- | --- | --- | --- |
| `decision` | `number`, `title`, `status`, `date`, `file`, `wholeRepository` | `supersededBy` to `decision`; `affects` to `module` | 14 |
| `module` | `path`, `packageName`, `description` | none | 16 |

### The rules

- **A superseded decision names what superseded it.** Over each decision, when `status == 'superseded'`: requires `present(supersededBy)`. Repaired by “Name what superseded it” (`mark-superseded`).
- **A decision something supersedes says so.** Over each decision, when `present(supersededBy)`: requires `status == 'superseded'`. Repaired by “Mark it superseded” (`mark-superseded`) or “It is not superseded” (`unmark-superseded`).
- **What supersedes a decision is accepted.** Over each decision, when `present(supersededBy)`: requires `supersededBy.status == 'accepted'`. Repaired by “It is not superseded” (`unmark-superseded`).
- **A decision is superseded only by a later one.** Over each decision, when `present(supersededBy)`: requires `supersededBy.date >= date`. Repaired by “It is not superseded” (`unmark-superseded`).
- **A proposal is decided within 90 days.** Over each decision, when `status == 'proposed'`: requires `days(date, today()) <= 90`. Repaired by “Accept it” (`accept-decision`) or “Reject it” (`reject-decision`).
- **An accepted decision affects something.** Over each decision, when `status == 'accepted'`: requires `wholeRepository == true or exists(out('affects'))`. Repaired by “Name a module it affects” (`affect-module`).

## What graview check says

Run on every push, against the committed file:

```sh
npx graview check --document app.json
· rules.proposal-not-left-open: Rule "proposal-not-left-open" reads the clock (today(), now(), a computed field that does, or a kind whose records retire on a date), so the day turning breaks or mends it with nothing changed. A store judges it again only when its host ticks it. — Host it with @graview/ship (openStore, serve and openRemote tick at each midnight, UTC), or call store.tick(now) when the day turns — once a day from a host's own alarm — and its subscribers hear what appeared and cleared.
```

A line starting with a dot is a note, not a warning: advice the checker leaves for a person to weigh.

## How it was made

An agent was given the prompt above and nothing else, at the root of Larkspur: a booking service for small clinics that does not exist, written as a TypeScript monorepo the size of a real one, with sixteen modules, guides and runbooks with gaps, a CODEOWNERS that misses some, fourteen decision records and pinned dependencies. It followed [start.md](https://graview.dev/start.md), scaffolded, declared, ran `graview check` until it was clean, opened `graview preview` and reported back. The two files it wrote are committed as they came out of that run.

CI does not run an agent. On every push it checks the committed declaration with `graview check --document`, loads the seed into a store, and opens this page in a browser to see the app mount. To run the prompt again yourself:

```sh
node scripts/fixtures/recipes/larkspur.mjs larkspur
cd larkspur && git init -q && git add -A && git commit -qm larkspur
# then paste the prompt into your agent
```

The files: [`app.json`](https://graview.dev/recipes/decisions/app.json) and [`seed.json`](https://graview.dev/recipes/decisions/seed.json) (30 records and 28 relations).

## The declaration, in full

```json
{
  "format": "graview-document",
  "formatVersion": 1,
  "name": "Larkspur decisions",
  "description": "Larkspur's architecture decision records (docs/adr): each decision, its status and date, what superseded it, and the modules it affects.",
  "kinds": {
    "decision": {
      "noun": "decision",
      "plural": "decisions",
      "label": "ADR {number}: {title}",
      "description": "One numbered record in docs/adr. Never edited after it is accepted; a changed mind is a new record that supersedes the old one.",
      "fields": {
        "number": { "type": "integer", "required": true, "min": 1, "description": "The record's number, from its file name and heading." },
        "title": { "type": "string", "required": true, "description": "The record's heading, without its number." },
        "status": { "type": "enum", "options": ["proposed", "accepted", "rejected", "superseded"], "required": true, "description": "The record's Status line." },
        "date": { "type": "date", "required": true, "description": "The record's Date line." },
        "file": { "type": "string", "required": true, "description": "Where the record lives in the repository." },
        "wholeRepository": { "type": "boolean", "label": "Affects the whole repository", "description": "The record's Affects line says the whole repository rather than naming modules." }
      },
      "edges": {
        "supersededBy": { "to": ["decision"], "cardinality": "one", "description": "the decision that superseded it", "inverse": "the decisions it supersedes" },
        "affects": { "to": ["module"], "cardinality": "many", "description": "the modules it affects", "inverse": "the decisions that affect it" }
      },
      "fieldRoles": { "when": "date" },
      "glance": ["status", "date", "wholeRepository"]
    },
    "module": {
      "noun": "module",
      "plural": "modules",
      "label": "{path}",
      "description": "A workspace package that pnpm-workspace.yaml takes in: a directory under services/, packages/ or tools/ with its own package.json.",
      "fields": {
        "path": { "type": "string", "required": true, "description": "The directory, from the repository root." },
        "packageName": { "type": "string", "required": true, "label": "Package", "description": "The name in its package.json." },
        "description": { "type": "string", "description": "The description in its package.json." }
      }
    }
  },
  "acts": {
    "add-decision": { "creates": "decision", "title": "Record a decision", "description": "Add a decision record from docs/adr." },
    "add-module": { "creates": "module", "title": "Add a module", "description": "Record a workspace package." },
    "affect-module": { "on": "decision", "connects": "affects", "title": "Say it affects a module", "description": "Name a module this decision affects.", "fromTheOtherEnd": "Name a decision that affects it" },
    "unaffect-module": { "on": "decision", "severs": "affects", "title": "Say it no longer affects a module", "description": "Take a module off this decision's Affects line.", "fromTheOtherEnd": "Take a decision off it" },
    "mark-superseded": { "on": "decision", "connects": "supersededBy", "sets": { "status": "superseded" }, "title": "Name what superseded it", "description": "Name the decision that superseded this one, and mark it superseded.", "fromTheOtherEnd": "Name a decision it supersedes" },
    "unmark-superseded": { "on": "decision", "severs": "supersededBy", "sets": { "status": "accepted" }, "title": "It is not superseded", "description": "Take back what superseded this decision, and mark it accepted again.", "fromTheOtherEnd": "Take back a decision it supersedes" },
    "accept-decision": { "on": "decision", "sets": { "status": "accepted" }, "title": "Accept it", "description": "Mark the decision accepted." },
    "reject-decision": { "on": "decision", "sets": { "status": "rejected" }, "title": "Reject it", "description": "Mark the decision rejected: it was considered and not taken." }
  },
  "rules": {
    "superseded-names-successor": {
      "title": "A superseded decision names what superseded it",
      "over": "decision",
      "when": "status == 'superseded'",
      "require": "present(supersededBy)",
      "says": "ADR {number} is superseded but does not say by what",
      "repairs": [{ "act": "mark-superseded", "label": "Name what superseded it" }]
    },
    "successor-is-marked-superseded": {
      "title": "A decision something supersedes says so",
      "over": "decision",
      "when": "present(supersededBy)",
      "require": "status == 'superseded'",
      "says": "ADR {number} has a successor but its status is {status}",
      "repairs": [{ "act": "mark-superseded", "label": "Mark it superseded" }, { "act": "unmark-superseded", "label": "It is not superseded" }]
    },
    "successor-is-accepted": {
      "title": "What supersedes a decision is accepted",
      "over": "decision",
      "when": "present(supersededBy)",
      "require": "supersededBy.status == 'accepted'",
      "says": "ADR {number} is superseded by a decision that is not accepted",
      "repairs": [{ "act": "unmark-superseded", "label": "It is not superseded" }]
    },
    "successor-is-newer": {
      "title": "A decision is superseded only by a later one",
      "over": "decision",
      "when": "present(supersededBy)",
      "require": "supersededBy.date >= date",
      "says": "ADR {number} is superseded by a decision dated before it",
      "repairs": [{ "act": "unmark-superseded", "label": "It is not superseded" }]
    },
    "proposal-not-left-open": {
      "title": "A proposal is decided within 90 days",
      "over": "decision",
      "when": "status == 'proposed'",
      "require": "days(date, today()) <= 90",
      "says": "ADR {number} has been proposed since {date} and is still open",
      "repairs": [{ "act": "accept-decision", "label": "Accept it" }, { "act": "reject-decision", "label": "Reject it" }]
    },
    "accepted-affects-something": {
      "title": "An accepted decision affects something",
      "over": "decision",
      "when": "status == 'accepted'",
      "require": "wholeRepository == true or exists(out('affects'))",
      "says": "ADR {number} is accepted but names no module it affects",
      "repairs": [{ "act": "affect-module", "label": "Name a module it affects" }]
    }
  }
}
```

---

A Graview recipe: The architecture decision records: what each decided, what it superseded and which modules it affects, with the loose ends flagged.

The page: https://graview.dev/docs/recipes/decisions.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
