---
id: "ea938839-1378-41d7-9f56-3363a961940f"
type: "capability"
title: "A kind can say which field is its natural time and which its author"
slug: "a-kind-can-say-which-field-is-its"
statement: "A kind can declare which of its fields is its natural time and which its author, and the product orders and checks records by those declared roles."
criteria: [{"id":"c1","text":"The document and defineNode shall accept a per-kind roles declaration of the form { when, who }."},{"id":"c2","text":"ListPage, timelines, glance and large-list ordering shall read a kind's declared roles to order its records."},{"id":"c3","text":"If a kind's roles name a field that is missing or whose type does not fit the role, graview check shall refuse the declaration."}]
tags:
  - "n-dx"
  - "document"
  - "fields"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #205: kinds.<kind>.fieldRoles in the document; lists open newest first by when, a glance leads with who and when, a timeline or calendar binding no start draws at when; graview check refuses field-role-missing-field and field-role-ill-typed."
---

fieldRoles is not a document key at 0.1.20, so a datetime cannot be declared a record's natural time nor a string its author; commits have no declared order and a timeline binds its date in the lens.
