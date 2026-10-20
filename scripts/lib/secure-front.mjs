/**
 * A PAGE SERVED AS A HOST SERVES IT: over HTTP/2 and TLS, in front of a
 * plain HTTP server on this machine.
 *
 * `graview serve` and `graview preview` speak HTTP/1.1, where a browser
 * opens six connections to a host and queues the rest: a page of forty
 * chunks waits on the queue, not on its work. Graview Cloud's pages come
 * from a host that speaks HTTP/2, every request on one connection at once.
 * A harness that times a page puts this in front, so what it measures is
 * the page and not the queue.
 *
 * The certificate is made for the run (`openssl`) and thrown away; the
 * browser is told to accept it (`ignoreHTTPSErrors`). An HTTP/1.1 upgrade
 * (the store's live socket) is passed through to the server behind as it
 * came.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createSecureServer } from "node:http2";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vacant } from "./serve.mjs";

/** Headers HTTP/2 forbids, which a server behind it sends over HTTP/1.1. */
const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-connection"]);

/** A certificate for localhost, made for this run. */
function certificate() {
  const dir = mkdtempSync(join(tmpdir(), "graview-front-"));
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")], { stdio: "ignore" });
    return { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Serve `https://localhost:<port>` over HTTP/2 in front of the HTTP server
 * on `behind` (a port on this machine). Resolves with its address and a way
 * to stop it.
 */
export async function secureFront(port, behind) {
  const server = createSecureServer({ ...certificate(), allowHTTP1: true });
  server.on("request", (incoming, outgoing) => {
    const headers = {};
    for (const [name, value] of Object.entries(incoming.headers)) if (!name.startsWith(":") && !HOP_BY_HOP.has(name)) headers[name] = value;
    // The server behind judges its own origin by the host it was asked for: the one the browser asked.
    headers.host = incoming.headers[":authority"] ?? incoming.headers.host ?? `localhost:${port}`;
    const forwarded = httpRequest({ host: "127.0.0.1", port: behind, path: incoming.url, method: incoming.method, headers }, (answer) => {
      const out = {};
      for (const [name, value] of Object.entries(answer.headers)) if (!HOP_BY_HOP.has(name)) out[name] = value;
      outgoing.writeHead(answer.statusCode ?? 502, out);
      answer.pipe(outgoing);
    });
    forwarded.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(forwarded);
  });
  // The live socket asks for an upgrade over HTTP/1.1: written through to the server behind, byte for byte.
  server.on("upgrade", (incoming, socket, head) => {
    const upstream = connect(behind, "127.0.0.1", () => {
      const lines = [`${incoming.method} ${incoming.url} HTTP/1.1`];
      for (let at = 0; at < incoming.rawHeaders.length; at += 2) lines.push(`${incoming.rawHeaders[at]}: ${incoming.rawHeaders[at + 1]}`);
      upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head?.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    const end = () => (socket.destroy(), upstream.destroy());
    upstream.on("error", end);
    socket.on("error", end);
  });
  await vacant(port);
  await new Promise((ready, fail) => {
    server.once("error", fail);
    server.listen(port, ready);
  });
  return {
    url: `https://localhost:${port}`,
    stop: () =>
      new Promise((done) => {
        server.close(() => done(undefined));
        // Sessions the browser still holds would keep `close` waiting.
        setTimeout(() => done(undefined), 1_000);
      }),
  };
}
