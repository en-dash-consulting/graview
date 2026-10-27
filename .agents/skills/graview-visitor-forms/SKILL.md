---
name: graview-visitor-forms
description: Open one act of a Graview app to people who never join it — an RSVP, a sign-up, a request — as a form drawn alone, run as a visitor the host mints per answer, its answers landing as records and nothing else of the app shown — verified by graview check and by opening the form as that visitor.
---

# A form for a visitor

An RSVP link is a page with nothing on it but the question. The visitor has
no account, sees no record, and their answer lands as one. Graview does not
add a second permission system for it: a visitor is a principal like any
other, holding one role, and the policy says what that role may do and see.
The form is the declaration of which act, which fields, and what they are
told afterwards.

## Do this

1. **Declare the form.** In code (`defineApp({ …, forms })`) or a document's
   `forms`:

   ```json
   "forms": {
     "rsvp": {
       "act": "add-guest",
       "title": "RSVP",
       "intro": "Tell us whether you can come on June 14.",
       "fields": ["name", "email", "coming", "note"],
       "say": "The hosts will write to you a week before."
     }
   }
   ```

   `act` makes a record or acts on none — a visitor is shown no record to
   pick. `fields` is the order asked; unsaid, every argument a visitor
   could fill, its name first and then what must be answered. `say` is what the visitor reads under "Received — thank
   you." `submit` is the button (the act's title, unsaid). `role` is the
   role the visitor holds: `visitor`, unsaid.

2. **Grant the role the act, and name it in no sight.**

   ```json
   "policy": {
     "grants": [{ "roles": ["host"], "mutations": "*" }, { "roles": ["visitor"], "mutations": ["add-guest"] }],
     "sees": [{ "roles": ["host"], "kinds": ["guest", "table"] }]
   }
   ```

   A policy with `sees` keeps every kind it does not name from every role
   it does not name, so the visitor is served nothing — not the guests
   already there, not the one they just made. A picker the form asks with
   offers only what the visitor is served: show them a kind by a sight
   naming their role when they must pick one (an event to answer for).

3. **Mint a visitor per answer, on the host.** `formVisitor(app, "rsvp",
   "form:<token>")` from `@graview/core/forms` is `{ kind: "visitor", id,
   name: "a visitor via the RSVP form", roles: ["visitor"] }`: hand it to
   the store that judges the act (a served store believes it from the
   seat's headers), so Activity names the answer for the form and never
   by its token.

4. **Draw it alone.** `@graview/embed/form`:

   ```ts
   import { mount } from "@graview/embed/form";
   mount(el, { app, form: "rsvp", principal: "form:<token>", remote, height: "100dvh" });
   ```

   `remote` is `openRemote` opened as the same visitor. No bar, no lists,
   no seat; `onSubmitted` is told once it is received. A React host draws
   `VisitorFormPage` from `@graview/pages/visitor-form`.

5. **Try it locally.** `graview preview <document>` serves each form at
   `/forms/<name>`, a visitor minted per page: open the form's address as
   it prints it, which carries the run's key.

## Worked examples

- `packages/core/tests/document/fixtures/rsvp.gdd.json` — the RSVP: a form,
  its grant, a sight that never names the visitor
- `packages/core/tests/unit/a-form-for-a-visitor.test.ts` — the visitor
  minted, the act run as them, their seat served nothing, every finding
- `packages/embed/tests/unit/a-visitor-answers-a-form-mounted-alone.test.tsx`
  — the mount, drawn alone and answered

## Then find out whether it worked

```sh
npx graview check ./app.gdd.json
```

A form is held to what a visitor can do: `form-unknown-act`,
`form-act-on-a-record`, `form-without-sight` (no policy, or one that says
nothing of who sees what: the visitor would be served every record),
`form-act-not-granted`, `form-field-unknown`, `form-omits-required`,
`form-field-unfillable` (a required picker over records the visitor is not
served, or a field their sight keeps from them); and as warnings,
`form-visitor-sees` (a sight serves the visitor a kind — to everybody, or by
name where no picker asks for it) and `form-visitor-may-more` (the role may
run acts no form opens). Report what it said.

**Read what it asks.** `describe_place` with `forms/<name>` (or
`graview describe <entry> --place forms/<name>`) says each field in the
order asked: its label, a star where it must be answered, what it takes and
its choices — as the visitor is asked it.

**And try it.** Open `/forms/<name>` under `graview preview`, answer, and
read the store as the host: the record is there, its author "a visitor via
the … form". Then read `store.seenBy(visitor).snapshot()` — it should be
empty — and the answers the page was sent should name no record.

## What the check cannot see

- Abuse. How many answers one link may take, from where, and whether a
  token is spent once: the host's, before it mints a visitor.
- Who may open the form at all, and on which plan: the host's.
- Whether the words help. `intro` and `say` are the app's; whether a
  stranger understands what they are signing up for is a reading, not a
  check.
