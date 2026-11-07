---
id: "6ad5b5bf-31b8-463e-983c-fea7ad8e2438"
type: "capability"
title: "A host that keeps the declaration chooses who sees the studio (FR-59)"
slug: "a-host-that-keeps-the-declaration"
statement: "A host that keeps the declaration chooses who sees the studio, overriding the app's own policy."
criteria: [{"id":"c1","text":"When a host passes studio: { onApply, offered: true } or a may predicate to StudioPlace, the studio place shall use that value instead of maySeeTheStudio to decide who sees the studio."},{"id":"c2","text":"When a host passes studio: { onApply, offered: true } or a may predicate to the embed's mount, the embed shall use that value instead of maySeeTheStudio to decide who sees the studio."},{"id":"c3","text":"When the host offers the studio and the app's policy is left on the store, the studio shall show data-testid='studio' to an editor whom no grant gives '*' on the vendors fixture."}]
tags:
  - "graview-cloud"
  - "FR-59"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "medium"
---

maySeeTheStudio judges only by the app's own policy; Cloud has already decided who may build, and today hands the embed a store with no policy to get round it.
