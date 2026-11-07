---
id: "7c58712a-1850-49b6-9a4c-d067eb6844bd"
type: "capability"
title: "Lenses that bind more domains than the examples"
slug: "lenses-that-bind-more-domains-than-the"
statement: "Graview's shipped lenses bind the fields of domains beyond the examples, and SVG shapes drawn as pick targets are announced as buttons."
criteria: [{"id":"c1","text":"When a coverage runs through an intermediate kind, the coverage lens shall compute coverage through a path of edges."},{"id":"c2","text":"The coverage lens shall accept an app's coverage as a binding of the shipped lens."},{"id":"c3","text":"The calendar lens shall accept a boolean field, a status field with done values, or a date field as its done role."},{"id":"c4","text":"The calendar lens shall bind done to a task's status field without a derived field."},{"id":"c5","text":"When an SVG element (g, polygon, circle, rect, path, ellipse, polyline or use) carries a pick target, usePickTargets shall give it role=button."},{"id":"c6","text":"usePickTargets shall keep landmarks from receiving role=button."},{"id":"c7","text":"The graview-lens skill shall tell an author drawing in SVG that the framework sets role and the author sets aria-label."}]
tags:
  - "groundskeeper-feedback"
  - "@graview/primitives"
  - "@graview/react"
  - "skills"
source: "groundskeeper-graview/docs/graview-feedback.md"
priority: "medium"
---

Each of these was hit binding a shipped lens or writing one to the skill: coverage cannot run through a node; the calendar's done role is boolean-only; usePickTargets gives SVG no role; hueFor returns a fraction under a name that says degrees; a group lens is handed one kind's members and the skill never says so; there is no scaffolder for a lens; the figure vocabulary runs out fast.
