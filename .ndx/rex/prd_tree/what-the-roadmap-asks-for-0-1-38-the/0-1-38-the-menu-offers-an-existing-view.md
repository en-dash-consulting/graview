---
id: "9b7fe67a-056f-47b5-b359-6e3e6c632bab"
level: "task"
title: "0.1.38 · The right-click menu offers an existing view or lens before drawing a new one"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
acceptanceCriteria:
  - "where the menu offers to draw a view, it first matches the app's views and lenses (title, attachment, what they read) to the target and the ask and offers Open <view> (Open and adjust for a partial fit) above Draw a new view"
  - "at most three suggestions, none and no header when nothing fits, no model call (manifests only), from the menu's prefetch and cache; the menu is no taller than today"
  - "tests fail first; asking the Recon-like fixture for a searchable board offers the existing board first"
description: "Roadmap f-menu-suggests-existing-views (from r-menu-suggests-existing-views, Nick 2026-10-19)."
completedAt: "2026-10-19T05:10:00.000Z"
endedAt: "2026-10-19T05:10:00.000Z"
lastModified: "2026-10-19T05:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "On feat/menu-suggests-existing-views: existingViewsOf (@graview/core/catalog) matches the app's places by what they attach to, read, are titled and are, with no model call; the menu offers the best one above Draw a new view, in a row its suggestions give up; the quick ask offers up to three for its words; Open and adjust opens the view with the quick ask on it. Place carries lens and reads, a worker view its manifest's reads."
---

## Notes

**Decision: where it is matched.** `existingViewsOf(store, target, { principal, places, said?, most? })`
on `@graview/core/catalog`, beside `catalogOf`, pure: the target's kinds (or the kinds the words
name — "the opportunities pipeline" asks of opportunities wherever it is asked), each place's
attachment (`kind`/`over`), what it reads (`reads`), its title words and what it is (`lens`, with
a small table of the words that ask for each shipped lens: board/kanban/pipeline for `columns`,
calendar/schedule/due for `calendar`…). A word a view's title says is asked of that view only, so
"week" reaches "This week" and not every calendar. Full fit: attached to the kind and every word
said; partial: it only reads the kind, or a word is unsaid ("searchable"). Never a hidden place,
the lens it was opened on, or a kind the seat may not see; nothing for a word-only ask ("show"),
for the home with nothing asked, or for a question in the quick ask (Enter there asks).

**Decision: what the registry tells it.** `ViewMeta`/`Place` take optional `lens` and `reads`.
`registerDeclaredLenses` (declared and reader-kept lenses) passes the shipped lens's name;
`registerWorkerView` passes `lens: "view"` and `manifest.reads.kinds`. `useInlineEnv` hands them
(and `over`, `hidden`) through `CatalogPlace`. A host needs nothing new for a chat-added view: a
worker view registered with `registerWorkerView` and a `title` is matched by its manifest. A
home-attached view is not a place and is not offered (the home already lists the places).

**Decision: how quiet the menu is.** The menu has no words, so all views of the kind tie; it
offers the best one (registration order breaks the tie) and the model's suggestions give up a
row for it, so the AI section is never taller than with three suggestions; a suggested "go
there" to the same place is dropped. Offering three there pushed the todo app's suggestions out
entirely (verify-inline-ai `aMenuSuggestionIsPickedFromWhatTheMenuOffers` failed on it). "Draw a
panel" reads "Draw a new view" only when an Open row stands above it. The quick ask has the
words and offers up to three, ahead of its "Show …" rows, de-duplicating its "Go to" rows.

**Decision: "Open and adjust".** Opens the place and the quick ask on it (`{ on: "lens" }`), with
the typed words already asked when it came from the quick ask — the ask is put to the existing
view rather than drawing a second one. A draft revision of a declared lens in place was not
chosen: `recipeDraft` drafts from a panel recipe, and "Keep as a lens" under a name a place has
is passed over, so revising a declared lens under its name needs its own seam.

**Computed from the prefetch and cache.** The menu's section module is what `MenuSection.prepare`
prefetches (FR-186); the match is a `useMemo` beside the catalog's, per target, and reads only
`env.places` — no model, no fetch.

Tests (failing first): `packages/core/tests/document/the-menu-offers-an-existing-view-before-drawing-a-new-one.test.ts`
(the Recon fixture: "a searchable board" offers "Actions by status" first, partial),
`packages/pages/tests/unit/the-menu-offers-an-existing-view-before-drawing-a-new-one.test.tsx`
(Open above Draw a new view, no thinking call, Open and adjust opens the quick ask, nothing when
nothing fits), the quick ask's test, and the worker view registration test. Harnesses
`inline-ai`, `quick-ask`, `menu` (`--quick`) hold.
