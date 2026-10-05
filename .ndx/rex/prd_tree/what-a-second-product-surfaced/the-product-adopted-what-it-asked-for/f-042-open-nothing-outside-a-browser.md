---
id: "51bbef5a-04e7-4654-ac01-8971c6708716"
level: "task"
title: "F-042 · Open — nothing outside a browser can see what is drawn, and no app can fix it"
status: "completed"
priority: "medium"
startedAt: "2026-09-19T07:13:40.061Z"
completedAt: "2026-09-19T07:15:03.688Z"
endedAt: "2026-09-19T07:15:03.688Z"
resolutionType: "code-change"
resolutionDetail: "--views <module> on describe/check/docs; note reworded to say it is the design"
acceptanceCriteria: []
description: "Every graview describe run ends by asking for defineApp({ views }). No app can pass one: the registry is React and the declaration lives in the domain tier, which the skills forbid React in. Suggest a --views ./dist/ui/views.js flag, or reword the note so it stops reading as neglect."
lastModified: "2026-09-19T07:15:03.701Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
