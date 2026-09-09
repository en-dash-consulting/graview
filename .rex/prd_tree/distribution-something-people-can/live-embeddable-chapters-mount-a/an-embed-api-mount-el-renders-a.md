---
id: "734b926b-c960-4419-8c49-259e958fb6b7"
level: "task"
title: "An embed API: mount(el, …) renders a declared app into any element, without the Shell"
status: "completed"
priority: "high"
startedAt: "2026-09-09T19:46:59.882Z"
completedAt: "2026-09-09T19:54:13.385Z"
endedAt: "2026-09-09T19:54:13.385Z"
acceptanceCriteria: []
description: "A public entry — @graview/embed, or an entry of @graview/react — that mounts an app (declaration + seed + brand + lenses + pages registry + principal) into an element and returns { setFace, setStop, unmount }. Faces: scene, graview (altitude), pages (routed, at the element's width). In-memory adapter by default. What the framework lacks and this must add: a scene that sizes to its container rather than the viewport (the 100vh column and the fixed-position rails assume a window), theme tokens scoped to the mount element (themeCss writes document-level custom properties today), fonts declared by the brand loaded without the host page's help, and no assumption that window.location is the app's (UrlSync off, stops passed in). Covered by a test that mounts a chapter into a detached element and switches faces."
lastModified: "2026-09-09T19:54:13.397Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
