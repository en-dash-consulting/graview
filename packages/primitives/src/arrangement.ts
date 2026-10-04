import { formatArrangement, parseArrangement, type Arrangement } from "@graview/core";
import { withWithin, type ViewState } from "@graview/layout/view";

/*
 * THE STOP CARRIES IT. A lens reads its arrangement out of `view.within`
 * and writes the next one back with these; `in.sort`, `in.filter`,
 * `in.group` and `in.q` are the fragment's spelling of the same words a
 * page puts in its search.
 */

export function arrangementOf(view: ViewState): Arrangement {
  const within = view.within ?? {};
  return parseArrangement({
    ...(within["sort"] ? { sort: within["sort"] } : {}),
    ...(within["filter"] ? { filter: within["filter"] } : {}),
    ...(within["group"] ? { group: within["group"] } : {}),
    ...(within["q"] ? { q: within["q"] } : {}),
  });
}

export function withArrangement(view: ViewState, arrangement: Arrangement): ViewState {
  const words = formatArrangement(arrangement);
  let next = view;
  for (const key of ["sort", "filter", "group", "q"] as const) next = withWithin(next, key, words[key] ?? null);
  return next;
}
