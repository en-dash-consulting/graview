---
id: "dc69faec-95ba-415f-a93f-04fd2c93753e"
type: "change"
title: "The four record times cost an agent's read surfaces as little as they can"
slug: "f-touched-size-on-agent-read-surfaces"
intent: "From HQ feature:f-touched-size-on-agent-read-surfaces (left from 0.2.10): the four add about 155 characters per record to a host's find page. On agent read surfaces (describeRecord, a find page, aiContextOf) say them once compactly, e.g. one changed line with a relative time and the person, or only on request, without dropping them from get_node."
acceptanceCriteria:
  - "A 50-record find page grows by under 40 characters a record against 0.2.9 (test)"
  - "get_node's shape still carries all four (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-touched-size-on-agent-read-surfaces"
source: "Graview HQ feature:f-touched-size-on-agent-read-surfaces"
---
