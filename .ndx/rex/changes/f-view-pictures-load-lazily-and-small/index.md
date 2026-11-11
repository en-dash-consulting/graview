---
id: "ec2eb443-3629-404d-888a-cde1c1ba8906"
type: "change"
title: "A view's pictures load lazily and at the size each use needs"
slug: "f-view-pictures-load-lazily-and-small"
intent: "From building a home worker view that draws about 60 record photos: every <img> loaded at once (loading was refused), and each photo came at the hero's width even where it is drawn as a chip. The framework half: an <img> takes loading and fetchpriority, and a manifest asks for a second, smaller size (pictures.thumb) handed beside src, both counted against the view's picture budget, for worker views and frames alike. Cacheable picture URLs are Cloud's; nothing in the framework stops a host from serving its files at stable addresses."
acceptanceCriteria:
  - "An <img> takes loading \"lazy\" or \"eager\" and fetchpriority \"high\", \"low\" or \"auto\"; any other value is refused, saying the ones it takes (test)"
  - "pictures.thumb, a whole number of pixels from 16 to 4096 narrower than width, passes the check; anything else is refused ending with (view-pictures-thumb) (test)"
  - "Each picture handed an address comes with thumb beside src, made at the thumb's width, on the page and in a headless run (test)"
  - "Both sizes are reckoned against the view's budget, and a picture no wider than the thumb is reckoned once (test)"
  - "pictures.records and pictures.most keep working beside thumb (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "pictures"
  - "hq:feature:f-view-pictures-load-lazily-and-small"
source: "Graview HQ feature:f-view-pictures-load-lazily-and-small"
---
