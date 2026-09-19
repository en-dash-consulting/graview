---
"@graview/tools": patch
---

Loops: act, re-judge, act again, and know when to stop. `runLoop(store, loop, { decide, … })` reads `store.violations()`, takes the first violation with a repair it can take, asks which repair from the closed set the rule names (a Choice — an invented repair is impossible; a violation with one ready repair is not asked at all), applies it as the declared act under the loop's one batch and its own agent seat, re-judges, and goes again. Every turn is attributed and undoable: one undo takes the whole loop back.

It stops for a reason it can say, as a sentence in `stopped.said`: nothing left; not sure enough of the repair (the question is handed to a person at its node, with the repairs as presses); a state the graph has already been in (the loop is going in a circle); the budget of turns, questions or dollars spent; the provider failed; the policy refused. `replyFromLoop(result)` speaks it as the seat's own reply, and every visit to a violation's node is announced through the seat's existing `onCall` path as a read of that node — and the stop as a `stop` call carrying the sentence — so the Activity rail shows which node the loop is at and why it stopped, with no second reporting path.
