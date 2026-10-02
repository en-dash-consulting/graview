---
id: "62c78a26-3677-4365-ace3-c208d05a0958"
level: "feature"
title: "Agents name records the way people do: a node argument accepts a label, and ambiguity comes back as candidates"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "chat"
  - "FR-33"
source: "Nick, 2026-10-02: \"i really want to make sure this works super well with someone's existing chatgpt/claude/etc … seamless with both data and structural changes\""
acceptanceCriteria:
  - "act book with id 'bloom' books vendor:bloom-co and the result names the id it resolved"
  - "Two matches refuse with both candidates listed"
  - "Resolution only ever sees records the principal may see"
description: "WHAT IS THERE NOW: every act argument that names a record is a nodeRef taking an id; an agent in a conversation must look the id up first (a search call), and a person says 'mark the florist booked', never 'vendor:bloom-co'. MISSING: one round trip for the commonest thing a person asks. POSITION: createToolRuntime (and graview mcp / apply) resolve a nodeRef argument given as a label or a unique case-insensitive prefix among the seen records of the accepted kinds; exactly one match resolves (and the result says which id it chose); several come back as a refusal listing the candidates with ids and labels; none says so. Ids keep working unchanged."
lastModified: "2026-10-02T23:32:59.124Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
