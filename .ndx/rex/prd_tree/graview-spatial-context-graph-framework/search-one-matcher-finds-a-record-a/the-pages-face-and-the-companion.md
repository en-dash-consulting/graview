---
id: "259a47ac-17f1-4dcf-8958-f4e323222f99"
level: "task"
title: "The pages face and the companion: /search, the nav box, list pages on the shared matcher, search-to-create, the conversation's fallback"
status: "completed"
priority: "medium"
blockedBy:
  - "f3a98697-b72a-46a5-adc3-724848221708"
startedAt: "2026-09-28T22:03:22.811Z"
completedAt: "2026-09-28T22:03:23.292Z"
endedAt: "2026-09-28T22:03:23.292Z"
resolutionType: "code-change"
resolutionDetail: "pages/page-search.tsx: DefaultSearchPage at /search (hits grouped by kind, heading → /<plural>?q=, why lines, kind/place/rule hits, honest empty state via describeSearched), beginningsFor + SearchToCreate ('A <kind> called “words”', act title on the button, DerivedForm initial = editable prefill). PageFind in the derived shell's nav (narrows a list via ?q= replace, else /search; exported with narrowsLists for app shells — Things' rail uses it with false). List page: shared matcher incl. q conditions and is:any, WhyLine per row, empty state says what was searched and prefills the beginnings; ArrangeBar query off under the derived shell. registry warns on route('/search'). tools: ChatReply.picks + ChatContext.principal; graphResponder answers a no-act/no-fact message with search hits (not grounded); chat draws picks as presses. Activity rail draws a read call's reads. Todo's tidy seat searches before it repairs. Harnesses: verify-pages theWordsFindItOnAPage, verify-chat noActAndNoFactAnswersWithWhatTheWordsFind, verify-seat 'finds what it changes with search_graph, and the rail shows what it read' (18/18). Tests: pages the-words-find-it-on-a-page, tools conversation fallback."
acceptanceCriteria:
  - "/search?q= lists hits grouped by kind with why; each kind heading links to its list with ?q= carried; the nav box narrows on a list page and goes to /search elsewhere"
  - "The list pages use the shared matcher and show why; the empty state says what was searched and offers the creating acts the seat may run with the label prefilled"
  - "A conversation message matching no act and no fact answers with hits as picks"
  - "verify-pages holds the route landing cold; verify-chat holds the fallback; verify-seat holds search_graph's reads"
description: "/search?q= lists hits grouped by kind, each a link to its record, each heading a link to the kind's list with ?q= carried; the nav carries the box, typing on a list narrows it and elsewhere goes to /search. List pages use the shared matcher and show why. Empty states say what was searched (current only unless is:any) and offer the creating acts the seat may run with the label prefilled. A conversation message matching no act and no fact answers with hits as picks. Harness claims in verify-pages and verify-chat; verify-seat holds search_graph's reads."
lastModified: "2026-09-28T22:03:23.360Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
