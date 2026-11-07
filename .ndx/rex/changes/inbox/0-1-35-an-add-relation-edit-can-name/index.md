---
id: "ba2f6434-e66a-47e3-af36-d7480da48d64"
type: "change"
title: "0.1.35 · An add-relation edit can name another app's kind"
slug: "0-1-35-an-add-relation-edit-can-name"
intent: "Roadmap f-add-relation-far-kind. packages/core/src/document/edit.ts addRelation checks every to against this.doc.kinds and refuses @<address>/<kind>, so only a whole document can declare a cross-app relation (0.1.30 f-cross-app-relations); Cloud's builder, propose_change with edits and the studio cannot."
acceptanceCriteria:
  - "editDocument with add-relation to [\"@nick/house/house\"] gives a document that checks clean, with a test that fails on 0.1.34"
  - "a mixed or two-app to is refused with the checker's own finding (linked-mixed, linked-apps), and rename-relation / remove-relation work on a far relation"
  - "the said sentence names the far kind as people say it; the studio and propose_change can make the relation"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "The studio hands a document-compiled app back as a document, and editDocument can set a glance (FR-54)" (d1052c83-a06c-473d-8fb2-afa0aeae5f2b).
