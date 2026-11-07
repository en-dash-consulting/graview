---
id: "734b926b-c960-4419-8c49-259e958fb6b7"
type: "change"
title: "An embed API: mount(el, …) renders a declared app into any element, without the Shell"
slug: "an-embed-api-mount-el-renders-a"
intent: "A public entry — @graview/embed, or an entry of @graview/react — that mounts an app (declaration + seed + brand + lenses + pages registry + principal) into an element and returns { setFace, setStop, unmount }. Faces: scene, graview (altitude), pages (routed, at the element's width). In-memory adapter by default. What the framework lacks and this must add: a scene that sizes to its container rather than the viewport (the 100vh column and the fixed-position rails assume a window), theme tokens scoped to the mount element (themeCss writes document-level custom properties today), fonts declared by the brand loaded without the host page's help, and no assumption that window.location is the app's (UrlSync off, stops passed in). Covered by a test that mounts a chapter into a detached element and switches faces."
touches:
  - "f59ea8e1-68bf-4320-b226-96db703ab81b"
priority: "high"
---
