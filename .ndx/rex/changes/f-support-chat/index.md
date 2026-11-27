---
id: "2ec785c8-181d-4941-a119-45942e36c5e7"
type: "change"
title: "A person chats with the host's staff from inside any app, each message carrying where they were"
slug: "f-support-chat"
intent: "From HQ feature:f-support-chat (Nick, 2026-11-26): start a chat with the host's maintainers or support from any app, also usable for free or paid help building an app; it builds on f-chat-rooms. The framework's half is a host seam: PagesApp and mount take support { title, transport }, the person's menu offers 'Chat with <title>' and opens an async-first panel, and each message carries the app, place, record, role, recent friction and version. The thread is never in the app's graph. memorySupport keeps one in the page for tests and development. The staff inbox, delivery and build-help pricing are Graview Cloud's."
acceptanceCriteria:
  - "Without support nothing shows; with it the person's menu offers 'Chat with <title>' on the routed face, the one face and an embed's bar (harness, unit test)"
  - "A message sent from the panel carries the app, the place, the record, the person and their roles, the recent friction and the framework's version (harness supportSendsWithContextAndShowsAReply)"
  - "A reply from the transport shows in the panel, and one that arrives while it is shut waits on the bell (harness)"
  - "The panel says replies come later, works at phone width, opens and closes from the keyboard, and gives the keyboard back where it came from (harness supportSendsWithContextAndShowsAReplyOnAPhone)"
  - "memorySupport keeps a thread for tests and development, and pnpm dev in the example offers it"
priority: "high"
tags:
  - "rooms"
  - "hq:feature:f-support-chat"
source: "Graview HQ feature:f-support-chat"
---
