---
id: "73f9006d-e4fd-4660-9bb7-6f9e46e15b65"
level: "feature"
title: "Jev: a provider that answers the questions the declaration already types"
status: "pending"
priority: "high"
acceptanceCriteria: []
description: "Jev (TypeSafe AI, POST https://api.typesafe.ai/v1/systemone, model jev-latest) is not an LLM: unstructured state in, TYPED probabilistic decisions out. It answers only in values you declared — Choice over named options, Score over an ordered rubric, Noul as a truth — so an invalid or hallucinated answer is not unlikely, it is impossible. Input is $0.042/M and output is unmetered. That combination is the one this framework has been shaped for without having anything to point it at: a Graview declaration ALREADY types every question worth asking. A z.enum field is a Choice whose criteria are its own options; a nodeRef arg is a Choice over the live nodes of that kind; an invariant is a Noul; an ordinal field is a Score. None of it needs authoring, the way affordances and agent tools need none. Verified against the real API: Groundskeeper's own surface enum came back as a Choice with confidence 1.0, an invariant-shaped question as a noul of 0.57, and an effort rubric as a score of 1.21 with its legend. And because answers are typed and cheap, the parse-and-refuse layer an LLM needs disappears and fan-out becomes ordinary: score every concern against every practice and you have rebuilt the coverage matrix, 440 questions for a fraction of a cent."
lastModified: "2026-09-19T04:14:42.139Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A decision provider is a third kind, and the declaration should say so](./a-decision-provider-is-a-third-kind.md) | completed |
| [Chains: a run is a sequence of typed asks over the graph, declared not scripted](./chains-a-run-is-a-sequence-of-typed.md) | completed |
| [Confidence is a first-class answer, not a number in a log](./confidence-is-a-first-class-answer-not.md) | completed |
| [Derive the questions from the declaration rather than authoring them](./derive-the-questions-from-the.md) | completed |
| [Groundskeeper proves it on the matrix it already draws](./groundskeeper-proves-it-on-the-matrix.md) | pending |
| [Loops: act, re-judge, act again, and know when to stop](./loops-act-re-judge-act-again-and-know.md) | in_progress |
| [One switch, four rungs — and a rung that says what it cannot do](./one-switch-four-rungs-and-a-rung-that.md) | completed |
| [The provider itself: one call, many questions, honest about failure](./the-provider-itself-one-call-many.md) | completed |
