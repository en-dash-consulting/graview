import { isInlineSvg } from "@graview/core";
import { usePlayback } from "@graview/react/provider";
import type { MouseEvent, ReactNode } from "react";
import type { AppMenuRow, BarFaces, BarScheme, SchemeChoice } from "./app-bar.js";
import { useMarkup } from "./markup.js";
import { prefetchTimeline } from "./past-bar.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * WHAT THE APP'S NAME OPENS (Roadmap f-app-bar-calm): the app menu. The
 * scene and the pages stood on the row as a pill of two, a control a
 * person uses once a session given the room of three places; they are the
 * menu's first rows now, the one drawn checked. Then History, the app's
 * timeline (Roadmap f-host-opens-history). Then the host's rows —
 * Graview Cloud's App settings, Connections — and, where the host or the
 * Shell turns it on, the scheme: System, Light or Dark. Fetched with the
 * bar's panes when the menu is first reached for.
 */

/* The menu's own rules, fetched with its rows. */
const MENU_CSS = `
.graview-app-menu{width:min(280px,calc(100vw - 24px))}
.graview-app-menu-group{display:grid;margin:0;padding:0 0 4px;list-style:none}
.graview-app-menu-group+.graview-app-menu-group{padding-top:4px;border-top:1px solid var(--graview-edge)}
.graview-app-menu-choice{display:flex;gap:2px;margin:4px 8px 6px;padding:2px;border:1px solid var(--graview-edge);border-radius:8px}
.graview-app-menu-choice button{flex:1 1 0;min-height:28px;margin:0;padding:0 8px;border:0;border-radius:6px;background:none;box-shadow:none;font:inherit;font-size:.8125rem;color:var(--graview-ink-muted);cursor:pointer}
.graview-app-menu-choice button[aria-pressed=true]{background:color-mix(in srgb,var(--graview-accent) 16%,transparent);color:var(--graview-ink);font-weight:600}`;

const SCHEME_WORDS: Record<SchemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

export function AppMenuPane({ faces, rows, scheme, history = false, close }: { readonly faces?: BarFaces | undefined; readonly rows: readonly AppMenuRow[]; readonly scheme?: BarScheme | undefined; readonly history?: boolean; readonly close: () => void }) {
  const offers = scheme?.offers ?? (["system", "light", "dark"] as const);
  return (
    <>
      <style>{MENU_CSS}</style>
      {faces ? (
        <div role="group" aria-label={`${faces.scene.label} or ${faces.pages.label}`} data-testid="app-faces" className="graview-app-menu-group">
          {(["scene", "pages"] as const).map((which) => {
            const one = faces[which];
            return (
              <button
                key={which}
                type="button"
                className="graview-bar-item"
                data-testid={`app-face-${which}`}
                aria-pressed={one.current}
                {...(one.reach && !one.current ? { onPointerEnter: one.reach, onPointerDown: one.reach, onFocus: one.reach } : {})}
                onClick={() => {
                  close();
                  if (!one.current) one.go();
                }}
              >
                <span className="graview-bar-mark">{which === "scene" ? <SceneMark /> : <PagesMark />}</span>
                <span style={{ flex: "1 1 auto" }}>{one.label}</span>
                {one.current ? (
                  <span className="graview-bar-mark" aria-hidden="true">
                    <Check />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {history ? <HistoryRow close={close} /> : null}
      {rows.length > 0 ? (
        <ul aria-label="From the host" data-testid="app-menu-rows" className="graview-app-menu-group">
          {rows.map((row) => (
            <li key={row.label}>
              <Row row={row} close={close} />
            </li>
          ))}
        </ul>
      ) : null}
      {scheme ? (
        <div role="group" aria-labelledby="graview-app-menu-scheme" data-testid="app-menu-scheme" className="graview-app-menu-group">
          <p id="graview-app-menu-scheme">Appearance</p>
          <div className="graview-app-menu-choice">
            {offers.map((value) => (
              <button
                key={value}
                type="button"
                data-testid={`app-menu-scheme-${value}`}
                aria-pressed={scheme.value === value}
                onClick={() => scheme.onChoose(value)}
              >
                {SCHEME_WORDS[value]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * HISTORY, WHERE PEOPLE LOOK FOR IT (Roadmap f-host-opens-history): an
 * app's previous versions were reached only from a row of Activity ("As it
 * was"), which few found. One plain row in the app menu, wherever the face
 * keeps a playback, opens the timeline at now — its ticks, its player,
 * "Restore to here" — the one a row of Activity opens, and the keyboard goes
 * on to its scrubber as it is drawn. An app nothing has happened in yet
 * opens a timeline that says so.
 */
function HistoryRow({ close }: { readonly close: () => void }) {
  const playback = usePlayback();
  if (!playback) return null;
  return (
    <div className="graview-app-menu-group">
      <button
        type="button"
        className="graview-bar-item"
        data-testid="app-menu-history"
        onPointerEnter={prefetchTimeline}
        onFocus={prefetchTimeline}
        onClick={() => {
          close();
          playback.show(playback.live.log.length, { focus: true });
        }}
      >
        <span className="graview-bar-mark">
          <HistoryMark />
        </span>
        <span>History</span>
      </button>
    </div>
  );
}

/** One of the host's rows: a link where it has an address, else a press; its mark beside its words where it gives one. */
function Row({ row, close }: { readonly row: AppMenuRow; readonly close: () => void }) {
  const Entry = (row.href !== undefined ? "a" : "button") as "a";
  return (
    <Entry
      className="graview-bar-item"
      data-testid="app-menu-row"
      {...(row.href !== undefined ? { href: row.href, ...(row.target ? { target: row.target, rel: "noopener" } : {}) } : { type: "button" as const })}
      onClick={(_event: MouseEvent) => {
        close();
        row.onSelect?.();
      }}
    >
      <span className="graview-bar-mark">{row.icon ? <RowMark icon={row.icon} /> : null}</span>
      <span>{row.label}</span>
    </Entry>
  );
}

function RowMark({ icon }: { readonly icon: string }) {
  const markup = useMarkup(isInlineSvg(icon) ? icon : undefined);
  return markup ? <span className="graview-bar-host-mark" aria-hidden="true" dangerouslySetInnerHTML={markup} /> : <span className="graview-bar-host-mark" aria-hidden="true">{icon}</span>;
}

function Mark({ children }: { readonly children: ReactNode }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" focusable="false" style={{ flex: "0 0 auto" }}>
      {children}
    </svg>
  );
}

/** The scene's mark: a plot of the city, seen from above at an angle. */
function SceneMark() {
  return (
    <Mark>
      <path d="M7 1.5 L12.5 4.5 L7 7.5 L1.5 4.5 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M1.5 7.5 L7 10.5 L12.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </Mark>
  );
}

/** History's mark: a clock with its hand turned back. */
function HistoryMark() {
  return (
    <Mark>
      <path d="M2.25 7 a4.75 4.75 0 1 0 1.4-3.35" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1.75 2.25 V4.75 H4.25" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4.25 V7 L8.75 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Mark>
  );
}

/** The pages' mark: a page of lines. */
function PagesMark() {
  return (
    <Mark>
      <rect x="2.25" y="1.75" width="9.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 5 H9.5 M4.5 7.25 H9.5 M4.5 9.5 H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Mark>
  );
}

function Check() {
  return (
    <Mark>
      <path d="M3 7.25 L5.75 10 L11 4.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Mark>
  );
}
