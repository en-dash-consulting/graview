---
"@graview/tools": patch
"@graview/studio": patch
---

A model gets every change to interpret, with the graph's own reading handed up as a starting point.

The ladder had one rule: a grounded answer outranks any model, because a small local model asked who can play left back will fluently invent a goalkeeper. That is right about FACTS and wrong about everything else — and the floor was marking both the same way. A reading of what somebody wants CHANGED came back marked grounded too, so choosing a model changed nothing at all about the turns a model is actually better at. Speaking loosely is the entire point of having one: "add details to Meal, the name of the food and the number of people it can feed" is two fields in one sentence, and a pattern-matcher can only ever see one of them.

So a fact and a reading are now different things. What kinds there are, what an act writes, who may take it, which kinds have no figure, what is broken and what the rules themselves say repairs it — those are facts, and no rung may replace one with a guess about the same fact. Everything that interprets a sentence as a change is a reading: it is the answer when no model is chosen, and when one is, it goes UP to the model as a starting point — keep it, correct it, or split it into the several acts the sentence described. What the model may not do is come back with less: an answer with no proposals never replaces a reading that had them, and a model that cannot be reached falls back to the reading with the reason attached.

The prompt grew the two things it was missing. It listed the acts and never the things, so a model asked to add a field to Meal answered `{"kind": "Meal"}` and hoped — it now sees what is in the graph, by name, bounded per kind (and `resolveProposal` turns whichever name it picks into the id). And it is told plainly that several proposals are welcome, one per distinct change, which is what makes decomposition possible at all.
