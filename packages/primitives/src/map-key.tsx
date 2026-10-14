import { useGraview } from "@graview/react/provider";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * WHAT THE MAP'S MARKS MEAN, from altitude, at the head of the Key's pane:
 * each block is a record, in a row by where it stands, and every mark one
 * wears is said here in words. Fetched when the Key is first opened over
 * the map, with its own rules (FR-57).
 */
const MARKS: readonly [string, string][] = [
  ["waiting", "Waiting"],
  ["active", "Under way: darker and taller"],
  ["done", "Done: flat and pale"],
  ["flagged", "A problem, or past its due date"],
  ["recent", "Changed since you were last here"],
  ["own", "Yours"],
];

const css = (light: boolean) => {
  const ink = (share: number) => `color-mix(in oklab,var(--graview-ink) ${share}%,var(--graview-panel))`;
  return `.graview-map-key{display:grid;gap:4px;padding:2px 4px 8px;margin-bottom:6px;border-bottom:1px solid var(--graview-edge);font-size:.8125rem;color:var(--graview-ink-muted)}
.graview-map-key>div{display:flex;align-items:center;gap:8px}
.graview-map-key>div:first-child{color:var(--graview-ink)}
.graview-map-key i{flex:none;width:14px;height:10px;border-radius:2px;background:${ink(light ? 34 : 42)}}
.graview-map-key i[data-graview-mark=active]{height:14px;background:${ink(70)}}
.graview-map-key i[data-graview-mark=done]{height:4px;background:${ink(light ? 13 : 18)}}
.graview-map-key i[data-graview-mark=flagged]{background:var(--graview-warn)}
.graview-map-key i[data-graview-mark=recent]{box-shadow:0 0 3px 1px color-mix(in oklab,var(--graview-accent) 70%,transparent)}
.graview-map-key i[data-graview-mark=own]{outline:1.4px solid var(--graview-ink)}
.graview-map-key i[data-graview-mark=more]{width:auto;height:auto;background:none;font-size:.6875rem;font-style:normal}`;
};

export function MapKey() {
  const { scheme } = useGraview();
  return (
    <div className="graview-map-key" data-testid="map-key">
      <style>{css(scheme === "light")}</style>
      <div>The map: a block is a record, in a row by its status</div>
      {MARKS.map(([mark, words]) => (
        <div key={mark}>
          <i data-graview-mark={mark} aria-hidden="true" />
          {words}
        </div>
      ))}
      <div>
        <i data-graview-mark="more" aria-hidden="true">
          +3
        </i>
        More in that row than its plot holds
      </div>
    </div>
  );
}
