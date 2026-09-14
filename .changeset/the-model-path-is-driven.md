---
"@graview/studio": patch
"@graview/tools": patch
---

The model path is driven end to end in a real browser, and the keyless rung offers the way out of a sentence it cannot read.

Every test of the model rung stubbed the responder itself, so nothing had ever checked that a provider's answer reaches the panel at all. `verify-studio.mjs` now runs an OpenAI-compatible provider on localhost and drives the shipping path through it: the config, the adapter, the prompt, the gate, the forms. One loose sentence — "add a Meal kind, with the name of the food and how many people it feeds" — comes back as three editable proposals, the two that need the kind say what they are waiting on, and keeping the kind brings them alive with the name the model used resolved to the node it now means.

That harness immediately found the thing that would have made the whole feature pointless. **A sentence that opens with an instruction is not a question.** The branches that answer questions about the declaration recognised them by the words they contained rather than by what the sentence was doing, so "add a Meal kind, with the name of the food and how many people it feeds" — which contains "kind" and "how many" — was answered with an inventory of the kinds, and answered as a FACT, which takes the turn away from the model entirely. The one sentence most in need of a model was the one guaranteed never to reach it.

**And a dead end now has a door.** The keyless rung reads a handful of sentence shapes and says so when a sentence is not one of them, which is honest and, on its own, leaves a person guessing which phrasing a pattern-matcher wants — when the rung that reads any phrasing is one press away behind the gear. An answer it could not read is marked, and where no model is chosen the turn carries "Let a model read it →", which opens the picker. Where one already is, there is nothing to offer and nothing is offered.

Also: a proposal waiting on another says `Waiting on kind "Meal" — keep the one that makes it first`, rather than the store's own `Edge "of" references missing node`.

Not tested, and worth saying plainly: the on-device rung itself. WebGPU is unavailable to a browser launched on this machine, so WebLLM cannot start here — what is verified is that it fails honestly, naming the reason, with the graph answering in its place.
