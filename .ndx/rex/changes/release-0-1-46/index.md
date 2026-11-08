---
id: "f7163679-32e8-4e00-a25a-b0a59e47c569"
type: "change"
title: "0.1.46: Built-in views share one type scale and one heading per page, a view's own place flows with the page, and the home may keep the line under the name off."
slug: "release-0-1-46"
intent: "What 0.1.46 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Built-in views look designed. Place headers, blocks lenses, grouped lists, kind lists and record pages share one type scale, one left edge and one heading. A lens's headline becomes the line under the page's title instead of a second heading; a group's heading is its label and its count; a record's name in a row or card is set in the text face; choices in a line of facts are drawn as small chips; spacing follows a 4px scale, given as `--graview-space-1` … `--graview-space-7`."
  - "A view's place flows with the page. A titled worker view at `/places/<slug>` is no longer drawn in a fixed-height frame that scrolls inside itself, which trapped the thumb on a phone. A calendar, a board and the other pictures keep their frame."
  - "The home may keep its line off. `brand.subtitle: false` keeps the description from being drawn under the app's name on the home, so a home view with its own hero no longer says everything twice. The description stays the app's, in its listings and on the name's hover."
shippedIn: "0.1.46"
tags:
  - "backfill"
  - "0.1.46"
source: "apps/site/releases.json"
---
