---
id: "f8da2a4b-5370-4f05-ba05-6df07ca192ad"
type: "capability"
title: "A connect that replaces replaces the link it should (FR-156)"
slug: "a-connect-that-replaces-replaces-the"
statement: "A declared act with connects and replaces: true severs the link a record already has and makes the new one, rather than being refused for a missing edge."
criteria: [{"id":"c1","text":"When a declared act with connects and replaces: true, on a relation of one, is run on a record that already has a link of that relation, the act shall sever that link and make the new one as one act, one batch and one undo."},{"id":"c2","text":"The framework shall sever the existing link and make the new one when the act runs by apply, applyAll, preview, previewAll, the act's tool and preview_mutation."},{"id":"c3","text":"When the relation is declared from the far kind, is a relation of many, replaces names several relations, or two acts on one relation run in a batch, each act shall do what replaces says."},{"id":"c4","text":"The framework shall keep the refusals, their reasons and the permissions of a connects act unchanged by replaces."}]
tags:
  - "graview-cloud"
  - "FR-156"
  - "document"
  - "acts"
source: "Graview Cloud, 2026-10-09 (found on production 0.1.18, a private pricing-model app, via the Claude connector)"
priority: "high"
resolution: "Fixed in #184: a declared act severs a link once however many of its effects ask it to."
---

replaces: true on a connects act was refused "Cannot remove missing edge" whenever the record already had the link it was meant to replace: replaces and the cardinality-one connect each planned the same removal from the graph as it stood before the act.
