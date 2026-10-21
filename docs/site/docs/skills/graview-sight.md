# graview-sight

`graview-sight` is one of Graview's 27 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Say who sees which records of a Graview app, and which of their fields — so a seat is served only what it may see, on every surface at once — verified by graview check and by comparing what a seat is told with a hidden value and without one.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Say who sees what

A grant says who may DO an act; a sight says who may SEE a record, and which of its fields. It is the same kind of declaration — once, in the policy — and the store is what enforces it: every surface a seat reads (the scene, the pages, Find, the log, an agent's tools, the wire) is handed the seat's view, `store.seenBy(principal)`, so none of them has to remember.

### Do this

1. **Say it for every kind.** `sees` keeps records from seats the way grants keep acts: once there is one sight, a kind no sight names is seen by nobody but the system (`sight-unnamed-kind` says which).

```ts sees: [ { roles: "*", kinds: ["car"] }, // the shop window { roles: ["shopper"], kinds: ["test-drive"], own: true }, // theirs, joined to theirs, or made by them { roles: ["participant"], kinds: ["match"], via: "givenBy" }, // only what that relation joins to their own record ] ```

A served store sends a seat only what it sees, withholds the rest of the log in place, and refuses an act that names a record it may not see exactly as one that names nothing — a document's `setsOther` target too. A record whose required reference names a kind its seat may not see is withheld whole (`sight-hides-required-ref`): let the role see the target, or make the field optional.

1. **Hide a field, not only a kind.** A roster where parents see every player's name and not their phone number:

```ts sees: [ { roles: ["coach"], kinds: ["player"] }, { roles: ["parent"], kinds: ["player"], hide: ["phone", "medical"] }, { roles: ["parent"], kinds: ["player"], own: true }, // their own child, whole ] ```

`hide` keeps those fields; `fields: ["name"]` is an allow list, so a field added tomorrow is kept until a sight shows it. SIGHTS ADD UP: a field is shown when any sight that shows the seat the record shows it, so the `own` sight gives a parent their own child's phone back, and a person with two roles sees what either shows. A kept field is not in anything the seat is served — the record, the log (an op that wrote it, or whose sentence read it, is withheld), a search, a name, a form, an import — and the seat may not write it: the act is refused as one given an argument it does not take, whatever the field held. A computed field and a rule are worked out over what the seat is served, so to a parent a phone it may not see reads as none.

1. **Load the judge where the store is.** Field sight is `@graview/core/field-sight`: `@graview/ship`'s server entry loads it. A page that holds the whole store (`openStore` from `@graview/ship/browser`, or a `Store` of its own) imports it once — `import "@graview/core/field-sight";`, as `apps/gauntlet/src/main.tsx` does — and so does a host that serves seats without `@graview/ship`. Without it a sight with `hide` or `fields` shows nothing: the store keeps the record rather than serve a field it cannot judge. A page `openRemote` opened needs nothing: its host judged what it was sent, and that store alone is trusted — a whole store on the same page still needs the import. An agent's tool for an act lists no argument writing a field the seat never sees.

1. **Edit it as a document.** `add-sight` and `remove-sight` take `hide` and `fields` like any other key; a field none of the sight's kinds has is refused (`sight-field`).

1. **A notification is a read too.** "Notify me" (`@graview/core/subscriptions`) judges each commit as the subscriber's seat: a change to a record they cannot see never matches, a field kept from them is neither said in the match nor read by its condition, and a change withheld from them says "Someone". Prove it as above: `matchSubscriptions(store, ops, [sub])` for a world with the hidden record answers `[]` (`packages/core/tests/unit/a-subscription-is-told-what-its-subscriber-may-see.test.ts`).

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

- `sight-names-an-unknown-field` (an error): a `hide` or `fields` naming a field none of the sight's kinds has — it keeps or shows nothing.
- `sight-hides-a-required-field` (an error): a role may not see a field every record needs, so it is shown no such record at all.
- `sight-hides-a-labeled-field` (a warning): a kind's label or description reads a field some role may not see; that role is told the name worked out without it.
- `act-reads-hidden-kind` (a warning): an act a role may run reads a kind that role may not see — its condition, its refusal, a value it sets, or what a TypeScript act declares it `reads`. Let the role see the kind, keep the act from it, or read only what it sees.
- `rule-says-hidden-fact` (a warning): a rule's message says a fact over a kind some role told of it may not see in full. A seat's problems are judged over what it sees.

**And try it.** The test that matters is a world with the hidden value and the same world with another, or none — everything the seat reads must be the same:

```ts
const told = (store: Store<AnySchema>) => JSON.stringify({
  snapshot: store.seenBy(parent).snapshot(),
  log: store.seenBy(parent).log.all(),
  problems: store.seenBy(parent).violations(),
  found: search(store, "555", { principal: parent }).hits,
});
expect(told(world("555 0101"))).toBe(told(world(undefined)));
```

### Worked examples

- `packages/core/tests/unit/a-sight-can-hide-a-field.test.ts` and `packages/core/tests/support/hidden-phones.ts` — the roster, world with and without a phone number, every read compared
- `packages/core/tests/unit/an-act-runs-under-its-callers-sight.test.ts` — a hidden record, the same comparison for an act's answer
- `apps/gauntlet/src/domain/policy.ts` — staff kept from the visitor, and where a speaker comes from kept from them too
- `packages/core/tests/document/fixtures/secret-santa.gdd.json` — a sight via a relation

### What the check cannot see

- Whether a TypeScript act's `describe` reads a hidden field directly: the store withholds such an op from the seat as it runs, but the author is the one who knows it was meant.
- Whether what a seat may not see is what the people involved expect. That is a conversation, not a declaration.

---

Say who sees which records of a Graview app, and which of their fields — so a seat is served only what it may see, on every surface at once — verified by graview check and by comparing what a seat is told with a hidden value and without one.

The page: https://graview.dev/docs/skills/graview-sight.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
