---
id: "87fe051f-d5dd-4c45-8ad0-704c7eca9c5c"
type: "capability"
title: "Guest views: someone else's React in a sandboxed frame that can only ask, under the viewer's seat"
slug: "guest-views-someone-else-s-react-in-a"
statement: "A guest view is a view registered as a URL and rendered in a sandboxed frame that receives only what the viewer may see and can only ask the host for acts, navigations or sizes, all under the viewer's seat."
criteria: [{"id":"c1","text":"The host shall render a guest view in an iframe with sandbox=\"allow-scripts\" and connect it through a MessageChannel handed in at load."},{"id":"c2","text":"The host shall push to a guest view ViewProps already filtered by the viewer's sights."},{"id":"c3","text":"A guest view shall never receive the store, a token or a node the viewer does not see, while it can still render and request acts."},{"id":"c4","text":"When a guest view asks for an act by name with args, a navigation or a size, the host shall handle the request."},{"id":"c5","text":"When a guest view requests an act, the host shall apply it through store.apply under the viewer's principal with via view:<name>."},{"id":"c6","text":"When a guest view requests an act that policy would refuse the viewer's own click, the host shall refuse it in the same way."},{"id":"c7","text":"When a guest view's requested act is applied, the rail shall attribute it to the view."},{"id":"c8","text":"The host shall rate-limit the requests a guest view makes."},{"id":"c9","text":"If a guest view attempts a fetch, a top navigation, forged messages or a flood of requests, the host shall leave the app unchanged and rate-limit the guest."},{"id":"c10","text":"The @graview/guest SDK shall let a guest view be written for React and for vanilla JavaScript."}]
tags:
  - "graview-cloud"
  - "FR-04"
  - "security"
source: "Graview Cloud FR-04, 2026-10-02"
priority: "medium"
---

WHAT IS THERE NOW: views and embeds run same-document with full store access (useGraview gives the store and the principal); @graview/embed mounts with createRoot, no iframe or shadow DOM. MISSING: custom code from an author the viewer does not trust. POSITION: a guest-view protocol — a view registered as a URL rendered in <iframe sandbox="allow-scripts">; over a MessageChannel handed in at load the host pushes ViewProps already filtered by the viewer's sights and the guest may ask for an act by name with args, a navigation, or a size; the host applies acts through store.apply under the viewer's principal with via view:<name>, rate-limited; a small @graview/guest SDK for React and vanilla. Where the frame is served from is the host's business.
