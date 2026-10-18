# graview-permissions

`graview-permissions` is one of Graview's 19 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Declare who may do what in a Graview app once, so the store enforces it, the actions strip narrows and an agent seat narrows with it — verified by graview check and by trying it.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Declare who may do what

Permission is another input to a derivation the framework already does. What can be done is already DERIVED from the schema and the invariants, so adding a principal and some grants narrows the interface and the agent surface at the same time, from one declaration.

Two things must not be got wrong, and they are the reason to follow this rather than improvise.

**Enforcement belongs at the STORE.** The tool runtime calls the same mutations a person does, so a check inside a React component is not a permission system, it is a suggestion — and the agent seat is the bypass.

**An action you may not take should SAY SO rather than vanish.** Hiding it teaches people the software is broken: they watched a colleague do this yesterday and now the button is gone.

### Do this

1. **Write the policy where the checker can read it.** In your domain layer, not your UI:

```ts export const policy: Policy = { roles: ["coach", "analyst", "player"], grants: [ { roles: ["coach"], mutations: "*" }, { roles: ["analyst"], mutations: ["plan-drill", "cut-drill", "design-drill"] }, // The line can be drawn by SUBJECT KIND on the same mutation: an // analyst may rename a drill and not a position, because a position's // name is part of the formation and the formation is selection. { roles: ["analyst"], mutations: ["rename"], kinds: ["drill", "session"] }, { roles: ["player"], mutations: ["end-unavailability", "explain"] }, ], }; ```

1. **Hand it to both `defineApp` and the `Store`.** `defineApp` is what `graview check` reads; the `Store` is what enforces.

The derived acts ride your grants rather than needing their own line: `edit-<kind>` is permitted to whoever may change or make the kind, and `remove-<kind>`, `archive-<kind>`, `unarchive-<kind>` and `merge-<kind>` to whoever may make it — but only over the records that seat made. To take out anybody's, name the act in the grant or say `*`. A grant to every role (`roles: "*"`) is a door, not a key: riding only it, even the edit reaches just the seat's own records, so "anybody may join" lets each person change or remove their own record, never everybody's. A relation's derived `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>` ride the edit's reading, on the kind the relation leaves. A refusal names who could, so a seat told no learns what it lacks rather than concluding the capability is missing.

1. **Give the provider a principal.** `<GraviewProvider principal={{ kind: "human", id: me.id, roles: me.roles }}>`. The interface reads it to decide what to OFFER; the store decides what to allow; the log attributes to it. Three readings of one object, which is why they cannot drift.

1. **Do not filter anything yourself.** The narrowing happens once, in `deriveAffordances`. A provider written tomorrow inherits it.

1. **Remember the absence of a policy permits everything.** That keeps permission opt-in rather than a tax every app pays before it has decided it has users.

1. **The derived edits ride your grants.** `edit-<kind>` — the act the framework derives for fields nobody writes — is permitted to whoever may already run an act that writes a field of that kind or creates one, on that kind. An analyst who may `resize-drill` may change a drill's other fields; a player who may not, may not. Nothing to add to the policy; a grant may still name `edit-drill` outright, and `*` reaches it. When no role may write or create a kind at all, `graview check` says so per field (`field-without-writer`): grant an act, or mark the field `fixed`.

1. **Put the installation in the graph.** Who may use the app, who has been asked to, and what each holds are nodes and acts, not a second app:

```ts const installation = declareInstallation({ roles: ["coach", "analyst", "player"], admin: "coach" }); createSchema([...yours, ...installation.kinds]); // user, invitation — typed, so // an edge may say to: ["user"] mutations: [...yours, ...installation.mutations]; // invite, welcome, remove-user, grant, revoke, revoke-invitation modules: installation.modules; // drawn only for those who administer it policy: installation.withPolicy(policy); // the admin's grants, and "you, on yours" for a profile ```

The coach sees "Show the installation" in the person's menu on the app bar and the people and invitations rise as ordinary districts; nobody else ever sees them. A person's record page is their profile, and the derived `edit-user` is theirs alone through a `self: true` grant. Register `reachLens` over the people with a title and the policy is a picture: roles down the side, acts across the top, a mark where the store would say yes. Chapter 14 of `apps/seedbed` is the worked example.

**Pointing at a person?** `declareInstallation({ …, required: true })`. An edge into a module the app can turn off earns a `module-edge-leak` warning, and for people the only answer is "it is never off" — an installation without people is a household of one, not a disabled module. Say it once and the checker stops asking.

1. **Say who sees what, for every kind — and which fields.** `sees` keeps records (and, with `hide` or `fields`, some of their fields) from seats the way grants keep acts. It is a job of its own: the `graview-sight` skill.

1. **Say which kind is the people.** `people: true` on one kind (a document's `"people": true`; the installation's `user` says it): a record of it whose id is a principal's id IS that person. Then: - `{ roles: ["participant"], kinds: ["match"], via: "givenBy" }` shows a seat a match only where `givenBy` joins it to their own record — each Secret Santa giver sees their match, not the one they receive in (`own` would show both). - `{ mutations: ["take-back"], ownEnd: true }` holds a connect or sever to the seat's own end of the link: a voter takes back their own vote. Every link the act touches is held, so a connect on a relation of one that would replace somebody else's is refused. - A document act's `"to": "$me"` (or `"set": { "champion": "$me" }`) is the acting person's record — the tool stops asking who, a seat with no record is refused with a sentence, and only that person can undo it. - A document says each by a named edit, previewed in words: `set-people` (`kind`, `people`), `add-grant` / `remove-grant`, `add-sight` / `remove-sight` (a removal names it by roles and acts or kinds).

### Worked examples

- `packages/core/tests/unit/permissions.test.ts` — grants by role, by mutation and by subject kind, and the refusal that names who could
- `packages/tools/tests/unit/affordances.test.ts` — a guarded store: what a principal is offered, what is withheld and said, and how the agent seat narrows with it
- `packages/core/tests/document/fixtures/secret-santa.gdd.json` and `idea-board.gdd.json` — a sight via a relation, `$me` and an own-end grant

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

The checker reports `mutation-unreachable-by-any-role` (declared and unreachable), `role-may-do-nothing` (a role that can neither run a mutation nor see a kind; a viewer that only reads is not reported, since reading is the point of it), `grant-unknown-mutation` and `grant-unknown-kind`. All four are silent at runtime and obvious at build time, and the person who finds them otherwise is the person standing in front of a button they cannot press. Report the output. The people have theirs: `people-ambiguous` (two kinds say it), `people-unsaid` (a `via`, an `ownEnd` or a `$me` and no people kind), `sight-via-misses-people` (a relation that never reaches them) and `grant-own-end-without-link`.

What a sight keeps, and the checks that say so (`act-reads-hidden-kind`, `rule-says-hidden-fact`, the `sight-*` codes), are `graview-sight`'s.

**And try it.** Two tests that matter more than the check:

```ts
it("refuses at the store, where nothing can go around it", () => {
  expect(() => store.apply(call, { author: player })).toThrow(PermissionDeniedError);
  expect(store.log.length).toBe(0);
});

it("narrows the agent seat from the same policy", () => {
  const seat = createToolRuntime(store, { author: { kind: "agent", roles: ["player"] } });
  expect(seat.definitions.map((t) => t.name)).not.toContain("select-player");
});
```

Undo is a change and is judged like one: what you may undo is what you may have done. If you have a custom undo path, check it goes through `store.undo`.

### What the check cannot see

- Whether the roles match how the organization actually works. That is a conversation, not a declaration.
- Whether a withheld action's message helps. It names the roles that could; whether that is useful depends on whether a person knows who holds them.
- Whether the principal is who they say they are. Graview authorizes; it does not authenticate. Wire that to your own identity provider and pass the result in as the principal.

---

Declare who may do what in a Graview app once, so the store enforces it, the actions strip narrows and an agent seat narrows with it — verified by graview check and by trying it.

The page: https://graview.dev/docs/skills/graview-permissions.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
