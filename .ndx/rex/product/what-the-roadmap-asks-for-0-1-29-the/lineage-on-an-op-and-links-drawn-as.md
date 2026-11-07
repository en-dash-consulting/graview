---
id: "070f2fa5-dca0-4c57-b8e3-b9ffa04c9182"
type: "capability"
title: "Lineage on an op, and links drawn as provisional until a person touches them (FR-172)"
slug: "lineage-on-an-op-and-links-drawn-as"
statement: "An op or its Author may carry lineage, and a link made by an op of confidence below 1 is drawn as provisional until a person touches it."
criteria: [{"id":"c1","text":"An op (or its Author) shall be able to carry lineage of the form { basis: string; confidence?: number; model?: string }, keep it in the log and on the wire, and show it on the history line and the record's card."},{"id":"c2","text":"While a link's making op carries confidence below 1 and no op by a person has touched the link, the Scene shall draw the link dashed, Pages shall draw it with a small mark, and the basis shall appear on hover or long-press."},{"id":"c3","text":"When a person touches a provisional link, by an accept act or any edit, the link shall become an ordinary link."},{"id":"c4","text":"When an op carrying lineage is undone, the undo shall keep the undone op's lineage so a host can read 'do not make this again'."}]
tags:
  - "roadmap"
  - "f-op-lineage"
  - "FR-172"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "Shipped on feat/fr-172-op-lineage: an op carries a checked `lineage` (on the op, not the Author) in the log, on the batch and on the wire, said on history lines and a record page; a link made at confidence below 1 by anyone but a person is provisional (dashed in the scene with its basis on hover and in its acts, an \"unsure\" mark on Pages) until a person's `keep-link` or removal, read through `@graview/core/provenance`; an undo keeps the declined op's lineage as `undoneLineage`."
---

Author is kind, id, session, name, onBehalfOf; nothing says what a change was based on or how sure its maker was. Cloud's tidying actor needs to show why and to draw its links quieter until accepted. Roadmap f-op-lineage; unblocks f-auto-lineage.
