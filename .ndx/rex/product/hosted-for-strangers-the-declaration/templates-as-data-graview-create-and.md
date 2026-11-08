---
id: "b7202ccb-5bd7-41e7-a044-46571520854e"
type: "capability"
title: "Templates as data: graview create and graview apply take a template made anywhere"
slug: "templates-as-data-graview-create-and"
statement: "Graview scaffolds a self-hosted TypeScript project from a graview-template made anywhere, and instantiates a template into a live store with its setup recorded as attributed operations."
criteria: [{"id":"c1","text":"When a user runs graview create --template with a template file, the CLI shall make a project whose verify passes."},{"id":"c2","text":"When a user runs graview create --template with a template file, the CLI shall make a project whose graview describe matches the template's document."},{"id":"c3","text":"When a user runs graview apply --template, the CLI shall run the template's setup acts as one attributed batch."},{"id":"c4","text":"When a user runs graview apply --template, the CLI shall make the batch of setup acts undoable as one."}]
tags:
  - "graview-cloud"
  - "FR-08"
source: "Graview Cloud FR-08, 2026-10-02"
priority: "medium"
---

WHAT IS THERE NOW: @graview/core/scaffold generates one project shape in-process. MISSING: a template someone made and shared in a hosted service scaffolding a self-hosted project, which is the anti-lock-in claim for templates. POSITION: graview create --template <file|url> scaffolds a TS project from a graview-template (document + setup questions + seed, format at ../graview-cloud/docs/templates.md) and graview apply --template instantiates one into a live store, setup as attributed ops.
