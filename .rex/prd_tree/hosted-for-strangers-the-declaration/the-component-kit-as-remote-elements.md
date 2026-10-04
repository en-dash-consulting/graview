---
id: "19cdba5a-0f0a-493f-b1de-fae92d7b0033"
level: "feature"
title: "The component kit as remote elements, declared once for both sides (FR-69)"
status: "pending"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-69"
  - "later"
  - "tier-2"
  - "security"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
acceptanceCriteria:
  - "Tier 1's kit (FR-03) is declared once as each component's typed properties and events; the worker-side RemoteElement classes and the host-side receiver policy both derive from it"
  - "For every kit component, a property or event outside its declaration, an element outside the kit, and a URL-valued property with a non-https: scheme are each rejected by the host renderer (a test per case)"
  - "Adding a property to the declaration makes it available on both sides with no other change"
description: "Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha."
lastModified: "2026-10-04T20:34:34.493Z"
---
