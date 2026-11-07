---
id: "8eed578e-cdaa-4724-8a61-022f34cf780c"
type: "task"
title: "The watch hears a page whose module rejected before it drew"
slug: "the-watch-hears-a-page-whose-module"
description: "Found fixing the Nightly's engines leg (#330): in WebKit the page's top-level await rejected with no pageerror, and the watch passed a blank page"
acceptanceCriteria:
  - "the watch reports a page whose app root drew nothing after load, or whose module rejected, in all three engines"
  - "a watch test fails first"
priority: "medium"
tags:
  - "engines"
source: "ndx-capture"
---
