---
id: "c3cd621b-8928-49fd-945a-edfd3100e439"
type: "change"
title: "The studio says the host refused when it did: onApply can answer with findings (FR-60)"
slug: "the-studio-says-the-host-refused-when"
intent: "onApply returns nothing, so with documentFindings present the studio still says 'The checker is happy. Handed to the host to keep' while the host previews nothing."
acceptanceCriteria:
  - "onApply may return { ok: false, findings }; the studio then shows those findings in its applied panel and stays open with the edits intact"
  - "The studio no longer says 'Handed to the host to keep' when the host refused"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-60"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A host's refusal can say its own sentence, and an Apply with no edits says so before the host is asked (FR-65)" (75213918-52dd-423f-b641-4776b56c0474).
