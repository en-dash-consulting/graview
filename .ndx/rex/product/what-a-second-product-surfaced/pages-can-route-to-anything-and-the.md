---
id: "63bcc889-264e-4b44-bc30-5d1e0ed7300b"
type: "capability"
title: "Pages can route to anything, and the shell passes the responder through"
slug: "pages-can-route-to-anything-and-the"
statement: "An app adds its own routes to the derived pages with a registry call and hands the Shell chat panel its own responder, and the routed face renders the same links under a basename in tests as in a browser."
criteria: [{"id":"c1","text":"When an app calls registry.route(path, Component), PagesApp shall render the component inside the shell surface like any other page."},{"id":"c2","text":"When a routed page asks to appear in the navigation, PagesApp shall list it in the derived nav."},{"id":"c3","text":"When an app passes a responder to Shell, Shell shall hand it to the chat panel, which shall answer through it."},{"id":"c4","text":"While PagesApp renders with an initialPath, PagesApp shall give the MemoryRouter the basename and prefix the initialPath with it."},{"id":"c5","text":"When PagesApp renders in memory mode under basename /pages, a Link to \"/x\" shall render the href /pages/x, the same href a browser renders."}]
tags:
  - "groundskeeper-feedback"
  - "@graview/pages"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
priority: "high"
---

Two seams that exist and cannot be reached: PagesApp derives its routes and lets an app replace but not add one, so an onboarding, settings or import page has nowhere to live; Shell has a chat panel and no prop to hand it the app's domain responder.
