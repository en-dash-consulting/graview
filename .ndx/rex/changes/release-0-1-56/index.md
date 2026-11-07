---
id: "19df26f2-5dcb-450e-bd19-db614714d73a"
type: "change"
title: "0.1.56: An id names its kind; a date may know only its year or month, and an option has a readable label; a brand's suggested shade passes; a view is handed its computed values; the tray, the home's problems and Activity read better."
slug: "release-0-1-56"
intent: "What 0.1.56 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "An id says its kind. An add act's requested `id` must begin with its kind (`actor:apt1`); `apt1` is refused, the refusal names the prefixed form, and nothing in that batch lands. Ids already stored are untouched."
  - "Every relation can be linked. A declared act that makes a record and links it no longer hides the derived `connect-*` act; only one that makes nothing and stands on one end replaces the pair."
  - "Partial dates, and clearing. A `date` holds `2006` or `2016-05` as well as a day, drawn \"2006\" or \"May 2016\" and sorted a year before its months. `null` clears an optional field on a derived edit, and `importRows(…, { blanksClear: true })` clears what a blank cell leaves empty."
  - "Option labels. Enum fields take `optionLabels` and `set-options` takes `labels`; pages, pickers, change sentences, group headings, the CSV and a worker view's `props.choices` say them. An option with no label is said from its id: `state-sponsored` reads \"State sponsored\"."
  - "A brand's suggestion passes. A ground is judged on every pair the compiled palette holds, so the shade a refusal names is kept when sent back; an accent is judged on the ground it is drawn on, so a black brand keeps its gold. A light-scheme ground that is dark is drawn as a dark page."
  - "Views get computed values. Every record a worker view is handed carries its computed values, worked out over the viewer's sight, from a lazily loaded evaluator. `unreadEdgesSentence` on `@graview/guest/host/views` names only a relation the view's code uses."
  - "Who is here, exported. `whoFor(store, principal, who)` on `@graview/ship/runtime` is what the wire, `/graview/who` and `/graview/here` call."
  - "The actor takes back its own. `withdrawSuggestion` on `@graview/core/tidying` is the maker's undo, not a decline; `dream()` withdraws its waiting suggestions that fall below the bands it is given."
  - "Reading better. The Suggested tray wraps instead of scrolling sideways; a home says only the problems of the records it draws, on those records; Activity's row for a batch names each merge, removal and archive."
shippedIn: "0.1.56"
tags:
  - "backfill"
  - "0.1.56"
source: "apps/site/releases.json"
---
