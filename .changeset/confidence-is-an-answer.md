---
"@graview/tools": patch
"@graview/primitives": patch
---

Confidence is a first-class answer, not a number in a log. `PlannedCall.confidence` (0–1) is how sure the proposer was, carried on the call rather than written into `why`, so the same number travels wherever the call does. A run's every answer reaches a surface with its confidence and full distribution (`Answered`); an answer that came back split — the top two options within `splitWithin` of each other, "turf 0.5, bed 0.45" — or below the `floor` is not applied and not dropped but OFFERED: an `OfferedQuestion` naming the node it is about (id and label), the question in the declaration's words, why it is asked, and each option with its probability and the call it would be. `offerOf(answer)` is the rule. A confident answer is still a plan before it is a change.

Offered questions travel the seat's own reply — `ChatReply.questions` — and `replyFromRun(result)` speaks a whole run that way: what it asked, the confident calls as proposals, the rest as questions, a refusal or a stop said out loud. The chat panel stands each question at its node, "Back Lawn: Which surface?", with the options as presses that land through the same attributed, undoable path a proposal does. `PlanReview` reads a plan whose calls carry a confidence least sure first, with the number beside each row, and still applies it in the plan's own order.
