---
id: "6c8f85ad-be5a-445b-bcc8-0f73530ac49b"
level: "task"
title: "The home is a gallery: the pictures large and live in a wide grid, the standing as the headline, an empty picture says what would fill it, and the reading matter moves to /map and a row of counts"
status: "pending"
priority: "high"
tags:
  - "pages"
  - "design"
acceptanceCriteria:
  - "DefaultHomePage renders, in order: a header whose h1 is the standing sentence (counts, or \"Nothing here yet.\") with the problems link or \"All rules hold\" as its lede; the gallery (`data-testid=\"gallery\"`); one row of kinds with counts (`data-testid=\"kinds\"`) and a one-line link to /map when relations exist; Recently"
  - "The home and the shell use a 1160px column; list, record, map, problems and place pages keep 760"
  - "A gallery card fills its grid cell (auto-fill, minimum 420px, one column under that), draws the lens at a scale measured from the card's own width (ResizeObserver, with a sensible server-side default), stays inert, and captions the picture with its title and how much it is over"
  - "A card over a kind with no current members carries a legend saying so and naming the first creating act the seat may take; the kind sections with descriptions and four members are gone from the home"
  - "the-map-of-kinds and the-pictures-on-pages tests are rewritten to the new shape; whose-work and parity still pass unchanged"
description: "packages/pages/src/page-home.tsx, page-places.tsx (Gallery, GalleryCard replacing PlaceCard's fixed 288px), page-typography.tsx (a `wide` column). The relation list stays exported as KindMapSection for /map and for apps that want it on a page of their own."
lastModified: "2026-09-27T06:00:50.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
