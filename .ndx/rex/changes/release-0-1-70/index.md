---
id: "c43d1c94-51a7-4213-b6a3-bd196815569e"
type: "change"
title: "0.1.70: A design reaches the router through @graview/pages on React Router 8; a worker view keeps values for whoever is looking, spans the whole window and draws in its app's faces; the inbox opens on what needs you; and an owner can try other ways to show a list."
slug: "release-0-1-70"
intent: "What 0.1.70 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "The router comes from `@graview/pages`. `Link`, `NavLink`, `useParams`, `useNavigate`, `useLocation`, `useSearchParams` and `MemoryRouter` are exported from `@graview/pages`, and the routed face runs on React Router 8. A product that imports them from `react-router-dom` should import them from `@graview/pages` and drop that dependency; `graview doctor` says so where it finds one."
  - "A view keeps values for whoever is looking. `graview.mine` holds small strings per viewer, and a seat may carry a profile, so several people at one screen each have their own `$me`."
  - "A view spans the window. `bleed: \"full\"` draws a view edge to edge at every width."
  - "Views as their authors expect. A view of one record reads its own kind across a relation, a press on a control already in its state passes the check, so does a dropdown a person picks from, cards keep whole in CSS columns, a brand lends its views web faces, the app's theme wins over a view's own rule, and a view that replaces a record's page may draw its own heading."
  - "The inbox opens on what needs you. The bell counts only what asks something of this person; For you is Needs you and Updates; a person can stop a kind of suggestion."
  - "Other ways to show this. An owner can flip a list or a place between a few ways to show it, drawn in its real records, and keep one; a list may open as a place (`pages.lists.<kind>.opens`)."
  - "The bar. A host takes back what it handed the bar at mount, and a person picks the scheme in the app menu by keyboard."
  - "Security and reliability fixes."
shippedIn: "0.1.70"
tags:
  - "release"
  - "0.1.70"
source: "apps/site/releases.json"
---
