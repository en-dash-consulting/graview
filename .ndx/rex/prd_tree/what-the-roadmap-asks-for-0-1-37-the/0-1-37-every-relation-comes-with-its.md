---
id: "e5a9d8d3-309e-4d25-8d66-db921735f750"
level: "task"
title: "0.1.37 · Every relation comes with its connect and disconnect acts"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
acceptanceCriteria:
  - "a relation declared without acts gets a derived connect and disconnect (sever) pair, as kinds get add-/edit-/archive-, titled from the relation and its description, overridable"
  - "an add-relation edit leaves a document whose records can be linked with no add-act; a declared connects/severs act for the same relation replaces the derived one; tests fail on 0.1.36"
  - "policy, sight and cardinality hold for the derived acts; agents see them in describe_app"
description: "Roadmap request:add-relation-should-come-with-its-own-connect-and-disconnect-acts. After add-relation nothing could link two records until a hand-written add-act with connects was added."
completedAt: "2026-10-18T23:30:00.000Z"
endedAt: "2026-10-18T23:30:00.000Z"
lastModified: "2026-10-18T23:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Framework, on feat/relation-acts-derived: every kind's relation is given connect-<kind>-<relation> and disconnect-<kind>-<relation> ({ id, to }) in deriveMutations, replaced by any declared act that connects or severs it; edge-without-severer is gone."
---

## Notes

**What a host and an agent see.** `deriveRelationMutations`
(`packages/core/src/mutations/derive-relations.ts`), part of `deriveMutations`, so the store, the
checker, `graview describe`, the conformance kit and `toolDefinitions`/`createToolRuntime` all list
them with nothing more.

- Names: `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`, per kind that declares the
  relation, the relation kebab-cased as act names are (`takenOn` → `connect-moment-taken-on`).
  Per kind, not per relation, because a shared relation's permission and wording are the kind's
  (`derived: { kind, act, relation }`). A name is read back against the kinds
  (`relationActOf`), since a kebab-case kind cannot be split off by the name alone.
- Args: `{ id, to }`, strict — `id` the record the relation leaves (as every derived act names its
  subject), `to` a node ref of the relation's target kinds.
- Titles: cardinality one → "Set the day" / "Clear the day"; many → "Link a traveler" / "Unlink a
  traveler"; `fromTheOtherEnd` "Link a moment" / "Unlink a moment"; a kind with two relations to the
  same kinds appends the relation's words, "Set the person (reviewer)". The description carries the
  relation's `description`. Log sentences: "Set the day of Sunset at the pier to <the day's label>", "Link
  Sunset at the pier to Ana", "Unlink … from …". The policy said in words uses the same titles.

**Decisions.**
- Overridable per verb, per relation: any declared act whose `connects` names the relation replaces
  the derived connect (every kind's), any whose `severs` names it the derived disconnect; an act of
  the same name keeps its name.
- Cardinality one: connect severs the old link and makes the new one as one act, one undo.
  Connecting what is already linked changes nothing; disconnecting what is not linked is refused in
  words ("Sunset at the pier is not linked to Ben").
- `appendOnly` → no disconnect. `edge-without-severer` is removed: a relation an act makes and none
  breaks now has a derived disconnect, so the warning could only be wrong.
- Policy: `derivedVia` reads connect/disconnect like an edit — the declared acts that write or make
  the kind the relation leaves — or a grant naming the act. Sight: the store already refuses an
  argument naming a record the seat may not see ("“Link a traveler” names a record …"), and the act
  reads `ctx.graph` (the seat's view) besides.
- A relation to another app's kind (FR-171) is a field (`linkedEdges`), which the derived edit
  already sets: it is given neither act, and `list_linkable` keeps saying "Linking one is the
  record's edit".
- The tools layer needed no second path: `providers/schema.ts` and `structure.ts` offer any act
  that declares `connects`/`severs` from either end of the tie. The import's linker now also reads
  the derived connect (a relation no declared act made was "linked by nobody"), and the inline AI's
  ghost now fills a relation through it.
- Documents: a grant or repair may name one (`compile.ts`, `edit.ts`'s `add-grant`); renaming a kind
  or relation renames grants and repairs naming its acts and says so in "the tools an agent is
  offered change"; removing a kind or relation drops them from grants.
- `graview describe` gains "## How records are linked": each relation and the acts that make and
  break it.

**Act lists that changed.** Only the desk (`apps/launcher`): `connect-app-uses`,
`disconnect-app-uses`. todo, seedbed, rota, discography, gauntlet and every document app already
declared acts for each relation. The conformance kit announces `connect-vendor-fills` and
`disconnect-vendor-fills` on `document:shortlist-0.1.10` (0.1.37).

**Not done.** `keep-link` is still permitted through declared acts that make or break the relation
(`keepLinkVia`), not through a derived connect.
