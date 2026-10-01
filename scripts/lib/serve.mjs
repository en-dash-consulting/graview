/**
 * The app a harness drives, whether or not somebody already has it open.
 *
 * Every harness span its own `vite` and waited for the port number to
 * appear on stdout. That works exactly once: with a dev server already
 * holding 5193 — which is how anyone actually working on the app leaves it —
 * the second vite picks 5194 instead, the readiness match never fires, and
 * the harness dies with "vite did not start" sixty seconds later. A harness
 * you cannot run while the app is open is a harness nobody runs.
 *
 * So: ask the port first. If something is already answering there, drive
 * that and leave it alone afterwards. Otherwise start one and own it.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const answers = async (port) => {
  try {
    // A dev server answers; a closed port refuses the connection.
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2_000) });
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {string} app  directory under `apps/`
 * @param {number} port the port that app's vite config claims
 * @param {string} repoRoot
 * @returns {Promise<{ url: string, borrowed: boolean, stop: () => void }>}
 */
export async function serving(app, port, repoRoot) {
  const url = `http://localhost:${port}`;
  if (await answers(port)) {
    /*
     * BORROW ONLY THIS CHECKOUT'S SERVER. A second checkout — a worktree an
     * agent works in — can hold the same port, and a harness that borrowed
     * it judged that checkout's code and reported it as this one's. A vite
     * server answers `/@fs/` only for files in its own workspace, so asking
     * it for this app's page by absolute path says whose it is.
     */
    const ours = await fetch(`${url}/@fs${resolve(repoRoot, "apps", app, "index.html")}`, { signal: AbortSignal.timeout(2_000) })
      .then((response) => response.ok)
      .catch(() => false);
    if (!ours) throw new Error(`port ${port} is held by a server that is not this checkout's ${app} — stop it, or run from that checkout`);
    return { url, borrowed: true, stop: () => {} };
  }

  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, `apps/${app}`),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  };
  await new Promise((ready, fail) => {
    const timer = setTimeout(() => {
      stop();
      fail(new Error(`vite for ${app} did not start on ${port}`));
    }, 60_000);
    const settle = () => {
      clearTimeout(timer);
      ready(undefined);
    };
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(port))) settle();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite for ${app} exited with ${code}`));
    });
  });
  return { url, borrowed: false, stop };
}
