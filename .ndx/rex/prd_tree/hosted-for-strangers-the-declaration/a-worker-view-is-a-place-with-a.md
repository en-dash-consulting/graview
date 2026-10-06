---
id: "c45e1f45-05e1-4570-82c7-7d2893fa8dbf"
level: "feature"
title: "A worker view is a place, with a manifest the host enforces (FR-91)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-91"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "A manifest { name, title?, attach: kind | \"home\", cardinality, reads?, acts? }; props are the viewer's sight limited to reads, with label filled; a titled view is a named place on both faces; attach home makes it the home body; theme tokens in props, pushed again on toggle"
  - "The LifeLogics package lens as a worker view reads offers and includes, is a place titled 'The packages' on both faces, lists each package's offers; an unseen offer is absent; toggling the scheme restyles it"
description: "FR-85, FR-86 and FR-87 folded in for workers."
lastModified: "2026-10-05T20:03:32.950Z"
---
