---
id: "3dce0f3d-bcf0-4db9-b79c-869587e448a2"
type: "capability"
title: "A document can declare computed facts of the whole graph"
slug: "a-document-can-declare-computed-facts"
statement: "A document can declare computed facts of the whole graph, in a document-level computed section written in the rule language and held to a budget, and those facts read the same across every surface."
criteria: [{"id":"c1","text":"A document-level computed section shall accept expressions written in the rule language."},{"id":"c2","text":"The document-level computed section shall evaluate its expressions within a budget."},{"id":"c3","text":"When a document declares a computed fact of the whole graph, blocks, the scene, Pages and describe/MCP shall each read that same fact."},{"id":"c4","text":"graview check shall judge the document-level computed facts."}]
tags:
  - "n-dx"
  - "document"
  - "computed"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #205: a document's top-level computed is read anywhere as fact('<name>'), worked out over the reader's graph under the language's budget, listed by describe and describe_place on the home, worked out by factValues, and judged by graview check as a computed field (fact-unknown for a fact that is not there)."
---

'The whole product map is proposed' is decided in a face with every(n => n.proposed); computed is per kind only, so the scene and MCP cannot say the same thing.
