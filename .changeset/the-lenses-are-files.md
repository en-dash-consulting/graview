---
"@graview/primitives": patch
---

The calendar and plan lenses are files by what they do. The calendar: its options, its date arithmetic, placing an entry and moving one, the view, the spans a range is drawn in, and the drawing. The plan: its state, its drawing and the lens that binds them. `calendar.tsx` and `plan.tsx` say what the parts are and re-export them; a comment that had drifted from the viewBox scale went back to it. Nothing exported changed.
