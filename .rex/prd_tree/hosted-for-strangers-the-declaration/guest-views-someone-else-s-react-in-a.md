---
id: "87fe051f-d5dd-4c45-8ad0-704c7eca9c5c"
level: "feature"
title: "Guest views: someone else's React in a sandboxed frame that can only ask, under the viewer's seat"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-04"
  - "security"
source: "Graview Cloud FR-04, 2026-10-02"
acceptanceCriteria:
  - "A guest can render and request acts but never receives the store, a token or an unseen node"
  - "A guest's requested act is refused by policy exactly as the viewer's click would be, and is attributed to the view in the rail"
  - "A hostile guest test (fetch, top navigation, forged messages, flood) changes nothing and is rate-limited"
description: "WHAT IS THERE NOW: views and embeds run same-document with full store access (useGraview gives the store and the principal); @graview/embed mounts with createRoot, no iframe or shadow DOM. MISSING: custom code from an author the viewer does not trust. POSITION: a guest-view protocol — a view registered as a URL rendered in <iframe sandbox=\"allow-scripts\">; over a MessageChannel handed in at load the host pushes ViewProps already filtered by the viewer's sights and the guest may ask for an act by name with args, a navigation, or a size; the host applies acts through store.apply under the viewer's principal with via view:<name>, rate-limited; a small @graview/guest SDK for React and vanilla. Where the frame is served from is the host's business."
lastModified: "2026-10-02T20:55:08.587Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
