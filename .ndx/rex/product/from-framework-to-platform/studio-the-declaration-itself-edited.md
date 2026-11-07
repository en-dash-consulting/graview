---
id: "4a0045cc-f380-4618-9faa-3cbd340d7632"
type: "capability"
title: "Studio: the declaration itself, edited in the graph's own interface, with changes applied as mutations"
slug: "studio-the-declaration-itself-edited"
statement: "Studio shows a Graview app's own declaration (kinds, fields, edges, acts, rules, policy, brand and lenses) as a graph in Graview's interface and applies each change to it as a mutation that graview check has judged."
criteria: [{"id":"c1","text":"Studio shall present the declaration's kinds, fields, edges, acts, rules, policy, brand and lenses as nodes with their relations that the scene and the pages can show."},{"id":"c2","text":"When a person changes the declaration, Studio shall record the change as a mutation with an author, an intent and an inverse."},{"id":"c3","text":"When a person undoes a change to the declaration, Studio shall reverse it using the change's inverse."},{"id":"c4","text":"When a change to the declaration is proposed, Studio shall run graview check on the proposed declaration and show its findings before the change is applied."},{"id":"c5","text":"When a change is applied, Studio shall apply it as a mutation to the running declaration so that it reaches the running app."},{"id":"c6","text":"If an applied change needs the stored graph to change, Studio shall produce a migration for it."},{"id":"c7","text":"When a person writes the declaration back, Studio shall write it as the same files graview create writes."},{"id":"c8","text":"A checkout built from the files Studio writes back shall pass its own verify."},{"id":"c9","text":"When an agent seat proposes a declaration change, Studio shall show the proposed change to a person."},{"id":"c10","text":"When a person accepts a proposed declaration change in Studio, Studio shall apply it as a mutation to the declaration."}]
tags:
  - "studio"
  - "creator"
  - "schema"
  - "platform"
source: "Nick, 2026-09-12 (/ndx-capture): \"there needs to be a studio/creator mode or something. basically a web ui for the schema/etc that comprise the context graph, and apply a mutation from changes and whatnot\""
priority: "high"
---

A creator mode where the context graph's own declaration — kinds, fields, edges with both readings, acts, rules and their repairs, the policy, the brand, the lenses — is a graph you can see and edit in Graview's own interface, in the browser. The meta-schema is declared with the same defineNode/defineMutation the apps use, so the studio is a Graview app over the declaration: adding a field is an act, renaming a kind is an act, every change is an op with an author, an intent and an inverse, and graview check runs on the result before it is applied. Changes are applied as mutations to the running declaration (a migration where the stored graph needs one), and the result can be written back as code (the scaffold's generator already produces the files) so the studio and the checkout never disagree. This is the seam graview-cloud's app-from-declaration needs, and the natural home for working the declaration with an agent: the seat proposes a kind, the studio shows it, the person accepts it.
