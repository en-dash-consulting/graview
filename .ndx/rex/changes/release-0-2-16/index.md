---
id: "89208a92-de9d-4d23-9741-7efaba09b731"
type: "change"
title: "0.2.16: Custom pages appear at once, a Todoist project is a connection, and a view plays a YouTube or Vimeo video in place."
slug: "release-0-2-16"
intent: "What 0.2.16 shipped, recorded after the release from its entry in apps/site/releases.json. The work was tracked on Graview HQ as feature:f-todoist-connection, feature:f-archive-keeps-synced-counterpart, feature:f-firefox-page-waits-for-one-face, feature:f-pages-face-late-redraws, feature:f-see-all-count-at-slow-4, feature:f-harness-split-longest, feature:f-whole-chain-green-on-github, feature:f-opening-screen-waits-for-one-face, feature:f-custom-pages-do-not-flash, feature:f-custom-pages-first-visit, feature:f-view-video-embeds, feature:f-frame-view-autosize-short-on-desk: #706, #707, #708, #709, #712, #713, #714, #715, #716, #718, #719; batch #720."
acceptanceCriteria:
  - "**A custom page stands at once when a person goes back to it.** A view's drawing and worker are kept for a few minutes after its page is left and put back before the page paints, with typed text, scroll and focus as they were; going back took 150 ms and eight blank frames, and now takes under 40 ms and none."
  - "**A first visit comes sooner.** A view's code and what it keeps for its reader are fetched as the pointer rests on a link, a finger goes down on it or the keyboard reaches it, and the first few places are fetched when the page is idle; nothing is fetched under Save-Data."
  - "**A Todoist project is a connection.** A document's `connections` take `\"system\": \"todoist\"`: a project, or one section or label of it, kept in step with a kind both ways through a personal API token. Its first run sends nothing that was already here, unless `sendExisting` says to; a task completed there sets a field and removes nothing."
  - "**Archiving a record keeps what it is synced with.** A record set aside keeps its Todoist task, Notion page or Google Calendar event, and brought back it is the same one; only removing the record deletes it there."
  - "**A view plays a YouTube or Vimeo video in place.** `<graview-video>` names the video; the host draws a poster and a play button, and nothing reaches the provider until the reader presses play."
  - "**A frame view at its own place is as tall as it draws** at every width, where a desk cut it short, and a height past the host's limit is said as `taller-than-allowed`."
  - "**The opening screen lifts once the page is painted**, where it could lift onto a blank page early, and no longer waits for the one face's own parts."
  - "**The pages face's bell comes with its bar**, so the problem count is said at once and nothing on the bar moves as it arrives."
  - "**An e-ink screen is gray whatever machine draws it**, where Chromium on Linux smoothed its text in color."
shippedIn: "0.2.16"
source: "apps/site/releases.json"
tags:
  - "release"
  - "0.2.16"
---
