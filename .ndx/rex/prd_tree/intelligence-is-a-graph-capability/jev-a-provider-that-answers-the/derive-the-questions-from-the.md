---
id: "1b750f27-d08d-4f10-b3d1-28bfb34eb53d"
level: "task"
title: "Derive the questions from the declaration rather than authoring them"
status: "completed"
priority: "critical"
blockedBy:
  - "a5636b6f-44d3-409c-9311-03e59ec9957f"
startedAt: "2026-09-19T05:12:54.940Z"
completedAt: "2026-09-19T05:18:52.536Z"
endedAt: "2026-09-19T05:18:52.536Z"
resolutionType: "code-change"
resolutionDetail: "questions.ts in @graview/tools with derived Choice/Noul/Score questions from enums, nodeRefs, booleans, bounded numbers and invariants; nodeRef describe fix in core"
acceptanceCriteria:
  - "A z.enum field yields a Choice whose criteria are its options and whose instructions are its description"
  - "A nodeRef argument yields a Choice over the live nodes of that kind, labelled by labelOf"
  - "An invariant yields a Noul whose true-branch meaning is the rule, and whose repairs are the follow-on Choice"
  - "No question is written by hand anywhere in an app, the way no agent tool is"
description: "jevQuestionsFor(app, kind | mutation | field): a z.enum becomes a Choice whose criteria are its options and whose instructions are the field's description; a nodeRef arg becomes a Choice over the live nodes of that kind, labelled by labelOf; z.boolean and an invariant become a Noul with its own repair as the true-branch meaning; an ordinal or a declared rubric becomes a Score. Nothing hand-written, for the same reason the agent tool surface is nothing hand-written — two descriptions of the same domain will disagree."
lastModified: "2026-09-19T05:18:52.555Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
