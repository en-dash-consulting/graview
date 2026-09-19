---
"@graview/core": patch
"@graview/tools": patch
---

The questions a decision provider is asked are derived from the declaration, never authored. `questionsForKind(store, kind)` turns each settable field with a typed answer into one question in the wire shape a decision provider takes: a `z.enum` is a Choice whose criteria are its options and whose instruction is the field's own description; a `z.boolean` is a truth; a bounded integer is a Score over its levels; prose asks nothing. Each field question names the act that writes the field and the argument the answer fills. `questionsForMutation(store, act, given)` asks the arguments `given` has not settled — a `nodeRef` is a Choice over the live nodes of that kind, labelled by `labelOf`, the id as the option name. `questionsForInvariant(store, rule, violation?)` is a truth whose "yes" is the rule in its own words and, where the closed set has more than one member, a follow-on Choice over the repairs — the violation's ready repairs when the store has judged, the rule's declared repairs when it has not — each option naming the call it means. `nodeState(store, id)` is the state a question is asked over: the node as a card shows it, joined things by label. `allQuestions(store)` is the whole derived surface.

Also: a described node reference is still a node reference. `nodeRef(["concern"]).describe("…")` clones the schema, and the registry was keyed on the instance, so the natural way to write the question lost the kind — no picker, no candidates. The registry now keys on the def as well, which the clone shares.
