---
name: graview-tidying
description: Tidy a Graview app without losing anything — set records aside (archive, bring back) instead of deleting them, merge a duplicate into the one that stays, and let the app's own actor link and prune by suggestion a person accepts or declines, held to what people said — verified with graview check and by undoing it rather than assuming nothing was lost.
---

# Tidy without losing anything

A list that grows fills with what is finished and what was entered twice,
and the only tidy a bare store offers is a delete, which takes the record's
links and its history with it. Every kind can already set a record aside and
fold a duplicate into the one that stays, and an actor that tidies on its
own can be told what it may not touch. What a list offers, the order it
opens in and how its cards read are `graview-lists`.

## Do this

1. **Set records aside instead of deleting them.** Every kind has
   `archive-<kind>` and `unarchive-<kind>` (`{ id }`, "Bring it back") and
   `merge-<kind>` (`{ id, into }`: `into` takes the duplicate's links and
   the duplicate is archived), permitted through the acts that create the
   kind. An archived record is out of lists, the scene, counts, computed
   fields and rules; its own page and search still find it, marked. A list
   says "+3 archived" and opens them at `?archived=true`; a rule reads them
   with `all('feature', true)` (`'all'` for both) and `archived()`. A kind
   that should never be archived says `archives: false` in `defineNode` (a
   document's `"archives": false`; the edit `set-archives`): it is given no
   archive, unarchive or merge, and its records are kept or removed. An
   archived record keeps its fields, its links and its history.

2. **Let the app's own actor tidy, and say what it may not.** An actor
   that links and prunes on its own is an author that says
   `automated: true` (`kind: "system"` or `"agent"`). What it is sure of it
   applies with `lineage: { basis, confidence }`; what it is not it
   suggests: `suggest(store, calls, { author, lineage })` (from
   `@graview/core/tidying`) keeps the calls in the log, changes nothing,
   and they wait in the Suggested tray beside Activity until a person
   accepts (`acceptSuggestion`, made as them) or declines them
   (`declineSuggestion`); `declined(store, calls)` says so, and the actor is
   refused the same change again — matched by what it means
   (`meaningKey`): the same link by any act that makes the relation, a
   record made again under a new id, a merged pair either way round. Its
   run of changes is one Activity row, "Tidied 6 things overnight". Give a
   night's work one `lineage.run`, name the judge in `lineage.actor` and
   the records it rests on in `lineage.evidence`; give a suggestion an
   `expiresAt`, after which it leaves the tray and the next run judges it
   again. "Not now" is not a decline: it is the person's own state
   (`Dismissal`, handed to `suggestions(store, who, { dismissed })`), hides
   it from them alone and binds the actor to nothing. The tray's Not now
   keeps it in the host's `dismissals`, else the browser; a seat says it
   with `withNotNow(runtime, dismissals)`.

3. **Hold it to what people said.** A person says "Leave this one alone" on
   a record (`leave-alone-<kind>`, cleared by `allow-tidying-<kind>`;
   `isLeftAlone(store, id)`), and the declaration says a kind is never
   tidied or never linked — `tidying: "never" | "no-links"` on
   `defineNode`, `tidying: "never"` on a relation; in a document the edit
   `{"op": "set-tidying", "kind": "vendor", "tidying": "no-links"}` (with
   `"relation"` for one relation, `"allowed"` to undo it). The store refuses
   the actor each in a sentence; a person is never refused by them.

4. **Let it dream.** `dream(store, { now, limit, ai })` from
   `@graview/tools/tidy` runs the actor once. Code puts forward
   near-duplicates, the records a relation might mean, finished records
   and empty choices; the host's System One model (`ai.fast`, Jev) does
   the judging, one request per candidate; code routes each answer by how
   much the change would undo (`BANDS`) — made, suggested with its basis
   ("Jev: 0.93 that …"), or dropped. Without a model, or when it fails or
   the budget runs out, the floor is the judges' own rules: a shared name
   or email, a link the record's text names, a finished record unchanged
   for 30 days. It skips what was declined, what waits, what is left alone
   or changed in the last day, and applies nothing unless the host passes
   `applyAtLeast`. A host's schedule runs it (`graview dream <entry> --data
   ./data --model jev-latest --cache ./cache.json`), or reaches the store
   as the actor through `suggest_changes`, the tool only an `automated`
   seat is offered. `whileAway(store, { seq }, principal, { dismissed })`
   is the tray's line, less what the reader said "not now" to; a host that
   works it out after the first draw hands it over with
   `handle.setWhileAway(away)` (a React host changes the prop).

## Then find out whether it worked

```sh
graview check src/domain/app.ts
npx graview check --document app.json   # a document
```

Report **the actual output**. In a document it warns `tidying-redundant`
where a relation says `"never"` that its kind's own `tidying` already says.
The rest is behavior, so try it:

- Archive one record by its act and ask `graview describe <entry> --place
  <slug>` again: it is gone from the list and the count, and
  `?archived=true` finds it. Bring it back; its links are still there.
- Merge two records and undo the merge: both come back with their links.
- Have a test actor (`automated: true`) suggest a link and decline it from
  the tray: `suggest(store, …)` of the same calls then refuses, and a
  record left alone refuses the actor's change by name.
- Run `graview dream` twice: the second run suggests nothing new, and its
  JSON says each finding is already waiting.

## What the check cannot see

Whether a rule should still count an archived record: it does not unless
it asks with `all(kind, true)`, and a total that should include last
season's says so on purpose. Whether the actor's confident changes deserved
their confidence — read a day of its Activity row before raising what it
applies without asking. And which of two duplicates should stay: `into` is
the one you name, so name the one with the history.
