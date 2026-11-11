---
id: "d1e571d5-bf7c-4018-8e48-59de38bd822a"
type: "change"
title: "Any place drawn for an e-ink screen: grayscale, motionless, touch-only, at a fixed viewport"
slug: "f-eink-display-profile"
intent: "Cloud, 2026-11-11 (accepted by Nick): a render mode any place can be drawn in for a grayscale (16 levels), high-contrast, motionless, hover-free, finger-sized screen at a fixed viewport given as a parameter (Kindle PW3 portrait 758x1024), with type read at arm's length. Automatic for every app; a view may opt into its own variant later. Builds on the static page render (renderPlace) and the drawn-and-settled signal. Cloud then builds the PNG endpoint, the tap endpoint and paired device tokens on it."
acceptanceCriteria:
  - "A place rendered with the e-ink profile at a viewport uses only the 16 gray levels of the profile's ramp, no transition, animation or hover rule, and no script (test over todo, rota and seedbed)"
  - "Every app draws on the profile with no markup of its own: the home, a list and a record page of todo, rota and seedbed each fit the viewport without scrolling (test)"
  - "Content past the viewport goes onto fixed pages rather than being cut or scrolled, and the render says which page of how many it is (test)"
  - "Every pressable region is at least 64 px on each side at the PW3 viewport (test)"
  - "The rendered page fetches nothing and is settled when written: a real browser at 758x1024 shows the same picture with and without waiting (harness)"
touches:
  - "dd8e4788-2c4f-435c-91d6-b7c2c32ab5df"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "render"
  - "hq:feature:f-eink-display-profile"
source: "Graview HQ feature:f-eink-display-profile"
---
