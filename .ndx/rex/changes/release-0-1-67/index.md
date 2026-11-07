---
id: "3123a0be-e7cc-4bc9-8622-a4204059edcc"
type: "change"
title: "0.1.67: Better UI keeps a correct draft the first time and makes a small change as a small edit; a tidying suggestion is one plain question; a workflow step can reach another app; the right-click menu opens at the pointer in Safari; and a district's name stands under its plot on Chrome 157."
slug: "release-0-1-67"
intent: "What 0.1.67 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Better UI, right the first time. Its checks read what the page draws: a record is named by its label or its link, not a card's words run together, so an unchanged draft passes; a heading a person asked to reword may change; and a built-in list page's records are read, so a draft that drops them fails. A small change is an edit the framework applies to the script (one changed declaration, not the whole page again), the agent sees the whole script, and a refused style is named by its rule. After two failures on the same thing it says so in a sentence and offers Keep anyway or Stop; a host can log each check (`HostAi.onDraftChecked`); Kept is said once."
  - "A suggestion is one question. \"Put “What I steer by” in 09 · Without a Map?\" with Yes, No and Later, its records as links, why behind \"Why?\" in words, several alike under one line; a placement is no longer suggested on one shared word."
  - "Workflows reach another app. A step's `reads` and `acts` may name another app's kind or act (`@<address>/<name>`), checked by shape and, with a host's resolver, by what that app has; the step runs only through the host's `FarApps`, a dry run lists the far writes, and each carries lineage the other app can show."
  - "Hosts. The Answer slot says what the app lacks (`couldNotFind`, `lacks`); Share holds a second link; a status item on the app bar with its sentence on hover (`status`, `setStatus`); a kept 👎 note says where it went (`keptSays`)."
  - "Fixes. The right-click menu opens at the pointer in Safari, which drew it at the page's foot; a district's name and landmark stand under its plot on the GPU path (Chrome 157); a calendar entry wraps its name rather than cutting it."
shippedIn: "0.1.67"
tags:
  - "backfill"
  - "0.1.67"
source: "apps/site/releases.json"
---
