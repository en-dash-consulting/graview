---
id: "b6b3a26a-8e1b-45cc-a1a2-4bc781b4ec3b"
type: "change"
title: "F-025 · PagesApp has no slot for a page that is not about a kind"
slug: "f-025-pagesapp-has-no-slot-for-a-page"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-025. Groundskeeper's Survey Desk sat unreachable for a whole build; the workaround is the shell reading useLocation and swapping its children, which lies to the router."
acceptanceCriteria:
  - "registry.route(path, Component) renders the component inside the shell surface like any other page"
  - "A routed page appears in the derived nav when it asks to"
  - "The graview-pages skill documents it with an onboarding page as the example"
touches:
  - "63bcc889-264e-4b44-bc30-5d1e0ed7300b"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/pages"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
