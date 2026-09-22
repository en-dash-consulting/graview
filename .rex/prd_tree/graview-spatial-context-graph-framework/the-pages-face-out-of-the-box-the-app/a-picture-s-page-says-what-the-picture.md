---
id: "23741b19-b497-4293-a9eb-d157a5aebc52"
level: "task"
title: "A picture's page says what the picture is, not what one of its members is"
status: "pending"
priority: "medium"
tags:
  - "pages"
  - "lenses"
  - "wording"
source: "Nick's squad pages, 2026-09-22, and seen again on todo's canvas lens in a2bd5497."
acceptanceCriteria:
  - "The place page's lede describes the picture rather than one of its members"
  - "A place registered with `across` says what it is across, the way the card already does"
  - "The kind's own description still appears where it belongs — on the kind's list page and on a record"
  - "Unit test over a place page for a kind whose description is plainly singular; todo, rota, seedbed and squad pages harnesses pass"
description: "`DefaultPlacePage` leads with the KIND's description as the picture's lede, and a kind is described in the singular because a kind describes one of its members. So todo's burn-down reads \"What is left / One thing to do.\", squad's training week reads \"The week / One training session in the week.\", and the formation board reads \"The team / A place in the formation, where it sits, and what it demands.\" Every one of them is a sentence about a member standing under the name of a picture of all of them. `pages.tsx` already builds the honest phrase for the cards — `pictureOf()` returns \"A picture of tasks\", \"A picture of skills across drills\" — and the page ignores it. Affects every app with a registered place."
lastModified: "2026-09-22T06:27:43.504Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
