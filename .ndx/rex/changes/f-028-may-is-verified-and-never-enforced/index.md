---
id: "5acc1e9f-f845-44d1-bd89-079717493db5"
type: "change"
title: "F-028 · may is verified and never enforced"
slug: "f-028-may-is-verified-and-never-enforced"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-028. An agent principal with the keeper role can log-work through store.apply whatever the surveyor was declared able to do. validateProposals honours may only on the tool-runtime path."
acceptanceCriteria:
  - "store.apply looks up intelligence[author.id].may when author.kind === 'agent' and refuses an act outside it with a policy-style sentence"
  - "A test: an agent principal declared with may: ['stake-out-zone'] is refused 'log-work' by the store, with the sentence naming the provider"
  - "Groundskeeper's assertMay can be deleted and its test still passes"
touches:
  - "e6c7337e-197d-46d2-b4f7-a70e535f0851"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
