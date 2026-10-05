/**
 * HOW A CHAT FRAMES A WIDGET, reproduced on loopback (FR-68–FR-71).
 *
 * Graview Cloud's spike "Remote DOM in a worker inside ChatGPT and Claude
 * widgets" (graview-cloud docs/spikes/remote-dom-in-widgets.md, run
 * 2026-10-04) read each host's live policy and framing; these are its
 * `claude` and `chatgpt` variants, copied here so the framework's harness
 * does not depend on Cloud's repository. Each is a sandbox proxy page on
 * the sandbox's origin (its response header, `proxyCsp`, and for ChatGPT a
 * `<meta>` policy too) that draws the widget in an inner frame: by
 * `srcdoc`, inheriting the proxy's policy, or by `document.write` into an
 * about:blank frame, which inherits it the same way.
 *
 * Two local substitutions, as in the spike: `frame-ancestors` names the
 * harness's host rather than claude.ai or chatgpt.com, and
 * `upgrade-insecure-requests` / `block-all-mixed-content` are dropped,
 * because the harness is plain http on loopback (they only ever tighten a
 * policy). What matters for a worker guest:
 *
 *   Claude   worker-src 'self' blob:   the view frame is opaque, so a module blob: worker is refused in Chromium
 *   ChatGPT  worker-src blob:          the view frame shares the sandbox's origin with every widget of the connector
 */

/**
 * Claude (claude.ai web and Desktop): the response header of
 * https://<hash>.claudemcpcontent.com/mcp_apps, read with curl on
 * 2026-10-04. The view is a srcdoc frame with sandbox="allow-scripts
 * allow-forms" (no allow-same-origin: an opaque origin) and no policy of
 * its own, so it runs under this header.
 */
const CLAUDE_OBSERVED =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; font-src 'self' data:; media-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'self' blob: data:; base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://claude.ai https://preview.claude.ai app://localhost; form-action 'self'; webrtc 'block'; upgrade-insecure-requests; block-all-mixed-content";

/**
 * ChatGPT: the policy https://web-sandbox.oaiusercontent.com/assets/apply-csp-*.js
 * builds for a widget declaring no domains (read 2026-10-04): a <meta> in the
 * sandbox document, inherited by the about:blank view frame it writes into.
 * The host always adds its own defaults to script-src and connect-src (34
 * Azure storage accounts are elided to one, as in the spike).
 */
const OAI_DEFAULTS = [
  "https://cdn.jsdelivr.net",
  "https://cdn.tailwindcss.com",
  "https://esm.sh",
  "https://unpkg.com",
  "https://pypi.org",
  "https://files.pythonhosted.org",
  "https://*.oaiusercontent.com",
  "https://oaisdmntpreastus.blob.core.windows.net",
  "https://threejs.org",
].join(" ");
const CHATGPT_META = [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' 'unsafe-eval' blob: ${OAI_DEFAULTS}`,
  "worker-src blob:",
  `style-src 'self' 'unsafe-inline' ${OAI_DEFAULTS}`,
  `style-src-elem 'self' 'unsafe-inline' ${OAI_DEFAULTS}`,
  "style-src-attr 'unsafe-inline'",
  `img-src 'self' data: ${OAI_DEFAULTS}`,
  `font-src 'self' ${OAI_DEFAULTS}`,
  `connect-src 'self' ${OAI_DEFAULTS}`,
  `media-src 'self' ${OAI_DEFAULTS}`,
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");
/** The response header of the ChatGPT sandbox document itself (curl, 2026-10-04). */
const CHATGPT_SANDBOX_HEADER =
  "frame-ancestors 'self' https://chatgpt.com; frame-src 'self' https: data: blob:; sandbox allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms";

/** A host's policy, servable from the local harness (see the header comment). */
export function localize(csp, hostOrigin) {
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive && directive !== "upgrade-insecure-requests" && directive !== "block-all-mixed-content")
    .map((directive) => (directive.startsWith("frame-ancestors") ? `frame-ancestors 'self' ${hostOrigin}` : directive))
    .join("; ");
}

export const POLICIES = {
  claude: {
    label: "Claude (claudemcpcontent.com /mcp_apps header, observed 2026-10-04)",
    proxyCsp: CLAUDE_OBSERVED,
    proxyMetaCsp: null,
    innerSandbox: "allow-scripts allow-forms",
    render: "srcdoc",
  },
  chatgpt: {
    label: "ChatGPT (web-sandbox.oaiusercontent.com apply-csp, observed 2026-10-04)",
    proxyCsp: CHATGPT_SANDBOX_HEADER,
    proxyMetaCsp: CHATGPT_META,
    innerSandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms",
    render: "write",
  },
};

/**
 * The sandbox proxy page for a policy: it draws `widgetHtml` in the inner
 * frame the way that host does. Served with `localize(policy.proxyCsp)` as
 * its content-security-policy header.
 */
export function proxyPage(policy, widgetHtml, hostOrigin) {
  const meta = policy.proxyMetaCsp ? `<meta http-equiv="Content-Security-Policy" content="${localize(policy.proxyMetaCsp, hostOrigin)}">` : "";
  return `<!doctype html><html><head><meta charset="utf-8">${meta}<title>Sandbox proxy</title><style>html,body{margin:0;height:100%}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><script>
const html = ${JSON.stringify(widgetHtml).replace(/<\/script/gi, "<\\/script")};
const inner = document.createElement("iframe");
inner.id = "view";
inner.title = "Widget";
inner.setAttribute("sandbox", ${JSON.stringify(policy.innerSandbox)});
if (${JSON.stringify(policy.render)} === "srcdoc") {
  inner.srcdoc = html;
  document.body.appendChild(inner);
} else {
  document.body.appendChild(inner);
  const d = inner.contentDocument;
  d.open();
  d.write(html);
  d.close();
}
</script></body></html>`;
}
