---
id: "8671952e-f22b-4042-98cd-4db99a5787ea"
type: "change"
title: "0.1.63: An app declares workflows that fill next week, keep records in step, archive what is done and label what arrives; people propose changes for review; Notion makes the properties it needs; a connection says whom it invited; and the right-click menu says what is under the cursor."
slug: "release-0-1-63"
intent: "What 0.1.63 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Workflows. A document's `workflows` run on a schedule (words or cron, in the app's zone), when a record is made or changed, after a connection's pass, or by hand. Steps run an act over a query, make dated records from a pattern (`generate`), archive what is done after N days (`archive`), label each record with a model and a floor of plain rules (`classify`), or ask an agent within a budget. A run never makes a record twice, its first run after a change is a dry run, a paused workflow holds, and what it asks waits as one suggestion a person accepts whole or one change at a time. Workflows stand on the Scene's map; `graview workflow` lists and runs them; an owner's seat runs, pauses and resumes them."
  - "Records in step. A kind may say it `derives` from another: a plan item's rename renames its event in the same change and the next sync sends it; a computed field may be sent out through a connection."
  - "Proposals and votes. A grant may say `propose`: such a seat's form reads Propose, and a reviewer accepts or declines what it proposed. A shared or signed-out seat is refused a vote unless the host keeps visitors' votes advisory, apart from the tally that accepts."
  - "Connections. A Notion connection keeps several data sources of one database, one kind each, and makes the properties it needs. A calendar pass says in history whom it invited or took off, caps an event's guests, and lets a host read them back."
  - "Pages. The right-click menu offers Copy link and Inspect, leaves selected text to copy, and offers Add and Show only on a column; a blank field an act writes is an empty slot to fill, and a reader sees values plainly; an iPad's bar fits and its Scene glides once per tap; money never reads .00; a timeline that cannot draw is refused with its bindings named."
shippedIn: "0.1.63"
tags:
  - "backfill"
  - "0.1.63"
source: "apps/site/releases.json"
---
