# graview-linked-records

`graview-linked-records` is one of Graview's 27 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Link a record in one Graview app to a record in another app — a relation whose target is another app's kind, read there as whoever is looking, walked by computed fields and rules, its far changes kept in this app's history — and verify it with graview check and by opening it as a viewer who may not see the other app.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Link a record in another app

A relation usually goes to a kind of the same app. When the thing lives in an app of its own — a purchase scenario that buys a house kept in the house app — the relation goes THERE: its target is `@` + the other app's address + `/` + its kind. Linking picks a record in that app; the other app is never changed. What the far record is, and whether this viewer may see it, is the host's to say, every time, as the viewer.

### Do this

1. **Declare the relation to the other app's kind.** In a document:

```json "scenario": { "fields": { "name": { "type": "string", "required": true }, "budget": { "type": "number", "format": "money" } }, "edges": { "forHouse": { "to": ["@nick/house/house"], "cardinality": "one", "description": "the house this scenario buys" } } } ```

The address is the one an `app-link` field would hold: `@owner/app`, the id the host knows the app by (`@app_kf5eydr9z58jzf/house`), or its https address (`@https://example.com/a/house/house`). Every target names ONE app; mix in a kind of this app, a second app, an `inverse` or `appendOnly`, and the check refuses it in a sentence. In TypeScript the link is a field it is kept in: `forHouse: linkedRecordField("@nick/house/house").optional()` (`{ cardinality: "many" }` for several). A host that changes a document by edits sends `{"op": "add-relation", "kind": "scenario", "relation": "forHouse", "to": ["@nick/house/house"], "cardinality": "one"}`, refused by the same finding codes; the studio makes one with its act for linking another app's records.

1. **Let the record's own edit link one.** The link is kept on the record that links, as the far kind and its id — `"house:h1"`, or a list — so the derived `edit-scenario` sets it, undoes it, logs it and hides it from a seat a sight keeps it from, like any field. The faces draw a picker that lists what the host finds there for this viewer; an agent finds the value with `find_linked` and passes it to the edit. A declared act may not `connects` it or set it (`act-linked`).

1. **Walk it by name.** `forHouse.listPrice` reads the far record's field, in a computed field, a view's block or a rule:

```json "computed": { "price": { "expr": "forHouse.listPrice", "label": "Asking price" } }, "rules": { "within-budget": { "over": "scenario", "when": "budget != null", "require": "forHouse.listPrice <= budget" } } ```

It is read AS THE VIEWER: a field they may not see there reads as nothing. A link they may not open, or not read yet, is said, never thrown — the computed value says why it has none, and a rule that would fail without it is "could not be judged" rather than broken. `out('forHouse')` does not walk it (`rule-linked`).

1. **Show it.** A record's page and the scene's record panel draw the far record with its own card — label, describe line, a glance at its fields, its app's name — and `{ "field": "forHouse" }` in a card names it. Pressing it opens it in its own app through the host. A viewer who may not open that app sees "linked record (no access)" and nothing of it.

1. **Hand the host's reader in.** The host implements `LinkedRecords` and passes it where it passes `resolveApp` (`mount`, `<Embed>`, `GraviewProvider`, `PagesApp`) as `linkedRecords`: `resolve(ref, viewer)` answers `{ address, kind, id, label, describe?, card?, fields, href?, app? }`, `{ denied: true }` or `null`; `find({ address, kinds, query, limit }, viewer)` the records it may link; `open(ref, viewer)`, optional, opens one in place. `linkedRecordsOver({ "@nick/house": { store, name, opens, href } })` from `@graview/core/linked` is that host over stores in memory — tests and a host holding both apps use it as is. When the far record changes there, the host calls `recordLinkedChange(store, { ref, fields, app })`: one op per linking record, authored by the far app, naming what changed and none of its values, so Activity and the record's history say it.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./app.gdd.json
npx graview describe ./app.gdd.json   # "Linked from other apps" says each relation and how to link one
```

Report **the actual output**. What it catches here: `linked-target`, `linked-mixed`, `linked-apps`, `linked-inverse`, `linked-append-only`, `act-linked`, `rule-linked`. Then open a record that links one as a viewer the host refuses that app, and confirm the page says "linked record (no access)" and shows nothing of it — not its name, not a value worked out from it.

### What the check cannot see

- Whether the other app exists, has that kind, or lets this viewer in: the host answers that, every time, and nothing in the document can.
- Whether a far field the expression names (`listPrice`) is one the other app has: a field it lacks, or hides from this viewer, reads as nothing.
- Whether linking across apps was the right shape at all. If both kinds change together and the same people keep them, one app with a local relation is simpler.

---

Link a record in one Graview app to a record in another app — a relation whose target is another app's kind, read there as whoever is looking, walked by computed fields and rules, its far changes kept in this app's history — and verify it with graview check and by opening it as a viewer who may not see the other app.

The page: https://graview.dev/docs/skills/graview-linked-records.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
