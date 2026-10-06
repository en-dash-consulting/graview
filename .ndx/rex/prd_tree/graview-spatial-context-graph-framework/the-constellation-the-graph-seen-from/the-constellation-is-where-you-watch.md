---
id: "88355b50-8061-4903-8bd8-c49cefe929ec"
level: "task"
title: "The constellation is where you watch the system work"
status: "completed"
priority: "high"
startedAt: "2026-08-31T02:20:34.995Z"
completedAt: "2026-08-31T02:32:11.416Z"
endedAt: "2026-08-31T02:32:11.416Z"
resolutionType: "code-change"
resolutionDetail: "Activity is derived from the op log into per-node marks held by the provider; the scene resolves them onto whatever is drawn, the theme draws them with animations that run once, and read-only tool calls now report what they looked at. Ten criteria verified in a live browser by scripts/verify-watching.mjs."
acceptanceCriteria:
  - "An edit lands visibly on the kind it touched, live, without opening a panel"
  - "A rule beginning to fail is visible from the overview"
  - "Directed, co-edited and autonomous changes are distinguishable — the log has author and intent, so nothing new is invented to tell them apart"
  - "What an agent READ is visible as well as what it wrote, since that is the half a diff cannot show"
  - "Watching costs nothing when nothing is happening: no animation loop on a quiet graph"
description: "The strongest argument for the overview is not orientation, it is WATCHING. An agent turn, a rule firing, two people editing at once — all of it is currently a rail of text in the corner, which is the wrong medium for something happening across a whole graph.\n\nFrom outside the plane stack, activity has somewhere to happen: a kind lights where an edit landed, an edge pulses where a relation was made or broken, a flag appears where an invariant started failing. The op log already carries author, intent, reads and writes, so every one of these is derivable — including the distinction the rail cannot currently draw between a change someone directed and one an agent made on its own."
---
