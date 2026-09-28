---
"@graview/react": patch
---

A relation over the neighbourhood is captioned once. Captions were runs of consecutive nodes in a frame sorted by id, so an artist featured on some songs and producing others got "the songs they are featured on" twice, keyed alike — and the duplicate keys left the old stop's captions on top of the next picture after travelling. Captions now group by relation and end whatever the order, sit over the first row the relation occupies, share gutters with their neighbours rather than overlapping them, and stay out from under the rails (`railInset` moves to its own module).
