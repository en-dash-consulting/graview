---
id: "62c78a26-3677-4365-ace3-c208d05a0958"
type: "capability"
title: "Agents name records the way people do: a node argument accepts a label, and ambiguity comes back as candidates"
slug: "agents-name-records-the-way-people-do"
statement: "Agents name records by label or unique case-insensitive prefix in a node argument, and the tool runtime resolves it to a record id, refuses ambiguity with candidates, and keeps ids working unchanged."
criteria: [{"id":"c1","text":"When an act's node argument is given as a label or unique case-insensitive prefix that matches exactly one seen record of the accepted kinds, the tool runtime shall resolve it to that record's id and name the resolved id in the result."},{"id":"c2","text":"When act book is given the id 'bloom', the tool runtime shall book vendor:bloom-co and name the resolved id in the result."},{"id":"c3","text":"If a node argument matches two or more seen records, the tool runtime shall refuse the act and list each candidate with its id and label."},{"id":"c4","text":"If a node argument matches no seen record, the tool runtime shall say that nothing matched."},{"id":"c5","text":"When a node argument is given as a record id, the tool runtime shall accept it unchanged."},{"id":"c6","text":"The tool runtime shall resolve a node argument only against records the principal may see."},{"id":"c7","text":"The tool runtime shall resolve node arguments from a label index so that the cost of resolution scales with the number of matches rather than the number of visible records."},{"id":"c8","text":"The node-argument reader shall work without sharing the framework module instance that compiled the act, keeping no WeakMap keyed on a zod instance."}]
tags:
  - "graview-cloud"
  - "chat"
  - "FR-33"
source: "Nick, 2026-10-02: \"i really want to make sure this works super well with someone's existing chatgpt/claude/etc … seamless with both data and structural changes\""
priority: "high"
---

WHAT IS THERE NOW: every act argument that names a record is a nodeRef taking an id; an agent in a conversation must look the id up first (a search call), and a person says 'mark the florist booked', never 'vendor:bloom-co'. MISSING: one round trip for the commonest thing a person asks. POSITION: createToolRuntime (and graview mcp / apply) resolve a nodeRef argument given as a label or a unique case-insensitive prefix among the seen records of the accepted kinds; exactly one match resolves (and the result says which id it chose); several come back as a refusal listing the candidates with ids and labels; none says so. Ids keep working unchanged.
