---
id: "1612641e-295e-4f0b-ab74-3c011d2e0dee"
type: "area"
title: "Hosted for strangers: the declaration as a document, a live wire, and the seams a host of many apps needs"
slug: "hosted-for-strangers-the-declaration"
summary: "Graview Cloud (../graview-cloud) is a host of many apps for people who are not us: they make apps from a ChatGPT or Claude conversation, from templates, and share them by URL to work on together, live, with their agents. Reading the framework for it found what one deployment would also want and the framework does not yet have. THE DECLARATION IS CODE: defineApp is a TypeScript module, every host path import()s it, and serveStore re-runs mutation.apply and invariant.evaluate on the server, so a host of strangers' apps would run strangers' code beside other strangers' data. The studio already holds a declaration as a JSON graph and writes act bodies from data; it cannot judge a rule. THE WIRE POLLS: openRemote polls /graview/since every 800 ms; there is no push, no rebase of pending optimistic calls, and concurrent patches are last-writer-wins. THE SEAT IS A HEADER: the default seatOf trusts x-graview-seat and labels every remote caller human, so an agent reaching a served store over graview mcp --remote-url is logged as a person. THE WIRE IS NODE: serveStore is node:http only and MCP is stdio only. POSITION: each item below is a public seam a self-hoster wants too; Cloud carries interim implementations on public APIs (marked INTERIM(FR-xx) there) and deletes them as these land. Out of scope here, and staying in Cloud: tenancy, accounts, OAuth servers, billing, quotas, the multi-app connector. Related and already tracked: 'What a seat may not see never leaves the store' (d6f8b50f), which Cloud needs at critical priority."
tags:
  - "graview-cloud"
source: "Nick, 2026-10-02: \"anything you find that should be factored into the graview framework, go ahead and capture those in the graview repo\" — from the Graview Cloud refinement, ../graview-cloud/docs/framework-requirements.md"
priority: "high"
---
