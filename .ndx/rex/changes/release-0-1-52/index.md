---
id: "b2a9bb1c-cb39-4e68-aefe-b3f7627872c0"
type: "change"
title: "0.1.52: A list exports as a CSV, just as it is shown, and a view hidden from the place menu leaves the bar."
slug: "release-0-1-52"
intent: "What 0.1.52 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Export CSV. A kind's list on the Pages face, and the lenses that list records, offer Export CSV. The file holds the records the place shows, in its order, filter, search and groups (a Group column first, and a shut group's rows too), the label and then the fields the list reads, said as the page says them. It never holds a field the seat may not see. Cells are quoted for any spreadsheet, with a byte-order mark for Excel, and a cell that would start a formula is escaped. The writing and the download load only when somebody presses it; a host that saves files itself passes `onExport`."
  - "A switch per view. `export: false` on a lens or under `pages.lists.<kind>` turns it off; an owner turns it off or on from the place menu, for everyone, as hiding a view is (`set-lens-export`). `graview check` says a value that is not a boolean, and an `export` on a lens that lists nothing."
  - "A hidden view leaves the bar. Hiding the view that is open put it under Hidden but left it on the bar and the scene's tabs; now every place a person navigates from skips a hidden view (`offeredPlaces`), the page stays where it is, and Show brings it back at once."
shippedIn: "0.1.52"
tags:
  - "backfill"
  - "0.1.52"
source: "apps/site/releases.json"
---
