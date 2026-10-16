# Start a Graview app (for the agent)

You are a coding agent. Someone has asked you for a Graview app: either one
made from part of the repository you are in (its docs, its decisions, its
dependencies, its issues), or one for something they named in words (a
volunteer rota, a community garden, a tender response). This page is the
procedure for both. Follow the steps in order, run every
command, and report what each command actually printed.

Graview is a TypeScript framework. An app is one declaration: the kinds of
record, their fields and relations, the acts that change them, and the rules
they have to keep. Graview derives the interface, the permissions and a typed
tool for every act from that declaration. You write the declaration and the
records. You never write a screen.

You need Node 22 or later, npm, and access to the npm registry. If your
sandbox blocks the network, ask the person to allow it for npm.

## 1. Scaffold

From the repository root (or, with no repository, an empty folder):

```sh
npm create graview@latest graview-app -- --no-git
cd graview-app
```

This writes a Graview project into `graview-app/`, installs it, and installs
the authoring skills. `--no-git` is there because the repository already has
git; leave it off in an empty folder. Do everything below inside `graview-app/`, and change nothing outside
it. If `graview-app/` already exists, pick another name. Don't pass `--force`.

## 2. Read the root file and the skills

Read `AGENTS.md`. It says how the project is checked and what an agent may
not do. Then read the skills it lists, in `.claude/skills/` (Claude Code) or
`.agents/skills/` (Codex, Cursor and the others). Before you declare
anything, read at least these three:

- `graview-node-kind`: a kind, with its fields, edges, label and plural.
- `graview-invariant`: a rule that names the act that repairs it.
- `graview-seed`: getting from a blank graph to a useful one.

## 3. Declare

`AGENTS.md` and the skills describe the declaration as TypeScript in
`src/domain/`, checked by `npm run check`. For this first pass, write the
same declaration as a document instead: one JSON file that needs no build,
and that `graview check` and `graview preview` read as it is. Leave
`src/domain/` and its starter `item` kind alone; `npm run check` and
`npm run verify` judge that TypeScript app, not your document. The skills'
ideas carry over unchanged: `defineNode` is an entry under `kinds`,
`defineMutation` one under `acts`, an invariant one under `rules`.

- `app.json` is the declaration. It holds `"format": "graview-document"`,
  `"formatVersion": 1`, a `name`, a `description`, and then `kinds`, `acts`
  and `rules`. Its JSON Schema is at
  `node_modules/@graview/core/dist/document.schema.json`.
- `seed.json` holds the records, as `{ "nodes": [...], "edges": [...] }`.
  Each node is `{ "id", "kind", ...its fields }`. Each edge is
  `{ "id", "kind", "from", "to" }`, where `kind` is the edge's name and
  `from` is a record of the kind that declares it. An id is any string,
  unique across the whole seed; a readable one such as `module-search` or
  `adr-0004` makes the problems easier to read. `graview check` does not
  read the seed: `graview preview` and `graview mcp` load it, and say what
  is wrong with it.

Decide in this order:

1. **Read the part of the repository the task names before you design
   anything.** The records come from what is actually there: file paths,
   headings, CODEOWNERS, status lines, versions in `package.json`. Invent
   nothing. Where the repository says nothing, leave the field empty and let
   a rule say so. If the task names a domain in words instead, the domain
   comes from the person: ask what they track and what goes wrong, if they
   haven't said, and seed a small set of plainly made-up example records
   (say so in the report) that leave at least one rule broken, so the app
   opens with a problem and its repair.
2. **A kind for each thing a person would point at.** A field for each fact
   about it, and an edge for each relation between two of them. Give every
   edge a `description` (what it means read forward) and an `inverse` (read
   backward).
3. **A rule for each thing that should be true and isn't always.** A rule
   goes `over` a kind, can take a `when`, has a `require` expression and a
   `says` sentence, and lists `repairs`: the acts that fix it. A gap the
   repository really has should show up as a problem with a way out.
4. **An act for each change a person would make.** Creating each kind,
   making and unmaking each relation (`connects` and `severs`), setting each
   status (`"sets": { "status": "accepted" }`, one act per status), and
   every act a repair names.
5. **A repair acts on the record the rule is about.** A rule `over` a doc
   offers acts that are `on` a doc. If the fix is a relation declared on
   another kind, declare a second act `on` the rule's kind that `connects`
   that same edge from its far end; `graview check` does not catch a repair
   whose act is on the wrong kind, and the problem then offers a fix that
   refuses.

The rule language, in brief: a field or a one-to-one edge by its bare name
(`status`, `ownedBy`); `present(x)` for a value that is set;
`out('edge')` and `in('edge')` for the records an edge reaches forward and
backward; `exists(set)`, `count(set)`, `every(set, condition)` and
`some(set, condition)`; `set where condition` (inside `where`, `every` and `some`, bare names are
the member's, not the outer record's); `==`, `!=`, `<`, `&&`, `||` and `!`;
a one-to-one edge followed to a field (`pins.version`); `today()` and
`days(from, to)` for whole days between two dates. A `says` sentence fills
`{field}` from the record.

A small document that compiles:

```json
{
  "format": "graview-document",
  "formatVersion": 1,
  "name": "Modules",
  "description": "The repository's modules and who owns each.",
  "kinds": {
    "module": {
      "noun": "module", "plural": "modules", "label": "{path}",
      "description": "A directory with its own package.json.",
      "fields": {
        "path": { "type": "string", "required": true },
        "status": { "type": "enum", "options": ["active", "retired"], "default": "active", "required": true }
      },
      "edges": {
        "ownedBy": { "to": ["person"], "cardinality": "one", "description": "who reviews it", "inverse": "what they own" }
      }
    },
    "person": {
      "noun": "person", "plural": "people", "label": "{handle}",
      "description": "Someone CODEOWNERS names.",
      "fields": { "handle": { "type": "string", "required": true } }
    }
  },
  "acts": {
    "add-module": { "creates": "module", "title": "Add a module", "description": "Record a module." },
    "add-person": { "creates": "person", "title": "Add a person", "description": "Record someone who owns code." },
    "give-to": { "on": "module", "connects": "ownedBy", "title": "Give it an owner", "description": "Say who reviews this module.", "fromTheOtherEnd": "Give them a module" },
    "take-from": { "on": "module", "severs": "ownedBy", "title": "Take its owner off", "description": "Say nobody reviews this module now.", "fromTheOtherEnd": "Take a module off them" },
    "retire": { "on": "module", "sets": { "status": "retired" }, "title": "Retire it", "description": "Say this module is no longer used." }
  },
  "rules": {
    "module-has-owner": {
      "title": "Every module has an owner",
      "over": "module",
      "when": "status == 'active'",
      "require": "present(ownedBy)",
      "says": "{path} has no owner",
      "repairs": [{ "act": "give-to", "label": "Give it an owner" }]
    }
  }
}
```

There are three finished examples, each made by following this page. Each
one has an `app.json` and a `seed.json`:
[the docs](https://graview.dev/recipes/docs/app.json),
[the decisions](https://graview.dev/recipes/decisions/app.json) and
[the dependencies](https://graview.dev/recipes/dependencies/app.json).

## 4. Check

```sh
npx graview check --document app.json
```

Fix what it reports, and run it again until it exits 0 with no line
starting with `!`. An error stops the document compiling; a warning (`!`)
is a real problem in it, so treat warnings as work too. A note (`·`) is
advice: read it, and leave it if it doesn't apply. A rule that reads
`today()` always leaves one, saying the store judges it again each day.
With no notes left, check prints `✓ the document compiles and checks
clean`. Then read the app back the way a person would meet it:

```sh
npx graview describe --document app.json
```

## 5. Preview

```sh
npx graview preview app.json --seed seed.json --port 5180
```

It prints an address and keeps serving until it is stopped, so run it in the
background. Open the address in a browser, or hand it to the person. If you
can't look at a page yourself, photograph it instead. That needs Playwright
first (`npm i -D playwright && npx playwright install chromium`):

```sh
npx graview shots app.json --seed seed.json --out shots
```

To read the problems the rules found in the seed, ask the store through its
MCP server (`get_violations`). The store is kept in `data/` (the scaffold's
`.gitignore` already leaves it out) and reads `seed.json` only when that
folder is new, so delete `data/` whenever you change the seed:

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"sh","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_violations","arguments":{}}}' \
  | npx graview mcp --document app.json --seed seed.json --data data
```

The answer is a page of twenty: the JSON inside `result.content[0].text`
holds `data.violations`, and says how many more there are. Ask again with
`"arguments":{"offset":20}` (then 40, and so on) until you have them all.

## 6. Report back

Tell the person, briefly:

- what you declared: the kinds, and each rule in one sentence;
- how many records the seed holds, and where in the repository each kind
  came from (or that they are made-up examples);
- what `graview check` printed, word for word;
- the problems the rules found, each with its sentence and the repair it
  offers (a repair that still needs a value, `"missing": ["to"]`, is one a
  person finishes by choosing the record);
- the preview's address, and whether it is still running;
- what you left out, and why.

From here, the person can keep the document as it is, or make it a full
product: `src/domain/app.ts` can compile `app.json` (see the
`graview-new-app` skill), and `npm run dev` serves it. Everything about
Graview is at https://graview.dev/llms.txt.
