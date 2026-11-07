---
id: "98f1db14-6452-4cbc-878c-ff4f968b9c2a"
type: "change"
title: "Presence speaks one dialect and forgets the gone; seats can be added after mount without offering to sit as someone else"
slug: "presence-speaks-one-dialect-and"
intent: "Three findings from Cloud's shell. Presence participant keys are 'kind:id:session' in the framework but nothing names that format for a host, and the framework applies no TTL to a participant list that arrives from a server. Passing more than one seat to embed (Cloud passes every member so the rail can name them) turns on an 'As …' seat switcher and 'Sit as somebody else' — in a hosted app the seat is who you signed in as, not a choice. And seats cannot change after mount, so an agent who first acts after the page opened shows as an id until remount. POSITION: export the participant key format; TTL remote presence; separate 'names the app may show' (a people directory, updatable) from 'seats you may sit in' (none, for a hosted reader)."
acceptanceCriteria:
  - "A host can pass a people directory that names authors and updates after mount"
  - "With no extra seats offered, no seat switcher or 'sit as somebody else' appears"
  - "Remote participants older than the TTL disappear"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-13"
source: "Graview Cloud build, 2026-10-02"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "Presence a host can add to: kind, name, onBehalfOf, announce for socketless visitors, and welcome.participant (FR-47)" (5e600ef7-20bf-4fb3-8223-ba49545c37aa).
