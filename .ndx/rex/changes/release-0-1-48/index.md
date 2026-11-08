---
id: "4ce9966b-fb1e-4b39-ad61-0f00fe109b50"
type: "change"
title: "0.1.48: Forms ask the name first, acts answer to the way they're spelled, refusals name the act that would, and a place says its forms."
slug: "release-0-1-48"
intent: "What 0.1.48 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A creating form asks the name first. Then the required fields, then the rest, in the page's order, whatever order the document keeps its fields in. A key's abbreviation is said as its letters: `cvss` is \"CVSS\", `sourceUrl` \"Source URL\"."
  - "An act answers to its other spellings. `connect-threat-partOf` runs `connect-threat-part-of`; a name no act has is answered with the nearest one. A relation from a kind to itself is titled from its description: \"Set the family it belongs to\"."
  - "Refusals name the act that would. An edit refused a field another act writes says which act: \"whatToDo is set by set-verdict\". A number given as its digits (\"8.6\") is read as the number."
  - "Capitals where they belong. A headline that opens on a count in words starts with a capital; an acronym (\"CVEs\") is never lowered."
  - "A declared row names its record when its blocks don't, so the picture and its words agree."
  - "describe_place says a place's forms: each creating act's fields in order, required, with their choices; and a visitor form at `forms/<name>`."
  - "A hidden lens is hidden where a record is seen, and a title another lens holds is refused by naming that lens. A draft view takes no title a titled view already has."
shippedIn: "0.1.48"
tags:
  - "backfill"
  - "0.1.48"
source: "apps/site/releases.json"
---
