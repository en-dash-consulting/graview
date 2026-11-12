---
id: "0ad852f5-556d-4c60-a77a-ad3a42d03627"
type: "change"
title: "0.2.0: Pages and the Scene become one face, opt-in per app: a page rises on one camera from Page to Nearby to City, every view stands as a billboard in the city, and graview check finds two views that show the same thing."
slug: "release-0-2-0"
intent: "What 0.2.0 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on Graview HQ (feature:f-page-zooms-out-to-the-city) and in the change f-page-zooms-out-to-the-city."
acceptanceCriteria:
  - "**One face, opt-in.** A `PagesApp` given `views` and `sceneUnderPages: true` stands over the app's own city. A face without it is unchanged; one face by default comes in 0.2.1."
  - "**Three levels on one camera.** Page is the page. Nearby is the same page as a panel beside its place in the city (a resizable sheet on a phone), with a line from each record it shows to that record's building and a Connected list. City is an isometric city with every page and view of the app standing as a billboard on its district; choosing anything there lands at Nearby. The same element moves between levels, never a cut to another screen."
  - "**One control at the bottom left.** Page \u00b7 Nearby \u00b7 City and a legend of what the city's marks mean, which folds into a one-row slider. Keys 1, 2, 3 and [ ] move a level and can be turned off in the legend; Cmd or Ctrl with plus and minus stay the browser's zoom. No Scene/Pages switch and no Up; the bar stays at the top at every level."
  - "**History in the levels.** While the history is played, buildings rise and sink as the scrub passes the changes that made and removed them."
  - "**Duplicate views are found.** `graview check` names two views that show the same thing (`view-duplicates-another`) and carries the `remove-lens` edit that removes one: how pages and lenses become one view, applied per app."
  - "**Find.** The down arrow goes onto the first result, and a result chosen after typing replaces the search page in the history, on every routed face."
shippedIn: "0.2.0"
tags:
  - "release"
  - "0.2.0"
source: "apps/site/releases.json"
---
