---
id: "6b5394c2-c7a2-447a-85b0-95ae911d79c3"
type: "change"
title: "A bare app looks designed by default"
slug: "f-better-bare-app-defaults"
intent: "Cloud, 2026-11-11, from building Thanksgiving from a chat: a datetime row reads 'At: Nov 26, 2026, 9:30 AM EST' with a label until a custom row view uses {at|time}; the glance alone doesn't change the rows on the home; the masthead repeats the description under the headline; pumpkin #b4532a is refused as an accent for sharing the warning hue. Fix the defaults, and keep warnings told by icon and words, not hue alone."
acceptanceCriteria:
  - "A derived row whose kind's date is a datetime leads with the time as people say it, with no field label, and names the zone only when the reader is not in the app's zone (test)"
  - "A kind's declared glance shapes its rows on the home as it does on its list (test)"
  - "The masthead says the app's description once (test)"
  - "An accent near the warning hue is taken when its contrast holds, and every warning carries an icon and words so it is not told by hue alone (test, brand harness)"
touches:
  - "369257a0-22a8-471f-85dd-eee0e8bfcf78"
  - "1dd2559a-2f18-4b2b-827c-3ce8f07d5807"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "core"
  - "hq:feature:f-better-bare-app-defaults"
source: "Graview HQ feature:f-better-bare-app-defaults"
---
