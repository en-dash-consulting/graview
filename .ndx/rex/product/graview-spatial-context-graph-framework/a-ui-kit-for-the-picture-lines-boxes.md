---
id: "1f4d64da-0995-47a2-b123-6532f5aa5cef"
type: "capability"
title: "A UI kit for the picture: lines, boxes and marks are declared, customisable, and set up for styles nobody has asked for yet"
slug: "a-ui-kit-for-the-picture-lines-boxes"
statement: "The scene's drawn elements (connectors, strands, hit strokes, captions, card frames, district rings, the ground grid, kind tags, emphasis and flag marks) are a declared kit whose colour and visibility a brand can set per element and per edge kind, with connector route and stroke as declared strategies, and a playground lets a reader change kit values live."
criteria: [{"id":"c1","text":"The scene shall draw every element from a named kit entry whose colour and visibility a brand can set, with no colour or stroke width as a literal in scene.tsx."},{"id":"c2","text":"The scene shall take a connector's route and stroke from declared strategies, so that adding arced or right-angled routing or a dashed stroke is one case in one file with no change to the layout or the hit-testing."},{"id":"c3","text":"If a brand's connector or caption colour falls below AA contrast on the brand's ground, graview check shall report a finding."},{"id":"c4","text":"The kit shall let a brand declare colour and visibility per edge kind, and the relation key shall reflect them."},{"id":"c5","text":"The marketing page shall provide a playground in which a reader changes kit values live in an embed."}]
tags:
  - "ui-kit"
  - "theming"
  - "connectors"
  - "scene"
source: "Nick, 2026-09-12 (/ndx-capture): \"all of the line connections and boxes and whatnot should also be color or visibility customizable. should be a nice little custom ui kit built in where people can really start playing with it (no we dont need to offer dashed vs dotted connectors, but it sure as hell should be set up to offer that easily, or even set up to handle a setting like arced or right-angled lines.. that kinda forward thinking for the ui-customizations)\""
priority: "medium"
---

The scene's drawn things — connectors, strands, hit strokes, captions, card frames, district rings, the ground grid, the kind tags, emphasis and flag marks — become a declared kit rather than constants scattered through scene.tsx and theme.ts. A brand (or an app's views) can set colour and visibility per element and per edge kind, and the kit's shape is extensible on purpose: a connector's route (straight, arced, right-angled) and stroke (solid, dashed, dotted) are declared strategies with one implementation each today, so offering a second is adding a case, not reworking the scene. Everything the kit exposes is a theme token or a declaration the checker can read (a colour that fails AA on the brand's ground is a finding), and the marketing page's Depth or Lenses section gets a small playground where a reader changes them live. Not in scope: shipping every style — the point is that the second style costs one file.
