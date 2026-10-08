---
id: "1612641e-295e-4f0b-ab74-3c011d2e0dee"
level: "epic"
title: "Hosted for strangers: the declaration as a document, a live wire, and the seams a host of many apps needs"
status: "in_progress"
priority: "high"
tags:
  - "graview-cloud"
source: "Nick, 2026-10-02: \"anything you find that should be factored into the graview framework, go ahead and capture those in the graview repo\" — from the Graview Cloud refinement, ../graview-cloud/docs/framework-requirements.md"
startedAt: "2026-10-03T16:25:57.725Z"
description: "Graview Cloud (../graview-cloud) is a host of many apps for people who are not us: they make apps from a ChatGPT or Claude conversation, from templates, and share them by URL to work on together, live, with their agents. Reading the framework for it found what one deployment would also want and the framework does not yet have. THE DECLARATION IS CODE: defineApp is a TypeScript module, every host path import()s it, and serveStore re-runs mutation.apply and invariant.evaluate on the server, so a host of strangers' apps would run strangers' code beside other strangers' data. The studio already holds a declaration as a JSON graph and writes act bodies from data; it cannot judge a rule. THE WIRE POLLS: openRemote polls /graview/since every 800 ms; there is no push, no rebase of pending optimistic calls, and concurrent patches are last-writer-wins. THE SEAT IS A HEADER: the default seatOf trusts x-graview-seat and labels every remote caller human, so an agent reaching a served store over graview mcp --remote-url is logged as a person. THE WIRE IS NODE: serveStore is node:http only and MCP is stdio only. POSITION: each item below is a public seam a self-hoster wants too; Cloud carries interim implementations on public APIs (marked INTERIM(FR-xx) there) and deletes them as these land. Out of scope here, and staying in Cloud: tenancy, accounts, OAuth servers, billing, quotas, the multi-app connector. Related and already tracked: 'What a seat may not see never leaves the store' (d6f8b50f), which Cloud needs at critical priority."
lastModified: "2026-10-08T11:54:57.388Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A batch preview is judged as the batch would be: author, via and admit, and the ops as they would be logged (FR-56)](./a-batch-preview-is-judged-as-the-batch.md) | completed |
| [A board column's accessible name starts with the lens's title (FR-109)](./a-board-column-s-accessible-name.md) | completed |
| [A classic-worker build: the guest worker entry and a guest bundle need no module worker (FR-71)](./a-classic-worker-build-the-guest.md) | completed |
| [A compacted log keeps who made each record, so an own sight survives a restart](./a-compacted-log-keeps-who-made-each.md) | completed |
| [A conformance kit: fixtures any host runs against a version to prove it reads, compiles and derives the same](./a-conformance-kit-fixtures-any-host.md) | completed |
| [A contrast refusal names the pair and the ratio, with a fix (FR-126)](./a-contrast-refusal-names-the-pair-and.md) | completed |
| [A coverage cell over a path selects what it joins (FR-111)](./a-coverage-cell-over-a-path-selects.md) | completed |
| [A declared lens draws: a lenses entry maps to the shipped factory and is a named place (FR-79)](./a-declared-lens-draws-a-lenses-entry.md) | completed |
| [A derived edit offers every field nothing else really sets, and refuses what it can't take (FR-110)](./a-derived-edit-offers-every-field.md) | completed |
| [A document can say a kind's glance fields, and the compiler stops asking for what it cannot say (FR-39)](./a-document-can-say-a-kind-s-glance.md) | completed |
| [A figure's label is a template, and check flags braces in any non-template string (FR-99)](./a-figure-s-label-is-a-template-and.md) | completed |
| [A guest view can be a named place: guestView takes a title (FR-87)](./a-guest-view-can-be-a-named-place.md) | completed |
| [A guest view gets the theme, and follows the app's toggle (FR-86)](./a-guest-view-gets-the-theme-and.md) | completed |
| [A guest view may read across kinds, gets labels, and may attach to the home (FR-85)](./a-guest-view-may-read-across-kinds.md) | completed |
| [A hardened guest worker runtime: every global outside an allowlist removed before guest code runs (FR-70)](./a-hardened-guest-worker-runtime-every.md) | completed |
| [A home view from the closed block set: headline, figure and list (FR-81)](./a-home-view-from-the-closed-block-set.md) | completed |
| [A home view is the front page on a desk too (FR-136)](./a-home-view-is-the-front-page-on-a.md) | pending |
| [A host can ask up front what the studio will not edit: uneditable(document) (FR-62)](./a-host-can-ask-up-front-what-the.md) | completed |
| [A host can hand the page a compiled app, so the page no longer carries the compiler (FR-123)](./a-host-can-hand-the-page-a-compiled.md) | completed |
| [A host can read Graview's shape and type: SHAPE, TYPOGRAPHY and isoShade(scheme) from core (FR-73)](./a-host-can-read-graview-s-shape-and.md) | completed |
| [A host's own work has a seat: a system principal the policy lets through, and authors named by their own name](./a-host-s-own-work-has-a-seat-a-system.md) | completed |
| [A host's refusal can say its own sentence, and an Apply with no edits says so before the host is asked (FR-65)](./a-host-s-refusal-can-say-its-own.md) | completed |
| [A host speaks in the app's own notices: notify() on the embed handle (FR-75)](./a-host-speaks-in-the-app-s-own-notices.md) | completed |
| [A host that keeps the declaration chooses who sees the studio (FR-59)](./a-host-that-keeps-the-declaration.md) | completed |
| [A host that owns the page gives the routed face the address bar (FR-106)](./a-host-that-owns-the-page-gives-the.md) | completed |
| [A hosted page carries at most 600 KB of framework up front, and zod at most 150 KB of it (FR-57)](./a-hosted-page-carries-at-most-600-kb.md) | completed |
| [A live client a host can observe: status, counters, pending, backoff, presence cadence and visibility (FR-49)](./a-live-client-a-host-can-observe.md) | completed |
| [A live connection a hibernating host can resume from serialized per-socket state (FR-41)](./a-live-connection-a-hibernating-host.md) | completed |
| [A live wire: ops pushed as they land, pending edits rebased, and a stale write is a conflict rather than a loss](./a-live-wire-ops-pushed-as-they-land.md) | completed |
| [A log a seat may not fully see is redacted, not gapped: OperationLog and openRemote take withheld ops](./a-log-a-seat-may-not-fully-see-is.md) | completed |
| [A log can be folded from a base: epochs across declaration changes](./a-log-can-be-folded-from-a-base-epochs.md) | completed |
| [A long-lived log compacts behind an undo horizon](./a-long-lived-log-compacts-behind-an.md) | completed |
| [A member drawn as a row is a cell a view can claim](./a-member-drawn-as-a-row-is-a-cell-a.md) | completed |
| [A name is never cut off where it's the thing to read (FR-118)](./a-name-is-never-cut-off-where-it-s-the.md) | completed |
| [A named step is a move: an act that sets the column field to a constant offers a move to that column (FR-108)](./a-named-step-is-a-move-an-act-that.md) | completed |
| [A number field may say its range: min, max and step (FR-114)](./a-number-field-may-say-its-range-min.md) | completed |
| [A picture of an app without a browser: sceneThumbnail(document, { scheme }) as an SVG string (FR-74)](./a-picture-of-an-app-without-a-browser.md) | completed |
| [A pill means press this to choose, or a state (FR-117)](./a-pill-means-press-this-to-choose-or-a.md) | completed |
| [A repair reads a declared default, so a record a coerce would keep is patched rather than dropped (FR-50)](./a-repair-reads-a-declared-default-so-a.md) | completed |
| [A rule language the framework interprets: total, budgeted, and read like a sentence](./a-rule-language-the-framework.md) | completed |
| [A rule's refusal says so: reason refused, not invalid (FR-119)](./a-rule-s-refusal-says-so-reason.md) | completed |
| [A search hit says its address (FR-129)](./a-search-hit-says-its-address-fr-129.md) | completed |
| [A seat's first state read after a wake costs what it did before FR-55](./a-seat-s-first-state-read-after-a-wake.md) | completed |
| [A stability contract a host can hold the framework to: what a version may change, a changelog that says so, and capabilities() naming the seams it ships](./a-stability-contract-a-host-can-hold.md) | completed |
| [A status board: a shipped columns lens over a choice field (FR-97)](./a-status-board-a-shipped-columns-lens.md) | completed |
| [A store can adopt the server's whole state, with pending batches applied again on top (FR-53)](./a-store-can-adopt-the-server-s-whole.md) | completed |
| [A store can hold records that no longer fit while still checking new writes](./a-store-can-hold-records-that-no.md) | completed |
| [A store can prove its own fold: a deterministic snapshot hash and store.verify()](./a-store-can-prove-its-own-fold-a.md) | completed |
| [A studio mounted into part of a page draws no main, so a host page has no framework landmark violations (FR-58)](./a-studio-mounted-into-part-of-a-page.md) | completed |
| [A thumbnail fitted to what stands: fit to content and a legible minimum building (FR-107)](./a-thumbnail-fitted-to-what-stands-fit.md) | completed |
| [A thumbnail reads as a place with no counts (FR-120)](./a-thumbnail-reads-as-a-place-with-no.md) | completed |
| [A view can list related records: a list block with a walk as its source (FR-82)](./a-view-can-list-related-records-a-list.md) | completed |
| [A walk from every member of a set: out()/in() over a set return the distinct union, costed (FR-101)](./a-walk-from-every-member-of-a-set-out.md) | completed |
| [A worker view is a place, with a manifest the host enforces (FR-91)](./a-worker-view-is-a-place-with-a.md) | completed |
| [Agents name records the way people do: a node argument accepts a label, and ambiguity comes back as candidates](./agents-name-records-the-way-people-do.md) | completed |
| [An act's own logic cannot tell a seat whether a hidden record exists](./an-act-s-own-logic-cannot-tell-a-seat.md) | pending |
| [An agent acts for someone, through something: delegation and channel on every op, and seat headers trusted only on request](./an-agent-acts-for-someone-through.md) | completed |
| [An edit can set a kind's glance (set-glance), and the studio renames display.glance with its field](./an-edit-can-set-a-kind-s-glance-set.md) | completed |
| [An icon-sized thumbnail: sceneThumbnail size icon at 32x32 (FR-130)](./an-icon-sized-thumbnail-scenethumbnail.md) | completed |
| [An open kit for worker views: a declared HTML/SVG/CSS allowlist, with everything that can fetch or escape removed (FR-90)](./an-open-kit-for-worker-views-a.md) | completed |
| [An open page is told the app takes no changes for now, and when it does again (FR-66)](./an-open-page-is-told-the-app-takes-no.md) | completed |
| [An optimistic client can roll back: Store.rebase, a public notify, and batch ids that never collide across clients](./an-optimistic-client-can-roll-back.md) | completed |
| [Applying primitives is all or nothing: a failure leaves the graph as it was](./applying-primitives-is-all-or-nothing.md) | completed |
| [Backpressure distinct from refusal: busy with retryAfter, and the client re-sends (FR-45)](./backpressure-distinct-from-refusal.md) | completed |
| [Check warns when an act reads a kind some role that may run it cannot see (FR-105)](./check-warns-when-an-act-reads-a-kind.md) | completed |
| [Currency on any money: field as money takes currency, and an app default applies (FR-100)](./currency-on-any-money-field-as-money.md) | completed |
| [Declared acts can do what the org app's mutations do: set the other end, replace links, choose by condition (FR-115)](./declared-acts-can-do-what-the-org-app.md) | completed |
| [Derived tools say what they do, are safe to name, and an act named like a read tool can still be run](./derived-tools-say-what-they-do-are.md) | completed |
| [Describe a place without a browser: describePlace for a chat to check its own work (FR-89)](./describe-a-place-without-a-browser.md) | completed |
| [describePlace says a coverage grid (FR-112)](./describeplace-says-a-coverage-grid-fr.md) | completed |
| [Edits for lenses, the home, pages, computed fields and the new blocks (FR-84)](./edits-for-lenses-the-home-pages.md) | completed |
| [Embed hands its views to the routed face too](./embed-hands-its-views-to-the-routed.md) | completed |
| [Embed holds inside a chat's widget: no storage assumed, its own height reported, the host's scheme taken](./embed-holds-inside-a-chat-s-widget-no.md) | completed |
| [Embed knows what its host can keep: the studio hidden or handed to the host, and a size budget](./embed-knows-what-its-host-can-keep-the.md) | completed |
| [Embed reports what went wrong and how long it took, without what was on screen](./embed-reports-what-went-wrong-and-how.md) | completed |
| [Every act refuses an argument it doesn't take (FR-121)](./every-act-refuses-an-argument-it-doesn.md) | completed |
| [Every harness honours GRAVIEW_PORT_BASE, so a second checkout can run any of them](./every-harness-honours-graview-port.md) | completed |
| [/graview/export calls exportBundle with its arguments the wrong way round](./graview-export-calls-exportbundle-with.md) | completed |
| [Guest views in a worker: @graview/guest's worker entry and a host that takes a worker source (FR-68)](./guest-views-in-a-worker-graview-guest.md) | completed |
| [Guest views: someone else's React in a sandboxed frame that can only ask, under the viewer's seat](./guest-views-someone-else-s-react-in-a.md) | completed |
| [Limits and fallback for worker views: bytes, nodes, messages and CPU per push (FR-94)](./limits-and-fallback-for-worker-views.md) | completed |
| [Links from a worker view stay in the app (FR-93)](./links-from-a-worker-view-stay-in-the.md) | completed |
| [MCP for remote hosts: Streamable HTTP, honest tool hints, and other people's words marked as data](./mcp-for-remote-hosts-streamable-http.md) | completed |
| [Migrations that keep data: declared renames and type coercion in steps and migrationBetween](./migrations-that-keep-data-declared.md) | completed |
| [Modules reach the host: the enabled set is passed to opened, served and remote stores, and turning one off is in history](./modules-reach-the-host-the-enabled-set.md) | completed |
| [Named edits for the brand, the name and the subtitle (FR-125)](./named-edits-for-the-brand-the-name-and.md) | completed |
| [Notices float, and never move the page (FR-133)](./notices-float-and-never-move-the-page.md) | completed |
| [Old documents keep compiling after the en-US renames (FR-134)](./old-documents-keep-compiling-after-the.md) | pending |
| [One app bar on every face: the app, its places, and three tools (FR-131)](./one-app-bar-on-every-face-the-app-its.md) | completed |
| [One guest client, served not copied: a prebuilt classic script and an authoring guide (FR-88)](./one-guest-client-served-not-copied-a.md) | completed |
| [One place says how many problems there are (FR-122)](./one-place-says-how-many-problems-there.md) | completed |
| [openRemote's runtime entry exports the observable-client types, and read-only MCP calls can show presence](./openremote-s-runtime-entry-exports-the.md) | completed |
| [pages is a real arrangement: order, hide and first, compiled and honoured on both faces (FR-80)](./pages-is-a-real-arrangement-order-hide.md) | completed |
| [Presence a host can add to: kind, name, onBehalfOf, announce for socketless visitors, and welcome.participant (FR-47)](./presence-a-host-can-add-to-kind-name.md) | completed |
| [Presence speaks one dialect and forgets the gone; seats can be added after mount without offering to sit as someone else](./presence-speaks-one-dialect-and.md) | completed |
| [Refusal reasons a program can branch on: forbidden, missing, invalid, limit, with wouldNeed (FR-46)](./refusal-reasons-a-program-can-branch.md) | completed |
| [Registering one view layers over the defaults instead of replacing them, and a default can be wrapped](./registering-one-view-layers-over-the.md) | completed |
| [Room on the hosted page: weight by entry in release notes, and headroom under 600 KB (FR-104)](./room-on-the-hosted-page-weight-by.md) | completed |
| [Rows in a nested list keep their small blocks whole (FR-113)](./rows-in-a-nested-list-keep-their-small.md) | completed |
| [Run a worker view headless and describe it, in an isolated environment (FR-95)](./run-a-worker-view-headless-and.md) | completed |
| [Say what a host page needs for worker views, and say when it is missing (FR-102)](./say-what-a-host-page-needs-for-worker.md) | completed |
| [sceneThumbnail sizes districts by counts the way the live Scene does (FR-103)](./scenethumbnail-sizes-districts-by.md) | completed |
| [SECURITY: the seat view serves no unseen record's id, in field values, primitives, reads, writes or args (FR-55)](./security-the-seat-view-serves-no.md) | completed |
| [setApp takes the new label, so a renamed app says its new name without a reload (FR-128)](./setapp-takes-the-new-label-so-a.md) | completed |
| [Sights follow the log: seesId's judgement, an appended-op creator index, and the ambiguous refusal names the kind (FR-51)](./sights-follow-the-log-seesid-s.md) | completed |
| [Stored data checked against its declaration: validateGraph, and repairs as ordinary ops](./stored-data-checked-against-its.md) | completed |
| [Stored formats carry their version, and the next major brings the steps to read the last one](./stored-formats-carry-their-version-and.md) | completed |
| [Structural edits as a vocabulary: add, rename, retype, remove — and a rename rewrites every reference](./structural-edits-as-a-vocabulary-add.md) | completed |
| [Swap the app under a mounted embed without losing the reader's place (FR-116)](./swap-the-app-under-a-mounted-embed.md) | completed |
| [Templates as data: graview create and graview apply take a template made anywhere](./templates-as-data-graview-create-and.md) | completed |
| [The AI rail can be put away: collapse to a tab, overlay when narrow, and a host's starting state (FR-78)](./the-ai-rail-can-be-put-away-collapse.md) | completed |
| [The channel is the host's word: the live handler takes via from the seat, never from the client (FR-52)](./the-channel-is-the-host-s-word-the.md) | completed |
| [The companion is a top-level landmark or none, so axe's landmark-complementary-is-top-level holds (FR-40)](./the-companion-is-a-top-level-landmark.md) | completed |
| [The component kit as remote elements, declared once for both sides (FR-69)](./the-component-kit-as-remote-elements.md) | completed |
| [The declaration is a document: one JSON object compiles into the same app defineApp declares](./the-declaration-is-a-document-one-json.md) | completed |
| [The desk bar is one row (FR-135)](./the-desk-bar-is-one-row-fr-135.md) | pending |
| [The document holds the whole brand: logo, favicon, typography, shape, accents and a preferred scheme (FR-124)](./the-document-holds-the-whole-brand.md) | completed |
| [The embed has a place for a host's own actions, in the bar's profile menu (FR-72)](./the-embed-has-a-place-for-a-host-s-own.md) | completed |
| [The embed has one layering system: popovers in the top layer, persistent surfaces on one ladder (FR-76)](./the-embed-has-one-layering-system.md) | completed |
| [The embed loads the studio eagerly when the studio is the whole page (FR-63)](./the-embed-loads-the-studio-eagerly.md) | completed |
| [The embed's popovers behave as one family: one open, Escape and outside click, focus in and back, kept in the viewport (FR-77)](./the-embed-s-popovers-behave-as-one.md) | completed |
| [The embed's stylesheet stays inside its box: every scoped themeCss rule is under the scope (FR-64)](./the-embed-s-stylesheet-stays-inside.md) | completed |
| [The framework says its own version, and rule failures are structured](./the-framework-says-its-own-version-and.md) | completed |
| [The language computes what pages need: expressions in aggregates, first and sort, computed fields, template filters (FR-83)](./the-language-computes-what-pages-need.md) | completed |
| [The live handler serves a store the host already holds (FR-42)](./the-live-handler-serves-a-store-the.md) | completed |
| [The record names Graview Cloud and npm as they are](./the-record-names-graview-cloud-and-npm.md) | completed |
| [The scene is a place, not a mode (FR-132)](./the-scene-is-a-place-not-a-mode-fr-132.md) | completed |
| [The seat view serves an op that names a record that isn't there (FR-67)](./the-seat-view-serves-an-op-that-names.md) | completed |
| [The server pushes that the declaration changed, and a remote client reopens on it (FR-43)](./the-server-pushes-that-the-declaration.md) | completed |
| [The store a host drives: a real clock, its own sentences kept, previews of several calls, host ops appended, typed undo refusals](./the-store-a-host-drives-a-real-clock.md) | completed |
| [The store serves from any runtime: a fetch handler, an adapter over plain SQL, and core proven in workerd](./the-store-serves-from-any-runtime-a.md) | completed |
| [The studio changes a field in place: its type, required flag, options and description (FR-61)](./the-studio-changes-a-field-in-place.md) | completed |
| [The studio hands a document-compiled app back as a document, and editDocument can set a glance (FR-54)](./the-studio-hands-a-document-compiled.md) | completed |
| [The studio says the host refused when it did: onApply can answer with findings (FR-60)](./the-studio-says-the-host-refused-when.md) | completed |
| [The theme has good and bad tones, checked for contrast in both schemes](./the-theme-has-good-and-bad-tones.md) | completed |
| [The workbench has a heading: an h1 naming the app, and headings for its regions](./the-workbench-has-a-heading-an-h1.md) | completed |
| [Version skew on the wire: build strings, a reload answer, carried calls, and a codec name (FR-44)](./version-skew-on-the-wire-build-strings.md) | completed |
| [Views as data: a card, a row and a badge declared rather than written, and drawn by the framework](./views-as-data-a-card-a-row-and-a-badge.md) | completed |
| [Views get the whole theme, logo included (FR-127)](./views-get-the-whole-theme-logo.md) | completed |
| [What main can do, npm can do: 0.1.0 has no sights, so publish what the walks built](./what-main-can-do-npm-can-do-0-1-0-has.md) | completed |
| [Write a worker view with no build and no copied protocol (FR-96)](./write-a-worker-view-with-no-build-and.md) | completed |
| [Writes from a worker view that can't leak: manifest acts, and presses the host saw (FR-92)](./writes-from-a-worker-view-that-can-t.md) | completed |
