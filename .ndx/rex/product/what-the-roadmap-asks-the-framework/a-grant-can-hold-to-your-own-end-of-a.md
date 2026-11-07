---
id: "9ee9a3be-5932-4cf9-98e8-69771dabb60e"
type: "capability"
title: "A grant can hold to your own end of a link"
slug: "a-grant-can-hold-to-your-own-end-of-a"
statement: "A grant on a connect or sever can require that the record at the other end of the link belongs to the principal, so a principal's own end is held to rather than only the subject."
criteria: [{"id":"c1","text":"When a grant on a connect or sever requires the record at the other end to be the principal's own, the store shall refuse the act if the other end is not the principal's own."},{"id":"c2","text":"When the store refuses the other end of a link, it shall give the refusal as a sentence."},{"id":"c3","text":"While a grant requires the other end of a link to be the principal's own, the seat and the agent tools shall narrow the acts they offer to match."},{"id":"c4","text":"If a grant puts the own-end condition on an act that has no link, graview check shall refuse it."}]
tags:
  - "roadmap"
  - "f-own-end-grants"
source: "Graview Roadmap: f-own-end-grants"
priority: "high"
resolution: "Shipped in #234: `ownEnd: true` on a grant holds a connect or sever to the seat's own far end; the store refuses with a sentence, the strip narrows to the seat's own, and check says grant-own-end-without-link."
---

self covers only the subject; a voter can take back anyone's vote.
