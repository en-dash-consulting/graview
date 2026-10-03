/** The stylesheet the blocks are drawn with: classes over the theme's tokens, and nothing a spec can reach. */
export const SPEC_VIEW_CSS = `
.graview-spec { display: flex; flex-direction: column; gap: 6px; min-width: 0; color: var(--graview-ink); }
.graview-spec-row { flex-direction: row; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; box-sizing: border-box; max-width: 100%; padding: 3px 10px; border: 1px solid var(--graview-edge); border-radius: 999px; background: var(--graview-panel); font-size: 0.875rem; }
.graview-spec-row[data-selected] { border-color: var(--graview-accent); }
.graview-spec-row > * { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.graview-spec-page { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--graview-edge); }
.graview-spec-title { font-family: var(--graview-font-display, inherit); font-weight: 600; font-size: 1rem; line-height: 1.3; overflow-wrap: anywhere; }
.graview-spec-text { margin: 0; font-size: 0.875rem; line-height: 1.45; overflow-wrap: anywhere; }
.graview-spec-text[data-graview-tone] { color: var(--graview-spec-tone); }
.graview-spec-badge { align-self: flex-start; display: inline-block; max-width: 100%; box-sizing: border-box; padding: 1px 8px; border: 1px solid currentColor; border-radius: 999px; background: var(--graview-panel); color: var(--graview-spec-tone, var(--graview-ink-muted)); font-size: 0.8125rem; font-weight: 600; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.graview-spec-row .graview-spec-badge, .graview-spec-group[data-direction="row"] .graview-spec-badge { align-self: center; }
.graview-spec [data-graview-tone="good"] { --graview-spec-tone: var(--graview-good); }
.graview-spec [data-graview-tone="bad"] { --graview-spec-tone: var(--graview-bad); }
.graview-spec [data-graview-tone="warn"] { --graview-spec-tone: var(--graview-warn); }
.graview-spec [data-graview-tone="accent"] { --graview-spec-tone: var(--graview-accent); }
.graview-spec [data-graview-tone="neutral"] { --graview-spec-tone: var(--graview-ink-muted); }
.graview-spec-field { display: flex; flex-wrap: wrap; gap: 2px 8px; align-items: baseline; min-width: 0; font-size: 0.875rem; line-height: 1.4; }
.graview-spec-label { color: var(--graview-ink-muted); }
.graview-spec-value { min-width: 0; color: var(--graview-ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.graview-spec-link { position: relative; z-index: 1; color: var(--graview-accent); text-decoration: underline; }
.graview-spec-progress { display: grid; gap: 4px; font-size: 0.8125rem; }
.graview-spec-track { display: block; height: 6px; border-radius: 999px; background: var(--graview-edge); overflow: hidden; }
.graview-spec-fill { display: block; height: 100%; background: var(--graview-accent); }
.graview-spec-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.graview-spec-group[data-direction="row"] { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.graview-spec-row .graview-spec-group { flex-wrap: nowrap; }
.graview-spec-divider { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid var(--graview-edge); }
.graview-spec-figure { display: inline-flex; width: 22px; height: 22px; }
`;
