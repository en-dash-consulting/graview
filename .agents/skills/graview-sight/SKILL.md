---
name: graview-sight
description: Say who sees which records of a Graview app, and which of their fields — so a seat is served only what it may see, on every surface at once — verified by graview check and by comparing what a seat is told with a hidden value and without one.
---

# Say who sees what

A grant says who may DO an act; a sight says who may SEE a record, and
which of its fields. It is the same kind of declaration — once, in the
policy — and the store is what enforces it: every surface a seat reads
(the scene, the pages, Find, the log, an agent's tools, the wire) is
handed the seat's view, `store.seenBy(principal)`, so none of them has
to remember.

## Do this

1. **Say it for every kind.** `sees` keeps records from seats the way
   grants keep acts: once there is one sight, a kind no sight names is seen
   by nobody but the system (`sight-unnamed-kind` says which).

   ```ts
   sees: [
     { roles: "*", kinds: ["car"] },                        // the shop window
     { roles: ["shopper"], kinds: ["test-drive"], own: true }, // theirs, joined to theirs, or made by them
     { roles: ["participant"], kinds: ["match"], via: "givenBy" }, // only what that relation joins to their own record
   ]
   ```

   A served store sends a seat only what it sees, withholds the rest of the
   log in place, and refuses an act that names a record it may not see
   exactly as one that names nothing — a document's `setsOther` target
   too; an act's `setsLinked` reaches only the linked records the seat
   sees, and is refused, naming the record, where one of them is not the
   seat's to change. A record whose required reference names a kind its seat may not
   see is withheld whole (`sight-hides-required-ref`): let the role see
   the target, or make the field optional.

2. **Hide a field, not only a kind.** A roster where parents see every
   player's name and not their phone number:

   ```ts
   sees: [
     { roles: ["coach"], kinds: ["player"] },
     { roles: ["parent"], kinds: ["player"], hide: ["phone", "medical"] },
     { roles: ["parent"], kinds: ["player"], own: true }, // their own child, whole
   ]
   ```

   `hide` keeps those fields; `fields: ["name"]` is an allow list, so a
   field added tomorrow is kept until a sight shows it. SIGHTS ADD UP: a
   field is shown when any sight that shows the seat the record shows it,
   so the `own` sight gives a parent their own child's phone back, and a
   person with two roles sees what either shows. A kept field is not in
   anything the seat is served — the record, the log (an op that wrote it,
   or whose sentence read it, is withheld), a search, a name, a form, an
   import — and the seat may not write it: the act is refused as one given
   an argument it does not take, whatever the field held. A computed field
   and a rule are worked out over what the seat is served, so to a parent
   a phone it may not see reads as none.

3. **Load the judge where the store is.** Field sight is
   `@graview/core/field-sight`: `@graview/ship`'s server entry loads it. A
   page that holds the whole store (`openStore` from
   `@graview/ship/browser`, or a `Store` of its own) imports it once —
   `import "@graview/core/field-sight";`, as `apps/gauntlet/src/main.tsx`
   does — and so does a host that serves seats without `@graview/ship`.
   Without it a sight with `hide` or
   `fields` shows nothing: the store keeps the record rather than serve a
   field it cannot judge — a maker's own record too, so
   `{ roles: "*", kinds: ["ticket"], own: true, hide: ["triage"] }` that
   shows a sender nothing means the import is missing; loaded, it shows
   them their ticket without `triage`. A page `openRemote` opened needs nothing: its
   host judged what it was sent, and that store alone is trusted — a
   whole store on the same page still needs the import. An agent's tool
   for an act lists no argument writing a field the seat never sees.

4. **Edit it as a document.** `add-sight` and `remove-sight` take `hide`
   and `fields` like any other key; a field none of the sight's kinds has
   is refused (`sight-field`).

5. **A notification is a read too.** "Notify me" (`@graview/core/subscriptions`)
   judges each commit as the subscriber's seat: a change to a record they
   cannot see never matches, a field kept from them is neither said in the
   match nor read by its condition, and a change withheld from them says
   "Someone". Prove it as above: `matchSubscriptions(store, ops, [sub])`
   for a world with the hidden record answers `[]`
   (`packages/core/tests/unit/a-subscription-is-told-what-its-subscriber-may-see.test.ts`).

6. **What a seat reads beside a record keeps to its sight too.**
   - An id is served wherever its record is, so it is never minted from a
     field some sight keeps from a role: a tip whose title the public may
     not see is `tip:tip-2`, not `tip:secret-merger-plan` — an act, an
     import, and a day of a series changed apart alike. An act of your own
     gets the same from `freshId(name, kind, record?)` when the name quotes
     an argument for such a field, or a field of the record handed third;
     a name it builds from anything else is yours to keep clean.
   - A record withheld whole — its required reference names a kind the
     seat may not see — is refused as one that is not there, whatever the
     grant says, exactly as an id that names nothing.
   - The app's own actor's suggestions say why in words that quote fields;
     a seat whose sight keeps one the basis read is served the suggestion,
     and the change it made, withheld.
   - A sight with `hide` or `fields` shows a kind in part, so even a
     `roles: "*"` one is not total sight for a worker view: the view's own
     acts need a press the host saw.

## One sign-in, several people at the screen

A host says who at a shared screen on the seat: `principal: { ..., profile: { id: "prf_mia", name: "Mia" } }`
(an id of letters, digits, `_` and `-`). `$me`, a sight `via` the people or
`own`, and a view's `props.me` then read Mia's person, a record of the people
kind made on her first act, its id `<account>~prf_mia`, so it can only ever be
that account's. It is a name, not a seat: the roles, grants and `seatOf` stay
the account's, and everything the account could reach it still reaches. History
says "Mia (Nick)". Without a profile, nothing changes. A person removed stays
removed, and a kind that requires more than a name has none for a profile
(`people-unmakeable`): `$me` then refuses, and the act is not offered. The seat headers
carry it only where a host trusts them; otherwise it is the host's `seatOf`.

A person entered before they joined is bound, not made twice:
`bindPerson(store, joining, "person:bud", { author })` (`@graview/core/binding`);
`$me`, `own` and `self` then read that record. Only the host's system seat
binds; no grant may name `bind-person` (`grant-gives-binding`). A seat sees
its own binding, the host all; others read its acts as the record's. A host
reads through `seenBy` each time and keeps none of its methods, and forwards a
change through `answerSeenBy`: re-read, never pass on, what a listener is handed.

What a view keeps for that viewer (`graview.mine`, `graview-view-forms`) goes
where the host says, for the viewer it knows, handed to `mount`, `<Embed>` and
`PagesApp` as `viewerState`:

```ts
const viewerState: ViewerState = {
  read: (view) => fetchMine(view),                    // that view's values, by its name
  write: (view, key, value) => keepMine(view, key, value), // { ok: true } or { ok: false, sentence }
};
```

Keep it out of the record store: it is never history, an export or an agent's.

## What a view is told it cannot see

A worker view is handed `props.unseen` where its seat is kept from some of
what it reads, so it says why a part is empty:

```js
const { kinds = [], fields = {} } = graview.props.unseen ?? {};
if (kinds.includes("vendor")) draw("Sign in to see the vendors");
```

`kinds`: the kinds it reads the seat sees none of (no sight for its roles, an
`own` or `via` sight and no id, a module off). `fields`: per kind it sees, the
fields `hide` or `fields` may keep from it, read from the policy. Nothing of
any record is said: no count, no id. A frame, somebody else's code, is handed
`kinds` alone, of those its own `reads` names. Where everything a view reads
is kept, the host draws its `signIn` line (or "Nothing here is shown to you.")
instead of starting it. `graview view check --seats` runs a view as each seat
the policy names and says what each could not see: for the owner's eyes only.

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

- `sight-names-an-unknown-field` (an error): a `hide` or `fields` naming a
  field none of the sight's kinds has — it keeps or shows nothing.
- `sight-hides-a-required-field` (an error): a role may not see a field
  every record needs, so it is shown no such record at all.
- `sight-hides-a-labeled-field` (a warning): a kind's label or description
  reads a field some role may not see; that role is told the name worked
  out without it.
- `act-reads-hidden-kind` (a warning): an act a role may run reads a kind
  that role may not see — its condition, its refusal, a value it sets, or
  what a TypeScript act declares it `reads`. Let the role see the kind,
  keep the act from it, or read only what it sees.
- `rule-says-hidden-fact` (a warning): a rule's message says a fact over a
  kind some role told of it may not see in full. A seat's problems are
  judged over what it sees.

**And try it.** The test that matters is a world with the hidden value and
the same world with another, or none — everything the seat reads must be
the same:

```ts
const told = (store: Store<AnySchema>) => JSON.stringify({
  snapshot: store.seenBy(parent).snapshot(),
  log: store.seenBy(parent).log.all(),
  problems: store.seenBy(parent).violations(),
  found: search(store, "555", { principal: parent }).hits,
});
expect(told(world("555 0101"))).toBe(told(world(undefined)));
```

## Worked examples

- `packages/core/tests/unit/a-sight-can-hide-a-field.test.ts` and
  `packages/core/tests/support/hidden-phones.ts` — the roster, world with
  and without a phone number, every read compared
- `packages/core/tests/unit/an-act-runs-under-its-callers-sight.test.ts` —
  a hidden record, the same comparison for an act's answer
- `apps/gauntlet/src/domain/policy.ts` — staff kept from the visitor, and
  where a speaker comes from kept from them too
- `packages/core/tests/document/fixtures/secret-santa.gdd.json` — a sight
  via a relation

## What the check cannot see

- Whether a TypeScript act's `describe` reads a hidden field directly: the
  store withholds such an op from the seat as it runs, but the author is
  the one who knows it was meant.
- Whether what a seat may not see is what the people involved expect. That
  is a conversation, not a declaration.
