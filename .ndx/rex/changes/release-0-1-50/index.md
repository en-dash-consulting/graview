---
id: "39330c52-634f-4ad4-a58a-a90fe1faab99"
type: "change"
title: "0.1.50: The 1.0 foundations: formats that fail closed, links with ids of their own, opaque cursors, a publishing lifecycle, and the first two phases of text typed together."
slug: "release-0-1-50"
intent: "What 0.1.50 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Formats fail closed. A primitive, a typed value or a store format a build does not know is refused with `NewerFormatError` rather than skipped; an author kind it does not know reads as the system's; a refusal code a client does not know is final. Two writers on one log fail loudly with `LogHeadMovedError` instead of writing a second op 1."
  - "Links, ids and cursors. A link may carry an `id` and `data` of its own; an act honors a caller's id when it is free and refuses one that is taken; a page's own ids travel as a hint, so two people adding the same name both land. Positions on the wire are opaque cursors."
  - "Publishing. Under `publishing: { mode: \"on-publish\" }`, collaborators edit live and everyone else reads the app as of the last `publish`; `?as=published` shows what readers see, and `unpublished(store)` says what is waiting."
  - "Text typed together. A text field takes a `splice-text`, transformed so concurrent typing converges; the `type-text` act in `@graview/core/typing` merges keystrokes, an agent's whole rewrite and undo out of order."
  - "Not now. The Suggested tray hides a suggestion from one person until tomorrow, and a night's tidying is one row in Activity."
shippedIn: "0.1.50"
tags:
  - "backfill"
  - "0.1.50"
source: "apps/site/releases.json"
---
