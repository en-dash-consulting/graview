---
id: "659d240f-cc4b-409d-b6f9-4233d5894595"
type: "change"
title: "0.1.55: An app says who it is for and what they come to do; graview check judges the look and one call composes it; the home opens on those questions; an app learns from what people could not do."
slug: "release-0-1-55"
intent: "What 0.1.55 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Who it is for, and what they come to do. A document or `defineApp` takes `purpose`: `for`, a sentence about its people, and up to twelve `jobs`, each a question in their words answered by the records of one kind a rule holds for, in an order, with the act they usually take next. `graview check` holds each to the declaration (`job-*`), four edits change them, and `@graview/core/jobs` answers one as the viewer may see it. The seat, the MCP and `describeApp` say the purpose."
  - "A judgment of the look. `graview check` says `design-*` warnings: a place that repeats another, too many places, a home with no focus, a card that repeats its title, a raw value, a main kind with no card, a job nothing answers. Each finding carries the edits that fix it, removals included."
  - "One design, composed. `@graview/core/compose` infers jobs an app never said (`inferJobs`), and `composeDesign` returns the whole change: the jobs, the critic's edits applied until nothing is left to say, an accent where the brand has none. With no declared home, the derived home opens on the jobs: the question as its title, how many, the first records and their act."
  - "What people could not do. A search that found nothing, a question nobody answered, an act refused and an agent's invalid call are kept in the graph's own words, never a visitor's, counted across people (`@graview/core/friction`, `/graview/friction`; `graview serve --no-friction` turns it off)."
  - "Learning from use. `@graview/core/learn` turns that log, the op log and the records into suggestions for the declaration (another name for a word several people searched with and found nothing, a choice or a date field for text written that way, one act for two people take in a row), each shown by at least three people, accepted or declined like the app's own actor's; `graview learn` and the `list_app_suggestions` tool offer them. Kinds and fields gain `aliases`."
shippedIn: "0.1.55"
tags:
  - "backfill"
  - "0.1.55"
source: "apps/site/releases.json"
---
