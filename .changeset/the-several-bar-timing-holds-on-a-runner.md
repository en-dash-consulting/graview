---
"@graview/tools": patch
---

The several bar's timing test holds on a shared runner: 0.2.2 judges two thousand chosen tasks in about 78 ms on the reference machine, unchanged from 0.2.1. A shared CI runner slows that judging about twice as much as it slows the test's reference, so the test failed three runs in a row at 150 ms on a pull request that changed no code. It is now held to 200 ms, which still catches the old 3.4 s rehearsal seventeen times over. Nothing a host calls changes.
