---
id: "53fdea79-6a0d-4b38-8bd9-547ba8a51d5e"
type: "change"
title: "0.1.39 · FR-187: A hosted page opened on a draft view, so a proposal can be seen before it is kept"
slug: "0-1-39-fr-187-a-hosted-page-opened-on"
intent: "Roadmap f-draft-view-page (FR-187, next): Cloud pictures describe_place through Browser Rendering but can picture a proposed view only after applying it."
acceptanceCriteria:
  - "mount (and the hosted page) take a draft view, unsaved, for the current seat (e.g. mount({ draftView: { manifest, source } }) or a host-served one-time draft id)"
  - "it is drawn where it attaches (home, a kind's list, a record) and marked as a draft, as /~draft marks a drawn panel; nothing is kept when the page closes"
  - "a test and a harness picture a proposed view before it is kept"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on d3f4a8c2-0000-0000-0000-000000000000.
