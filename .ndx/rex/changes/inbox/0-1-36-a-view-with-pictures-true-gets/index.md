---
id: "b70ed5cf-5c2b-4f84-8567-71c741c0eab6"
type: "change"
title: "0.1.36 · A view with pictures: true gets each image field's src"
slug: "0-1-36-a-view-with-pictures-true-gets"
intent: "Roadmap request:pictures-true-never-delivers-src-views-get-image-fields-without-the-picture. A view with pictures: true gets each image field as { name, type, bytes }; src never arrives in propose_view runs or the live page, though the authoring guide says it arrives once it has come."
acceptanceCriteria:
  - "triaged: which layer drops src (the framework's guest/worker view host, or a host seam Cloud does not fill), written on the request"
  - "a view with pictures: true reading a record whose image field holds { href: /graview/files/…, name, type, bytes } receives src and draws it, with a test that fails on 0.1.35"
  - "if a host must hand something, the framework says so in place (refusal or console line) rather than silently dropping src, and the Cloud half is a Roadmap feature"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
resolution: "Framework half on fix/views-draw-their-pictures: a host says where a record's files are (file on the view's definition), a picture not loaded says what the host answered and names file, a headless run hands a stand-in src. Cloud half: pass file: (href) => base + href."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A guest view is handed the pictures it may show, behind their own door (FR-162)" (4d7c1b2e-9a63-4f0e-b1d8-62c5e0f3a917).
