---
id: "3e3b9cc7-f449-4144-a1d3-78882d13d155"
type: "capability"
title: "graview doctor says when a product's Graview pins or React pair disagree"
slug: "graview-doctor-says-when-a-product-s"
statement: "graview doctor says when a product's Graview pins or its React and React DOM pair disagree."
criteria: [{"id":"c1","text":"When a product's @graview/* and graview pins do not match, graview doctor shall report the mismatch."},{"id":"c2","text":"When a product's formatVersion does not match the installed @graview/core, graview doctor shall report the mismatch."},{"id":"c3","text":"When a product's react and react-dom versions are a pair that will refuse to work together, graview doctor shall report it."},{"id":"c4","text":"The test helper shall compile a document and a seed from paths, so that products need no fixture copies."}]
tags:
  - "n-dx"
  - "cli"
  - "versions"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #200: graview doctor says pins, lockfile, install, document format and React's pair, each with its fix, exiting 1 on a problem; compileDocumentFiles in @graview/core/testing; the getting-started page, the graview README and the new-app skill name the npx-in-pnpm trap."
---

One release means five pins (@graview/core, pages, ship, graview, formatVersion); react 19.2.8 beside react-dom 19.3.0 gave a blank page; npx -y graview@<pinned> fails inside a pnpm workspace that already holds it.
