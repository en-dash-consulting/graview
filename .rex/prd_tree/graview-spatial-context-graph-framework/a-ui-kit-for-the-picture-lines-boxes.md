---
id: "1f4d64da-0995-47a2-b123-6532f5aa5cef"
level: "feature"
title: "A UI kit for the picture: lines, boxes and marks are declared, customisable, and set up for styles nobody has asked for yet"
status: "pending"
priority: "medium"
tags:
  - "ui-kit"
  - "theming"
  - "connectors"
  - "scene"
blockedBy:
  - "b04b600e-401f-49a1-97a0-a8539408dd70"
source: "Nick, 2026-09-12 (/ndx-capture): \"all of the line connections and boxes and whatnot should also be color or visibility customizable. should be a nice little custom ui kit built in where people can really start playing with it (no we dont need to offer dashed vs dotted connectors, but it sure as hell should be set up to offer that easily, or even set up to handle a setting like arced or right-angled lines.. that kinda forward thinking for the ui-customizations)\""
acceptanceCriteria:
  - "every drawn element of the scene has a named kit entry with colour and visibility a brand can set, and no colour or stroke width is a literal in scene.tsx"
  - "connector route and stroke are declared strategies; adding arced or right-angled routing, or a dashed stroke, is one case in one file with no change to the layout or the hit-testing"
  - "a brand's kit choices are checked: a connector or caption colour below AA on the brand's ground is a graview check finding"
  - "per-edge-kind colour and visibility are declarable, and the relation key reflects them"
  - "a playground on the page lets a reader change kit values live in an embed"
description: "The scene's drawn things — connectors, strands, hit strokes, captions, card frames, district rings, the ground grid, the kind tags, emphasis and flag marks — become a declared kit rather than constants scattered through scene.tsx and theme.ts. A brand (or an app's views) can set colour and visibility per element and per edge kind, and the kit's shape is extensible on purpose: a connector's route (straight, arced, right-angled) and stroke (solid, dashed, dotted) are declared strategies with one implementation each today, so offering a second is adding a case, not reworking the scene. Everything the kit exposes is a theme token or a declaration the checker can read (a colour that fails AA on the brand's ground is a finding), and the marketing page's Depth or Lenses section gets a small playground where a reader changes them live. Not in scope: shipping every style — the point is that the second style costs one file."
lastModified: "2026-09-12T15:02:05.296Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
