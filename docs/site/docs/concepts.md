# Concepts

A Graview app is one declaration: a TypeScript object, made by `defineApp`, with seven things in it. Every surface in a Graview application is derived from some part of what is on this page.

## The declaration

One object — `defineApp` — carrying the schema, the mutations, the invariants, the policy, the brand, the lenses and the intelligence. It has no React in it, which is what lets a build, a CLI and a model all read it.

Taught by [`graview-new-app`](https://graview.dev/docs/skills/graview-new-app.html).

## Kinds and edges

A kind is a thing your domain has; an edge is how two of them relate, and it carries how it READS from each end. Declaring a kind gets you a district, a card at three fidelities, a hue, an accessible label and a place in every agent tool — before anything is drawn.

Taught by [`graview-node-kind`](https://graview.dev/docs/skills/graview-node-kind.html).

## Acts

Every change is a named, typed mutation. It is the button in the interface, the tool in the model's schema and the line in the log, and it says what it `creates`, `connects` and `severs` so the surfaces can derive themselves from it.

Taught by [`graview-node-kind`](https://graview.dev/docs/skills/graview-node-kind.html).

## Rules that repair

An invariant names the mutations that fix what it finds. That is the difference between a validation error and a problem with a way out — the interface can offer the repair because the rule said what it was.

Taught by [`graview-invariant`](https://graview.dev/docs/skills/graview-invariant.html).

## Lenses

A lens places nodes by a rule the domain supplies — a time, two sets, a coordinate, an outline. It binds ROLES rather than field names, so a lens written for your domain works unchanged in somebody else's, and a test in a second domain is how that claim is kept.

Taught by [`graview-lens`](https://graview.dev/docs/skills/graview-lens.html).

## Who may do what

One policy, declared once. The strip, the routed pages and the agent's tools all narrow from it, and an act a seat may not take is struck through with the sentence saying who can — never a button that silently fails.

Taught by [`graview-permissions`](https://graview.dev/docs/skills/graview-permissions.html).

## The seat for a model

An intelligence provider declares what a model may do and how words and pictures reach it. Its turns land in the same log with an author and an intent, and come back out through the same undo.

Taught by [`graview-agent-seat`](https://graview.dev/docs/skills/graview-agent-seat.html).

---

The ideas behind a Graview app: one declaration, and the seven things in it — kinds and edges, acts, rules that repair, lenses, who may do what, and the seat for a model.

The page: https://graview.dev/docs/concepts.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
