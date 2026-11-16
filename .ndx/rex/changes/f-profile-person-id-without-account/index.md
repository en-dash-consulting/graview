---
id: "e03e5dbf-9cb5-4a1b-b374-31428400bb1a"
type: "change"
title: "A profile's person record gets an id of its own, and a migration renames the ones stored"
slug: "f-profile-person-id-without-account"
intent: "A profile's person record is made under an id of its own, tied to its seat where a seat's tie belongs. A store kept by an earlier version is migrated on open: every link, field, op, epoch and archived entry that names one of these people is renamed, so history and undo still read as that person. A host can count what the migration would change, per app, without writing, and run it on staging first. Security and reliability details are in a private brief."
acceptanceCriteria:
  - "A profile's person made by this version is served to another member under an id of its own (test)"
  - "Opening a store kept by an earlier version renames each profile's person in the graph, links, fields, ops, epochs and archive; history still names the person and undo still works (test)"
  - "The migration is idempotent, leaves a store with no profiles as it is, and a run that stopped part way finishes with the same ids (test)"
  - "A dry run (`graview serve --dry-run`, `profilePeopleCount`) counts what would change and writes nothing (test)"
  - "A link from another app to one of these people is renamed with what the first run says (test)"
touches:
  - "83796ab4-ebd4-48f4-ad70-81121f49d17d"
priority: "high"
tags:
  - "graview"
  - "core"
  - "ship"
  - "hq:feature:f-profile-person-id-without-account"
source: "Graview HQ feature:f-profile-person-id-without-account"
---
