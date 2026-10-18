---
id: "b70ed5cf-5c2b-4f84-8567-71c741c0eab6"
level: "task"
title: "0.1.36 · A view with pictures: true gets each image field's src"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "triaged: which layer drops src (the framework's guest/worker view host, or a host seam Cloud does not fill), written on the request"
  - "a view with pictures: true reading a record whose image field holds { href: /graview/files/…, name, type, bytes } receives src and draws it, with a test that fails on 0.1.35"
  - "if a host must hand something, the framework says so in place (refusal or console line) rather than silently dropping src, and the Cloud half is a Roadmap feature"
description: "Roadmap request:pictures-true-never-delivers-src-views-get-image-fields-without-the-picture. A view with pictures: true gets each image field as { name, type, bytes }; src never arrives in propose_view runs or the live page, though the authoring guide says it arrives once it has come."
lastModified: "2026-10-18T18:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
