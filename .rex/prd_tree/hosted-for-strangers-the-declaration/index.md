---
id: "1612641e-295e-4f0b-ab74-3c011d2e0dee"
level: "epic"
title: "Hosted for strangers: the declaration as a document, a live wire, and the seams a host of many apps needs"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
source: "Nick, 2026-10-02: \"anything you find that should be factored into the graview framework, go ahead and capture those in the graview repo\" — from the Graview Cloud refinement, ../graview-cloud/docs/framework-requirements.md"
description: "Graview Cloud (../graview-cloud) is a host of many apps for people who are not us: they make apps from a ChatGPT or Claude conversation, from templates, and share them by URL to work on together, live, with their agents. Reading the framework for it found what one deployment would also want and the framework does not yet have. THE DECLARATION IS CODE: defineApp is a TypeScript module, every host path import()s it, and serveStore re-runs mutation.apply and invariant.evaluate on the server, so a host of strangers' apps would run strangers' code beside other strangers' data. The studio already holds a declaration as a JSON graph and writes act bodies from data; it cannot judge a rule. THE WIRE POLLS: openRemote polls /graview/since every 800 ms; there is no push, no rebase of pending optimistic calls, and concurrent patches are last-writer-wins. THE SEAT IS A HEADER: the default seatOf trusts x-graview-seat and labels every remote caller human, so an agent reaching a served store over graview mcp --remote-url is logged as a person. THE WIRE IS NODE: serveStore is node:http only and MCP is stdio only. POSITION: each item below is a public seam a self-hoster wants too; Cloud carries interim implementations on public APIs (marked INTERIM(FR-xx) there) and deletes them as these land. Out of scope here, and staying in Cloud: tenancy, accounts, OAuth servers, billing, quotas, the multi-app connector. Related and already tracked: 'What a seat may not see never leaves the store' (d6f8b50f), which Cloud needs at critical priority."
lastModified: "2026-10-02T20:55:06.678Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A conformance kit: fixtures any host runs against a version to prove it reads, compiles and derives the same](./a-conformance-kit-fixtures-any-host.md) | pending |
| [A host's own work has a seat: a system principal the policy lets through, and authors named by their own name](./a-host-s-own-work-has-a-seat-a-system.md) | completed |
| [A live wire: ops pushed as they land, pending edits rebased, and a stale write is a conflict rather than a loss](./a-live-wire-ops-pushed-as-they-land.md) | pending |
| [A log a seat may not fully see is redacted, not gapped: OperationLog and openRemote take withheld ops](./a-log-a-seat-may-not-fully-see-is.md) | pending |
| [A log can be folded from a base: epochs across declaration changes](./a-log-can-be-folded-from-a-base-epochs.md) | pending |
| [A long-lived log compacts behind an undo horizon](./a-long-lived-log-compacts-behind-an.md) | pending |
| [A member drawn as a row is a cell a view can claim](./a-member-drawn-as-a-row-is-a-cell-a.md) | pending |
| [A rule language the framework interprets: total, budgeted, and read like a sentence](./a-rule-language-the-framework.md) | pending |
| [A stability contract a host can hold the framework to: what a version may change, a changelog that says so, and capabilities() naming the seams it ships](./a-stability-contract-a-host-can-hold.md) | completed |
| [A store can hold records that no longer fit while still checking new writes](./a-store-can-hold-records-that-no.md) | pending |
| [A store can prove its own fold: a deterministic snapshot hash and store.verify()](./a-store-can-prove-its-own-fold-a.md) | pending |
| [Agents name records the way people do: a node argument accepts a label, and ambiguity comes back as candidates](./agents-name-records-the-way-people-do.md) | pending |
| [An agent acts for someone, through something: delegation and channel on every op, and seat headers trusted only on request](./an-agent-acts-for-someone-through.md) | completed |
| [An optimistic client can roll back: Store.rebase, a public notify, and batch ids that never collide across clients](./an-optimistic-client-can-roll-back.md) | pending |
| [Applying primitives is all or nothing: a failure leaves the graph as it was](./applying-primitives-is-all-or-nothing.md) | completed |
| [Derived tools say what they do, are safe to name, and an act named like a read tool can still be run](./derived-tools-say-what-they-do-are.md) | pending |
| [Embed hands its views to the routed face too](./embed-hands-its-views-to-the-routed.md) | pending |
| [Embed holds inside a chat's widget: no storage assumed, its own height reported, the host's scheme taken](./embed-holds-inside-a-chat-s-widget-no.md) | pending |
| [Embed knows what its host can keep: the studio hidden or handed to the host, and a size budget](./embed-knows-what-its-host-can-keep-the.md) | pending |
| [Embed reports what went wrong and how long it took, without what was on screen](./embed-reports-what-went-wrong-and-how.md) | pending |
| [/graview/export calls exportBundle with its arguments the wrong way round](./graview-export-calls-exportbundle-with.md) | completed |
| [Guest views: someone else's React in a sandboxed frame that can only ask, under the viewer's seat](./guest-views-someone-else-s-react-in-a.md) | pending |
| [MCP for remote hosts: Streamable HTTP, honest tool hints, and other people's words marked as data](./mcp-for-remote-hosts-streamable-http.md) | pending |
| [Migrations that keep data: declared renames and type coercion in steps and migrationBetween](./migrations-that-keep-data-declared.md) | pending |
| [Modules reach the host: the enabled set is passed to opened, served and remote stores, and turning one off is in history](./modules-reach-the-host-the-enabled-set.md) | pending |
| [Presence speaks one dialect and forgets the gone; seats can be added after mount without offering to sit as someone else](./presence-speaks-one-dialect-and.md) | pending |
| [Registering one view layers over the defaults instead of replacing them, and a default can be wrapped](./registering-one-view-layers-over-the.md) | pending |
| [Stored data checked against its declaration: validateGraph, and repairs as ordinary ops](./stored-data-checked-against-its.md) | pending |
| [Stored formats carry their version, and the next major brings the steps to read the last one](./stored-formats-carry-their-version-and.md) | completed |
| [Structural edits as a vocabulary: add, rename, retype, remove — and a rename rewrites every reference](./structural-edits-as-a-vocabulary-add.md) | pending |
| [Templates as data: graview create and graview apply take a template made anywhere](./templates-as-data-graview-create-and.md) | pending |
| [The declaration is a document: one JSON object compiles into the same app defineApp declares](./the-declaration-is-a-document-one-json.md) | pending |
| [The framework says its own version, and rule failures are structured](./the-framework-says-its-own-version-and.md) | completed |
| [The record names Graview Cloud and npm as they are](./the-record-names-graview-cloud-and-npm.md) | completed |
| [The store a host drives: a real clock, its own sentences kept, previews of several calls, host ops appended, typed undo refusals](./the-store-a-host-drives-a-real-clock.md) | pending |
| [The store serves from any runtime: a fetch handler, an adapter over plain SQL, and core proven in workerd](./the-store-serves-from-any-runtime-a.md) | pending |
| [The theme has good and bad tones, checked for contrast in both schemes](./the-theme-has-good-and-bad-tones.md) | pending |
| [The workbench has a heading: an h1 naming the app, and headings for its regions](./the-workbench-has-a-heading-an-h1.md) | pending |
| [Views as data: a card, a row and a badge declared rather than written, and drawn by the framework](./views-as-data-a-card-a-row-and-a-badge.md) | pending |
| [What main can do, npm can do: 0.1.0 has no sights, so publish what the walks built](./what-main-can-do-npm-can-do-0-1-0-has.md) | in_progress |
