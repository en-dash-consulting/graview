---
id: "98f1db14-6452-4cbc-878c-ff4f968b9c2a"
level: "task"
title: "Presence speaks one dialect and forgets the gone; seats can be added after mount without offering to sit as someone else"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-13"
source: "Graview Cloud build, 2026-10-02"
acceptanceCriteria:
  - "A host can pass a people directory that names authors and updates after mount"
  - "With no extra seats offered, no seat switcher or 'sit as somebody else' appears"
  - "Remote participants older than the TTL disappear"
description: "Three findings from Cloud's shell. Presence participant keys are 'kind:id:session' in the framework but nothing names that format for a host, and the framework applies no TTL to a participant list that arrives from a server. Passing more than one seat to embed (Cloud passes every member so the rail can name them) turns on an 'As …' seat switcher and 'Sit as somebody else' — in a hosted app the seat is who you signed in as, not a choice. And seats cannot change after mount, so an agent who first acts after the page opened shows as an id until remount. POSITION: export the participant key format; TTL remote presence; separate 'names the app may show' (a people directory, updatable) from 'seats you may sit in' (none, for a hosted reader)."
lastModified: "2026-10-02T22:26:19.666Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
