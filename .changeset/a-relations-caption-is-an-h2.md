---
"@graview/primitives": patch
---

A relation's caption is an h2. The connections panel wrote each group's caption as an `h4` for its size — which its own style sets regardless — and the only heading above it in a scene is the shell's `h1`, so axe reported `heading-order` on every screen with a relation drawn in it and a screen reader's heading list read as though two sections were missing.
