---
id: "19cdba5a-0f0a-493f-b1de-fae92d7b0033"
type: "capability"
title: "The component kit as remote elements, declared once for both sides (FR-69)"
slug: "the-component-kit-as-remote-elements"
statement: "The component kit is declared once as each component's typed properties and events, and both the worker-side remote elements and the host-side receiver policy are derived from that declaration."
criteria: [{"id":"c1","text":"The component kit shall be declared once as each component's typed properties and events."},{"id":"c2","text":"The worker-side RemoteElement classes and the host-side receiver policy shall both derive from the kit's single declaration."},{"id":"c3","text":"If a kit component receives a property or event outside its declaration, the host renderer shall reject it."},{"id":"c4","text":"If an element outside the kit is received, the host renderer shall reject it."},{"id":"c5","text":"If a URL-valued property has a non-https: scheme, the host renderer shall reject it."},{"id":"c6","text":"When a property is added to the kit declaration, the system shall make it available on both the worker side and the host side with no other change."}]
tags:
  - "graview-cloud"
  - "FR-69"
  - "later"
  - "tier-2"
  - "security"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
priority: "low"
---

Spike: ../graview-cloud/docs/spikes/remote-dom-in-widgets.md (Remote DOM in a blob: worker inside Claude's and ChatGPT's widget sandboxes: go-with-conditions). Tier 2 inside chats; not blocking alpha.
