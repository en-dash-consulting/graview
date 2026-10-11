---
"@graview/core": patch
"@graview/ship": patch
"@graview/skills": patch
---

A snapshot says when it was made and what it holds, and can be read a kind at a time. A snapshot file was one JSON object, `{ nodes, edges }`: to learn how old a projection was, or whether it held any tasks, a reader parsed every record, and n-dx's face loaded a 3.3 MB snapshot whole into a memory adapter on every page load. `@graview/core/snapshot` writes and reads one format for every snapshot file: `writeSnapshot(graph, { generatedAt })` puts a header line first — `"format": 2`, `generatedAt`, records per kind, links per kind and where each kind's lines are, by line and by byte — then one record per line, each kind's together, then the links. `readSnapshotHeader(text)` reads the first line alone; `readSnapshot(text, { kinds })` parses only those kinds' lines and the links among them; `fetchSnapshot(url, { kinds })` fetches the header and then only those kinds' bytes by range, reading the whole answer from a server that serves no ranges. An old `{ nodes, edges }` file reads everywhere as format 1, and a newer format is refused by its number. `graview serve --seed`, `graview sync-seed --seed` and `graview describe --place --seed` read either.

Compatibility: ops, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged, and so is what an adapter stores. New: the snapshot file's line format (`SNAPSHOT_FORMAT`, 2), on the stored-formats surface, and `@graview/core/snapshot` (`writeSnapshot`, `readSnapshot`, `readSnapshotHeader`, `fetchSnapshot` and their types). A seed is read as either format. What Graview Cloud changes: nothing.
