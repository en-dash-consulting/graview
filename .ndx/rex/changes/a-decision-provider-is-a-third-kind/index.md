---
id: "a5636b6f-44d3-409c-9311-03e59ec9957f"
type: "change"
title: "A decision provider is a third kind, and the declaration should say so"
slug: "a-decision-provider-is-a-third-kind"
intent: "intelligence[].kind is \"graph\" | \"llm\" | \"external\". Jev is none of them: it does not write prose and cannot propose an arbitrary call, it answers typed questions and returns a confidence. Add \"decision\" so every derived surface can tell what it may ask — a chat seat must not offer it, a field that wants filling should. graview check should refuse a decision provider given mutations it could not possibly call, and graview describe should read it out."
acceptanceCriteria:
  - "intelligence[].kind accepts \"decision\", and graview describe reads one out"
  - "graview check refuses a decision provider declared with mutations it cannot call"
  - "A chat seat does not offer a decision provider, because it has no prose to give"
touches:
  - "73f9006d-e4fd-4660-9bb7-6f9e46e15b65"
priority: "high"
---
