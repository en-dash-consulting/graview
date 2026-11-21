---
id: "18436ffc-2601-47a7-948f-f44940ff2c8a"
type: "change"
title: "0.2.10: Every record says when it was made and last changed, and by whom, in lists, templates, rules and jobs, kept as each seat may see them."
slug: "release-0-2-10"
intent: "What 0.2.10 shipped, recorded after the release from its entry in apps/site/releases.json. The work was tracked on Graview HQ and in the change of the same name: f-record-last-touched (#663, #667); batch #665."
acceptanceCriteria:
  - "**Every record keeps createdAt, createdBy, updatedAt and updatedBy**, stamped by every op that touches it, through a snapshot, a checkpoint, the archive and an export."
  - "**Lists, templates, rules, computed values and jobs read them** like any field, in the app's own time zone."
  - "**They are kept as each seat may see them**: a seat from whom anything is kept is told none of the four, and a judgment that would read them for it is not made."
  - "graview check refuses a kind that declares one of the four names (touched-field-taken) and warns touched-read-kept."
shippedIn: "0.2.10"
source: "apps/site/releases.json"
tags:
  - "release"
  - "0.2.10"
---
