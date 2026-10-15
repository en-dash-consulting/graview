# Your docs, as an app

This recipe is what an agent made of one prompt, in a repository it had never seen. The repository's docs, the modules they cover and who owns each, with every module that has no doc or no owner flagged and the repair offered.

```sh
Read https://graview.dev/start.md, then turn this repo's docs into a Graview app.
```

Paste it into Claude Code, Codex or Cursor at the root of your repository. [start.md](https://graview.dev/start.md) is the page the agent reads.

## The app, running

This is the declaration below, compiled in your browser by the same compiler `graview check` uses, over the seed below. Press a district; open the problems; take a repair.

*The app the docs prompt made, live: a live demo, on the HTML page.*

## What the agent declared

**Larkspur docs**: Larkspur's docs, the modules they cover, who owns each module, and where the docs and the owners run out. 4 kinds, 18 acts and 5 rules, each rule with the act that repairs it.

| Kind | Fields | Relations | Records in the seed |
| --- | --- | --- | --- |
| `module` | `path`, `packageName`, `summary`, `area`, `readme` | `ownedBy` to `person`; `documentedIn` to `doc` | 16 |
| `doc` | `title`, `path`, `section`, `lastReviewed` | `ownedBy` to `person` | 17 |
| `decision` | `number`, `title`, `path`, `status`, `decided`, `wholeRepository` | `affects` to `module`; `supersedes` to `decision` | 14 |
| `person` | `handle` | none | 7 |

### The rules

- **Every module has a doc.** Over each module: requires `exists(out('documentedIn'))`. Repaired by “Point it at a doc” (`document-in`).
- **Every module has an owner.** Over each module: requires `exists(out('ownedBy'))`. Repaired by “Give it an owner” (`give-module-owner`).
- **Every module has a README.** Over each module: requires `present(readme)`. Repaired by “Record its README” (`edit-module`).
- **Every guide, runbook and API doc covers a module.** Over each doc, when `section == 'guide' or section == 'runbook' or section == 'api'`: requires `exists(in('documentedIn'))`. Repaired by “Say which module it covers” (`cover-module`).
- **A superseded decision names its successor.** Over each decision, when `status == 'superseded'`: requires `exists(in('supersedes'))`. Repaired by “Say which record supersedes it” (`supersede`).

## What graview check says

Run on every push, against the committed file:

```sh
npx graview check --document app.json
✓ the document compiles and checks clean
```

## How it was made

An agent was given the prompt above and nothing else, at the root of Larkspur: a booking service for small clinics that does not exist, written as a TypeScript monorepo the size of a real one, with sixteen modules, guides and runbooks with gaps, a CODEOWNERS that misses some, fourteen decision records and pinned dependencies. It followed [start.md](https://graview.dev/start.md), scaffolded, declared, ran `graview check` until it was clean, opened `graview preview` and reported back. The two files it wrote are committed as they came out of that run.

CI does not run an agent. On every push it checks the committed declaration with `graview check --document`, loads the seed into a store, and opens this page in a browser to see the app mount. To run the prompt again yourself:

```sh
node scripts/fixtures/recipes/larkspur.mjs larkspur
cd larkspur && git init -q && git add -A && git commit -qm larkspur
# then paste the prompt into your agent
```

The files: [`app.json`](https://graview.dev/recipes/docs/app.json) and [`seed.json`](https://graview.dev/recipes/docs/seed.json) (54 records and 78 relations).

## The declaration, in full

```json
{
  "format": "graview-document",
  "formatVersion": 1,
  "name": "Larkspur docs",
  "description": "Larkspur's docs, the modules they cover, who owns each module, and where the docs and the owners run out.",
  "kinds": {
    "module": {
      "noun": "module",
      "plural": "modules",
      "label": "{path}",
      "description": "A workspace directory with its own package.json, under services/, packages/ or tools/.",
      "fields": {
        "path": { "type": "string", "required": true, "description": "The directory, from the repository root." },
        "packageName": { "type": "string", "label": "Package", "description": "The name in its package.json." },
        "summary": { "type": "string", "description": "The description in its package.json." },
        "area": { "type": "enum", "options": ["service", "package", "tool"], "required": true, "description": "Which workspace folder it sits in." },
        "readme": { "type": "string", "label": "README", "description": "Its own README.md, if it has one." }
      },
      "edges": {
        "ownedBy": { "to": ["person"], "cardinality": "many", "description": "who CODEOWNERS says reviews it", "inverse": "the modules they own" },
        "documentedIn": { "to": ["doc"], "cardinality": "many", "description": "the docs that cover it", "inverse": "the modules it covers" }
      }
    },
    "doc": {
      "noun": "doc",
      "plural": "docs",
      "label": "{title}",
      "description": "A Markdown file under docs/ (outside the decision records) or the repository's README.",
      "fields": {
        "title": { "type": "string", "required": true, "description": "Its first heading." },
        "path": { "type": "string", "required": true, "description": "The file, from the repository root." },
        "section": { "type": "enum", "options": ["overview", "guide", "runbook", "api", "index"], "required": true, "description": "Where it sits in docs/." },
        "lastReviewed": { "type": "date", "label": "Last reviewed", "description": "The date on its Last reviewed line." }
      },
      "edges": {
        "ownedBy": { "to": ["person"], "cardinality": "many", "description": "who CODEOWNERS says reviews it", "inverse": "the docs they own" }
      },
      "fieldRoles": { "when": "lastReviewed" }
    },
    "decision": {
      "noun": "decision record",
      "plural": "decision records",
      "label": "ADR {number}: {title}",
      "description": "A numbered decision record under docs/adr/.",
      "fields": {
        "number": { "type": "integer", "required": true, "min": 1, "description": "Its number." },
        "title": { "type": "string", "required": true, "description": "Its heading, without the number." },
        "path": { "type": "string", "required": true, "description": "The file, from the repository root." },
        "status": { "type": "enum", "options": ["proposed", "accepted", "superseded"], "required": true, "description": "Its Status line." },
        "decided": { "type": "date", "label": "Date", "description": "Its Date line." },
        "wholeRepository": { "type": "boolean", "label": "Affects the whole repository", "description": "Its Affects line names the whole repository rather than modules." }
      },
      "edges": {
        "affects": { "to": ["module"], "cardinality": "many", "description": "the modules its Affects line names", "inverse": "the decisions that affect it" },
        "supersedes": { "to": ["decision"], "cardinality": "one", "description": "the earlier decision it replaces", "inverse": "the decision that replaced it" }
      },
      "fieldRoles": { "when": "decided" },
      "glance": ["number", "status", "decided"]
    },
    "person": {
      "noun": "person",
      "plural": "people",
      "label": "{handle}",
      "description": "Someone .github/CODEOWNERS names.",
      "fields": {
        "handle": { "type": "string", "required": true, "description": "Their handle in CODEOWNERS." }
      }
    }
  },
  "acts": {
    "add-module": { "creates": "module", "title": "Add a module", "description": "Record a workspace directory with its own package.json." },
    "add-doc": { "creates": "doc", "title": "Add a doc", "description": "Record a Markdown file under docs/." },
    "add-decision": { "creates": "decision", "title": "Add a decision record", "description": "Record a numbered decision under docs/adr/." },
    "add-person": { "creates": "person", "title": "Add a person", "description": "Record someone CODEOWNERS names." },

    "give-module-owner": { "on": "module", "connects": "ownedBy", "title": "Give the module an owner", "description": "Say who reviews this module.", "fromTheOtherEnd": "Give them a module" },
    "take-module-owner": { "on": "module", "severs": "ownedBy", "title": "Take an owner off the module", "description": "Say this person no longer reviews this module.", "fromTheOtherEnd": "Take a module off them" },
    "give-doc-owner": { "on": "doc", "connects": "ownedBy", "title": "Give the doc an owner", "description": "Say who reviews this doc.", "fromTheOtherEnd": "Give them a doc" },
    "take-doc-owner": { "on": "doc", "severs": "ownedBy", "title": "Take an owner off the doc", "description": "Say this person no longer reviews this doc.", "fromTheOtherEnd": "Take a doc off them" },

    "document-in": { "on": "module", "connects": "documentedIn", "title": "Point it at a doc", "description": "Say which doc covers this module.", "fromTheOtherEnd": "Say it covers a module" },
    "cover-module": { "on": "doc", "connects": "documentedIn", "title": "Say which module it covers", "description": "Name a module this doc covers.", "fromTheOtherEnd": "Point it at this doc" },
    "undocument-in": { "on": "module", "severs": "documentedIn", "title": "Take a doc off it", "description": "Say this doc no longer covers this module.", "fromTheOtherEnd": "Say it no longer covers a module" },

    "add-affected": { "on": "decision", "connects": "affects", "title": "Name a module it affects", "description": "Add a module to its Affects line.", "fromTheOtherEnd": "Name a decision that affects it" },
    "remove-affected": { "on": "decision", "severs": "affects", "title": "Take a module off it", "description": "Take a module off its Affects line.", "fromTheOtherEnd": "Take a decision off it" },
    "supersede": { "on": "decision", "connects": "supersedes", "title": "Say what it supersedes", "description": "Name the earlier decision this one replaces.", "fromTheOtherEnd": "Say what superseded it" },
    "unsupersede": { "on": "decision", "severs": "supersedes", "title": "Take back what it supersedes", "description": "Say this decision no longer replaces that one.", "fromTheOtherEnd": "Take back what superseded it" },

    "accept-decision": { "on": "decision", "sets": { "status": "accepted" }, "title": "Accept it", "description": "Mark the decision accepted." },
    "propose-decision": { "on": "decision", "sets": { "status": "proposed" }, "title": "Put it back to proposed", "description": "Mark the decision proposed again." },
    "mark-superseded": { "on": "decision", "sets": { "status": "superseded" }, "title": "Mark it superseded", "description": "Mark the decision superseded by a later one." }
  },
  "rules": {
    "module-has-doc": {
      "title": "Every module has a doc",
      "over": "module",
      "require": "exists(out('documentedIn'))",
      "says": "No doc covers {path}",
      "repairs": [{ "act": "document-in", "label": "Point it at a doc" }]
    },
    "module-has-owner": {
      "title": "Every module has an owner",
      "over": "module",
      "require": "exists(out('ownedBy'))",
      "says": "{path} has no owner in CODEOWNERS",
      "repairs": [{ "act": "give-module-owner", "label": "Give it an owner" }]
    },
    "module-has-readme": {
      "title": "Every module has a README",
      "over": "module",
      "require": "present(readme)",
      "says": "{path} has no README.md",
      "repairs": [{ "act": "edit-module", "label": "Record its README" }]
    },
    "doc-covers-a-module": {
      "title": "Every guide, runbook and API doc covers a module",
      "over": "doc",
      "when": "section == 'guide' or section == 'runbook' or section == 'api'",
      "require": "exists(in('documentedIn'))",
      "says": "{title} ({path}) names no module it covers",
      "repairs": [{ "act": "cover-module", "label": "Say which module it covers" }]
    },
    "superseded-has-successor": {
      "title": "A superseded decision names its successor",
      "over": "decision",
      "when": "status == 'superseded'",
      "require": "exists(in('supersedes'))",
      "says": "{title} is marked superseded but no record supersedes it",
      "repairs": [{ "act": "supersede", "label": "Say which record supersedes it" }]
    }
  }
}
```

---

A Graview recipe: The repository's docs, the modules they cover and who owns each, with every module that has no doc or no owner flagged and the repair offered.

The page: https://graview.dev/docs/recipes/docs.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
