---
id: "b611b1c7-5ebf-4816-ada6-2d7c18463c29"
type: "change"
title: "A custom view sits beside the record's editable fields (FR-149)"
slug: "a-custom-view-sits-beside-the-record-s"
intent: "A cardinality-one view attached to a deliverable replaced the record page, so the record became read-only in practice."
acceptanceCriteria:
  - "A view attached to a kind no longer replaces the record page: the fields stay editable below it or behind an Edit control"
  - "Replacement only with an explicit manifest option (replaces: page), off by default"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-149"
  - "bug"
  - "views"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
resolution: "Shipped in #157, merged through #162 (0.1.18): a worker view of one record is drawn above the record's own editable fields unless its manifest says replaces: \"page\"."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A record page's blocks get a page's budget by default" (da9b5d63-6fa2-4227-a67e-d717b04c27f3).
