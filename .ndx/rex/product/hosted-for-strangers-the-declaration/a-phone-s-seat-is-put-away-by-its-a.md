---
id: "b6f1c2a4-7d3e-4e59-9a1c-164f164f1640"
type: "capability"
title: "A phone's seat is put away by its ✕, a tap or a pull down, and the keyboard goes down with it (FR-164)"
slug: "a-phone-s-seat-is-put-away-by-its-a"
statement: "On a phone, the seat's sheet is put away by its ✕, a tap on its grab line or a pull down on its top row, and the on-screen keyboard goes down with it."
criteria: [{"id":"c1","text":"The phone's seat sheet shall show a ✕, as the desk's seat does, and a tap on it shall close the sheet."},{"id":"c2","text":"When a person taps the grab line on a phone, the seat shall close the sheet."},{"id":"c3","text":"When a person pulls down on the sheet's top row past a threshold or with a flick, the seat shall close the sheet."},{"id":"c4","text":"When a person's pull down on the sheet's top row is short and slow, the seat shall settle the sheet back open."},{"id":"c5","text":"While the sheet is closed on a phone, the seat shall keep focus off every field and off <body>, so the on-screen keyboard is down."},{"id":"c6","text":"While the sheet is closed on a phone, a letter typed shall open nothing."},{"id":"c7","text":"The seat shall set the ask field's text to at least 16px, so iOS Safari does not zoom the page on focus."},{"id":"c8","text":"When the sheet is opened again after being closed, the seat shall keep the words typed and not sent, and the talk's scroll position."},{"id":"c9","text":"When an open sheet is restored after a reload, the seat shall let it be closed, with no field focused."},{"id":"c10","text":"The seat shall carry the swipe in its lazy chunk, so the hosted page's first load does not grow."}]
tags:
  - "graview-cloud"
  - "FR-164"
source: "Graview Cloud, 2026-10-11 (the framework brief after 0.1.23; Nick, on his phone)"
priority: "high"
resolution: "Shipped in the PR seat/the-phone-sheet-closes: a ✕ on the phone's sheet, a pull down on its top row (64px, or 0.5px/ms over 16px), a phone's close focuses the seat's region rather than a field, the field at max(1rem,16px), the talk's scroll kept for reopening; an open sheet is still restored on reload, now closable. Held by scripts/verify-phone-seat.mjs."
---

Nick, on his phone after 0.1.23: the bar at the top of the seat's sheet 'suggests it can be swiped down or tapped to minimize. Neither does anything, and there is no close button.' The grab was a 64x28 button closing on click only, with no pointer or touch handler; the ✕ and ⇄ were drawn on a desk only; the field was 0.9375rem, so iOS zoomed on focus; close() put the keyboard back in the ask field, so on a phone the on-screen keyboard stayed up and the next change opened the sheet again; and open was restored from sessionStorage on reload. Verified in Playwright's iPhone 13 (WebKit) and Pixel 7 (Chromium) emulation on both faces: the tap reached the grab and closed the sheet, focus went back to the field, and the next letter typed reopened it.
