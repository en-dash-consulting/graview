---
id: "a810b8c9-b725-484e-a4fc-eb667777f4ce"
type: "change"
title: "graview check knows every act the store derives, leave-alone and allow-tidying among them"
slug: "f-check-knows-tidying-acts-in-grants"
intent: "The store derives leave-alone-<kind> and allow-tidying-<kind>, but graview check refused a grant naming either as one no mutation declares. The checker should know every act the store derives, not just these two."
acceptanceCriteria:
  - "A grant naming every act the store registers for an app is not grant-unknown-mutation (test: check-knows-every-act-the-store-answers)"
  - "A grant naming keep-link or type-text is taken; one naming vote-suggestion, propose-changes or publish is told it gives nothing (test)"
  - "A grant naming an act nobody answers is still refused (test)"
touches:
  - "cdd910b9-7729-4f95-a821-3d59c35edb3b"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "check"
  - "hq:feature:f-check-knows-tidying-acts-in-grants"
source: "Graview HQ feature:f-check-knows-tidying-acts-in-grants"
---
